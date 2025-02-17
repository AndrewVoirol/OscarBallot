import { db } from "./db";
import { nominees, syncStatus } from "@shared/schema";
import { OscarSyncService } from "./services/oscarSync";
import { sql, eq, and, gte } from "drizzle-orm";
import { subHours } from "date-fns";

const SYNC_INTERVAL_HOURS = 24; // Only sync once per day

async function shouldStartSync(): Promise<boolean> {
  try {
    // Check if there's any ongoing sync
    const ongoingSync = await db.query.syncStatus.findFirst({
      where: eq(syncStatus.status, 'in_progress')
    });

    if (ongoingSync) {
      console.log("A sync is already in progress");
      return false;
    }

    // Check when was the last successful sync
    const lastSuccessfulSync = await db.query.syncStatus.findFirst({
      where: and(
        eq(syncStatus.status, 'completed'),
        eq(syncStatus.syncType, 'current_year')
      ),
      orderBy: [syncStatus.lastSyncCompleted, 'desc']
    });

    if (!lastSuccessfulSync) {
      console.log("No previous sync found, starting initial sync");
      return true;
    }

    const hoursSinceLastSync = 
      (Date.now() - lastSuccessfulSync.lastSyncCompleted!.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastSync >= SYNC_INTERVAL_HOURS;
  } catch (error) {
    console.error("Error checking sync status:", error);
    return false;
  }
}

// Function to run the heavy sync processes after server start
async function runBackgroundSync() {
  try {
    if (!await shouldStartSync()) {
      console.log("Skipping sync - too soon since last sync or sync in progress");
      return;
    }

    // Create new sync status record
    const [syncRecord] = await db
      .insert(syncStatus)
      .values({
        lastSyncStarted: new Date(),
        syncType: 'current_year',
        status: 'in_progress',
        processedItems: 0,
        failedItems: 0,
        metadata: {
          ceremonyYears: [2024],
          currentBatch: 0
        }
      })
      .returning();

    const oscarService = new OscarSyncService();

    // Sync current year (2024) nominees first
    console.log("\nBackground sync: Starting 2024 Oscar nominees sync...");
    const currentYearNominees = await oscarService.getNominationsForYear(2024);

    let processedCount = 0;
    let failedCount = 0;

    // Process in smaller batches with better progress tracking
    for (let i = 0; i < currentYearNominees.length; i += 3) {
      const batch = currentYearNominees.slice(i, i + 3);
      const batchResults = await Promise.allSettled(
        batch.map(async nominee => {
          try {
            const syncedNominee = await oscarService.syncNominee(nominee);
            if (syncedNominee) {
              await db.insert(nominees).values(syncedNominee);
              processedCount++;
              return true;
            }
          } catch (error) {
            console.error(`Failed to sync nominee ${nominee.nominee}:`, error);
            failedCount++;
          }
          return false;
        })
      );

      // Update sync status
      await db
        .update(syncStatus)
        .set({
          processedItems: processedCount,
          failedItems: failedCount,
          metadata: {
            ...syncRecord.metadata,
            currentBatch: Math.floor(i / 3),
            totalBatches: Math.ceil(currentYearNominees.length / 3)
          }
        })
        .where(eq(syncStatus.id, syncRecord.id));

      // Add delay between batches
      if (i + 3 < currentYearNominees.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Mark sync as completed
    await db
      .update(syncStatus)
      .set({
        lastSyncCompleted: new Date(),
        status: 'completed',
        totalItems: currentYearNominees.length,
        processedItems: processedCount,
        failedItems: failedCount
      })
      .where(eq(syncStatus.id, syncRecord.id));

    console.log(`Sync completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    console.error("Error in background sync:", error);
    // Update sync status to failed
    await db
      .update(syncStatus)
      .set({
        status: 'failed',
        error: error.message
      })
      .where(eq(syncStatus.status, 'in_progress'));
  }
}

// Main seed function - now just sets up basic data
export async function seed() {
  try {
    console.log("Starting minimal database seeding...");

    // Clear existing nominees
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Start background sync process after a delay
    setTimeout(() => {
      runBackgroundSync().catch(error => {
        console.error("Background sync failed:", error);
      });
    }, 5000); // Wait 5 seconds after server start

    return { status: "Background sync scheduled" };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}