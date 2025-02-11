import { pgTable, text, serial, integer, jsonb, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Oscar categories enum
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

// Users table with authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

// Nominees table with essential fields and TMDB integration
export const nominees = pgTable("nominees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  tmdbId: integer("tmdb_id"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  trailerUrl: text("trailer_url"),

  // Basic movie/person info
  releaseDate: text("release_date"),
  runtime: integer("runtime"),
  voteAverage: integer("vote_average"),
  genres: text("genres").array(),
  overview: text("overview"),

  // Credits and additional info
  cast: jsonb("cast").$type<Array<{
    id: number,
    name: string,
    character: string,
    profilePath: string | null
  }>>(),
  director: text("director"),

  // Oscar specific fields
  ceremonyYear: integer("ceremony_year").notNull(),
  isWinner: boolean("is_winner").notNull().default(false),

  // Validation status
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  isValidated: boolean("is_validated").notNull().default(false),
  validationErrors: text("validation_errors").array().default([]),
}, (table) => ({
  categoryIdx: index("nominee_category_idx").on(table.category),
  yearIdx: index("nominee_year_idx").on(table.ceremonyYear),
  tmdbIdx: index("nominee_tmdb_idx").on(table.tmdbId),
}));

// User predictions/voting
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  nomineeId: integer("nominee_id").notNull().references(() => nominees.id),
  predictedWinner: boolean("predicted_winner").notNull().default(false),
  hasWatched: boolean("has_watched").notNull().default(false),
  rating: integer("rating"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqUserNominee: unique().on(table.userId, table.nomineeId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  predictions: many(predictions),
}));

export const nomineesRelations = relations(nominees, ({ many }) => ({
  predictions: many(predictions),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  nominee: one(nominees, {
    fields: [predictions.nomineeId],
    references: [nominees.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertNomineeSchema = createInsertSchema(nominees).omit({ 
  id: true,
  lastUpdated: true,
  isValidated: true,
  validationErrors: true
});
export const insertPredictionSchema = createInsertSchema(predictions).omit({ 
  id: true,
  createdAt: true
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertNominee = z.infer<typeof insertNomineeSchema>;
export type Nominee = typeof nominees.$inferSelect;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;