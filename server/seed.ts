import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";
import { sql } from "drizzle-orm";

// 2024 Oscar nominees (96th Academy Awards)
const oscar2024Nominees = [
  {
    name: "American Fiction",
    category: "Best Picture",
    description: "A novelist who's fed up with the establishment profiting from Black entertainment decides to write a stereotypical book under a pen name, only to find himself trapped in the same world he's trying to critique.",
    streamingPlatforms: ["Prime Video"],
    funFacts: ["Based on the novel 'Erasure' by Percival Everett"],
    isWinner: false,
    ceremonyYear: 2024
  },
  {
    name: "Barbie",
    category: "Best Picture",
    description: "Barbie and Ken go on a journey of self-discovery following an existential crisis.",
    streamingPlatforms: ["Max"],
    funFacts: ["Highest-grossing film of 2023"],
    isWinner: false,
    ceremonyYear: 2024
  },
  {
    name: "Oppenheimer",
    category: "Best Picture",
    description: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb.",
    streamingPlatforms: ["Peacock"],
    funFacts: ["Shot entirely in IMAX"],
    isWinner: false,
    ceremonyYear: 2024
  },
  {
    name: "Poor Things",
    category: "Best Picture",
    description: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.",
    streamingPlatforms: ["Theaters"],
    funFacts: ["Based on Alasdair Gray's novel"],
    isWinner: false,
    ceremonyYear: 2024
  },
  {
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    description: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s.",
    streamingPlatforms: ["Apple TV+"],
    funFacts: ["Based on David Grann's non-fiction book"],
    isWinner: false,
    ceremonyYear: 2024
  }
];

export async function seed() {
  try {
    console.log("Starting database seeding...");

    // Clear existing nominees
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Process and insert nominees
    console.log("Processing and inserting nominees...");
    const nomineePromises = oscar2024Nominees.map(async (nominee) => {
      try {
        // Create base nominee record
        const baseNominee = {
          ...nominee,
          poster: "",
          trailerUrl: "",
          awards: {},
          castMembers: [],
          crew: [],
          historicalAwards: [{
            year: nominee.ceremonyYear,
            awards: [{
              ceremonyId: 96,
              name: "Academy Awards",
              type: nominee.category,
              result: "Nominated",
              dateAwarded: "2024-03-10"
            }]
          }],
          genres: [],
          backdropPath: "",
          productionCompanies: [],
          extendedCredits: { cast: [], crew: [] },
          aiGeneratedDescription: "",
          aiMatchConfidence: 100,
          dataSource: {
            tmdb: null,
            imdb: null,
            wikidata: null
          }
        };

        // Insert base nominee
        const [inserted] = await db
          .insert(nominees)
          .values(baseNominee)
          .returning();

        return inserted;
      } catch (error) {
        console.error(`Failed to process nominee ${nominee.name}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(nomineePromises);
    const inserted = results
      .filter((r): r is PromiseFulfilledResult<typeof nominees.$inferSelect> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    console.log(`Successfully inserted ${inserted.length} nominees`);

    // Update TMDB data for all inserted nominees
    console.log("Fetching TMDB data for nominees...");
    const tmdbUpdates = await Promise.allSettled(
      inserted.map((nominee) => updateNomineeWithTMDBData(nominee))
    );

    // Log results summary
    const successful = tmdbUpdates.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const failed = tmdbUpdates.filter((r) => r.status === "rejected").length;

    console.log("\nSeeding Summary:");
    console.log(`- Total nominees inserted: ${inserted.length}`);
    console.log(`- TMDB updates successful: ${successful}`);
    console.log(`- TMDB updates failed: ${failed}`);
    console.log("Database seeding completed");

    return {
      totalInserted: inserted.length,
      tmdbUpdatesSuccessful: successful,
      tmdbUpdatesFailed: failed,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}