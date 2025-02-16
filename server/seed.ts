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
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Prime Video"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Picture",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Jeffrey Wright", "Tracee Ellis Ross", "John Ortiz"],
    crew: ["Cord Jefferson - Director", "Cord Jefferson - Screenplay"],
    funFacts: ["Based on the novel 'Erasure' by Percival Everett"],
    ceremonyYear: 2024,
    isWinner: false,
    tmdbId: null,
    runtime: null,
    releaseDate: null,
    voteAverage: null,
    backdropPath: "",
    genres: [],
    productionCompanies: [],
    extendedCredits: { cast: [], crew: [] },
    aiGeneratedDescription: "",
    aiMatchConfidence: 100,
    dataSource: {
      tmdb: null,
      imdb: null,
      wikidata: null
    }
  },
  {
    name: "Barbie",
    category: "Best Picture",
    description: "To live in Barbie Land is to be a perfect being in a perfect place. Unless you have a full-on existential crisis. Or you're a Ken.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Max"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Picture",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Margot Robbie", "Ryan Gosling", "America Ferrera"],
    crew: ["Greta Gerwig - Director", "Greta Gerwig - Screenplay"],
    funFacts: ["Highest-grossing film of 2023"],
    ceremonyYear: 2024,
    isWinner: false,
    tmdbId: null,
    runtime: null,
    releaseDate: null,
    voteAverage: null,
    backdropPath: "",
    genres: [],
    productionCompanies: [],
    extendedCredits: { cast: [], crew: [] },
    aiGeneratedDescription: "",
    aiMatchConfidence: 100,
    dataSource: {
      tmdb: null,
      imdb: null,
      wikidata: null
    }
  },
  {
    name: "Poor Things",
    category: "Best Picture",
    description: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Hulu"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Picture",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Emma Stone", "Mark Ruffalo", "Willem Dafoe"],
    crew: ["Yorgos Lanthimos - Director"],
    funFacts: ["Based on the novel by Alasdair Gray"],
    ceremonyYear: 2024,
    isWinner: false,
    tmdbId: null,
    runtime: null,
    releaseDate: null,
    voteAverage: null,
    backdropPath: "",
    genres: [],
    productionCompanies: [],
    extendedCredits: { cast: [], crew: [] },
    aiGeneratedDescription: "",
    aiMatchConfidence: 100,
    dataSource: {
      tmdb: null,
      imdb: null,
      wikidata: null
    }
  },
  {
    name: "Oppenheimer",
    category: "Best Picture",
    description: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Peacock"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Picture",
        result: "Won" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."],
    crew: ["Christopher Nolan - Director", "Christopher Nolan - Screenplay"],
    funFacts: ["Shot entirely in IMAX"],
    ceremonyYear: 2024,
    isWinner: true,
    tmdbId: null,
    runtime: null,
    releaseDate: null,
    voteAverage: null,
    backdropPath: "",
    genres: [],
    productionCompanies: [],
    extendedCredits: { cast: [], crew: [] },
    aiGeneratedDescription: "",
    aiMatchConfidence: 100,
    dataSource: {
      tmdb: null,
      imdb: null,
      wikidata: null
    }
  }
];

export async function seed() {
  try {
    console.log("Starting database seeding...");

    // Clear existing nominees
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Insert nominees
    console.log("Inserting nominees...");
    const insertedNominees = await db
      .insert(nominees)
      .values(oscar2024Nominees)
      .returning();

    console.log(`Successfully inserted ${insertedNominees.length} nominees`);

    // Update TMDB data for all inserted nominees
    console.log("Fetching TMDB data for nominees...");
    const tmdbUpdates = await Promise.allSettled(
      insertedNominees.map((nominee) => updateNomineeWithTMDBData(nominee))
    );

    const successful = tmdbUpdates.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const failed = tmdbUpdates.filter((r) => r.status === "rejected").length;

    console.log("\nSeeding Summary:");
    console.log(`- Total nominees inserted: ${insertedNominees.length}`);
    console.log(`- TMDB updates successful: ${successful}`);
    console.log(`- TMDB updates failed: ${failed}`);

    return {
      totalInserted: insertedNominees.length,
      tmdbUpdatesSuccessful: successful,
      tmdbUpdatesFailed: failed,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}