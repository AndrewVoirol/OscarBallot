import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";

// Update categories by year
const categoriesByYear = {
  2025: {
    "Best Picture": [
      "American Fiction",
      "Anatomy of a Fall",
      "Barbie",
      "The Holdovers",
      "Killers of the Flower Moon",
      "Maestro",
      "Oppenheimer",
      "Past Lives",
      "Poor Things",
      "The Zone of Interest"
    ],
    "Best Actor": [
      "Bradley Cooper",
      "Colman Domingo",
      "Paul Giamatti",
      "Cillian Murphy",
      "Jeffrey Wright"
    ],
    "Best Actress": [
      "Annette Bening",
      "Lily Gladstone",
      "Sandra Hüller",
      "Carey Mulligan",
      "Emma Stone"
    ],
    "Best Supporting Actor": [
      "Sterling K. Brown",
      "Robert De Niro",
      "Robert Downey Jr.",
      "Ryan Gosling",
      "Mark Ruffalo"
    ],
    "Best Supporting Actress": [
      "Emily Blunt",
      "Danielle Brooks",
      "America Ferrera",
      "Jodie Foster",
      "Da'Vine Joy Randolph"
    ],
    "Best Director": [
      "Justine Triet",
      "Martin Scorsese",
      "Christopher Nolan",
      "Yorgos Lanthimos",
      "Jonathan Glazer"
    ],
    "Best Animated Feature Film": [
      "The Boy and the Heron",
      "Elemental",
      "Nimona",
      "Robot Dreams",
      "Spider-Man: Across the Spider-Verse"
    ]
  },
  2024: {
    "Best Picture": [
      "Oppenheimer",
      "Poor Things",
      "Killers of the Flower Moon",
      "Barbie",
      "The Zone of Interest"
    ],
    "Best Actor": [
      "Cillian Murphy",
      "Paul Giamatti",
      "Bradley Cooper"
    ],
    "Best Actress": [
      "Emma Stone",
      "Lily Gladstone",
      "Sandra Hüller"
    ],
    "Best Supporting Actor": [
      "Robert Downey Jr.",
      "Ryan Gosling",
      "Robert De Niro"
    ],
    "Best Supporting Actress": [
      "Da'Vine Joy Randolph",
      "Emily Blunt",
      "America Ferrera"
    ],
    "Best Director": [
      "Christopher Nolan",
      "Martin Scorsese",
      "Yorgos Lanthimos"
    ],
    "Best Animated Feature": [
      "The Boy and the Heron",
      "Spider-Man: Across the Spider-Verse"
    ],
    "Best International Feature": [
      "The Zone of Interest",
      "Perfect Days"
    ]
  }
};

async function seed() {
  try {
    console.log("Starting database seeding with enhanced validation...");

    // Clear existing nominees
    await db.delete(nominees);
    console.log("Cleared existing nominees");

    // Prepare all nominees data with proper validation
    const allNomineesData = [];

    // Process each year's nominees with their specific categories
    for (const [year, categories] of Object.entries(categoriesByYear)) {
      for (const [category, nomineeNames] of Object.entries(categories)) {
        for (const name of nomineeNames) {
          allNomineesData.push({
            name,
            category,
            ceremonyYear: parseInt(year),
            description: "", // Will be populated by TMDB
            streamingPlatforms: [],
            awards: {},
            historicalAwards: [],
            cast: [],
            crew: [],
            funFacts: [],
            poster: "",
            trailerUrl: "",
            dataComplete: false,
            dataVersion: 1,
            validationStatus: 'pending',
            validationErrors: []
          });
        }
      }
    }

    // Insert nominees
    const insertedNominees = await db.insert(nominees).values(allNomineesData).returning();
    console.log(`Inserted ${insertedNominees.length} nominees`);

    // Update nominees with TMDB data
    console.log("Fetching TMDB data for each nominee...");
    let successCount = 0;
    let errorCount = 0;

    for (const nominee of insertedNominees) {
      try {
        const updated = await updateNomineeWithTMDBData(nominee);
        if (updated) {
          console.log(`✓ ${nominee.name} (${nominee.ceremonyYear}): Updated successfully`);
          successCount++;
        } else {
          console.log(`✗ ${nominee.name} (${nominee.ceremonyYear}): Failed to update`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error updating ${nominee.name}:`, error);
        errorCount++;
      }

      // Add delay between requests to respect TMDB rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("\nSeeding Summary:");
    console.log(`Total nominees: ${insertedNominees.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to update: ${errorCount}`);
    console.log("Database seeding completed");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run the seed function
seed().catch(console.error);