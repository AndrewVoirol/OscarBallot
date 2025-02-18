import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBallotSchema, type User } from "@shared/schema";
import { setupAuth, requireAuth } from "./auth";
import rateLimit from 'express-rate-limit';
import { eq } from "drizzle-orm";
import { OscarSyncService } from "./services/oscarSync";
import { seed } from "./seed";

// Update Express Request type to match our User type
declare module "express" {
  interface Request {
    user?: Omit<User, 'password'>;
  }
}

export function registerRoutes(app: Express): Server {
  // Rate limiter for TMDB endpoints
  const tmdbLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: "Too many requests to update TMDB data, please try again later"
  });

  // Add new sync status endpoint
  app.get("/api/sync/status", async (_req, res) => {
    try {
      const syncStatus = await storage.getSyncStatus();
      res.json(syncStatus);
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ message: "Failed to fetch sync status" });
    }
  });

  // Public routes for accessing nominee data
  app.get("/api/nominees", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2024;
      const nominees = await storage.getNominees(year);
      res.json(nominees);
    } catch (error) {
      console.error("Error fetching nominees:", error);
      res.status(500).json({ message: "Failed to fetch nominees" });
    }
  });

  app.get("/api/nominees/category/:category", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2024;
      const nominees = await storage.getNomineesByCategory(req.params.category, year);
      res.json(nominees);
    } catch (error) {
      console.error("Error fetching nominees by category:", error);
      res.status(500).json({ message: "Failed to fetch nominees" });
    }
  });

  app.get("/api/nominees/:id", async (req, res) => {
    try {
      const nominee = await storage.getNominee(parseInt(req.params.id));
      if (!nominee) {
        res.status(404).json({ message: "Nominee not found" });
        return;
      }
      res.json(nominee);
    } catch (error) {
      console.error("Error fetching nominee:", error);
      res.status(500).json({ message: "Failed to fetch nominee" });
    }
  });

  // Update the TMDB endpoint to be more efficient
  app.post("/api/nominees/update-tmdb", tmdbLimiter, async (_req, res) => {
    try {
      const oscarService = new OscarSyncService();
      const nominees = await storage.getNominees();

      // Process in larger batches for efficiency
      const batchSize = 5; // Increased from 3
      const batch = nominees.slice(0, batchSize);

      const updates = await Promise.allSettled(
        batch.map(nominee =>
          oscarService.syncNominee({
            ceremonyYear: nominee.ceremonyYear,
            eligibilityYear: nominee.eligibilityYear,
            category: nominee.category,
            nominee: nominee.name,
            isWinner: nominee.isWinner
          })
        )
      );

      const successCount = updates.filter(r => r.status === 'fulfilled' && r.value).length;

      res.json({
        message: `Updated ${successCount} out of ${batchSize} nominees with TMDB data`,
        status: "success",
        details: updates.map((result, index) => ({
          nominee: batch[index].name,
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? (result.reason as Error).message : null
        }))
      });
    } catch (error) {
      console.error("Error updating nominees with TMDB data:", error);
      res.status(500).json({
        message: "Failed to update nominees with TMDB data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Setup auth routes
  setupAuth(app);

  // Protected routes for ballot operations
  app.get("/api/ballots/:nomineeId", requireAuth, async (req: Request, res) => {
    try {
      const ballot = await storage.getBallot(
        parseInt(req.params.nomineeId),
        req.user!.id
      );

      if (!ballot) {
        res.json({
          nomineeId: parseInt(req.params.nomineeId),
          userId: req.user!.id,
          ceremonyId: 96, // Default to 96th Academy Awards
          hasWatched: false,
          predictedWinner: false,
          wantToWin: false
        });
        return;
      }
      res.json(ballot);
    } catch (error) {
      console.error("Error fetching ballot:", error);
      res.status(500).json({ message: "Failed to fetch ballot" });
    }
  });

  app.post("/api/ballots", requireAuth, async (req: Request, res) => {
    try {
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
        userId: req.user!.id
      });
      res.json(ballot);
    } catch (error) {
      console.error("Error updating ballot:", error);
      res.status(500).json({ message: "Failed to update ballot" });
    }
  });

  app.get("/api/ballots", requireAuth, async (req: Request, res) => {
    try {
      const ballots = await storage.getBallotsByUser(req.user!.id);
      res.json(ballots);
    } catch (error) {
      console.error("Error fetching ballots:", error);
      res.status(500).json({ message: "Failed to fetch ballots" });
    }
  });

  // Add admin route for seeding
  app.post("/api/admin/seed", requireAuth, async (_req: Request, res) => {
    try {
      const result = await seed();
      res.json({ message: "Database seeding initiated", ...result });
    } catch (error: any) {
      console.error("Error in seed endpoint:", error);
      res.status(500).json({
        error: "Failed to seed database",
        message: error.message
      });
    }
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

  // Add this new test endpoint after the existing test endpoints
  app.post("/api/test/oscar-sync-test", async (_req, res) => {
    try {
      const oscarService = new OscarSyncService();
      const result = await oscarService.runTestSync();

      res.json({
        message: "Test sync completed",
        ...result
      });
    } catch (error) {
      console.error("Error in Oscar test sync:", error);
      res.status(500).json({
        error: "Failed to run test sync",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  return createServer(app);
}