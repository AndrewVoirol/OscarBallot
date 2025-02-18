import { db } from "./db";
import { nominees } from "@shared/schema";
import { OscarSyncService } from "./services/oscarSync";
import { sql } from "drizzle-orm";

async function cleanDatabase() {
  console.log("Cleaning database...");
  try {
    await db.delete(nominees);
    console.log("Database cleaned successfully");
  } catch (error) {
    console.error("Error cleaning database:", error);
    throw error;
  }
}

export async function seed(cleanFirst: boolean = true) {
  try {
    console.log("Starting database seeding...");

    if (cleanFirst) {
      await cleanDatabase();
    }

    const oscarService = new OscarSyncService();
    console.log("\nStarting Oscar nominees sync...");
    const nominations = await oscarService.getNominationsForYear(2024);

    console.log(`Processing ${nominations.length} nominees...`);
    const batchSize = 10; // Increased batch size for efficiency
    const totalBatches = Math.ceil(nominations.length / batchSize);
    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < nominations.length; i += batchSize) {
      const currentBatch = Math.floor(i / batchSize) + 1;
      console.log(`\nProcessing batch ${currentBatch}/${totalBatches}...`);

      const batch = nominations.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(nominee => oscarService.syncNominee(nominee))
      );

      const successfulNominees = results
        .map((result, index) => ({
          result,
          nominee: batch[index]
        }))
        .filter((item): item is { result: PromiseFulfilledResult<any>; nominee: any } =>
          item.result.status === 'fulfilled' && item.result.value
        );

      if (successfulNominees.length > 0) {
        await Promise.all(
          successfulNominees.map(({ result }) =>
            db
              .insert(nominees)
              .values(result.value)
              .onConflictDoUpdate({
                target: [nominees.name, nominees.category, nominees.ceremonyYear],
                set: result.value
              })
          )
        );
      }

      processedCount += successfulNominees.length;
      failedCount += results.filter(r => r.status === 'rejected').length;

      console.log(`Progress: ${Math.round((processedCount / nominations.length) * 100)}%`);
      console.log(`Processed: ${processedCount}, Failed: ${failedCount}`);

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < nominations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log("\nSync completed!");
    console.log(`Total processed: ${processedCount}`);
    console.log(`Total failed: ${failedCount}`);

    return {
      status: "Sync process completed",
      processed: processedCount,
      failed: failedCount,
      total: nominations.length
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}