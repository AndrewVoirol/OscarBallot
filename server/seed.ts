import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";

// 2024 Oscar nominees with their categories and winners (96th Academy Awards)
const nominees2024 = [
  // Best Picture
  { 
    name: "Oppenheimer",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"],
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb."
  },
  { 
    name: "Poor Things",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter."
  },
  { 
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s, sparking a major F.B.I. investigation."
  },
  { 
    name: "Barbie",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Max"],
    description: "Barbie suffers a crisis that leads her to question her world and her existence."
  },
  { 
    name: "The Zone of Interest",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The commandant of Auschwitz, Rudolf Höss, and his wife Hedwig, strive to build a dream life for their family in a house and garden next to the camp."
  },
  // Best Director
  {
    name: "Oppenheimer",
    category: "Best Director",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"],
    description: "Christopher Nolan for his visionary direction of Oppenheimer"
  },
  {
    name: "Poor Things",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Yorgos Lanthimos for his innovative direction of Poor Things"
  },
  // Best International Feature
  {
    name: "The Zone of Interest",
    category: "Best International Feature",
    isWinner: true,
    streamingPlatforms: ["Theaters"],
    description: "Jonathan Glazer's haunting exploration of the banality of evil"
  },
  {
    name: "Perfect Days",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Wim Wenders' meditation on finding beauty in the everyday"
  }
];

// 2025 Oscar nominees (97th Academy Awards) - Anticipated Contenders
const nominees2025 = [
  // Best Picture Contenders
  { 
    name: "Dune: Part Two",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family."
  },
  { 
    name: "Inside Out 2",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Follow Riley in her teenage years as new emotions join Joy, Sadness, Anger, Fear, and Disgust in Headquarters."
  },
  { 
    name: "Joker: Folie à Deux",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The continuation of the story of Arthur Fleck, this time exploring his relationship with Harley Quinn."
  },
  { 
    name: "Gladiator 2",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The sequel to Ridley Scott's epic historical drama, following a new generation of characters in ancient Rome."
  },
  // Best Director Contenders
  {
    name: "Dune: Part Two",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Denis Villeneuve returns to direct the epic conclusion of the first Dune saga"
  },
  {
    name: "Joker: Folie à Deux",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Todd Phillips directs this musical psychological thriller"
  },
  // Best International Feature Contenders
  {
    name: "The Beast",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Bertrand Bonello's futuristic romance starring Léa Seydoux"
  },
  {
    name: "Kinds of Kindness",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Yorgos Lanthimos' anthology film exploring different realities"
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
        description: n.description, 
        poster: "",
        trailerUrl: "",
        streamingPlatforms: n.streamingPlatforms,
        awards: [],
        castMembers: [], 
        crew: [],
        funFacts: [],
        ceremonyYear: 2024,
        isWinner: n.isWinner,
        historicalAwards: [], 
        genres: [], 
        backdropPath: "", 
        productionCompanies: [], 
        extendedCredits: { cast: [], crew: [] } 
      }))
    ).returning();
    console.log(`Inserted ${inserted2024.length} nominees for 2024`);

    // Insert 2025 nominees
    const inserted2025 = await db.insert(nominees).values(
      nominees2025.map(n => ({
        name: n.name,
        category: n.category,
        description: n.description,
        poster: "",
        trailerUrl: "",
        streamingPlatforms: n.streamingPlatforms,
        awards: [],
        castMembers: [], 
        crew: [],
        funFacts: [],
        ceremonyYear: 2025,
        isWinner: false,
        historicalAwards: [], 
        genres: [], 
        backdropPath: "", 
        productionCompanies: [], 
        extendedCredits: { cast: [], crew: [] } 
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
          console.log(`Updated: ${nominee.name} (${nominee.category}, ${nominee.ceremonyYear})`);
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