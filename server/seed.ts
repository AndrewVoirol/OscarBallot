import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";
import { sql } from "drizzle-orm";

// 2024 Oscar nominees (96th Academy Awards)
const oscar2024Nominees = [
  // Best Picture Nominees (existing)
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
    isWinner: false
  },
  // Adding Best Actor Nominees
  {
    name: "Maestro",
    category: "Best Actor",
    description: "Bradley Cooper's transformative portrayal of Leonard Bernstein in this intimate exploration of the conductor's life and relationships.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Netflix"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Actor",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Bradley Cooper", "Carey Mulligan"],
    crew: ["Bradley Cooper - Director"],
    funFacts: ["Cooper spent six years learning to conduct"],
    ceremonyYear: 2024,
    isWinner: false
  },
  {
    name: "Oppenheimer",
    category: "Best Actor",
    description: "Cillian Murphy's portrayal of J. Robert Oppenheimer, the theoretical physicist who led the development of the atomic bomb.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Peacock"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Actor",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."],
    crew: ["Christopher Nolan - Director"],
    funFacts: ["Murphy's first collaboration with Christopher Nolan as a lead actor"],
    ceremonyYear: 2024,
    isWinner: false
  },
  // Best Actress Nominees
  {
    name: "Poor Things",
    category: "Best Actress",
    description: "Emma Stone stars as Bella Baxter, a young woman brought back to life by an unorthodox scientist in this dark comedy.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Hulu"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Actress",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Emma Stone", "Mark Ruffalo", "Willem Dafoe"],
    crew: ["Yorgos Lanthimos - Director"],
    funFacts: ["Based on the novel by Alasdair Gray"],
    ceremonyYear: 2024,
    isWinner: false
  },
  {
    name: "Anatomy of a Fall",
    category: "Best Actress",
    description: "Sandra Hüller's compelling performance as a woman accused of her husband's murder.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Prime Video"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Actress",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Sandra Hüller", "Swann Arlaud", "Milo Machado Graner"],
    crew: ["Justine Triet - Director"],
    funFacts: ["Won the Palme d'Or at the 2023 Cannes Film Festival"],
    ceremonyYear: 2024,
    isWinner: false
  },
  // Best Supporting Actor
  {
    name: "Oppenheimer",
    category: "Best Supporting Actor",
    description: "Robert Downey Jr.'s portrayal of Lewis Strauss, the chairman of the Atomic Energy Commission.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Peacock"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Supporting Actor",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Robert Downey Jr.", "Cillian Murphy", "Emily Blunt"],
    crew: ["Christopher Nolan - Director"],
    funFacts: ["Downey Jr.'s first collaboration with Christopher Nolan"],
    ceremonyYear: 2024,
    isWinner: false
  },
  // Best Supporting Actress
  {
    name: "The Color Purple",
    category: "Best Supporting Actress",
    description: "Danielle Brooks delivers a powerful performance as Sofia in this musical adaptation.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Max"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Supporting Actress",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Danielle Brooks", "Fantasia Barrino", "Taraji P. Henson"],
    crew: ["Blitz Bazawule - Director"],
    funFacts: ["Based on the Broadway musical adaptation of Alice Walker's novel"],
    ceremonyYear: 2024,
    isWinner: false
  },
  // Best Animated Feature
  {
    name: "Spider-Man: Across the Spider-Verse",
    category: "Best Animated Feature",
    description: "Miles Morales returns in this groundbreaking animated sequel that pushes the boundaries of animation.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Netflix"],
    awards: {},
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Academy Awards",
        type: "Best Animated Feature",
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac"],
    crew: ["Joaquim Dos Santos - Director", "Kemp Powers - Director", "Justin K. Thompson - Director"],
    funFacts: ["Features over 40 unique animation styles"],
    ceremonyYear: 2024,
    isWinner: false
  },
  {
    name: "Barbie",
    category: "Best Picture",
    description: "Barbie and Ken go on a journey of self-discovery following an existential crisis.",
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
    isWinner: false
  },
  {
    name: "The Holdovers",
    category: "Best Picture",
    description: "A cranky teacher, a grieving cook, and a headstrong student form an unlikely family during Christmas break at a boarding school.",
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
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Paul Giamatti", "Da'Vine Joy Randolph", "Dominic Sessa"],
    crew: ["Alexander Payne - Director"],
    funFacts: ["Set in 1970s New England"],
    ceremonyYear: 2024,
    isWinner: false
  },
  {
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    description: "Members of the Osage tribe in Oklahoma are murdered under mysterious circumstances in the 1920s, sparking a major FBI investigation.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Apple TV+"],
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
    castMembers: ["Leonardo DiCaprio", "Robert De Niro", "Lily Gladstone"],
    crew: ["Martin Scorsese - Director"],
    funFacts: ["Based on David Grann's non-fiction book"],
    ceremonyYear: 2024,
    isWinner: false
  },
  {
    name: "Maestro",
    category: "Best Picture",
    description: "A biopic of composer Leonard Bernstein, focusing on his relationship with his wife Felicia Montealegre.",
    poster: "",
    trailerUrl: "",
    streamingPlatforms: ["Netflix"],
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
    castMembers: ["Bradley Cooper", "Carey Mulligan", "Matt Bomer"],
    crew: ["Bradley Cooper - Director"],
    funFacts: ["Cooper spent six years learning to conduct"],
    ceremonyYear: 2024,
    isWinner: false
  },
  {
    name: "Oppenheimer",
    category: "Best Picture",
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
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
        result: "Nominated" as const,
        dateAwarded: "2024-03-10"
      }]
    }],
    castMembers: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."],
    crew: ["Christopher Nolan - Director"],
    funFacts: ["Shot entirely on IMAX cameras"],
    ceremonyYear: 2024,
    isWinner: false
  },
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
    isWinner: false
  },
  {
    name: "Anatomy of a Fall",
    category: "Best Picture",
    description: "A woman is suspected of her husband's murder, and their blind son faces a moral dilemma as the main witness.",
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
    castMembers: ["Sandra Hüller", "Swann Arlaud", "Milo Machado Graner"],
    crew: ["Justine Triet - Director", "Justine Triet - Screenplay"],
    funFacts: ["Won Palme d'Or at 2023 Cannes Film Festival"],
    ceremonyYear: 2024,
    isWinner: false
  }
].map(nominee => ({
  ...nominee,
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
}));

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

    // Update TMDB data for all inserted nominees with retry logic
    console.log("Fetching TMDB data for nominees...");
    const tmdbUpdates = await Promise.allSettled(
      insertedNominees.map(async (nominee) => {
        try {
          const result = await updateNomineeWithTMDBData(nominee);
          if (!result) {
            console.log(`Failed to update TMDB data for ${nominee.name}, retrying once more...`);
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await updateNomineeWithTMDBData(nominee);
          }
          return result;
        } catch (error) {
          console.error(`Error updating ${nominee.name}:`, error);
          return null;
        }
      })
    );

    const successful = tmdbUpdates.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const failed = tmdbUpdates.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value)
    ).length;

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