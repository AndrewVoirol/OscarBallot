
import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";

// 2024 Oscar nominees with their categories
const nominees2024 = [
  { name: "American Fiction", category: "Best Picture" },
  { name: "Anatomy of a Fall", category: "Best Picture" },
  { name: "Barbie", category: "Best Picture" },
  { name: "The Holdovers", category: "Best Picture" },
  { name: "Killers of the Flower Moon", category: "Best Picture" },
  { name: "Maestro", category: "Best Picture" },
  { name: "Oppenheimer", category: "Best Picture" },
  { name: "Past Lives", category: "Best Picture" },
  { name: "Poor Things", category: "Best Picture" },
  { name: "The Zone of Interest", category: "Best Picture" }
];

async function seed() {
  try {
    console.log("Starting database seeding...");

    // Clear existing nominees
    await db.delete(nominees);
    console.log("Cleared existing nominees");

    // Insert basic nominee data
    const insertedNominees = await db.insert(nominees).values(nominees2024).returning();
    console.log(`Inserted ${insertedNominees.length} basic nominee records`);

    // Update each nominee with TMDB data
    console.log("Fetching TMDB data for each nominee...");
    const updatedNominees = await Promise.all(
      insertedNominees.map(async nominee => {
        const updated = await updateNomineeWithTMDBData(nominee);
        if (updated) {
          console.log(`${nominee.name}: Category: ${nominee.category}, Runtime: ${updated.runtime} minutes`);
        }
        return updated;
      })
    );

    const successCount = updatedNominees.filter(Boolean).length;
    console.log(`\nSummary:`);
    console.log(`Successfully updated ${successCount} nominees with TMDB data`);
    console.log("Database seeding completed");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
