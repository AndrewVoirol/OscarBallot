import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBallotSchema } from "@shared/schema";
import { setupAuth, requireAuth } from "./auth";
import { updateNomineeWithTMDBData, validateNomineeData, type ValidationReport } from "./tmdb";
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

  app.get("/api/nominees/validation-report", async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      const validationPromises = nominees.map(nominee => validateNomineeData(nominee));
      const validationReports = await Promise.all(validationPromises);

      // Filter to only show nominees with issues
      const problemNominees = validationReports.filter((report: ValidationReport) => report.issues.length > 0);

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

  app.post("/api/nominees/update-tmdb", tmdbLimiter, async (_req, res) => {
    try {
      const nominees = await storage.getNominees();
      console.log('Starting TMDB update for all nominees:', nominees.map(n => n.name).join(', '));

      const updates = await Promise.all(
        nominees.map(nominee => updateNomineeWithTMDBData(nominee))
      );

      const updatedCount = updates.filter(Boolean).length;
      console.log(`Successfully updated ${updatedCount} out of ${nominees.length} nominees`);

      // Generate validation report for updated nominees
      const validationReports = await Promise.all(updates.map(nominee => validateNomineeData(nominee)));
      const nomineesWithIssues = validationReports.filter((report: ValidationReport) => report.issues.length > 0);

      res.json({ 
        message: `Updated ${updatedCount} out of ${nominees.length} nominees with TMDB data`,
        updatedNominees: updates.filter(Boolean),
        validationReport: {
          totalNominees: nominees.length,
          nomineesWithIssues: nomineesWithIssues.length,
          problemNominees: nomineesWithIssues
        }
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

  setupAuth(app);

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