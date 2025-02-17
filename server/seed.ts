import { db } from "./db";
import { nominees } from "@shared/schema";
import { OscarSyncService } from "./services/oscarSync";
import { sql } from "drizzle-orm";

// Function to run the heavy sync processes after server start
async function runBackgroundSync() {
  try {
    const oscarService = new OscarSyncService();

    // Sync current year (2024) nominees first
    console.log("\nBackground sync: Starting 2024 Oscar nominees sync...");
    const currentYearNominees = await oscarService.getNominationsForYear(2024);

    // Process in smaller batches
    for (let i = 0; i < currentYearNominees.length; i += 3) {
      const batch = currentYearNominees.slice(i, i + 3);
      await Promise.allSettled(
        batch.map(async nominee => {
          try {
            const syncedNominee = await oscarService.syncNominee(nominee);
            if (syncedNominee) {
              await db.insert(nominees).values(syncedNominee);
              return true;
            }
          } catch (error) {
            console.error(`Failed to sync nominee ${nominee.nominee}:`, error);
          }
          return false;
        })
      );

      // Add delay between batches
      if (i + 3 < currentYearNominees.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Start historical data sync after current year is done
    console.log("\nBackground sync: Starting historical data sync...");
    await oscarService.syncHistoricalData(2020, 2023);
  } catch (error) {
    console.error("Error in background sync:", error);
  }
}

// Main seed function - now just sets up basic data
export async function seed() {
  try {
    console.log("Starting minimal database seeding...");

    // Clear existing nominees
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Start background sync process
    setTimeout(() => {
      runBackgroundSync().catch(error => {
        console.error("Background sync failed:", error);
      });
    }, 5000); // Wait 5 seconds after server start

    return { status: "Background sync started" };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}