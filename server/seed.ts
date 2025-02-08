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
    description: "The incredible tale about the fantastical evolution of Bella Baxter.",
    ceremonyYear: 2024
  },
  { 
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s.",
    ceremonyYear: 2024
  },
  // Best Actor
  {
    name: "Cillian Murphy",
    category: "Best Actor",
    isWinner: true,
    streamingPlatforms: ["Peacock"],
    description: "For the role of J. Robert Oppenheimer in Oppenheimer",
    ceremonyYear: 2024
  },
  {
    name: "Paul Giamatti",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "For the role of Paul Hunham in The Holdovers",
    ceremonyYear: 2024
  },
  {
    name: "Bradley Cooper",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "For the role of Leonard Bernstein in Maestro",
    ceremonyYear: 2024
  },
  // Best Actress
  {
    name: "Emma Stone",
    category: "Best Actress",
    isWinner: true,
    streamingPlatforms: ["Theaters"],
    description: "For the role of Bella Baxter in Poor Things",
    ceremonyYear: 2024
  },
  {
    name: "Lily Gladstone",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "For the role of Mollie Burkhart in Killers of the Flower Moon",
    ceremonyYear: 2024
  },
  {
    name: "Sandra Hüller",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "For the role of Hedwig Höss in The Zone of Interest",
    ceremonyYear: 2024
  },
  // Best Supporting Actor
  {
    name: "Robert Downey Jr.",
    category: "Best Supporting Actor",
    isWinner: true,
    streamingPlatforms: ["Peacock"],
    description: "For the role of Lewis Strauss in Oppenheimer",
    ceremonyYear: 2024
  },
  {
    name: "Ryan Gosling",
    category: "Best Supporting Actor",
    isWinner: false,
    streamingPlatforms: ["Max"],
    description: "For the role of Ken in Barbie",
    ceremonyYear: 2024
  },
  {
    name: "Robert De Niro",
    category: "Best Supporting Actor",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "For the role of William Hale in Killers of the Flower Moon",
    ceremonyYear: 2024
  },
  // Best Supporting Actress
  {
    name: "Da'Vine Joy Randolph",
    category: "Best Supporting Actress",
    isWinner: true,
    streamingPlatforms: ["Theaters"],
    description: "For the role of Mary Lamb in The Holdovers",
    ceremonyYear: 2024
  },
  {
    name: "Emily Blunt",
    category: "Best Supporting Actress",
    isWinner: false,
    streamingPlatforms: ["Peacock"],
    description: "For the role of Kitty Oppenheimer in Oppenheimer",
    ceremonyYear: 2024
  },
  {
    name: "America Ferrera",
    category: "Best Supporting Actress",
    isWinner: false,
    streamingPlatforms: ["Max"],
    description: "For the role of Gloria in Barbie",
    ceremonyYear: 2024
  },
  // Best Director
  {
    name: "Christopher Nolan",
    category: "Best Director",
    isWinner: true,
    streamingPlatforms: ["Peacock"],
    description: "For directing Oppenheimer",
    ceremonyYear: 2024
  },
  {
    name: "Martin Scorsese",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Apple TV+"],
    description: "For directing Killers of the Flower Moon",
    ceremonyYear: 2024
  },
  {
    name: "Yorgos Lanthimos",
    category: "Best Director",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "For directing Poor Things",
    ceremonyYear: 2024
  },
  // Best Animated Feature
  {
    name: "The Boy and the Heron",
    category: "Best Animated Feature",
    isWinner: true,
    streamingPlatforms: ["Theaters"],
    description: "Hayao Miyazaki's semi-autobiographical fantasy about loss, grief and hope",
    ceremonyYear: 2024
  },
  {
    name: "Spider-Man: Across the Spider-Verse",
    category: "Best Animated Feature",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People",
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

// 2025 Oscar nominees (97th Academy Awards) - Official Nominations
const nominees2025 = [
  // Best Picture
  { 
    name: "American Fiction",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters", "Prime Video"],
    description: "A novelist who's fed up with the establishment profiting from Black entertainment uses a pen name to write a book that propels him into the heart of hypocrisy and the madness he claims to disdain.",
    ceremonyYear: 2025
  },
  { 
    name: "Anatomy of a Fall",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "A woman is suspected of her husband's murder, and their blind son faces a moral dilemma as the main witness.",
    ceremonyYear: 2025
  },
  { 
    name: "Barbie",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Max", "Prime Video"],
    description: "Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbie Land. However, when they get a chance to go to the real world, they soon discover the joys and perils of living among humans.",
    ceremonyYear: 2025
  },
  { 
    name: "The Holdovers",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Peacock", "Prime Video"],
    description: "A cranky history teacher at a remote prep school is forced to remain on campus over the holidays with a troubled student who has no place to go.",
    ceremonyYear: 2025
  },
  { 
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Apple TV+", "Prime Video"],
    description: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s, sparking a major F.B.I. investigation involving J. Edgar Hoover.",
    ceremonyYear: 2025
  },
  { 
    name: "Maestro",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "A chronicle of the lifelong relationship between Leonard Bernstein and Felicia Montealegre Cohn Bernstein.",
    ceremonyYear: 2025
  },
  { 
    name: "Oppenheimer",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Peacock", "Prime Video"],
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    ceremonyYear: 2025
  },
  { 
    name: "Past Lives",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Prime Video"],
    description: "Nora and Hae Sung, two deeply connected childhood friends, are wrested apart after Nora's family emigrates from South Korea. Twenty years later, they are reunited for one fateful week.",
    ceremonyYear: 2025
  },
  { 
    name: "Poor Things",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.",
    ceremonyYear: 2025
  },
  { 
    name: "The Zone of Interest",
    category: "Best Picture",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "The commandant of Auschwitz, Rudolf Höss, and his wife Hedwig, strive to build a dream life for their family in a house and garden next to the camp.",
    ceremonyYear: 2025
  },

  // Best Actor
  {
    name: "Bradley Cooper",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "For portraying Leonard Bernstein in Maestro",
    ceremonyYear: 2025
  },
  {
    name: "Colman Domingo",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Prime Video"],
    description: "For portraying Bayard Rustin in Rustin",
    ceremonyYear: 2025
  },
  {
    name: "Paul Giamatti",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Peacock", "Prime Video"],
    description: "For portraying Paul Hunham in The Holdovers",
    ceremonyYear: 2025
  },
  {
    name: "Cillian Murphy",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Peacock", "Prime Video"],
    description: "For portraying J. Robert Oppenheimer in Oppenheimer",
    ceremonyYear: 2025
  },
  {
    name: "Jeffrey Wright",
    category: "Best Actor",
    isWinner: false,
    streamingPlatforms: ["Prime Video"],
    description: "For portraying Thelonious 'Monk' Ellison in American Fiction",
    ceremonyYear: 2025
  },

  // Best Actress
  {
    name: "Annette Bening",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Prime Video"],
    description: "For portraying Diana Nyad in Nyad",
    ceremonyYear: 2025
  },
  {
    name: "Lily Gladstone",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Apple TV+", "Prime Video"],
    description: "For portraying Mollie Burkhart in Killers of the Flower Moon",
    ceremonyYear: 2025
  },
  {
    name: "Sandra Hüller",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "For portraying Sandra Voyter in Anatomy of a Fall",
    ceremonyYear: 2025
  },
  {
    name: "Carey Mulligan",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Netflix"],
    description: "For portraying Felicia Montealegre Bernstein in Maestro",
    ceremonyYear: 2025
  },
  {
    name: "Emma Stone",
    category: "Best Actress",
    isWinner: false,
    streamingPlatforms: ["Theaters"],
    description: "For portraying Bella Baxter in Poor Things",
    ceremonyYear: 2025
  }
  // Rest of nominees2025 array remains unchanged
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