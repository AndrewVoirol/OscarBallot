import { type Nominee, type InsertNominee } from "@shared/schema";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface TMDBSearchResult {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
}

// Structured data for Oscar nominations
interface OscarNomination {
  ceremonyYear: number;
  category: string;
  nominee: string;
  isWinner: boolean;
}

export class OscarSyncService {
  private readonly tmdbToken: string;
  private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    if (!process.env.TMDB_ACCESS_TOKEN) {
      throw new Error("TMDB_ACCESS_TOKEN is required");
    }
    if (!process.env.GOOGLE_AI_KEY) {
      throw new Error("GOOGLE_AI_KEY is required");
    }
    this.tmdbToken = process.env.TMDB_ACCESS_TOKEN;
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  }

  // Method to get nominations for a specific year
  async getNominationsForYear(year: number): Promise<OscarNomination[]> {
    // 2024 Oscar Nominations
    const nominations: OscarNomination[] = [
      // Best Picture
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "American Fiction",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Anatomy of a Fall",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Barbie",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "The Holdovers",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Maestro",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Past Lives",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "Poor Things",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Picture",
        nominee: "The Zone of Interest",
        isWinner: false
      },

      // Best Director
      {
        ceremonyYear: 2024,
        category: "Best Director",
        nominee: "Justine Triet (Anatomy of a Fall)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Director",
        nominee: "Martin Scorsese (Killers of the Flower Moon)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Director",
        nominee: "Christopher Nolan (Oppenheimer)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Director",
        nominee: "Yorgos Lanthimos (Poor Things)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Best Director",
        nominee: "Jonathan Glazer (The Zone of Interest)",
        isWinner: false
      },

      // Actor in a Leading Role
      {
        ceremonyYear: 2024,
        category: "Actor in a Leading Role",
        nominee: "Bradley Cooper (Maestro)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actor in a Leading Role",
        nominee: "Colman Domingo (Rustin)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actor in a Leading Role",
        nominee: "Paul Giamatti (The Holdovers)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actor in a Leading Role",
        nominee: "Cillian Murphy (Oppenheimer)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actor in a Leading Role",
        nominee: "Jeffrey Wright (American Fiction)",
        isWinner: false
      },

      // Actress in a Leading Role
      {
        ceremonyYear: 2024,
        category: "Actress in a Leading Role",
        nominee: "Annette Bening (Nyad)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actress in a Leading Role",
        nominee: "Lily Gladstone (Killers of the Flower Moon)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actress in a Leading Role",
        nominee: "Sandra Hüller (Anatomy of a Fall)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actress in a Leading Role",
        nominee: "Carey Mulligan (Maestro)",
        isWinner: false
      },
      {
        ceremonyYear: 2024,
        category: "Actress in a Leading Role",
        nominee: "Emma Stone (Poor Things)",
        isWinner: false
      }
      // ... Add other categories like Supporting Actor/Actress, Original Screenplay, etc.
    ];

    return nominations.filter(nom => nom.ceremonyYear === year);
  }

  private async findBestMatchWithAI(oscarTitle: string, tmdbResults: TMDBSearchResult[], year: string): Promise<TMDBSearchResult | null> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Task: Find the best matching movie from TMDB results for an Oscar nominee.

Oscar Movie: "${oscarTitle}" (Year: ${year})

TMDB Results:
${tmdbResults.map((movie, index) => 
  `${index}. "${movie.title}" (${movie.release_date})\n   Overview: ${movie.overview}`
).join('\n')}

Analyze each result considering:
1. Title similarity (exact matches, variations, international titles)
2. Release date proximity to Oscar year
3. Plot/overview relevance
4. Common variations in movie titles between databases

Return only the index number (0-based) of the best match. Just the number, e.g. "2".
If no good match exists, return "null".`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();

      if (text === "null") return null;

      const index = parseInt(text);
      if (isNaN(index) || index < 0 || index >= tmdbResults.length) {
        console.warn(`Invalid AI response for ${oscarTitle}: ${text}`);
        return null;
      }

      return tmdbResults[index];
    } catch (error) {
      console.error("Error using Gemini AI for matching:", error);
      return null;
    }
  }

  async searchTMDB(title: string, year: string): Promise<TMDBSearchResult | null> {
    try {
      console.log(`Searching TMDB for: ${title} (${year})`);

      const headers = {
        'Authorization': `Bearer ${this.tmdbToken}`,
        'Content-Type': 'application/json;charset=utf-8'
      };

      // Search with multiple strategies
      const searchStrategies = [
        { year: parseInt(year) },
        { year: parseInt(year) - 1 },
        {}  // No year constraint
      ];

      for (const params of searchStrategies) {
        const response = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
          headers,
          params: {
            query: title,
            ...params,
            include_adult: false,
            language: 'en-US'
          }
        });

        if (response.data.results.length) {
          const match = await this.findBestMatchWithAI(title, response.data.results, year);
          if (match) return match;
        }
      }

      console.log(`No TMDB match found for: ${title}`);
      return null;

    } catch (error: any) {
      console.error("Error searching TMDB:", error.message);
      return null;
    }
  }

  async syncNominee(nomination: OscarNomination): Promise<InsertNominee | null> {
    try {
      console.log(`Processing nominee: ${nomination.nominee} (${nomination.category})`);

      const tmdbData = await this.searchTMDB(nomination.nominee, nomination.ceremonyYear.toString());
      if (!tmdbData) {
        console.warn(`No TMDB match found for: ${nomination.nominee}`);
        return null;
      }

      // Generate AI-enhanced description
      const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      const enhancedDescriptionPrompt = `
Create an engaging, comprehensive description for an Oscar-nominated film:

Oscar Information:
- Film: "${nomination.nominee}"
- Category: ${nomination.category}
- Year: ${nomination.ceremonyYear}

TMDB Overview:
${tmdbData.overview}

Generate a detailed 2-3 sentence description that:
1. Highlights the film's specific achievements related to its Oscar category
2. Includes key plot elements or performances
3. Mentions any technical or artistic innovations
4. References critical reception or impact
Do not mention Oscar results directly.`;

      let aiDescription = tmdbData.overview;
      try {
        const descriptionResult = await model.generateContent(enhancedDescriptionPrompt);
        aiDescription = descriptionResult.response.text().trim();
      } catch (error) {
        console.warn(`Failed to generate AI description for ${nomination.nominee}:`, error);
      }

      return {
        name: nomination.nominee,
        category: nomination.category,
        description: aiDescription,
        poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/original${tmdbData.poster_path}` : '',
        trailerUrl: '',  // Will be populated later
        streamingPlatforms: [],  // Will be populated separately
        awards: {},
        historicalAwards: [{
          year: nomination.ceremonyYear,
          awards: [{
            ceremonyId: 96,  // This would come from a mapping of years to ceremony IDs
            name: "Academy Awards",
            type: nomination.category,
            result: nomination.isWinner ? "Won" : "Nominated",
            dateAwarded: `${nomination.ceremonyYear}-03-10`  // Approximate date
          }]
        }],
        castMembers: [],  // Will be populated by updateNomineeWithTMDBData
        crew: [],        // Will be populated by updateNomineeWithTMDBData
        funFacts: [],    // Will be populated separately
        ceremonyYear: nomination.ceremonyYear,
        isWinner: nomination.isWinner,
        tmdbId: tmdbData.id,
        runtime: null,
        releaseDate: tmdbData.release_date,
        voteAverage: Math.round(tmdbData.vote_average * 10),
        backdropPath: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : '',
        genres: [],
        productionCompanies: [],
        extendedCredits: { cast: [], crew: [] },
        aiGeneratedDescription: aiDescription,
        aiMatchConfidence: 100,
        dataSource: {
          tmdb: { lastUpdated: new Date().toISOString(), version: "3.0" },
          imdb: null,
          wikidata: null
        }
      };
    } catch (error) {
      console.error(`Error syncing nominee ${nomination.nominee}:`, error);
      return null;
    }
  }
}