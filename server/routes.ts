import { validate2025Nominees } from "./oscar2025validator";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBallotSchema } from "@shared/schema";
import { setupAuth, requireAuth } from "./auth";
import { updateNomineeWithTMDBData, validateNomineeData } from "./tmdb";
import rateLimit from 'express-rate-limit';
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // Rate limiter for TMDB endpoints
  const tmdbLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: "Too many requests to update TMDB data, please try again later"
  });

  // Add new route for 2025 nominee validation
  app.get("/api/nominees/validate-2025", async (_req, res) => {
    try {
      const validationResult = await validate2025Nominees();
      if (!validationResult) {
        res.status(500).json({ message: "Failed to validate 2025 nominees - no result returned" });
        return;
      }
      res.json(validationResult);
    } catch (error) {
      console.error('Error validating 2025 nominees:', error);
      res.status(500).json({ 
        message: "Failed to validate 2025 nominees",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Enhanced validation report endpoint
  app.get("/api/nominees/validation-report", async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      const validationPromises = nominees.map(nominee => validateNomineeData(nominee));
      const validationReports = await Promise.all(validationPromises);

      // Filter to only show nominees with validation issues
      const problemNominees = validationReports.filter(report => report.issues.length > 0);

      res.json({
        totalNominees: nominees.length,
        nomineesWithIssues: problemNominees.length,
        reports: problemNominees
      });
    } catch (error) {
      console.error('Error generating validation report:', error);
      res.status(500).json({ message: "Failed to generate validation report" });
    }
  });

  // Public routes for accessing nominee data
  app.get("/api/nominees", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      const category = req.query.category as string;

      let nominees;
      if (!isNaN(year) && category) {
        nominees = await storage.getNomineesByCategory(category, year);
      } else if (!isNaN(year)) {
        nominees = await storage.getNominees(year);
      } else if (category) {
        nominees = await storage.getNomineesByCategory(category);
      } else {
        nominees = await storage.getNominees();
      }

      // Sort nominees by ceremony year (descending) and then by category
      nominees.sort((a, b) => {
        if (b.ceremonyYear !== a.ceremonyYear) {
          return b.ceremonyYear - a.ceremonyYear;
        }
        return a.category.localeCompare(b.category);
      });

      res.json(nominees);
    } catch (error) {
      console.error('Error fetching nominees:', error);
      res.status(500).json({ message: "Failed to fetch nominees" });
    }
  });

  app.get("/api/nominees/years", async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      const years = Array.from(new Set(nominees.map(n => n.ceremonyYear))).sort((a, b) => b - a);
      res.json(years);
    } catch (error) {
      console.error('Error fetching nominee years:', error);
      res.status(500).json({ message: "Failed to fetch nominee years" });
    }
  });

  app.get("/api/nominees/categories", async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      const categories = Array.from(new Set(nominees.map(n => n.category))).sort();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching nominee categories:', error);
      res.status(500).json({ message: "Failed to fetch nominee categories" });
    }
  });

  app.get("/api/nominees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ message: "Invalid nominee ID" });
        return;
      }

      const nominee = await storage.getNominee(id);
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

  setupAuth(app);

  // Ballot routes
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

  // Watchlist routes
  app.get("/api/watchlist", requireAuth, async (req, res) => {
    try {
      const watchlist = await storage.getWatchlist(req.user!.id);
      res.json(watchlist);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", requireAuth, async (req, res) => {
    try {
      const watchlistItem = await storage.addToWatchlist({
        ...req.body,
        userId: req.user!.id
      });
      res.json(watchlistItem);
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:nomineeId", requireAuth, async (req, res) => {
    try {
      await storage.removeFromWatchlist(req.user!.id, parseInt(req.params.nomineeId));
      res.sendStatus(200);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Enhanced TMDB update endpoint with validation
  app.post("/api/nominees/update-tmdb", tmdbLimiter, async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      console.log('Starting TMDB update for all nominees:', nominees.map(n => n.name).join(', '));

      const updates = await Promise.all(
        nominees.map(async nominee => {
          try {
            const updated = await updateNomineeWithTMDBData(nominee);
            const validation = await validateNomineeData(updated);
            return { nominee: updated, validation, error: null };
          } catch (error) {
            console.error(`Failed to update ${nominee.name}:`, error);
            return { 
              nominee, 
              validation: null, 
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );

      const successful = updates.filter(u => !u.error);
      const failed = updates.filter(u => u.error);

      console.log(`Updated ${successful.length} out of ${nominees.length} nominees`);

      res.json({ 
        message: `Updated ${successful.length} out of ${nominees.length} nominees with TMDB data`,
        summary: {
          total: nominees.length,
          successful: successful.length,
          failed: failed.length,
        },
        failed: failed.map(f => ({
          name: f.nominee.name,
          error: f.error
        }))
      });
    } catch (error: any) {
      console.error('Error updating nominees with TMDB data:', error);
      res.status(500).json({ message: "Failed to update nominees with TMDB data" });
    }
  });

  app.post("/api/nominees/:id/update-tmdb", tmdbLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ message: "Invalid nominee ID" });
        return;
      }

      const nominee = await storage.getNominee(id);
      if (!nominee) {
        res.status(404).json({ message: "Nominee not found" });
        return;
      }

      const updatedNominee = await updateNomineeWithTMDBData(nominee);
      if (!updatedNominee) {
        res.status(500).json({ message: "Failed to update TMDB data" });
        return;
      }

      // Generate validation report for the updated nominee
      const validationReport = await validateNomineeData(updatedNominee);

      res.json({
        nominee: updatedNominee,
        validation: validationReport
      });
    } catch (error: any) {
      console.error('Error updating nominee TMDB data:', error);
      res.status(500).json({ message: "Failed to update nominee TMDB data" });
    }
  });


  return createServer(app);
}