import { db } from "./db";
import { nominees, syncStatus } from "@shared/schema";
import { OscarSyncService } from "./services/oscarSync";
import { sql, eq, and, desc } from "drizzle-orm";
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
      orderBy: desc(syncStatus.lastSyncCompleted)
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

    console.log("Starting Oscar nominees sync...");
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
    const currentYearNominees = await oscarService.getNominationsForYear(2024);
    console.log(`Found ${currentYearNominees.length} nominees to process`);

    let processedCount = 0;
    let failedCount = 0;
    const totalBatches = Math.ceil(currentYearNominees.length / 3);

    for (let i = 0; i < currentYearNominees.length; i += 3) {
      const currentBatch = Math.floor(i / 3) + 1;
      console.log(`\nProcessing batch ${currentBatch}/${totalBatches}...`);

      const batch = currentYearNominees.slice(i, i + 3);
      await Promise.allSettled(
        batch.map(async nominee => {
          try {
            const syncedNominee = await oscarService.syncNominee(nominee);
            if (syncedNominee) {
              await db.insert(nominees).values({
                ...syncedNominee,
                awards: syncedNominee.awards || {},
                productionCompanies: syncedNominee.productionCompanies || [],
                extendedCredits: syncedNominee.extendedCredits || { cast: [], crew: [] }
              });
              processedCount++;
              return true;
            }
          } catch (error) {
            console.error(`Failed to sync: ${nominee.nominee}`);
            failedCount++;
          }
          return false;
        })
      );

      // Update sync status with progress
      await db
        .update(syncStatus)
        .set({
          processedItems: processedCount,
          failedItems: failedCount,
          metadata: {
            ...syncRecord.metadata,
            currentBatch,
            totalBatches
          }
        })
        .where(eq(syncStatus.id, syncRecord.id));

      // Progress indicator
      const progress = Math.round((processedCount / currentYearNominees.length) * 100);
      console.log(`Progress: ${progress}% (${processedCount}/${currentYearNominees.length} nominees processed)`);

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

    console.log(`\nSync completed successfully:`);
    console.log(`✓ ${processedCount} nominees processed`);
    console.log(`✗ ${failedCount} nominees failed`);

  } catch (error: any) {
    console.error("Error in background sync:", error.message);
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