import { type Nominee, type InsertNominee, syncStatus } from "@shared/schema";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type TMDBSearchResult, type OscarNomination } from "@shared/schema";
import { db, eq } from "../db";

// Simple in-memory cache
const tmdbCache = new Map<string, {
  data: TMDBSearchResult | null;
  timestamp: number;
}>();

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class OscarSyncService {
  private readonly tmdbToken: string;
  private readonly tmdbBaseUrl = "https://api.themoviedb.org/4";
  private readonly tmdbImageBaseUrl = "https://image.tmdb.org/t/p";
  private readonly genAI: GoogleGenerativeAI;
  private readonly BATCH_SIZE = 10; // Increased for efficiency
  private readonly RATE_LIMIT_DELAY = 250; // Reduced to optimize speed
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly headers: Record<string, string>;
  private currentSyncId: number | null = null;

  constructor() {
    if (!process.env.TMDB_ACCESS_TOKEN) {
      throw new Error("TMDB_ACCESS_TOKEN environment variable is required");
    }
    if (!process.env.GOOGLE_AI_KEY) {
      throw new Error("GOOGLE_AI_KEY environment variable is required");
    }
    this.tmdbToken = process.env.TMDB_ACCESS_TOKEN;
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
    this.headers = {
      'Authorization': `Bearer ${this.tmdbToken}`,
      'Content-Type': 'application/json;charset=utf-8'
    };
  }

  private formatImageUrl(path: string | null, size: string = 'original'): string {
    if (!path) return '';
    // Check if the path is already a full URL
    if (path.startsWith('http')) return path;
    // Ensure path starts with '/' if it doesn't already
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.tmdbImageBaseUrl}/${size}${cleanPath}`;
  }

  private async initializeSync(totalItems: number) {
    const [status] = await db.insert(syncStatus).values({
      lastSyncStarted: new Date(),
      syncType: 'full',
      totalItems,
      processedItems: 0,
      failedItems: 0,
      status: 'in_progress',
      metadata: {
        currentBatch: 0,
        totalBatches: Math.ceil(totalItems / this.BATCH_SIZE)
      }
    }).returning();

    this.currentSyncId = status.id;
    return status;
  }

  private async updateSyncProgress(processedItems: number, failedItems: number, currentBatch: number) {
    if (!this.currentSyncId) return;

    await db.update(syncStatus)
      .set({
        processedItems,
        failedItems,
        metadata: {
          currentBatch,
          totalBatches: Math.ceil(processedItems / this.BATCH_SIZE)
        },
        lastSyncCompleted: processedItems === failedItems ? new Date() : undefined,
        status: processedItems === failedItems ? 'completed' : 'in_progress'
      })
      .where(eq(syncStatus.id, this.currentSyncId));
  }

  private getCacheKey(query: string, year?: number): string {
    return `${query}:${year || ''}`;
  }

  private async searchTMDBWithCache(config: {
    query: string,
    year?: number,
    searchType: 'movie' | 'person' | 'multi',
    language?: string,
    region?: string
  }): Promise<TMDBSearchResult[]> {
    const cacheKey = this.getCacheKey(config.query, config.year);
    const cached = tmdbCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for: ${config.query}`);
      return cached.data ? [cached.data] : [];
    }

    try {
      console.log(`Fetching TMDB data for: ${config.query}`);
      const response = await axios.get(`${this.tmdbBaseUrl}/search/${config.searchType}`, {
        headers: this.headers,
        params: {
          query: config.query,
          year: config.year,
          include_adult: false,
          language: config.language || 'en-US',
          region: config.region || 'US',
          page: 1,
          append_to_response: 'images,credits,alternative_titles'
        }
      });

      if (response.data.results?.[0]) {
        // Get additional details for the first result
        const movieId = response.data.results[0].id;
        const detailsResponse = await axios.get(
          `${this.tmdbBaseUrl}/movie/${movieId}`,
          {
            headers: this.headers,
            params: {
              append_to_response: 'credits,images,alternative_titles,videos',
              include_image_language: 'en,null'
            }
          }
        );

        const enhancedResult = {
          ...response.data.results[0],
          ...detailsResponse.data,
          poster_path: this.formatImageUrl(detailsResponse.data.poster_path),
          backdrop_path: this.formatImageUrl(detailsResponse.data.backdrop_path),
          images: {
            ...detailsResponse.data.images,
            posters: detailsResponse.data.images?.posters?.map((p: any) => ({
              ...p,
              file_path: this.formatImageUrl(p.file_path)
            }))
          },
          credits: detailsResponse.data.credits,
          videos: detailsResponse.data.videos
        };

        tmdbCache.set(cacheKey, {
          data: enhancedResult,
          timestamp: Date.now()
        });

        return [enhancedResult];
      }

      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.log('Rate limit hit, waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY * 4));
          return this.searchTMDBWithCache(config);
        }
      }
      console.error(`TMDB API error for ${config.query}:`, error);
      return [];
    }
  }

  private async handleRateLimit() {
    await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY * 2));
  }

  private async searchTMDB(title: string, year: string, category: string): Promise<TMDBSearchResult | null> {
    const movieTitle = this.extractMovieTitle(title, category);
    console.log(`Starting TMDB search for: ${movieTitle} (${year})`);

    const searchType = this.getCategorySearchType(category);
    const searchLanguages = this.isInternationalCategory(category) ?
      ['en-US', 'original'] : ['en-US'];

    const ceremonyYear = parseInt(year);
    const eligibilityYear = ceremonyYear - 1;

    const searchStrategies = [
      { query: movieTitle, year: eligibilityYear, region: 'US' },
      { query: movieTitle, year: eligibilityYear - 1, region: 'US' },
      { query: this.getAlternativeTitle(movieTitle), year: eligibilityYear, region: 'US' },
      { query: movieTitle, region: 'US' }
    ];

    for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
      try {
        for (const strategy of searchStrategies) {
          for (const language of searchLanguages) {
            const results = await this.searchTMDBWithCache({
              ...strategy,
              searchType,
              language
            });

            if (results.length) {
              const match = await this.findBestMatchWithAI(title, results, year, category, eligibilityYear);
              if (match) {
                console.log(`✓ Found match for "${movieTitle}": ${match.title} (ID: ${match.id})`);
                return match;
              }
            }

            // Add small delay between searches
            await this.handleRateLimit();
          }
        }
      } catch (error) {
        console.error(`Error in search attempt ${attempt + 1} for "${movieTitle}":`, error);
        if (attempt < this.RETRY_ATTEMPTS - 1) {
          console.log(`Retrying search for "${movieTitle}" after delay...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (attempt + 1)));
        }
      }
    }

    console.log(`✗ No match found for: ${movieTitle}`);
    return null;
  }

  private async findBestMatchWithAI(
    oscarTitle: string,
    tmdbResults: TMDBSearchResult[],
    ceremonyYear: string,
    category: string,
    eligibilityYear: number
  ): Promise<TMDBSearchResult | null> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Task: Find the best matching movie from TMDB results for an Oscar nominee.

Oscar Information:
- Title: "${oscarTitle}"
- Category: ${category}
- Ceremony Year: ${ceremonyYear}
- Eligibility Year: ${eligibilityYear}

TMDB Results:
${tmdbResults.map((movie, index) =>
        `${index}. "${movie.title}" (${movie.release_date})
   Overview: ${movie.overview}
   Vote Average: ${movie.vote_average}`
      ).join('\n\n')}

Analyze each result considering:
1. Title similarity (exact matches, variations, international titles)
2. Release date must be primarily in ${eligibilityYear} (or late ${eligibilityYear - 1})
3. Plot/overview relevance to the Oscar category
4. Common variations in movie titles between databases
5. Critical reception (vote average) as a factor

Return only the index number (0-based) of the best match. Just the number, e.g. "2".
If no good match exists within the eligibility window, return "null".

Explanation: The selected movie should be the Oscar-nominated work that was released in the eligibility window and matches the specific Oscar category.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text === "null") return null;
      const index = parseInt(text);
      return isNaN(index) || index >= tmdbResults.length ? null : tmdbResults[index];
    } catch (error) {
      console.error("AI matching error:", error);
      return null;
    }
  }

  private getCategorySearchType(category: string): 'movie' | 'person' | 'multi' {
    if (category.includes("Actor") || category.includes("Actress") ||
      category.includes("Directing")) {
      return 'person';
    }
    if (category.includes("Music (Original Song)")) {
      return 'multi';
    }
    return 'movie';
  }

  private isInternationalCategory(category: string): boolean {
    return category === "International Feature Film" ||
      category.includes("Documentary") ||
      category.includes("Short Film");
  }

  private extractMovieTitle(nominee: string | undefined, category: string): string {
    if (!nominee) {
      console.log("Warning: Received undefined nominee");
      return "";
    }

    // Handle different nominee formats based on category
    if (category.includes("Actor") || category.includes("Actress") ||
      category.includes("Directing")) {
      const match = nominee.match(/\((.*?)\)$/);
      return match ? match[1] : nominee;
    }
    // Handle song nominations
    if (category.includes("Music (Original Song)")) {
      const match = nominee.match(/\((.*?)\)$/);
      return match ? match[1] : nominee;
    }
    // Handle international films
    if (category === "International Feature Film") {
      return nominee.split(" (")[0].trim();
    }
    return nominee;
  }

  private getAlternativeTitle(title: string): string {
    // Handle common title variations and international titles
    const variations: Record<string, string> = {
      "The Boy and the Heron": "How Do You Live?",
      "Society of the Snow": "La Sociedad de la Nieve",
      "Perfect Days": "パーフェクトデイズ",
      "The Teachers' Lounge": "Das Lehrerzimmer",
      "The Zone of Interest": "Zone of Interest",
      "Io Capitano": "Io Captain",
      "20 Days in Mariupol": "20 днів у Маріуполі",
      "Robot Dreams": "Robot Dreams (El sueño robot)",
      "The Peasants": "Chłopi",
      // Add more variations as needed
    };
    return variations[title] || title;
  }

  // Method to sync a nominee with TMDB data
  async syncNominee(nomination: OscarNomination): Promise<InsertNominee | null> {
    try {
      console.log(`\nSyncing nominee: ${nomination.nominee} (${nomination.category})`);

      // Create base nominee record with required fields
      const baseNominee: InsertNominee = {
        name: nomination.nominee,
        category: nomination.category,
        description: "",
        poster: "",
        trailerUrl: "",
        streamingPlatforms: [],
        awards: {},
        historicalAwards: [{
          ceremonyYear: nomination.ceremonyYear,
          eligibilityYear: nomination.eligibilityYear,
          awards: [{
            ceremonyId: nomination.ceremonyYear - 1928,
            name: "Academy Awards",
            type: nomination.category,
            result: nomination.isWinner ? "Won" : "Nominated",
            dateAwarded: `${nomination.ceremonyYear}-03-10`
          }]
        }],
        castMembers: [],
        crew: [],
        funFacts: [],
        ceremonyYear: nomination.ceremonyYear,
        eligibilityYear: nomination.eligibilityYear,
        isWinner: nomination.isWinner,
        tmdbId: null,
        runtime: null,
        releaseDate: null,
        voteAverage: null,
        backdropPath: null,
        genres: [],
        productionCompanies: [],
        extendedCredits: {
          cast: [],
          crew: []
        },
        aiGeneratedDescription: "",
        aiMatchConfidence: 0,
        alternativeTitles: [],
        originalLanguage: null,
        originalTitle: null,
        dataSource: {
          tmdb: null,
          imdb: null,
          wikidata: null
        },
        lastUpdated: new Date()
      };

      // Try to get TMDB data with retries
      const tmdbData = await this.searchTMDB(
        nomination.nominee,
        nomination.ceremonyYear.toString(),
        nomination.category
      );

      if (!tmdbData) {
        console.log(`No TMDB match found for ${nomination.nominee}`);
        return baseNominee;
      }

      // Generate AI description using Gemini
      let aiDescription = "";
      try {
        const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        const descriptionPrompt = `Generate a concise description for the Oscar-nominated ${
          nomination.category.includes("Actor") || nomination.category.includes("Actress") ?
            "performance in" : "work"} "${nomination.nominee}" (${nomination.ceremonyYear}).
        Focus on its Oscar-nominated aspects for the category "${nomination.category}".
        Include critical reception and any notable achievements. Keep it under 200 words.`;

        aiDescription = await model.generateContent(descriptionPrompt)
          .then(result => result.response.text())
          .catch(error => {
            console.error("Error generating AI description:", error);
            return "";
          });
      } catch (error) {
        console.error("Error with AI description generation:", error);
      }

      // Construct the enhanced nominee data with proper image URLs
      const enhancedNominee: InsertNominee = {
        ...baseNominee,
        description: tmdbData.overview || baseNominee.description,
        poster: tmdbData.poster_path || baseNominee.poster,
        tmdbId: tmdbData.id,
        runtime: tmdbData.runtime || baseNominee.runtime,
        releaseDate: tmdbData.release_date || baseNominee.releaseDate,
        voteAverage: Math.round(tmdbData.vote_average * 10),
        backdropPath: tmdbData.backdrop_path || baseNominee.backdropPath,
        genres: tmdbData.genres?.map((g: any) => g.name) || baseNominee.genres,
        productionCompanies: tmdbData.production_companies?.map((company: any) => ({
          id: company.id,
          name: company.name,
          logoPath: this.formatImageUrl(company.logo_path, 'w500'),
          originCountry: company.origin_country
        })) || baseNominee.productionCompanies,
        extendedCredits: {
          cast: tmdbData.credits?.cast?.slice(0, 10).map((member: any) => ({
            id: member.id,
            name: member.name,
            character: member.character,
            profileImage: this.formatImageUrl(member.profile_path, 'w500')
          })) || [],
          crew: tmdbData.credits?.crew?.slice(0, 10).map((member: any) => ({
            id: member.id,
            name: member.name,
            job: member.job,
            department: member.department,
            profileImage: this.formatImageUrl(member.profile_path, 'w500')
          })) || []
        },
        aiGeneratedDescription: aiDescription || baseNominee.aiGeneratedDescription,
        aiMatchConfidence: 100,
        alternativeTitles: tmdbData.alternative_titles?.titles?.map((t: any) => t.title) ||
          baseNominee.alternativeTitles,
        originalLanguage: tmdbData.original_language || baseNominee.originalLanguage,
        originalTitle: tmdbData.original_title || baseNominee.originalTitle,
        dataSource: {
          tmdb: {
            lastUpdated: new Date().toISOString(),
            version: "4.0",
            imageUrls: {
              poster: tmdbData.poster_path,
              backdrop: tmdbData.backdrop_path,
              logos: tmdbData.production_companies?.map((c: any) => c.logo_path) || []
            }
          },
          imdb: null,
          wikidata: null
        },
        lastUpdated: new Date()
      };

      // Add trailer URL if available
      const trailer = tmdbData.videos?.results?.find(
        (video: any) => video.site === "YouTube" &&
        (video.type === "Trailer" || video.type === "Teaser")
      );
      if (trailer) {
        enhancedNominee.trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
      }

      console.log(`✓ Successfully processed ${nomination.nominee} with TMDB ID: ${tmdbData.id}`);
      return enhancedNominee;

    } catch (error) {
      console.error(`Error syncing nominee ${nomination.nominee}:`, error);
      return null;
    }
  }

  // Method to fetch Oscar nominations for specified years
  async fetchOscarData(startYear: number, endYear: number): Promise<OscarNomination[]> {
    const nominations: OscarNomination[] = [];
    for (let year = startYear; year <= endYear; year++) {
      const yearNominations = await this.getNominationsForYear(year);
      nominations.push(...yearNominations);
    }
    return nominations;
  }

  // Method to get nominations for a specific year
  async getNominationsForYear(year: number): Promise<OscarNomination[]> {
    const nominations: OscarNomination[] = [
      // Best Picture nominees
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "American Fiction",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Anatomy of a Fall",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Barbie",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "The Holdovers",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Killers of the Flower Moon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Maestro",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Past Lives",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "The Zone of Interest",
        isWinner: false,
        eligibilityYear: year - 1
      },

      // Actor in a Leading Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Bradley Cooper (Maestro)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Colman Domingo (Rustin)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Paul Giamatti (The Holdovers)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Cillian Murphy (Oppenheimer)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Jeffrey Wright (American Fiction)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Actress in a Leading Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Annette Bening (Nyad)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Lily Gladstone (Killers of the Flower Moon)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Sandra Hüller (Anatomy of a Fall)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Carey Mulligan (Maestro)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Emma Stone (Poor Things)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Actor in a Supporting Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Sterling K. Brown (American Fiction)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Robert De Niro (Killers of the Flower Moon)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Robert Downey Jr. (Oppenheimer)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Ryan Gosling (Barbie)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Mark Ruffalo (Poor Things)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Actress in a Supporting Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Emily Blunt (Oppenheimer)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Danielle Brooks (The Color Purple)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "America Ferrera (Barbie)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Jodie Foster (Nyad)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Da'Vine Joy Randolph (The Holdovers)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Animated Feature Film (5 nominees)
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "The Boy and the Heron",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Elemental",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Nimona",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Robot Dreams",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Spider-Man: Across the Spider-Verse",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Cinematography (5 nominees)
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "El Conde",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Killers of the Flower Moon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Maestro",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Costume Design (5 nominees)
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Barbie",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Killers of the Flower Moon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Napoleon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Directing (5 nominees)
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Justine Triet (Anatomy of a Fall)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Martin Scorsese (Killers of the Flower Moon)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Christopher Nolan (Oppenheimer)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Yorgos Lanthimos (Poor Things)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Jonathan Glazer (The Zone of Interest)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Documentary Feature Film (5 nominees)
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "Bobi Wine: The People's President",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "The Eternal Memory",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "Four Daughters",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "To Kill a Tiger",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "20 Days in Mariupol",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Documentary Short Film (5 nominees)
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "The ABCs of Book Banning",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "The Barber of Little Rock",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "Island in Between",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "The Last Repair Shop",
        isWinner: false,
        eligibilityYear: year -1
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "Nǎi Nai & Wài Pó",
        isWinner: false,
        eligibilityYear: year - 1
      },      // Film Editing (5 nominees)
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Anatomy of a Fall",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "The Holdovers",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Killers of the Flower Moon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // International Feature Film (5 nominees)
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "Io Capitano (Italy)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "Perfect Days (Japan)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "Society of the Snow (Spain)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "The Teachers' Lounge (Germany)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "The Zone of Interest (United Kingdom)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Makeup and Hairstyling (5 nominees)
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Golda",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Maestro",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Makeup andHairstyling",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Society of the Snow",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Music (Original Score) (5 nominees)
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "American Fiction",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Indiana Jones and the Dial of Destiny",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Killers of the Flower Moon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Music (Original Song) (5 nominees)
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "The Fire Inside (Flamin' Hot)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "I'm Just Ken (Barbie)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "It Never Went Away (American Symphony)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "Wahzhazhe (A Song for My People) (Killers of the Flower Moon)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "What Was I Made For? (Barbie)",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Production Design (5 nominees)
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Barbie",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Killersof the Flower Moon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Napoleon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Short Film (Animated) (5 nominees)
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Letter to a Pig",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Ninety-Five Senses",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Our Uniform",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Pachyderme",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "War Is Over! Inspired by the Music of John & Yoko",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Short Film (Live Action) (5 nominees)
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "The After",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "Invincible",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "Knight of Fortune",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "Red, White and Blue",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "The Wonderful Story of Henry Sugar",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Sound (5 nominees)
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "The Creator",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "Maestro",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "Mission: Impossible - Dead Reckoning Part One",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "The Zone of Interest",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Visual Effects (5 nominees)
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "The Creator",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Godzilla Minus One",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Guardians of the Galaxy Vol. 3",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Mission: Impossible - Dead Reckoning Part One",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Napoleon",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Writing (Adapted Screenplay) (5 nominees)
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "American Fiction",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "Barbie",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "Oppenheimer",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "Poor Things",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "The Zone of Interest",
        isWinner: false,
        eligibilityYear: year - 1
      },
      // Writing (Original Screenplay) (5 nominees)
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "Anatomy of a Fall",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "The Holdovers",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "May December",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "Past Lives",
        isWinner: false,
        eligibilityYear: year - 1
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "Maestro",
        isWinner: false,
        eligibilityYear: year - 1
      }
    ];

    return nominations;
  }

  // Method to sync historical data with improved rate limiting
  async syncHistoricalData(startYear: number, endYear: number) {
    console.log(`Starting historical data sync from ${startYear} to ${endYear}`);
    const nominations = await this.fetchOscarData(startYear, endYear);

    console.log(`Retrieved ${nominations.length} historical nominations`);

    // Process in smaller batches with improved rate limiting
    const BATCH_SIZE = 5;
    let successCount = 0;
    let failureCount = 0;
    await this.initializeSync(nominations.length);
    for (let i = 0; i < nominations.length; i += BATCH_SIZE) {
      const batch = nominations.slice(i, i + BATCH_SIZE);

      // Add longer delay between batches to avoid rate limits
      if (i > 0) {
        console.log('Waiting to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Process batch with retries and improved error handling
      const results = await Promise.allSettled(
        batch.map(async nom => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const result = await this.syncNominee(nom);
              if (result) return result;

              console.log(`Attempt ${attempt} failed for ${nom.nominee}, retrying...`);
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            } catch (error) {
              console.error(`Attempt ${attempt} failed for ${nom.nominee}:`, error);
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
          console.error(`All attempts failed for ${nom.nominee}`);
          return null;
        })
      );

      // Count successes and failures
      successCount += results.filter(r => r.status === 'fulfilled' && r.value).length;
      failureCount += results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;
      await this.updateSyncProgress(successCount + failureCount, failureCount, Math.ceil((i + batch.length) / BATCH_SIZE));
      console.log(`Processed ${i + batch.length}/${nominations.length} nominations`);
      console.log(`Success: ${successCount}, Failed: ${failureCount}`);
    }

    return {
      total: nominations.length,
      succeeded: successCount,
      failed: failureCount
    };
  }
}