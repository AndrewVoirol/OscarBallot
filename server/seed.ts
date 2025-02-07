import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";

// 2024 Oscar nominees with their categories and winners
const nominees2024 = [
  { 
    name: "Oppenheimer",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"]
  },
  { 
    name: "Poor Things",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters", "Digital Purchase"]
  },
  { 
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Apple TV+", "Digital Purchase"]
  },
  { 
    name: "Barbie",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Max", "Digital Purchase"]
  },
  { 
    name: "The Zone of Interest",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters", "Digital Purchase"]
  }
];

// 2025 Oscar nominees (97th Academy Awards)
const nominees2025 = [
  { 
    name: "American Fiction",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"]
  },
  { 
    name: "Past Lives",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters", "Digital Purchase"]
  },
  { 
    name: "Maestro",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Netflix"]
  },
  { 
    name: "The Holdovers",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters", "Peacock"]
  }
];

async function seed() {
  try {
    console.log("Starting database seeding...");

    // Clear existing nominees
    await db.delete(nominees);
    console.log("Cleared existing nominees");

    // Insert 2024 nominees
    const inserted2024 = await db.insert(nominees).values(
      nominees2024.map(n => ({
        name: n.name,
        category: n.category,
        description: "", // Will be populated by TMDB
        poster: "", // Will be populated by TMDB
        trailerUrl: "", // Will be populated by TMDB
        streamingPlatforms: n.streamingPlatforms,
        awards: [], // Will be populated by TMDB
        cast: [], // Will be populated by TMDB
        crew: [], // Will be populated by TMDB
        funFacts: [],
        ceremonyYear: 2024,
        isWinner: n.isWinner
      }))
    ).returning();
    console.log(`Inserted ${inserted2024.length} nominees for 2024`);

    // Insert 2025 nominees
    const inserted2025 = await db.insert(nominees).values(
      nominees2025.map(n => ({
        name: n.name,
        category: n.category,
        description: "", // Will be populated by TMDB
        poster: "", // Will be populated by TMDB
        trailerUrl: "", // Will be populated by TMDB
        streamingPlatforms: n.streamingPlatforms,
        awards: [], // Will be populated by TMDB
        cast: [], // Will be populated by TMDB
        crew: [], // Will be populated by TMDB
        funFacts: [],
        ceremonyYear: 2025,
        isWinner: false // 2025 winners not yet determined
      }))
    ).returning();
    console.log(`Inserted ${inserted2025.length} nominees for 2025`);

    // Update all nominees with TMDB data
    const allNominees = [...inserted2024, ...inserted2025];
    console.log("Fetching TMDB data for each nominee...");

    const updatedNominees = await Promise.all(
      allNominees.map(async nominee => {
        const updated = await updateNomineeWithTMDBData(nominee);
        if (updated) {
          console.log(`${nominee.name}: Category: ${nominee.category}, Year: ${nominee.ceremonyYear}`);
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