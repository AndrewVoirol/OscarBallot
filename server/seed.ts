import { db } from "./db";
import { nominees } from "@shared/schema";
import { updateNomineeWithTMDBData } from "./tmdb";

// Historical Oscar nominees data (2020-2023)
const nominees2020 = [
  {
    name: "Parasite",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Hulu", "Digital Purchase"],
    description: "A poor family schemes to become employed by a wealthy family and infiltrate their household.",
    ceremonyYear: 2020
  },
  {
    name: "1917",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Digital Purchase"],
    description: "Two young British soldiers during WWI are given an impossible mission.",
    ceremonyYear: 2020
  }
];

const nominees2021 = [
  {
    name: "Nomadland",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Hulu"],
    description: "A woman in her sixties embarks on a journey through the American West.",
    ceremonyYear: 2021
  },
  {
    name: "The Trial of the Chicago 7",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "The story of 7 people on trial stemming from various charges surrounding the uprising at the 1968 Democratic National Convention.",
    ceremonyYear: 2021
  }
];

const nominees2022 = [
  {
    name: "CODA",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Apple TV+"],
    description: "A hearing teenage girl with deaf parents discovers her passion for singing.",
    ceremonyYear: 2022
  },
  {
    name: "The Power of the Dog",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "A domineering rancher responds with mocking cruelty when his brother brings home a new wife and her son.",
    ceremonyYear: 2022
  }
];

const nominees2023 = [
  {
    name: "Everything Everywhere All at Once",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Showtime"],
    description: "A Chinese immigrant gets unwittingly embroiled in an epic adventure.",
    ceremonyYear: 2023
  },
  {
    name: "The Banshees of Inisherin",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["HBO Max"],
    description: "Two lifelong friends find themselves at an impasse when one abruptly ends their relationship.",
    ceremonyYear: 2023
  }
];

// 2024 Oscar nominees with their categories and winners (96th Academy Awards)
const nominees2024 = [
  // Best Picture
  { 
    name: "Oppenheimer",
    category: "Best Picture",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"],
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    ceremonyYear: 2024
  },
  { 
    name: "Poor Things",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.",
    ceremonyYear: 2024
  },
  { 
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s, sparking a major F.B.I. investigation.",
    ceremonyYear: 2024
  },
  { 
    name: "Barbie",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Max"],
    description: "Barbie suffers a crisis that leads her to question her world and her existence.",
    ceremonyYear: 2024
  },
  { 
    name: "The Zone of Interest",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The commandant of Auschwitz, Rudolf Höss, and his wife Hedwig, strive to build a dream life for their family in a house and garden next to the camp.",
    ceremonyYear: 2024
  },
  // Best Director
  {
    name: "Oppenheimer",
    category: "Best Director",
    isWinner: true,
    streamingPlatforms: ["Peacock", "Digital Purchase"],
    description: "Christopher Nolan for his visionary direction of Oppenheimer",
    ceremonyYear: 2024
  },
  {
    name: "Poor Things",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Yorgos Lanthimos for his innovative direction of Poor Things",
    ceremonyYear: 2024
  },
  // Best International Feature
  {
    name: "The Zone of Interest",
    category: "Best International Feature",
    isWinner: true,
    streamingPlatforms: ["Theaters"],
    description: "Jonathan Glazer's haunting exploration of the banality of evil",
    ceremonyYear: 2024
  },
  {
    name: "Perfect Days",
    category: "Best International Feature",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "Wim Wenders' meditation on finding beauty in the everyday",
    ceremonyYear: 2024
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

    // Prepare all nominees data
    const allNomineesData = [
      ...nominees2020,
      ...nominees2021,
      ...nominees2022,
      ...nominees2023,
      ...nominees2024.map(n => ({ ...n, ceremonyYear: 2024 })),
      ...nominees2025.map(n => ({ ...n, ceremonyYear: 2025 }))
    ];

    // Insert all nominees with base data
    const insertedNominees = await db.insert(nominees).values(
      allNomineesData.map(n => ({
        name: n.name,
        category: n.category,
        description: n.description,
        poster: "",
        trailerUrl: "",
        streamingPlatforms: n.streamingPlatforms,
        awards: [],
        cast: [],
        crew: [],
        funFacts: [],
        ceremonyYear: n.ceremonyYear,
        isWinner: n.isWinner ?? false,
        dataVersion: 1,
        dataComplete: false
      }))
    ).returning();

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