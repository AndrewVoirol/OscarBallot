import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TMDBMovieResult {
  id: number;
  title: string;
  original_title?: string;
  release_date: string;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/4";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const RETRY_DELAYS = [1000, 2000, 4000]; // Retry delays in milliseconds

if (!process.env.TMDB_ACCESS_TOKEN) {
  throw new Error("TMDB_ACCESS_TOKEN environment variable is not set");
}

// Cache for successful movie matches
const movieCache = new Map<string, TMDBMovieResult>();
const failedMatches = new Set<string>();

class TMDBClient {
  private sessionId: string | null = null;
  private headers: Record<string, string> = {
    "Content-Type": "application/json;charset=utf-8",
    Authorization: "",
  };

  async initializeSession(): Promise<void> {
    try {
      // Get request token
      const response = await fetch(`${TMDB_BASE_URL}/auth/request_token`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json;charset=utf-8",
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Authentication failed: ${data.status_message}`);
      }

      // Login with API key
      const loginResponse = await fetch(`${TMDB_BASE_URL}/auth/login`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          username: "api_user",
          password: process.env.TMDB_ACCESS_TOKEN,
        }),
      });

      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginData.status_message}`);
      }

      this.sessionId = loginData.session_id;
      this.headers.Authorization = `Bearer ${this.sessionId}`;
    } catch (error: any) {
      console.error("Error initializing session:", error.message);
      throw error;
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if (!response.ok && retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryCount];
        console.log(`Retrying after ${delay}ms (attempt ${retryCount + 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      return response;
    } catch (error) {
      if (retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryCount];
        console.log(
          `Network error, retrying after ${delay}ms (attempt ${retryCount + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  private extractMovieTitle(nomineeString: string): {
    title: string;
    person?: string;
  } {
    const match = nomineeString.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return {
        person: match[1].trim(),
        title: match[2].trim(),
      };
    }
    return { title: nomineeString };
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\\u0300-\\u036f]/g, "") // Remove diacritics
      .replace(/[^a-z0-9\\s]/g, "") // Remove special characters
      .trim();
  }

  private calculateTitleSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeTitle(str1);
    const s2 = this.normalizeTitle(str2);

    if (s1 === s2) return 1;

    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1),
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
        );
      }
    }

    const maxLength = Math.max(s1.length, s2.length);
    return 1 - dp[m][n] / maxLength;
  }

  async searchMovie(
    query: string,
    year?: number,
  ): Promise<TMDBMovieResult | null> {
    try {
      // Check cache first
      const cacheKey = `${query}:${year || ""}`;
      if (movieCache.has(cacheKey)) {
        console.log(`Cache hit for: ${query}`);
        return movieCache.get(cacheKey)!;
      }

      // Check if this query previously failed
      if (failedMatches.has(cacheKey)) {
        console.log(`Skipping known failed match: ${query}`);
        return null;
      }

      const { title, person } = this.extractMovieTitle(query);
      console.log(`Searching for movie: ${title}${year ? ` (${year})` : ""}`);
      if (person) {
        console.log(`Associated person: ${person}`);
      }

      const searchStrategies = [
        { query: title, year },
        { query: title.split("(")[0].trim(), year }, // Try without parenthetical content
        { query: title, year: year ? year - 1 : undefined }, // Try previous year
        { query: title.split(":")[0].trim(), year }, // Try without subtitle
        { query: title }, // Try without year constraint
      ];

      for (const strategy of searchStrategies) {
        console.log(`Trying search strategy: ${JSON.stringify(strategy)}`);

        const searchParams = new URLSearchParams({
          query: strategy.query,
          include_adult: "false",
          language: "en-US",
          ...(strategy.year && { year: strategy.year.toString() }),
        });

        const response = await this.fetchWithRetry(
          `${TMDB_BASE_URL}/search/movie?${searchParams}`,
          { method: "GET", headers: this.headers },
        );

        if (!response.ok) {
          const error = await response.json();
          console.error("TMDB Search Error:", error);
          continue; // Try next strategy
        }

        const data = await response.json();
        if (!data.results?.length) {
          console.log(
            `No results found for strategy: ${JSON.stringify(strategy)}`,
          );
          continue;
        }

        // Score and rank results
        const scoredResults = data.results.map((movie: TMDBMovieResult) => {
          const titleSimilarity = this.calculateTitleSimilarity(
            strategy.query,
            movie.title,
          );
          const originalTitleSimilarity = movie.original_title
            ? this.calculateTitleSimilarity(
                strategy.query,
                movie.original_title,
              )
            : 0;

          const movieYear = movie.release_date
            ? new Date(movie.release_date).getFullYear()
            : 0;
          const yearMatch =
            !strategy.year || Math.abs(movieYear - strategy.year) <= 1 ? 1 : 0;

          return {
            movie,
            score:
              Math.max(titleSimilarity, originalTitleSimilarity) * 0.7 +
              yearMatch * 0.3,
          };
        });

        // Sort by score and filter those above threshold
        const bestMatches = scoredResults
          .filter((result: { score: number }) => result.score > 0.6)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

        if (bestMatches.length > 0) {
          const bestMatch = bestMatches[0].movie;
          console.log(
            `Found match: ${bestMatch.title} (ID: ${bestMatch.id}) with score ${bestMatches[0].score}`,
          );
          // Cache successful match
          movieCache.set(cacheKey, bestMatch);
          return bestMatch;
        }
      }

      console.log(`No suitable matches found for: ${query}`);
      // Track failed match
      failedMatches.add(cacheKey);
      return null;
    } catch (error: any) {
      console.error(`Error searching for movie ${query}:`, error.message);
      return null;
    }
  }

  private formatImageUrl(
    path: string | null,
    size: "w500" | "original" = "w500",
  ): string {
    if (!path) return "";
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
  }

  async getMovieDetails(movieId: number): Promise<any> {
    try {
      console.log(`Fetching details for movie ID: ${movieId}`);

      const response = await this.fetchWithRetry(
        `${TMDB_BASE_URL}/movies/${movieId}?append_to_response=videos,credits&language=en-US`,
        { method: "GET", headers: this.headers },
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("TMDB Details Error:", error);
        throw new Error(`TMDB API error: ${error.status_message}`);
      }

      const movieData = await response.json();
      console.log(`Successfully retrieved details for "${movieData.title}"`);
      return movieData;
    } catch (error: any) {
      console.error(
        `Error fetching movie details for ID ${movieId}:`,
        error.message,
      );
      return null;
    }
  }

  async updateNomineeWithTMDBData(nominee: Nominee): Promise<any> {
    try {
      console.log(`Processing nominee: ${nominee.name}`);

      // Search in both ceremony year and previous year
      let searchResult = await this.searchMovie(
        nominee.name,
        nominee.ceremonyYear,
      );
      if (!searchResult) {
        searchResult = await this.searchMovie(
          nominee.name,
          nominee.ceremonyYear - 1,
        );
      }

      if (!searchResult) {
        console.log(`No TMDB results found for: ${nominee.name}`);
        return null;
      }

      const movieDetails = await this.getMovieDetails(searchResult.id);
      if (!movieDetails) {
        console.log(`Failed to get movie details for: ${nominee.name}`);
        return null;
      }

      const castMembers =
        movieDetails.credits?.cast?.slice(0, 10).map((member: any) => ({
          id: member.id,
          name: member.name,
          character: member.character,
          profileImage: this.formatImageUrl(member.profile_path),
        })) || [];

      const crew =
        movieDetails.credits?.crew
          ?.filter((member: any) =>
            ["Director", "Producer", "Screenplay", "Writer"].includes(
              member.job,
            ),
          )
          .map((member: any) => ({
            id: member.id,
            name: member.name,
            job: member.job,
            department: member.department,
            profileImage: this.formatImageUrl(member.profile_path),
          })) || [];

      const trailerVideo = movieDetails.videos?.results?.find(
        (video: any) =>
          video.site === "YouTube" &&
          (video.type === "Trailer" || video.type === "Teaser"),
      );

      const [updatedNominee] = await db
        .update(nominees)
        .set({
          tmdbId: movieDetails.id,
          runtime: movieDetails.runtime || 0,
          releaseDate: movieDetails.release_date,
          voteAverage: Math.round((movieDetails.vote_average || 0) * 10),
          poster: this.formatImageUrl(movieDetails.poster_path),
          backdropPath: this.formatImageUrl(
            movieDetails.backdrop_path,
            "original",
          ),
          genres:
            movieDetails.genres?.map((g: { name: string }) => g.name) || [],
          productionCompanies:
            movieDetails.production_companies?.map((company: any) => ({
              id: company.id,
              name: company.name,
              logoPath: this.formatImageUrl(company.logo_path),
              originCountry: company.origin_country,
            })) || [],
          extendedCredits: {
            cast: castMembers,
            crew,
          },
          trailerUrl: trailerVideo
            ? `https://www.youtube.com/embed/${trailerVideo.key}`
            : "",
          dataSource: {
            tmdb: {
              lastUpdated: new Date().toISOString(),
              version: "4.0",
            },
            imdb: null,
            wikidata: null,
          },
          lastUpdated: new Date(),
        })
        .where(eq(nominees.id, nominee.id))
        .returning();

      console.log(`Successfully updated nominee: ${nominee.name}`);
      return updatedNominee;
    } catch (error: any) {
      console.error(
        `Error updating TMDB data for ${nominee.name}:`,
        error.message,
      );
      return null;
    }
  }
}

// Initialize and export the client
const tmdbClient = new TMDBClient();
export { tmdbClient };