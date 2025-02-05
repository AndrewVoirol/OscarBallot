
import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";

// 2024 Oscar nominees
const nominees2024 = [
  { name: "Oppenheimer", category: "Best Picture", description: "Epic biographical thriller about J. Robert Oppenheimer", poster: "placeholder", trailerUrl: "placeholder", streamingPlatforms: [], awards: {}, cast: [], crew: [], funFacts: [] },
  { name: "Barbie", category: "Best Picture", description: "Live-action Barbie adventure", poster: "placeholder", trailerUrl: "placeholder", streamingPlatforms: [], awards: {}, cast: [], crew: [], funFacts: [] },
  { name: "Killers of the Flower Moon", category: "Best Picture", description: "Historical drama about the Osage murders", poster: "placeholder", trailerUrl: "placeholder", streamingPlatforms: [], awards: {}, cast: [], crew: [], funFacts: [] },
  // Add more 2024 nominees
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
      insertedNominees.map(nominee => updateNomineeWithTMDBData(nominee))
    );

    console.log(`Successfully updated ${updatedNominees.filter(Boolean).length} nominees with TMDB data`);
    console.log("Database seeding completed");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    process.exit(0);
  }
}

seed();
