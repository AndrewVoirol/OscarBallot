import { db } from "./db";
import { nominees } from "@shared/schema";
import { OscarSyncService } from "./services/oscarSync";
import { sql } from "drizzle-orm";

// Function to get the last processed nominee
async function getLastProcessedNominee() {
  try {
    const [lastNominee] = await db
      .select()
      .from(nominees)
      .orderBy(sql`${nominees.ceremonyYear} DESC, ${nominees.id} DESC`)
      .limit(1);
    return lastNominee;
  } catch (error) {
    console.error("Error getting last processed nominee:", error);
    return null;
  }
}

async function insertNominee(nominee: any, db: any) {
  try {
    const [inserted] = await db
      .insert(nominees)
      .values(nominee)
      .onConflictDoUpdate({
        target: [nominees.name, nominees.category, nominees.ceremonyYear],
        set: nominee
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error(`Error inserting nominee ${nominee.name}:`, error);
    throw error;
  }
}

// Function to run the heavy sync processes after server start
async function runBackgroundSync() {
  try {
    const oscarService = new OscarSyncService();

    // Get current progress
    const existingNominees = await db.select().from(nominees);
    const existingNames = new Set(existingNominees.map(n => n.name));

    // Get nominations starting from 2024
    console.log("\nBackground sync: Starting Oscar nominees sync...");
    const nominations = await oscarService.getNominationsForYear(2024);
    const remainingNominees = nominations.filter(nom => !existingNames.has(nom.nominee));

    console.log(`Processing ${remainingNominees.length} remaining nominees...`);

    let processedCount = existingNominees.length;
    let failedCount = 0;
    const batchSize = 2; // Reduced batch size to be more conservative
    const totalBatches = Math.ceil(remainingNominees.length / batchSize);

    for (let i = 0; i < remainingNominees.length; i += batchSize) {
      const currentBatch = Math.floor(i / batchSize) + 1;
      console.log(`\nProcessing batch ${currentBatch}/${totalBatches}...`);

      const batch = remainingNominees.slice(i, i + batchSize);

      // Process each nominee with individual error handling
      for (const nominee of batch) {
        try {
          console.log(`Processing: ${nominee.nominee}`);
          const syncedNominee = await oscarService.syncNominee(nominee);

          if (syncedNominee) {
            await insertNominee(syncedNominee, db);
            processedCount++;
            console.log(`✓ Successfully processed: ${nominee.nominee}`);
          } else {
            console.log(`⚠ No data found for: ${nominee.nominee}`);
            failedCount++;
          }

          // Add a delay between each nominee
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`Failed to process: ${nominee.nominee}`, error);
          failedCount++;
          // Continue with next nominee despite error
          continue;
        }
      }

      const progress = Math.round((processedCount / (remainingNominees.length + existingNominees.length)) * 100);
      console.log(`Progress: ${progress}% (${processedCount}/${remainingNominees.length + existingNominees.length} nominees processed)`);
      console.log(`Failed: ${failedCount} nominees`);

      // Longer delay between batches
      if (i + batchSize < remainingNominees.length) {
        console.log("Waiting to avoid rate limits...");
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    console.log("\nSync completed!");
    console.log(`Total processed: ${processedCount}`);
    console.log(`Total failed: ${failedCount}`);

    return {
      processed: processedCount,
      failed: failedCount,
      total: remainingNominees.length + existingNominees.length
    };
  } catch (error) {
    console.error("Error in background sync:", error);
    throw error;
  }
}

// Main seed function - now just sets up basic data and triggers sync
export async function seed() {
  try {
    console.log("Starting database seeding...");

    // Get the last processed nominee to track progress
    const lastProcessed = await getLastProcessedNominee();
    if (lastProcessed) {
      console.log(`Resuming from last processed nominee: ${lastProcessed.name}`);
    }

    // Start background sync process immediately
    const result = await runBackgroundSync();
    return { 
      status: "Sync process completed",
      ...result
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}