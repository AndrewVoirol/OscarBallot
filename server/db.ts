
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function migrateDb() {
  try {
    console.log("Starting database migration...");
    await db.execute(`
      DO $$ BEGIN
        ALTER TABLE nominees
          ADD COLUMN IF NOT EXISTS tmdb_id INTEGER,
          ADD COLUMN IF NOT EXISTS runtime INTEGER,
          ADD COLUMN IF NOT EXISTS release_date TEXT,
          ADD COLUMN IF NOT EXISTS vote_average INTEGER,
          ADD COLUMN IF NOT EXISTS backdrop_path TEXT,
          ADD COLUMN IF NOT EXISTS genres TEXT[],
          ADD COLUMN IF NOT EXISTS overview TEXT,
          ADD COLUMN IF NOT EXISTS biography TEXT,
          ADD COLUMN IF NOT EXISTS production_companies JSONB,
          ADD COLUMN IF NOT EXISTS extended_credits JSONB,
          ADD COLUMN IF NOT EXISTS media_validation JSONB DEFAULT '{"images": {}, "videos": [], "lastValidated": null}'::jsonb,
          ADD COLUMN IF NOT EXISTS validation_score INTEGER DEFAULT 0;

        CREATE TABLE IF NOT EXISTS media_validation_log (
          id SERIAL PRIMARY KEY,
          nominee_id INTEGER REFERENCES nominees(id),
          validation_type TEXT NOT NULL,
          status TEXT NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_media_validation_nominee ON media_validation_log(nominee_id);
        CREATE INDEX IF NOT EXISTS idx_media_validation_status ON media_validation_log(status);
      EXCEPTION
        WHEN others THEN
          raise notice 'Error adding columns: %', SQLERRM;
      END $$;
    `);
    console.log("Database migration completed successfully");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}
