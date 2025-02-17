import { type Nominee, type InsertNominee } from "@shared/schema";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type TMDBSearchResult, type OscarNomination } from "@shared/schema";

export class OscarSyncService {
  private readonly tmdbToken: string;
  private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";
  private readonly genAI: GoogleGenerativeAI;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000;

  constructor() {
    if (!process.env.TMDB_ACCESS_TOKEN) {
      throw new Error("TMDB_ACCESS_TOKEN environment variable is required");
    }
    if (!process.env.GOOGLE_AI_KEY) {
      throw new Error("GOOGLE_AI_KEY environment variable is required");
    }
    this.tmdbToken = process.env.TMDB_ACCESS_TOKEN;
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  }

  private async searchTMDBWithConfig(config: {
    query: string,
    year?: number,
    searchType: 'movie' | 'person' | 'multi',
    language?: string
  }): Promise<any> {
    const headers = {
      'Authorization': `Bearer ${this.tmdbToken}`,
      'Content-Type': 'application/json;charset=utf-8'
    };

    try {
      const response = await axios.get(`${this.tmdbBaseUrl}/search/${config.searchType}`, {
        headers,
        params: {
          query: config.query,
          year: config.year,
          include_adult: false,
          language: config.language || 'en-US'
        }
      });
      return response.data.results;
    } catch (error) {
      console.error(`TMDB search failed for ${config.query}:`, error);
      return [];
    }
  }

  // Enhanced TMDB search with multiple strategies and retries
  async searchTMDB(title: string, year: string, category: string): Promise<TMDBSearchResult | null> {
    const movieTitle = this.extractMovieTitle(title, category);
    console.log(`Searching TMDB for: ${movieTitle} (${year}) - Original: ${title}, Category: ${category}`);

    // Determine search strategy based on category
    const searchType = this.getCategorySearchType(category);
    const searchLanguages = this.isInternationalCategory(category) ?
      ['en-US', 'original'] : ['en-US'];

    // Search strategies in order of preference
    const searchStrategies = [
      { query: movieTitle, year: parseInt(year) },
      { query: movieTitle, year: parseInt(year) - 1 },
      { query: this.getAlternativeTitle(movieTitle), year: parseInt(year) },
      { query: movieTitle }
    ];

    for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
      for (const strategy of searchStrategies) {
        for (const language of searchLanguages) {
          try {
            const results = await this.searchTMDBWithConfig({
              ...strategy,
              searchType,
              language
            });

            if (results.length) {
              const match = await this.findBestMatchWithAI(title, results, year, category);
              if (match) return match;
            }
          } catch (error) {
            console.error(`TMDB search failed for ${movieTitle}:`, error);
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
            continue;
          }
        }
      }
    }

    console.log(`No TMDB match found for: ${movieTitle}`);
    return null;
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

  private extractMovieTitle(nominee: string, category: string): string {
    // Handle different nominee formats based on category
    if (category.includes("Actor") || category.includes("Actress") ||
      category.includes("Directing")) {
      return nominee.split(" (")[1]?.replace(")", "") || nominee;
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

  private async findBestMatchWithAI(oscarTitle: string, tmdbResults: TMDBSearchResult[], year: string, category: string): Promise<TMDBSearchResult | null> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Task: Find the best matching movie from TMDB results for an Oscar nominee.

Oscar Information:
- Title: "${oscarTitle}"
- Category: ${category}
- Year: ${year}

TMDB Results:
${tmdbResults.map((movie, index) =>
        `${index}. "${movie.title}" (${movie.release_date})
   Overview: ${movie.overview}
   Vote Average: ${movie.vote_average}`
      ).join('\n\n')}

Analyze each result considering:
1. Title similarity (exact matches, variations, international titles)
2. Release date proximity to Oscar year
3. Plot/overview relevance to the Oscar category
4. Common variations in movie titles between databases
5. Critical reception (vote average) as a factor

Return only the index number (0-based) of the best match. Just the number, e.g. "2".
If no good match exists, return "null".

Explanation: The selected movie should be the Oscar-nominated work, considering both the title and its eligibility for the specific Oscar category.`;

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

  // Method to sync a nominee with TMDB data
  async syncNominee(nomination: OscarNomination): Promise<InsertNominee | null> {
    try {
      console.log(`Syncing nominee: ${nomination.nominee} (${nomination.category})`);

      const tmdbData = await this.searchTMDB(
        nomination.nominee,
        nomination.ceremonyYear.toString(),
        nomination.category
      );

      if (!tmdbData) {
        console.log(`No TMDB match found for ${nomination.nominee}`);
        return null;
      }

      // Generate AI description using Gemini
      const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      const descriptionPrompt = `Generate a concise description for the Oscar-nominated ${
        nomination.category.includes("Actor") || nomination.category.includes("Actress") ?
          "performance in" : "work"} "${nomination.nominee}" (${nomination.ceremonyYear}).
Focus on its Oscar-nominated aspects for the category "${nomination.category}".
Include critical reception and any notable achievements. Keep it under 200 words.`;

      const aiDescription = await model.generateContent(descriptionPrompt)
        .then(result => result.response.text())
        .catch(error => {
          console.error("Error generating AI description:", error);
          return "";
        });

      // Get additional details if it's a movie
      let details = {};
      if (!nomination.category.includes("Actor") && !nomination.category.includes("Actress")) {
        try {
          const detailsResponse = await axios.get(
            `${this.tmdbBaseUrl}/movie/${tmdbData.id}`,
            {
              headers: { 'Authorization': `Bearer ${this.tmdbToken}` },
              params: { append_to_response: 'credits,alternative_titles' }
            }
          );
          details = detailsResponse.data;
        } catch (error) {
          console.error(`Error fetching details for ${nomination.nominee}:`, error);
        }
      }

      return {
        name: nomination.nominee,
        category: nomination.category,
        description: tmdbData.overview || "",
        poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : "",
        trailerUrl: "", // Will be added in a separate API call
        streamingPlatforms: [],
        awards: {},
        historicalAwards: [{
          year: nomination.ceremonyYear,
          awards: [{
            ceremonyId: nomination.ceremonyYear - 1928,
            name: "Academy Awards",
            type: nomination.category,
            result: nomination.isWinner ? "Won" : "Nominated",
            dateAwarded: `${nomination.ceremonyYear}-03-10`
          }]
        }],
        castMembers: (details as any)?.credits?.cast?.slice(0, 10).map((c: any) => c.name) || [],
        crew: (details as any)?.credits?.crew?.slice(0, 10).map((c: any) => `${c.name} - ${c.job}`) || [],
        funFacts: [],
        ceremonyYear: nomination.ceremonyYear,
        isWinner: nomination.isWinner,
        tmdbId: tmdbData.id,
        runtime: (details as any)?.runtime || null,
        releaseDate: tmdbData.release_date,
        voteAverage: Math.round(tmdbData.vote_average * 10),
        backdropPath: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : '',
        genres: (details as any)?.genres?.map((g: any) => g.name) || [],
        productionCompanies: (details as any)?.production_companies || [],
        extendedCredits: {
          cast: (details as any)?.credits?.cast || [],
          crew: (details as any)?.credits?.crew || []
        },
        aiGeneratedDescription: aiDescription,
        aiMatchConfidence: 100,
        alternativeTitles: (details as any)?.alternative_titles?.titles?.map((t: any) => t.title) || [],
        originalLanguage: (details as any)?.original_language || null,
        originalTitle: (details as any)?.original_title || null,
        dataSource: {
          tmdb: { lastUpdated: new Date().toISOString(), version: "3.0" },
          imdb: null,
          wikidata: null
        },
        lastUpdated: new Date()
      };
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
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Anatomy of a Fall",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Barbie",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "The Holdovers",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Maestro",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Past Lives",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "Poor Things",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Best Picture",
        nominee: "The Zone of Interest",
        isWinner: false
      },

      // Actor in a Leading Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Bradley Cooper (Maestro)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Colman Domingo (Rustin)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Paul Giamatti (The Holdovers)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Cillian Murphy (Oppenheimer)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Leading Role",
        nominee: "Jeffrey Wright (American Fiction)",
        isWinner: false
      },
      // Actress in a Leading Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Annette Bening (Nyad)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Lily Gladstone (Killers of the Flower Moon)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Sandra Hüller (Anatomy of a Fall)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Carey Mulligan (Maestro)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Leading Role",
        nominee: "Emma Stone (Poor Things)",
        isWinner: false
      },
      // Actor in a Supporting Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Sterling K. Brown (American Fiction)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Robert De Niro (Killers of the Flower Moon)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Robert Downey Jr. (Oppenheimer)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Ryan Gosling (Barbie)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actor in a Supporting Role",
        nominee: "Mark Ruffalo (Poor Things)",
        isWinner: false
      },
      // Actress in a Supporting Role (5 nominees)
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Emily Blunt (Oppenheimer)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Danielle Brooks (The Color Purple)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "America Ferrera (Barbie)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Jodie Foster (Nyad)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Actress in a Supporting Role",
        nominee: "Da'Vine Joy Randolph (The Holdovers)",
        isWinner: false
      },
      // Animated Feature Film (5 nominees)
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "The Boy and the Heron",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Elemental",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Nimona",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Robot Dreams",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Animated Feature Film",
        nominee: "Spider-Man: Across the Spider-Verse",
        isWinner: false
      },
      // Cinematography (5 nominees)
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "El Conde",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Maestro",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Cinematography",
        nominee: "Poor Things",
        isWinner: false
      },
      // Costume Design (5 nominees)
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Barbie",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Napoleon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Costume Design",
        nominee: "Poor Things",
        isWinner: false
      },
      // Directing (5 nominees)
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Justine Triet (Anatomy of a Fall)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Martin Scorsese (Killers of the Flower Moon)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Christopher Nolan (Oppenheimer)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Yorgos Lanthimos (Poor Things)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Directing",
        nominee: "Jonathan Glazer (The Zone of Interest)",
        isWinner: false
      },
      // Documentary Feature Film (5 nominees)
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "Bobi Wine: The People's President",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "The Eternal Memory",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "Four Daughters",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "To Kill a Tiger",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Feature Film",
        nominee: "20 Days in Mariupol",
        isWinner: false
      },
      // Documentary Short Film (5 nominees)
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "The ABCs of Book Banning",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "The Barber of Little Rock",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "Island in Between",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "The Last Repair Shop",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Documentary Short Film",
        nominee: "Nǎi Nai & Wài Pó",
        isWinner: false
      },
      // Film Editing (5 nominees)
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Anatomy of a Fall",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "The Holdovers",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Film Editing",
        nominee: "Poor Things",
        isWinner: false
      },
      // International Feature Film (5 nominees)
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "Io Capitano (Italy)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "Perfect Days (Japan)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "Society of the Snow (Spain)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "The Teachers' Lounge (Germany)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "International Feature Film",
        nominee: "The Zone of Interest (United Kingdom)",
        isWinner: false
      },
      // Makeup and Hairstyling (5 nominees)
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Golda",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Maestro",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Poor Things",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Makeup and Hairstyling",
        nominee: "Society of the Snow",
        isWinner: false
      },
      // Music (Original Score) (5 nominees)
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "American Fiction",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Indiana Jones and the Dial of Destiny",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Score)",
        nominee: "Poor Things",
        isWinner: false
      },
      // Music (Original Song) (5 nominees)
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "The Fire Inside (Flamin' Hot)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "I'm Just Ken (Barbie)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "It Never Went Away (American Symphony)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "Wahzhazhe (A Song for My People) (Killers of the Flower Moon)",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Music (Original Song)",
        nominee: "What Was I Made For? (Barbie)",
        isWinner: false
      },
      // Production Design (5 nominees)
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Barbie",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Killers of the Flower Moon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Napoleon",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Production Design",
        nominee: "Poor Things",
        isWinner: false
      },
      // Short Film (Animated) (5 nominees)
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Letter to a Pig",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Ninety-Five Senses",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Our Uniform",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "Pachyderme",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Animated)",
        nominee: "War Is Over! Inspired by the Music of John & Yoko",
        isWinner: false
      },
      // Short Film (Live Action) (5 nominees)
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "The After",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "Invincible",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "Knight of Fortune",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "Red, White and Blue",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Short Film (Live Action)",
        nominee: "The Wonderful Story of Henry Sugar",
        isWinner: false
      },
      // Sound (5 nominees)
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "The Creator",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "Maestro",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "Mission: Impossible - Dead Reckoning Part One",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Sound",
        nominee: "The Zone of Interest",
        isWinner: false
      },
      // Visual Effects (5 nominees)
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "The Creator",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Godzilla Minus One",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Guardians of the Galaxy Vol. 3",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Mission: Impossible - Dead Reckoning Part One",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Visual Effects",
        nominee: "Napoleon",
        isWinner: false
      },
      // Writing (Adapted Screenplay) (5 nominees)
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "American Fiction",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "Barbie",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "Oppenheimer",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "Poor Things",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Adapted Screenplay)",
        nominee: "The Zone of Interest",
        isWinner: false
      },
      // Writing (Original Screenplay) (5 nominees)
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "Anatomy of a Fall",
        isWinner: false
      },
      {
        ceremonyYear: year,category: "Writing (Original Screenplay)",
        nominee: "The Holdovers",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "May December",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "Past Lives",
        isWinner: false
      },
      {
        ceremonyYear: year,
        category: "Writing (Original Screenplay)",
        nominee: "Maestro",
        isWinner: false
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
    const BATCH_SIZE = 3;
    let successCount = 0;
    let failureCount = 0;

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