import { type Nominee, type InsertNominee } from "@shared/schema";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface OscarNominee {
  AwardShowNumber: number;
  AwardYear: string;
  Category: string;
  Nominee: string;
  Film: string;
  Winner: boolean;
}

interface TMDBSearchResult {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
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

  private async fetchWithRetry(url: string, config: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, {
          ...config,
          headers: {
            ...config.headers,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  async fetchOscarData(yearStart: number, yearEnd: number): Promise<OscarNominee[]> {
    const query = {
      Sort: "3-Award Category-Chron",
      AwardCategory: [
        "9998", // Best Picture
        "1",    // Actor in a Leading Role
        "2",    // Actor in a Supporting Role
        "3",    // Actress in a Leading Role
        "4",    // Actress in a Supporting Role
        "5",    // Animated Feature Film
        "6",    // Cinematography
        "8",    // Costume Design
        "9",    // Directing
        "10",   // Documentary Feature
        "11",   // Film Editing
        "12",   // International Feature Film
        "13",   // Makeup and Hairstyling
        "14",   // Music (Original Score)
        "15",   // Music (Original Song)
        "16",   // Production Design
        "17",   // Short Film (Animated)
        "18",   // Short Film (Live Action)
        "19",   // Sound
        "7",    // Visual Effects
        "20",   // Writing (Adapted Screenplay)
        "21",   // Writing (Original Screenplay)
        "9997"  // Documentary Short Subject
      ],
      AwardShowNumberFrom: yearStart,
      AwardShowNumberTo: yearEnd,
      Search: 500  // Increased to ensure we get ALL nominations
    };

    try {
      console.log(`Fetching Oscar data for Academy Awards ${yearStart}-${yearEnd}...`);

      const url = 'https://awardsdatabase.oscars.org/api/awards/search';
      const config = {
        params: query,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': 'https://awardsdatabase.oscars.org',
          'Referer': 'https://awardsdatabase.oscars.org/search'
        }
      };

      const response = await this.fetchWithRetry(url, config);

      if (!response.data?.results?.length) {
        throw new Error("No results returned from Oscar database");
      }

      // Validate and log the categories we received
      const categories = new Set(response.data.results.map((r: OscarNominee) => r.Category));
      console.log("Retrieved categories:", Array.from(categories).sort());
      console.log(`Total nominations found: ${response.data.results.length}`);

      return response.data.results;
    } catch (error: any) {
      console.error("Error fetching Oscar data:", error.message);
      throw error;
    }
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

  async syncNominee(oscarNominee: OscarNominee): Promise<InsertNominee | null> {
    try {
      console.log(`Processing nominee: ${oscarNominee.Film} (${oscarNominee.Category})`);

      const tmdbData = await this.searchTMDB(oscarNominee.Film, oscarNominee.AwardYear);
      if (!tmdbData) {
        console.warn(`No TMDB match found for: ${oscarNominee.Film}`);
        return null;
      }

      // Generate AI-enhanced description
      const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      const enhancedDescriptionPrompt = `
Create an engaging, comprehensive description for an Oscar-nominated film:

Oscar Information:
- Film: "${oscarNominee.Film}"
- Category: ${oscarNominee.Category}
- Year: ${oscarNominee.AwardYear}

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
        console.warn(`Failed to generate AI description for ${oscarNominee.Film}:`, error);
      }

      return {
        name: oscarNominee.Film,
        category: oscarNominee.Category,
        description: aiDescription,
        poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/original${tmdbData.poster_path}` : '',
        trailerUrl: '',  // Will be populated later
        streamingPlatforms: [],  // Will be populated separately
        awards: {},
        historicalAwards: [{
          year: parseInt(oscarNominee.AwardYear),
          awards: [{
            ceremonyId: oscarNominee.AwardShowNumber,
            name: "Academy Awards",
            type: oscarNominee.Category,
            result: oscarNominee.Winner ? "Won" : "Nominated",
            dateAwarded: `${oscarNominee.AwardYear}-03-10`  // 2024 Academy Awards date
          }]
        }],
        castMembers: [],  // Will be populated by updateNomineeWithTMDBData
        crew: [],        // Will be populated by updateNomineeWithTMDBData
        funFacts: [],    // Will be populated separately
        ceremonyYear: parseInt(oscarNominee.AwardYear),
        isWinner: oscarNominee.Winner,
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
      console.error(`Error syncing nominee ${oscarNominee.Film}:`, error);
      return null;
    }
  }
}