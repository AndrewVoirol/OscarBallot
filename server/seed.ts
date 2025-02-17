import { db } from "./db";
import { nominees } from "@shared/schema";
import { OscarSyncService } from "./services/oscarSync";
import { updateNomineeWithTMDBData } from "./tmdb";
import { sql } from "drizzle-orm";

export async function seed() {
  try {
    console.log("Starting database seeding...");

    // Create Oscar sync service
    const oscarService = new OscarSyncService();

    // Clear existing nominees
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Fetch all nominees for the 96th Academy Awards (2024)
    console.log("Fetching nominees from local dataset...");
    const oscarNominees = await oscarService.getNominationsForYear(2024);
    console.log(`Retrieved ${oscarNominees.length} nominees from dataset`);

    // Group nominees by category for logging
    const categoryCounts = oscarNominees.reduce((acc: Record<string, number>, nom) => {
      acc[nom.category] = (acc[nom.category] || 0) + 1;
      return acc;
    }, {});

    console.log("\nNominees by category:");
    Object.entries(categoryCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, count]) => {
        console.log(`${category}: ${count} nominees`);
      });

    // Process nominees in parallel batches
    const BATCH_SIZE = 5;
    const nominations = [];

    for (let i = 0; i < oscarNominees.length; i += BATCH_SIZE) {
      const batch = oscarNominees.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (oscarNominee) => {
          try {
            return await oscarService.syncNominee(oscarNominee);
          } catch (error) {
            console.error(`Failed to sync ${oscarNominee.nominee}:`, error);
            return null;
          }
        })
      );

      const validResults = batchResults
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      nominations.push(...validResults);

      // Log progress
      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(oscarNominees.length / BATCH_SIZE)}`);
    }

    // Insert synced nominees
    console.log(`\nInserting ${nominations.length} nominees into database...`);
    const insertedNominees = await db
      .insert(nominees)
      .values(nominations)
      .returning();

    console.log(`Successfully inserted ${insertedNominees.length} nominees`);

    // Start TMDB enrichment in parallel batches
    console.log("\nEnriching nominees with TMDB data (background process)...");

    // Process TMDB updates in the background
    (async () => {
      const TMDB_BATCH_SIZE = 3;
      let enrichedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < insertedNominees.length; i += TMDB_BATCH_SIZE) {
        const batch = insertedNominees.slice(i, i + TMDB_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (nominee) => {
            try {
              const result = await updateNomineeWithTMDBData(nominee);
              if (!result) {
                console.log(`Failed to update TMDB data for ${nominee.name}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await updateNomineeWithTMDBData(nominee);
              }
              return result;
            } catch (error) {
              console.error(`Error updating ${nominee.name}:`, error);
              return null;
            }
          })
        );

        enrichedCount += results.filter(r => r.status === 'fulfilled' && r.value).length;
        failedCount += results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;

        console.log(`TMDB Enrichment Progress: ${enrichedCount}/${insertedNominees.length} completed (${failedCount} failed)`);

        // Add delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log("\nTMDB Enrichment Complete:");
      console.log(`- Successfully enriched: ${enrichedCount}`);
      console.log(`- Failed: ${failedCount}`);
    })();

    return {
      totalFetched: oscarNominees.length,
      totalSynced: nominations.length,
      totalInserted: insertedNominees.length,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}