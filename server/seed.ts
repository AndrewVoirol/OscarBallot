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

    // First insert all nominees with basic data, without waiting for TMDB
    const basicNominations = oscarNominees.map(nominee => ({
      name: nominee.nominee,
      category: nominee.category,
      description: "",
      poster: "",
      trailerUrl: "",
      streamingPlatforms: [],
      awards: {},
      historicalAwards: [{
        year: nominee.ceremonyYear,
        awards: [{
          ceremonyId: 96,
          name: "Academy Awards",
          type: nominee.category,
          result: nominee.isWinner ? "Won" : "Nominated",
          dateAwarded: `${nominee.ceremonyYear}-03-10`
        }]
      }],
      castMembers: [],
      crew: [],
      funFacts: [],
      ceremonyYear: nominee.ceremonyYear,
      isWinner: nominee.isWinner,
      tmdbId: null,
      runtime: null,
      releaseDate: null,
      voteAverage: null,
      backdropPath: "",
      genres: [],
      productionCompanies: [],
      extendedCredits: { cast: [], crew: [] },
      aiGeneratedDescription: "",
      aiMatchConfidence: 0,
      dataSource: {
        tmdb: null,
        imdb: null,
        wikidata: null
      }
    }));

    // Insert all nominees with basic data
    console.log(`\nInserting ${basicNominations.length} nominees into database...`);
    const insertedNominees = await db
      .insert(nominees)
      .values(basicNominations)
      .returning();

    console.log(`Successfully inserted ${insertedNominees.length} nominees`);

    // Start TMDB enrichment in background
    console.log("\nStarting TMDB enrichment in background...");

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
      totalSynced: basicNominations.length,
      totalInserted: insertedNominees.length,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}