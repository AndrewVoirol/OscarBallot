import { pgTable, text, serial, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
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
    year: number;
    awards: Array<{
      name: string;
      type: string;
      result: "Won" | "Nominated";
    }>;
  }[]>().notNull().default([]),
  castMembers: text("cast_members").array().notNull(),
  crew: text("crew").array().notNull(),
  funFacts: text("fun_facts").array().notNull(),
  ceremonyYear: integer("ceremony_year").notNull().default(2025),
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
    logo_path: string | null;
    origin_country: string;
  }[]>(),
  extendedCredits: jsonb("extended_credits").$type<{
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  }>(),
});

export const ballots = pgTable("ballots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  nomineeId: integer("nominee_id").notNull(),
  hasWatched: boolean("has_watched").notNull().default(false),
  predictedWinner: boolean("predicted_winner").notNull().default(false),
  wantToWin: boolean("want_to_win").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertNomineeSchema = createInsertSchema(nominees);
export const insertBallotSchema = createInsertSchema(ballots);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertNominee = z.infer<typeof insertNomineeSchema>;
export type Nominee = typeof nominees.$inferSelect;
export type InsertBallot = z.infer<typeof insertBallotSchema>;
export type Ballot = typeof ballots.$inferSelect;