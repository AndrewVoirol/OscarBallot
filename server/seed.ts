import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";
import { sql } from "drizzle-orm";

// Base nominee type for seeding
type BaseSeedNominee = {
  name: string;
  category: string;
  isWinner: boolean;
  streamingPlatforms: string[];
  description: string;
  funFacts: string[];
};

// 2024 Oscar nominees (96th Academy Awards)
const nominees2024: BaseSeedNominee[] = [
  // Best Picture
  { 
    name: "Oppenheimer",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"],
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    funFacts: [
      "Shot entirely on IMAX cameras",
      "Used practical effects instead of CGI for nuclear explosion sequences",
      "Cillian Murphy lost significant weight for the role"
    ]
  },
  { 
    name: "Poor Things",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.",
    funFacts: [
      "Features unique Victorian-era steampunk aesthetics",
      "Emma Stone also served as producer",
      "Shot in black and white and color sequences"
    ]
  },
  { 
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s, sparking a major F.B.I. investigation.",
    funFacts: []
  },
  { 
    name: "Barbie",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Max"],
    description: "Barbie suffers a crisis that leads her to question her world and her existence.",
    funFacts: []
  },
  { 
    name: "The Zone of Interest",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The commandant of Auschwitz, Rudolf Höss, and his wife Hedwig, strive to build a dream life for their family in a house and garden next to the camp.",
    funFacts: []
  },
  // Best Director
  {
    name: "Oppenheimer",
    category: "Best Director",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"],
    description: "Christopher Nolan for his visionary direction of Oppenheimer",
    funFacts: []
  },
  {
    name: "Poor Things",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Yorgos Lanthimos for his innovative direction of Poor Things",
    funFacts: []
  },
  // Best International Feature
  {
    name: "The Zone of Interest",
    category: "Best International Feature",
    isWinner: true,
    streamingPlatforms: ["Theaters"],
    description: "Jonathan Glazer's haunting exploration of the banality of evil",
    funFacts: []
  },
  {
    name: "Perfect Days",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Wim Wenders' meditation on finding beauty in the everyday",
    funFacts: []
  }
];

// 2025 Oscar nominees (97th Academy Awards)
const nominees2025: BaseSeedNominee[] = [
  // Best Picture Contenders
  { 
    name: "Dune: Part Two",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    funFacts: [
      "Filmed in real desert locations",
      "Features over 1000 visual effects shots",
      "Cast underwent extensive combat training"
    ]
  },
  { 
    name: "Inside Out 2",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Follow Riley in her teenage years as new emotions join Joy, Sadness, Anger, Fear, and Disgust in Headquarters.",
    funFacts: []
  },
  { 
    name: "Joker: Folie à Deux",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The continuation of the story of Arthur Fleck, this time exploring his relationship with Harley Quinn.",
    funFacts: []
  },
  { 
    name: "Gladiator 2",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The sequel to Ridley Scott's epic historical drama, following a new generation of characters in ancient Rome.",
    funFacts: []
  },
  // Best Director Contenders
  {
    name: "Dune: Part Two",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Denis Villeneuve returns to direct the epic conclusion of the first Dune saga",
    funFacts: []
  },
  {
    name: "Joker: Folie à Deux",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Todd Phillips directs this musical psychological thriller",
    funFacts: []
  },
  // Best International Feature Contenders
  {
    name: "The Beast",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Bertrand Bonello's futuristic romance starring Léa Seydoux",
    funFacts: []
  },
  {
    name: "Kinds of Kindness",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Yorgos Lanthimos' anthology film exploring different realities",
    funFacts: []
  }
];

async function seed() {
  try {
    console.log("Starting database seeding...");

    // Clear existing nominees using a more efficient query
    await db.execute(sql`TRUNCATE TABLE ${nominees}`);
    console.log("Cleared existing nominees");

    // Transform nominees data for insertion
    const transformNominee = (nominee: BaseSeedNominee, year: number) => ({
      ...nominee,
      poster: "",
      trailerUrl: "",
      awards: [],
      castMembers: [],
      crew: [],
      ceremonyYear: year,
      historicalAwards: [],
      genres: [],
      backdropPath: "",
      productionCompanies: [],
      extendedCredits: { cast: [], crew: [] }
    });

    // Batch insert nominees for both years
    const nomineeRecords = [
      ...nominees2024.map(n => transformNominee(n, 2024)),
      ...nominees2025.map(n => transformNominee(n, 2025))
    ];

    const inserted = await db.insert(nominees)
      .values(nomineeRecords)
      .returning();

    console.log(`Inserted ${inserted.length} nominees`);

    // Update TMDB data in parallel with proper error handling
    console.log("Fetching TMDB data for nominees...");
    const results = await Promise.allSettled(
      inserted.map(nominee => updateNomineeWithTMDBData(nominee))
    );

    // Log results summary
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log("\nSeeding Summary:");
    console.log(`- Total nominees inserted: ${inserted.length}`);
    console.log(`- TMDB updates successful: ${successful}`);
    console.log(`- TMDB updates failed: ${failed}`);
    console.log("Database seeding completed");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error; // Re-throw to ensure the error is properly handled by the calling code
  }
}

// Execute seeding
seed().catch(console.error);