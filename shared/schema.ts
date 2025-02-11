import { pgTable, text, serial, integer, jsonb, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Add validation enums for categories
export const OscarCategories = {
  PICTURE: "Best Picture",
  ACTOR: "Best Actor",
  ACTRESS: "Best Actress",
  SUPPORTING_ACTOR: "Best Supporting Actor",
  SUPPORTING_ACTRESS: "Best Supporting Actress",
  DIRECTOR: "Best Director",
  ANIMATED_FEATURE: "Best Animated Feature Film",
  DOCUMENTARY_FEATURE: "Best Documentary Feature Film",
  INTERNATIONAL_FEATURE: "Best International Feature Film",
  ADAPTED_SCREENPLAY: "Best Adapted Screenplay",
  ORIGINAL_SCREENPLAY: "Best Original Screenplay",
  CINEMATOGRAPHY: "Best Cinematography",
  COSTUME_DESIGN: "Best Costume Design",
  FILM_EDITING: "Best Film Editing",
  MAKEUP_HAIRSTYLING: "Best Makeup and Hairstyling",
  PRODUCTION_DESIGN: "Best Production Design",
  SCORE: "Best Original Score",
  SONG: "Best Original Song",
  SOUND: "Best Sound",
  VISUAL_EFFECTS: "Best Visual Effects"
} as const;

export type OscarCategory = typeof OscarCategories[keyof typeof OscarCategories];

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
  posterPath: text("poster_path").notNull(),
  trailerUrl: text("trailer_url").notNull(),
  streamingPlatforms: text("streaming_platforms").array().notNull(),
  awards: jsonb("awards").notNull(),
  historicalAwards: jsonb("historical_awards").$type<{
    year: number;
    awards: Array<{
      name: string;
      type: string;
      category: string;
      result: "Won" | "Nominated";
      ceremonyName: string;
    }>;
  }[]>().notNull().default([]),
  cast: text("cast").array().notNull(),
  crew: text("crew").array().notNull(),
  funFacts: text("fun_facts").array().notNull(),
  ceremonyYear: integer("ceremony_year").notNull().default(2024),
  isWinner: boolean("is_winner").notNull().default(false),

  // TMDB fields
  tmdbId: integer("tmdb_id"),
  runtime: integer("runtime"),
  releaseDate: text("release_date"),
  voteAverage: integer("vote_average"),
  backdropPath: text("backdrop_path"),
  genres: text("genres").array(),
  overview: text("overview"),
  biography: text("biography"),

  // Validation fields
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  dataVersion: integer("data_version").notNull().default(1),
  dataComplete: boolean("data_complete").notNull().default(false),
  lastTMDBSync: timestamp("last_tmdb_sync"),
  validationStatus: text("validation_status").notNull().default('pending'),
  validationErrors: text("validation_errors").array().notNull().default([]),
});

export const ballots = pgTable("ballots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  nomineeId: integer("nominee_id").notNull().references(() => nominees.id),
  hasWatched: boolean("has_watched").notNull().default(false),
  predictedWinner: boolean("predicted_winner").notNull().default(false),
  wantToWin: boolean("want_to_win").notNull().default(false),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  nomineeId: integer("nominee_id").notNull().references(() => nominees.id),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  watchStatus: text("watch_status").notNull().default('pending'),
  rating: integer("rating"),
  notes: text("notes"),
}, (table) => ({
  uniqUserNominee: unique().on(table.userId, table.nomineeId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ballots: many(ballots),
  watchlistItems: many(watchlist),
}));

export const nomineesRelations = relations(nominees, ({ many }) => ({
  ballots: many(ballots),
  watchlistItems: many(watchlist),
}));

export const ballotsRelations = relations(ballots, ({ one }) => ({
  user: one(users, {
    fields: [ballots.userId],
    references: [users.id],
  }),
  nominee: one(nominees, {
    fields: [ballots.nomineeId],
    references: [nominees.id],
  }),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  nominee: one(nominees, {
    fields: [watchlist.nomineeId],
    references: [nominees.id],
  }),
}));

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertNomineeSchema = createInsertSchema(nominees);
export const insertBallotSchema = createInsertSchema(ballots);
export const insertWatchlistSchema = createInsertSchema(watchlist).omit({ id: true, addedAt: true });

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertNominee = z.infer<typeof insertNomineeSchema>;
export type Nominee = typeof nominees.$inferSelect;
export type InsertBallot = z.infer<typeof insertBallotSchema>;
export type Ballot = typeof ballots.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlist.$inferSelect;