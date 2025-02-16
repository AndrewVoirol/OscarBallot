import { db } from "./db";
import { nominees, type InsertNominee } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";
import { sql } from "drizzle-orm";
import { OscarSyncService } from "./services/oscarSync";

export async function seed() {
  try {
    console.log("Starting database seeding...");

    // Clear existing nominees
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Initialize Oscar sync service
    const oscarService = new OscarSyncService();

    // Fetch Oscar data for years 2020-2024 (93rd-96th Academy Awards)
    console.log("Fetching Oscar nominees data from 2020-2024...");
    const oscarData = await oscarService.fetchOscarData(93, 96);
    console.log(`Retrieved ${oscarData.length} Oscar nominations`);

    // Process and insert nominees
    console.log("Processing and inserting nominees...");
    const nomineePromises = oscarData.map(async (oscarNominee) => {
      try {
        const nominee = await oscarService.syncNominee(oscarNominee);
        if (nominee) {
          // Explicitly type the insert operation
          const [inserted] = await db
            .insert(nominees)
            .values(nominee as unknown as typeof nominees.$inferInsert)
            .returning();
          return inserted;
        }
      } catch (error) {
        console.error(`Failed to process nominee ${oscarNominee.Film}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(nomineePromises);
    const inserted = results
      .filter((r): r is PromiseFulfilledResult<typeof nominees.$inferSelect> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    console.log(`Successfully inserted ${inserted.length} nominees`);

    // Update TMDB data for all inserted nominees
    console.log("Fetching TMDB data for nominees...");
    const tmdbUpdates = await Promise.allSettled(
      inserted.map((nominee) => updateNomineeWithTMDBData(nominee))
    );

    // Log results summary
    const successful = tmdbUpdates.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const failed = tmdbUpdates.filter((r) => r.status === "rejected").length;

    console.log("\nSeeding Summary:");
    console.log(`- Total Oscar nominees fetched: ${oscarData.length}`);
    console.log(`- Successfully inserted nominees: ${inserted.length}`);
    console.log(`- TMDB updates successful: ${successful}`);
    console.log(`- TMDB updates failed: ${failed}`);
    console.log("Database seeding completed");

    return {
      totalFetched: oscarData.length,
      inserted: inserted.length,
      tmdbUpdatesSuccessful: successful,
      tmdbUpdatesFailed: failed,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Execute seeding
seed().catch(console.error);