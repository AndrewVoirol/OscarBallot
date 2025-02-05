import { pgTable, text, serial, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const nominees = pgTable("nominees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  poster: text("poster").notNull(),
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
  cast: text("cast").array().notNull(),
  crew: text("crew").array().notNull(),
  funFacts: text("fun_facts").array().notNull(),
});

export const ballots = pgTable("ballots", {
  id: serial("id").primaryKey(),
  nomineeId: integer("nominee_id").notNull(),
  hasWatched: boolean("has_watched").notNull().default(false),
  predictedWinner: boolean("predicted_winner").notNull().default(false),
  wantToWin: boolean("want_to_win").notNull().default(false),
});

export const insertNomineeSchema = createInsertSchema(nominees);
export const insertBallotSchema = createInsertSchema(ballots);

export type InsertNominee = z.infer<typeof insertNomineeSchema>;
export type Nominee = typeof nominees.$inferSelect;
export type InsertBallot = z.infer<typeof insertBallotSchema>;
export type Ballot = typeof ballots.$inferSelect;