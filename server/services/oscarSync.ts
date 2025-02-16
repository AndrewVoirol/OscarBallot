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
  private readonly tmdbBaseUrl = "https://api.themoviedb.org/4";
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

  async fetchOscarData(yearStart: number, yearEnd: number): Promise<OscarNominee[]> {
    const query = {
      Sort: "3-Award Category-Chron",
      AwardCategory: ["9998","1","2","3","4","5","6","8","9","10","9997","11","12","13","14","15","16","17","18","19","7","20","21","84","24","25","26","27","28","29"],
      AwardShowNumberFrom: yearStart,
      AwardShowNumberTo: yearEnd,
      Search: 30
    };

    try {
      console.log(`Fetching Oscar data for Academy Awards ${yearStart}-${yearEnd}...`);
      const response = await axios.get("https://awardsdatabase.oscars.org/search/getresults", {
        params: { query: JSON.stringify(query) }
      });

      if (!response.data?.results?.length) {
        throw new Error("No results returned from Oscar database");
      }

      console.log(`Retrieved ${response.data.results.length} nominations`);
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

      // Try exact year first
      const exactYearResponse = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
        headers: { 'Authorization': `Bearer ${this.tmdbToken}` },
        params: {
          query: title,
          year: new Date(year).getFullYear(),
          include_adult: false
        }
      });

      // If no results, try year-1 (movies often release year before Oscar nomination)
      if (!exactYearResponse.data.results.length) {
        const previousYearResponse = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
          headers: { 'Authorization': `Bearer ${this.tmdbToken}` },
          params: {
            query: title,
            year: new Date(year).getFullYear() - 1,
            include_adult: false
          }
        });

        if (!previousYearResponse.data.results.length) {
          console.log(`No TMDB results found for: ${title}`);
          return null;
        }

        return await this.findBestMatchWithAI(title, previousYearResponse.data.results, year);
      }

      return await this.findBestMatchWithAI(title, exactYearResponse.data.results, year);

    } catch (error: any) {
      console.error("Error searching TMDB:", error.message);
      return null;
    }
  }

  async syncNominee(oscarNominee: OscarNominee): Promise<InsertNominee | null> {
    const tmdbData = await this.searchTMDB(oscarNominee.Film, oscarNominee.AwardYear);
    if (!tmdbData) {
      console.warn(`No TMDB match found for: ${oscarNominee.Film}`);
      return null;
    }

    // Generate AI-enhanced description using both Oscar and TMDB data
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    const enhancedDescriptionPrompt = `
Create an engaging, informative description for an Oscar-nominated film by combining:

Oscar Information:
- Film: "${oscarNominee.Film}"
- Category: ${oscarNominee.Category}
- Year: ${oscarNominee.AwardYear}
- Result: ${oscarNominee.Winner ? "Won" : "Nominated"}

TMDB Overview:
${tmdbData.overview}

Generate a comprehensive 2-3 sentence description that highlights:
1. The film's artistic/technical achievements
2. Its Oscar recognition
3. Key plot elements
Do not mention the Oscar result directly in the description.
`;

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
      trailerUrl: '',  // Will be populated by updateNomineeWithTMDBData
      streamingPlatforms: [],
      awards: {},
      historicalAwards: [{
        year: parseInt(oscarNominee.AwardYear),
        awards: [{
          ceremonyId: oscarNominee.AwardShowNumber,
          name: "Academy Awards",
          type: oscarNominee.Category,
          result: oscarNominee.Winner ? "Won" : "Nominated",
          dateAwarded: new Date(parseInt(oscarNominee.AwardYear), 1, 1).toISOString().split('T')[0]
        }]
      }],
      castMembers: [],
      crew: [],
      funFacts: [],
      ceremonyYear: parseInt(oscarNominee.AwardYear),
      isWinner: oscarNominee.Winner,
      tmdbId: tmdbData.id,
      runtime: 0,
      releaseDate: tmdbData.release_date,
      voteAverage: Math.round(tmdbData.vote_average * 10),
      backdropPath: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : '',
      genres: [],
      productionCompanies: [],
      extendedCredits: { cast: [], crew: [] },
      aiGeneratedDescription: aiDescription,
      aiMatchConfidence: 100,  // We're using AI for matching
      dataSource: {
        tmdb: { lastUpdated: new Date().toISOString(), version: "4.0" },
        imdb: null,
        wikidata: null
      }
    };
  }
}