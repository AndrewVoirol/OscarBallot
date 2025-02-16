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
      const response = await axios.get("https://awardsdatabase.oscars.org/search/getresults", {
        params: { query: JSON.stringify(query) }
      });
      return response.data.results;
    } catch (error) {
      console.error("Error fetching Oscar data:", error);
      throw error;
    }
  }

  private async findBestMatchWithAI(oscarTitle: string, tmdbResults: TMDBSearchResult[], year: string): Promise<TMDBSearchResult | null> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Task: Find the best matching movie from TMDB results for an Oscar nominee.

Oscar Movie: "${oscarTitle}" (Year: ${year})

TMDB Results:
${tmdbResults.map(movie => `- "${movie.title}" (${movie.release_date})`).join('\n')}

Return only the index number (0-based) of the best match. Consider:
1. Title similarity
2. Release year proximity
3. Common variations in movie titles

Response format: Just the number, e.g. "2" for the third movie.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const index = parseInt(response.text().trim());

      if (isNaN(index) || index < 0 || index >= tmdbResults.length) {
        console.warn(`Invalid AI response for ${oscarTitle}: ${response.text()}`);
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
      const response = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
        headers: {
          'Authorization': `Bearer ${this.tmdbToken}`
        },
        params: {
          query: title,
          year: new Date(year).getFullYear(),
          include_adult: false
        }
      });

      if (response.data.results.length === 0) {
        return null;
      }

      return await this.findBestMatchWithAI(title, response.data.results, year);

    } catch (error) {
      console.error("Error searching TMDB:", error);
      return null;
    }
  }

  async syncNominee(oscarNominee: OscarNominee): Promise<InsertNominee | null> {
    const tmdbData = await this.searchTMDB(oscarNominee.Film, oscarNominee.AwardYear);
    if (!tmdbData) {
      console.warn(`No TMDB match found for: ${oscarNominee.Film}`);
      return null;
    }

    return {
      name: oscarNominee.Film,
      category: oscarNominee.Category,
      description: tmdbData.overview,
      poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/original${tmdbData.poster_path}` : '',
      trailerUrl: '',
      streamingPlatforms: [],
      awards: {},
      historicalAwards: [{
        year: parseInt(oscarNominee.AwardYear),
        awards: [{
          ceremonyId: oscarNominee.AwardShowNumber,
          name: "Academy Awards",
          type: oscarNominee.Category,
          result: oscarNominee.Winner ? "Won" : "Nominated",
          dateAwarded: oscarNominee.AwardYear
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
      voteAverage: Math.round(tmdbData.vote_average),
      backdropPath: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : '',
      genres: [],
      dataSource: {
        tmdb: { lastUpdated: new Date().toISOString(), version: "4.0" },
        imdb: null,
        wikidata: null
      }
    };
  }
}