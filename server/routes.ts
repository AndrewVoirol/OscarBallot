import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBallotSchema } from "@shared/schema";
import { setupAuth, requireAuth } from "./auth";
import { updateNomineeWithTMDBData } from "./tmdb";
import rateLimit from 'express-rate-limit';
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // Rate limiter for TMDB endpoints
  const tmdbLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: "Too many requests to update TMDB data, please try again later"
  });

  // Public routes for accessing nominee data
  app.get("/api/nominees", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      if (isNaN(year)) {
        // If no year is provided or it's invalid, return nominees from all years
        const nominees = await storage.getNominees();
        return res.json(nominees);
      }
      const nominees = await storage.getNominees(year);
      res.json(nominees);
    } catch (error) {
      console.error('Error fetching nominees:', error);
      res.status(500).json({ message: "Failed to fetch nominees" });
    }
  });

  app.get("/api/nominees/category/:category", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      if (isNaN(year)) {
        // If no year is provided or it's invalid, return nominees from all years for this category
        const nominees = await storage.getNomineesByCategory(req.params.category);
        return res.json(nominees);
      }
      const nominees = await storage.getNomineesByCategory(req.params.category, year);
      res.json(nominees);
    } catch (error) {
      console.error('Error fetching nominees by category:', error);
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
      console.error('Error fetching nominee:', error);
      res.status(500).json({ message: "Failed to fetch nominee" });
    }
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
  app.get("/api/ballots/:nomineeId", requireAuth, async (req, res) => {
    const ballot = await storage.getBallot(
      parseInt(req.params.nomineeId),
      req.user!.id
    );
    if (!ballot) {
      res.json({
        nomineeId: parseInt(req.params.nomineeId),
        userId: req.user!.id,
        hasWatched: false,
        predictedWinner: false,
        wantToWin: false
      });
      return;
    }
    res.json(ballot);
  });

  app.post("/api/ballots", requireAuth, async (req, res) => {
    const result = insertBallotSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid ballot data" });
      return;
    }
    const ballot = await storage.updateBallot({
      ...result.data,
      userId: req.user!.id
    });
    res.json(ballot);
  });

  return createServer(app);
}