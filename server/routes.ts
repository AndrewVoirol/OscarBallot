import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBallotSchema, type User } from "@shared/schema";
import { setupAuth, requireAuth } from "./auth";
import { updateNomineeWithTMDBData } from "./tmdb";
import rateLimit from 'express-rate-limit';
import { eq } from "drizzle-orm";
import { OscarSyncService } from "./services/oscarSync";
import { seed } from "./seed";

// Extend Express Request type to include our User type
declare module "express" {
  interface Request {
    user?: User;
  }
}

export function registerRoutes(app: Express): Server {
  // Rate limiter for TMDB endpoints
  const tmdbLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: "Too many requests to update TMDB data, please try again later"
  });

  // Public routes for accessing nominee data
  app.get("/api/nominees", async (req, res) => {
    const year = parseInt(req.query.year as string) || 2025;
    const nominees = await storage.getNominees(year);
    res.json(nominees);
  });

  app.get("/api/nominees/category/:category", async (req, res) => {
    const year = parseInt(req.query.year as string) || 2025;
    const nominees = await storage.getNomineesByCategory(req.params.category, year);
    res.json(nominees);
  });

  app.get("/api/nominees/:id", async (req, res) => {
    const nominee = await storage.getNominee(parseInt(req.params.id));
    if (!nominee) {
      res.status(404).json({ message: "Nominee not found" });
      return;
    }
    res.json(nominee);
  });

  // Public endpoint to update TMDB data for all nominees
  app.post("/api/nominees/update-tmdb", tmdbLimiter, async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      console.log('Starting TMDB update for all nominees:', nominees.map(n => n.name).join(', '));

      const updates = await Promise.all(
        nominees.map(nominee => updateNomineeWithTMDBData(nominee))
      );

      const updatedCount = updates.filter(Boolean).length;
      console.log(`Successfully updated ${updatedCount} out of ${nominees.length} nominees`);

      res.json({ 
        message: `Updated ${updatedCount} out of ${nominees.length} nominees with TMDB data`,
        updatedNominees: updates.filter(Boolean)
      });
    } catch (error: any) {
      console.error('Error updating nominees with TMDB data:', error);
      res.status(500).json({ message: "Failed to update nominees with TMDB data" });
    }
  });

  // Public endpoint to update single nominee TMDB data
  app.post("/api/nominees/:id/update-tmdb", tmdbLimiter, async (req, res) => {
    const nominee = await storage.getNominee(parseInt(req.params.id));
    if (!nominee) {
      res.status(404).json({ message: "Nominee not found" });
      return;
    }

    const updatedNominee = await updateNomineeWithTMDBData(nominee);
    if (!updatedNominee) {
      res.status(500).json({ message: "Failed to update TMDB data" });
      return;
    }

    res.json(updatedNominee);
  });

  // Setup auth routes
  setupAuth(app);

  // Protected routes for ballot operations
  app.get("/api/ballots/:nomineeId", requireAuth, async (req: Request, res) => {
    const user = req.user as User;
    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const ballot = await storage.getBallot(
      parseInt(req.params.nomineeId),
      user.id
    );

    if (!ballot) {
      res.json({
        nomineeId: parseInt(req.params.nomineeId),
        userId: user.id,
        ceremonyId: 96, // Default to 96th Academy Awards
        hasWatched: false,
        predictedWinner: false,
        wantToWin: false
      });
      return;
    }
    res.json(ballot);
  });

  app.post("/api/ballots", requireAuth, async (req: Request, res) => {
    const user = req.user as User;
    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = insertBallotSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ 
        message: "Invalid ballot data",
        errors: result.error.errors 
      });
      return;
    }

    const ballot = await storage.updateBallot({
      ...result.data,
      userId: user.id
    });
    res.json(ballot);
  });

  app.get("/api/ballots", requireAuth, async (req: Request, res) => {
    const user = req.user as User;
    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const ballots = await storage.getBallotsByUser(user.id);
    res.json(ballots);
  });

  // Test route for Oscar data sync
  app.get("/api/test/oscar-sync", async (req, res) => {
    try {
      const oscarService = new OscarSyncService();
      const oscarData = await oscarService.fetchOscarData(93, 96); // 2020-2023

      console.log(`Fetched ${oscarData.length} Oscar nominees`);

      // Process first 5 nominees as a test
      const results = await Promise.all(
        oscarData.slice(0, 5).map(async nominee => {
          const result = await oscarService.syncNominee(nominee);
          return {
            oscarTitle: nominee.Film,
            category: nominee.Category,
            matched: !!result,
            tmdbData: result ? {
              title: result.name,
              tmdbId: result.tmdbId,
              releaseDate: result.releaseDate,
            } : null
          };
        })
      );

      res.json({
        totalNominees: oscarData.length,
        testResults: results
      });
    } catch (error) {
      console.error("Error in Oscar sync test:", error);
      res.status(500).json({ 
        error: "Failed to test Oscar sync",
        message: error.message 
      });
    }
  });

  // Add admin route for seeding
  app.post("/api/admin/seed", requireAuth, async (req: Request, res) => {
    const user = req.user as User;
    if (!user?.isAdmin) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    try {
      await seed();
      res.json({ message: "Database seeding completed successfully" });
    } catch (error: any) {
      console.error("Error in seed endpoint:", error);
      res.status(500).json({ 
        error: "Failed to seed database",
        message: error.message 
      });
    }
  });

  return createServer(app);
}