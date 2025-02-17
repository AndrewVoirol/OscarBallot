import { pgTable, text, serial, integer, jsonb, boolean, timestamp, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// TMDB related types
export interface TMDBSearchResult {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
}

// Enhanced Oscar nomination interface
export interface OscarNomination {
  ceremonyYear: number;        // Year the ceremony takes place (e.g., 2025)
  eligibilityYear: number;     // Year the film was eligible (e.g., 2024)
  category: string;
  nominee: string;
  isWinner: boolean;
}

// New sync status table to track TMDB syncs
export const syncStatus = pgTable("sync_status", {
  id: serial("id").primaryKey(),
  lastSyncStarted: timestamp("last_sync_started").notNull(),
  lastSyncCompleted: timestamp("last_sync_completed"),
  syncType: text("sync_type").notNull(), // 'initial', 'current_year', 'historical'
  totalItems: integer("total_items"),
  processedItems: integer("processed_items"),
  failedItems: integer("failed_items"),
  status: text("status").notNull(), // 'in_progress', 'completed', 'failed'
  error: text("error"),
  metadata: jsonb("metadata").$type<{
    ceremonyYears?: number[];
    currentBatch?: number;
    totalBatches?: number;
    lastProcessedId?: number;
  }>(),
});

// Database schema definitions
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const awardCeremonies = pgTable("award_ceremonies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  dateHeld: timestamp("date_held"),
  description: text("description"),
  categories: jsonb("categories").$type<{
    name: string;
    description: string;
    eligibilityRules: string;
  }[]>().notNull(),
  venue: text("venue"),
  host: text("host"),
  broadcastPartner: text("broadcast_partner"),
});

export const nominees = pgTable("nominees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  poster: text("poster").notNull(),
  trailerUrl: text("trailer_url").notNull(),
  streamingPlatforms: text("streaming_platforms").array().notNull(),
  awards: jsonb("awards").notNull(),
  historicalAwards: jsonb("historical_awards").$type<{
    ceremonyYear: number;
    eligibilityYear: number;
    awards: Array<{
      ceremonyId: number;
      name: string;
      type: string;
      result: "Won" | "Nominated";
      dateAwarded: string;
    }>;
  }[]>().notNull().default([]),
  castMembers: text("cast_members").array().notNull(),
  crew: text("crew").array().notNull(),
  funFacts: text("fun_facts").array().notNull(),
  ceremonyYear: integer("ceremony_year").notNull().default(2025),
  eligibilityYear: integer("eligibility_year").notNull().default(2024),
  isWinner: boolean("is_winner").notNull().default(false),
  tmdbId: integer("tmdb_id"),
  runtime: integer("runtime"),
  releaseDate: text("release_date"),
  voteAverage: integer("vote_average"),
  backdropPath: text("backdrop_path"),
  genres: text("genres").array(),
  productionCompanies: jsonb("production_companies").$type<{
    id: number;
    name: string;
    logoPath: string | null;
    originCountry: string;
  }[]>(),
  extendedCredits: jsonb("extended_credits").$type<{
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profileImage: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profileImage: string | null;
    }>;
  }>(),
  aiGeneratedDescription: text("ai_generated_description"),
  aiMatchConfidence: integer("ai_match_confidence"),
  alternativeTitles: jsonb("alternative_titles").$type<string[]>().notNull().default([]),
  originalLanguage: text("original_language"),
  originalTitle: text("original_title"),
  dataSource: jsonb("data_source").$type<{
    tmdb: { lastUpdated: string; version: string; } | null;
    imdb: { lastUpdated: string; version: string; } | null;
    wikidata: { lastUpdated: string; version: string; } | null;
  }>().notNull().default({
    tmdb: null,
    imdb: null,
    wikidata: null
  }),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const ballots = pgTable("ballots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  nomineeId: integer("nominee_id").notNull(),
  ceremonyId: integer("ceremony_id").notNull(),
  hasWatched: boolean("has_watched").notNull().default(false),
  predictedWinner: boolean("predicted_winner").notNull().default(false),
  wantToWin: boolean("want_to_win").notNull().default(false),
  notes: text("notes"),
  lastModified: timestamp("last_modified").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertAwardCeremonySchema = createInsertSchema(awardCeremonies).omit({ id: true });
export const insertNomineeSchema = createInsertSchema(nominees);
export const insertBallotSchema = createInsertSchema(ballots);
export const insertSyncStatusSchema = createInsertSchema(syncStatus);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAwardCeremony = z.infer<typeof insertAwardCeremonySchema>;
export type AwardCeremony = typeof awardCeremonies.$inferSelect;
export type InsertNominee = z.infer<typeof insertNomineeSchema>;
export type Nominee = typeof nominees.$inferSelect;
export type InsertBallot = z.infer<typeof insertBallotSchema>;
export type Ballot = typeof ballots.$inferSelect;
export type InsertSyncStatus = z.infer<typeof insertSyncStatusSchema>;
export type SyncStatus = typeof syncStatus.$inferSelect;