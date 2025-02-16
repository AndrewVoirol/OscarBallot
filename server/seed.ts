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
    console.log("Fetching nominees from Oscar database...");
    const oscarNominees = await oscarService.fetchOscarData(96, 96);
    console.log(`Retrieved ${oscarNominees.length} nominees from Oscar database`);

    // Group nominees by category for logging
    const categoryCounts = oscarNominees.reduce((acc, nom) => {
      acc[nom.Category] = (acc[nom.Category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\nNominees by category:");
    Object.entries(categoryCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, count]) => {
        console.log(`${category}: ${count} nominees`);
      });

    // Sync each nominee with TMDB data
    console.log("\nSyncing nominees with TMDB...");
    const nominations = [];
    for (const oscarNominee of oscarNominees) {
      try {
        const nomination = await oscarService.syncNominee(oscarNominee);
        if (nomination) {
          nominations.push(nomination);
        }
      } catch (error) {
        console.error(`Failed to sync ${oscarNominee.Film}:`, error);
      }
    }

    // Insert synced nominees
    console.log(`\nInserting ${nominations.length} nominees into database...`);
    const insertedNominees = await db
      .insert(nominees)
      .values(nominations)
      .returning();

    console.log(`Successfully inserted ${insertedNominees.length} nominees`);

    // Update nominees with additional TMDB data
    console.log("\nEnriching nominees with additional TMDB data...");
    const tmdbUpdates = await Promise.allSettled(
      insertedNominees.map(async (nominee) => {
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

    const successful = tmdbUpdates.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const failed = tmdbUpdates.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value)
    ).length;

    console.log("\nSeeding Summary:");
    console.log(`- Total nominees fetched from Oscar database: ${oscarNominees.length}`);
    console.log(`- Successfully synced with TMDB: ${nominations.length}`);
    console.log(`- Inserted into database: ${insertedNominees.length}`);
    console.log(`- TMDB enrichment successful: ${successful}`);
    console.log(`- TMDB enrichment failed: ${failed}`);

    return {
      totalFetched: oscarNominees.length,
      totalSynced: nominations.length,
      totalInserted: insertedNominees.length,
      tmdbUpdatesSuccessful: successful,
      tmdbUpdatesFailed: failed,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}