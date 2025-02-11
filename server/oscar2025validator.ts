import { db } from "./db";
import { nominees, OscarCategories } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ValidationError {
  type: 'missing' | 'incorrect' | 'incomplete';
  category: string;
  details: string;
  severity: 'high' | 'medium' | 'low';
  recommendation?: string;
}

interface NomineeMetadata {
  tmdbData: any;
  mediaValidation: any;
  historicalData: any;
}

// Official 2025 nominees data structure - this matches oscars.org
const official2025Categories = {
  [OscarCategories.PICTURE]: [
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
  [OscarCategories.ACTOR]: [
    "Bradley Cooper",
    "Colman Domingo",
    "Paul Giamatti",
    "Cillian Murphy",
    "Jeffrey Wright"
  ],
  [OscarCategories.ACTRESS]: [
    "Annette Bening",
    "Lily Gladstone",
    "Sandra Hüller",
    "Carey Mulligan",
    "Emma Stone"
  ],
  [OscarCategories.SUPPORTING_ACTOR]: [
    "Sterling K. Brown",
    "Robert De Niro",
    "Robert Downey Jr.",
    "Ryan Gosling",
    "Mark Ruffalo"
  ],
  [OscarCategories.SUPPORTING_ACTRESS]: [
    "Emily Blunt",
    "Danielle Brooks",
    "America Ferrera",
    "Jodie Foster",
    "Da'Vine Joy Randolph"
  ],
  [OscarCategories.DIRECTOR]: [
    "Justine Triet",
    "Martin Scorsese",
    "Christopher Nolan",
    "Yorgos Lanthimos",
    "Jonathan Glazer"
  ],
  [OscarCategories.ANIMATED_FEATURE]: [
    "The Boy and the Heron",
    "Elemental",
    "Nimona",
    "Robot Dreams",
    "Spider-Man: Across the Spider-Verse"
  ]
};

export async function validate2025Nominees() {
  const errors: ValidationError[] = [];

  // Get all 2025 nominees from database
  const currentNominees = await db
    .select()
    .from(nominees)
    .where(eq(nominees.ceremonyYear, 2025));

  // Check for completeness in each category
  for (const [category, expectedNominees] of Object.entries(official2025Categories)) {
    const categoryNominees = currentNominees.filter(n => n.category === category);

    // Check for missing nominees
    for (const expectedName of expectedNominees) {
      const found = categoryNominees.find(n => n.name === expectedName);
      if (!found) {
        errors.push({
          type: 'missing',
          category,
          details: `Missing nominee: ${expectedName} in ${category}`,
          severity: 'high',
          recommendation: `Add nominee "${expectedName}" to ${category}`
        });
        continue;
      }

      // Validate nominee data completeness
      if (!found.tmdbId || !found.poster || found.poster === '/placeholder-poster.jpg') {
        errors.push({
          type: 'incomplete',
          category,
          details: `Incomplete TMDB data for ${expectedName}: missing ${!found.tmdbId ? 'TMDB ID' : 'poster'}`,
          severity: 'high',
          recommendation: 'Update TMDB data for complete nominee information'
        });
      }

      // For movies, check additional required fields
      if (category === OscarCategories.PICTURE) {
        if (!found.overview || !found.releaseDate || !found.runtime) {
          errors.push({
            type: 'incomplete',
            category,
            details: `Incomplete movie data for ${expectedName}: missing ${
              !found.overview ? 'overview' : !found.releaseDate ? 'release date' : 'runtime'
            }`,
            severity: 'high',
            recommendation: 'Fetch complete movie details from TMDB'
          });
        }
      }

      // For persons, check biography
      if ([OscarCategories.ACTOR, OscarCategories.ACTRESS, OscarCategories.SUPPORTING_ACTOR, 
           OscarCategories.SUPPORTING_ACTRESS, OscarCategories.DIRECTOR].includes(category as any)) {
        if (!found.biography) {
          errors.push({
            type: 'incomplete',
            category,
            details: `Missing biography for ${expectedName}`,
            severity: 'medium',
            recommendation: 'Fetch biography data from TMDB'
          });
        }
      }
    }

    // Check for incorrect nominees
    for (const current of categoryNominees) {
      if (!expectedNominees.includes(current.name)) {
        errors.push({
          type: 'incorrect',
          category,
          details: `Incorrect nominee in database: ${current.name} for ${category}`,
          severity: 'high',
          recommendation: `Remove incorrect nominee "${current.name}" from ${category}`
        });
      }
    }
  }

  return {
    totalNominees: currentNominees.length,
    errors,
    errorCount: errors.length,
    categoryCounts: Object.fromEntries(
      Object.entries(official2025Categories).map(([category, nominees]) => 
        [category, currentNominees.filter(n => n.category === category).length]
      )
    )
  };
}