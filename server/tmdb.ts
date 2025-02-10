import axios from "axios";
import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

if (!TMDB_ACCESS_TOKEN) {
  throw new Error("TMDB_ACCESS_TOKEN environment variable is required");
}

interface TMDBResponse {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  profile_path?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  runtime?: number;
  vote_average?: number;
  overview?: string;
  biography?: string;
  production_companies?: Array<{
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }>;
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      known_for_department: string;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  };
}

const RATE_LIMIT = {
  maxRequests: 30,
  perSeconds: 1,
  retryAttempts: 3,
  retryDelay: 1000,
};

class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  async throttle(endpoint: string): Promise<void> {
    const now = Date.now();
    let timestamps = this.requests.get(endpoint) || [];
    timestamps = timestamps.filter(time => now - time < RATE_LIMIT.perSeconds * 1000);

    if (timestamps.length >= RATE_LIMIT.maxRequests) {
      const oldestRequest = timestamps[0];
      const waitTime = (RATE_LIMIT.perSeconds * 1000) - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.throttle(endpoint);
    }

    timestamps.push(now);
    this.requests.set(endpoint, timestamps);
  }
}

const rateLimiter = new RateLimiter();

const tmdbAxios = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json;charset=utf-8'
  },
  timeout: 15000
});

const withRetry = async (fn: () => Promise<any>, retries = 3, initialDelay = 1000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.response?.status === 429 || error.response?.status >= 500) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const PERSON_APPEND_PARAMS = "movie_credits,images,combined_credits,external_ids,tagged_images,changes";
const MOVIE_APPEND_PARAMS = "credits,videos,images,keywords,recommendations,similar,release_dates,external_ids,changes,awards";

async function searchMovie(query: string, year?: number) {
  try {
    console.log(`Searching for movie: "${query}"${year ? ` (${year})` : ''}`);
    const response = await withRetry(() =>
      tmdbAxios.get('/search/movie', {
        params: {
          query,
          year: year ? year - 1 : undefined,
          language: "en-US",
          include_adult: false
        }
      })
    );

    if (!response.data.results?.length) {
      console.log(`No results found for movie: "${query}"`);
      return null;
    }

    const results = response.data.results;
    const searchYear = year ? year - 1 : undefined;

    const bestMatch = results.reduce((best: any, current: any) => {
      const releaseYear = current.release_date ? new Date(current.release_date).getFullYear() : null;
      const currentScore = calculateMatchScore(current, query, releaseYear, searchYear);
      const bestScore = best ? calculateMatchScore(best, query,
        best.release_date ? new Date(best.release_date).getFullYear() : null,
        searchYear) : -1;

      return currentScore > bestScore ? current : best;
    }, null);

    if (bestMatch) {
      console.log(`Found movie match: "${bestMatch.title}" (ID: ${bestMatch.id}, Release: ${bestMatch.release_date})`);
      return bestMatch;
    }

    return null;
  } catch (error: any) {
    console.error(`Error searching for movie "${query}":`, error.response?.data || error.message);
    return null;
  }
}

function calculateMatchScore(movie: any, query: string, movieYear: number | null, searchYear: number | undefined): number {
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const normalizedTitle = movie.title.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 100;
  } else if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    score += 50;
  }

  if (searchYear && movieYear === searchYear) {
    score += 30;
  }

  score += (movie.popularity || 0) / 100;
  score += Math.min((movie.vote_count || 0) / 1000, 10);

  return score;
}

async function searchPerson(query: string) {
  try {
    console.log(`Performing comprehensive search for person: "${query}"`);
    const response = await withRetry(() => tmdbAxios.get('/search/person', {
      params: {
        query,
        language: "en-US",
        include_adult: false,
        page: 1
      }
    }));

    if (!response.data.results?.length) {
      console.log(`No results found for person: "${query}"`);
      return null;
    }

    const results = response.data.results;
    const bestMatch = results.reduce((best: any, current: any) => {
      const currentScore = calculatePersonMatchScore(current, query);
      const bestScore = best ? calculatePersonMatchScore(best, query) : -1;
      return currentScore > bestScore ? current : best;
    }, null);

    if (bestMatch) {
      console.log(`Found person match: "${bestMatch.name}" (ID: ${bestMatch.id})`);
      return bestMatch;
    }

    return null;
  } catch (error: any) {
    console.error(`Error searching for person "${query}":`, error.response?.data || error.message);
    return null;
  }
}

function calculatePersonMatchScore(person: any, query: string): number {
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const normalizedName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  let score = 0;

  if (normalizedName === normalizedQuery) {
    score += 100;
  } else if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
    score += 50;
  }

  if (person.known_for_department === "Acting" || person.known_for_department === "Directing") {
    score += 20;
  }

  score += (person.popularity || 0) / 100;
  score += Math.min((person.known_for?.length || 0) * 5, 20);

  return score;
}

async function getMovieDetails(movieId: number) {
  try {
    console.log(`Fetching comprehensive details for movie ID: ${movieId}`);
    const response = await withRetry(() => tmdbAxios.get(
      `/movie/${movieId}`,
      {
        params: {
          append_to_response: MOVIE_APPEND_PARAMS,
          language: "en-US"
        }
      }
    ));

    console.log(`Successfully retrieved details for movie ID ${movieId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching movie details for ID ${movieId}:`, error.response?.data || error.message);
    return null;
  }
}

async function getPersonDetails(personId: number) {
  try {
    console.log(`Fetching comprehensive details for person ID: ${personId}`);
    const response = await withRetry(() => tmdbAxios.get(
      `/person/${personId}`,
      {
        params: {
          append_to_response: PERSON_APPEND_PARAMS,
          language: "en-US"
        }
      }
    ));

    console.log(`Successfully retrieved details for person ID ${personId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      for (let attempts = 0; attempts < RATE_LIMIT.retryAttempts; attempts++) {
        console.log(`Rate limit hit, attempt ${attempts + 1}/${RATE_LIMIT.retryAttempts}`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryDelay));
        
        try {
          const retryResponse = await tmdbAxios.get(`/person/${personId}`, {
            params: {
              append_to_response: PERSON_APPEND_PARAMS,
              language: "en-US"
            }
          });
          return retryResponse.data;
        } catch (retryError) {
          if (retryError.response?.status !== 429) throw retryError;
        }
      }
    }
    console.error(`Error fetching person details for ID ${personId}:`, error.response?.data || error.message);
    return null;
  }
}

function formatImageUrl(path: string | null, size: 'w500' | 'original' = 'w500'): string {
  if (!path) return '/placeholder-poster.jpg';
  if (!path.startsWith('http')) {
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
  }
  return path;
}

function isPersonCategory(category: string): boolean {
  return [
    'Best Actor',
    'Best Actress',
    'Best Supporting Actor',
    'Best Supporting Actress',
    'Best Director'
  ].includes(category);
}

async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || url === '/placeholder-poster.jpg' || url === '/placeholder-backdrop.jpg') {
    return false;
  }

  try {
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: (status) => status === 200
    });

    const contentType = response.headers['content-type'];
    const contentLength = parseInt(response.headers['content-length'] || '0');

    return contentType?.startsWith('image/') && contentLength > 5000;
  } catch (error) {
    console.error(`Failed to validate image URL: ${url}`, error);
    return false;
  }
}

export interface ValidationReport {
  nomineeId: number;
  name: string;
  category: string;
  ceremonyYear: number;
  issues: string[];
  severity: 'high' | 'medium' | 'low';
}

export async function validateNomineeData(nominee: Nominee): Promise<ValidationReport> {
  const issues: string[] = [];
  let severity: 'high' | 'medium' | 'low' = 'low';

  if (!nominee.name) {
    issues.push("Missing name");
    severity = 'high';
  }
  if (!nominee.category) {
    issues.push("Missing category");
    severity = 'high';
  }
  if (!nominee.ceremonyYear) {
    issues.push("Missing ceremony year");
    severity = 'high';
  }

  const posterValid = await validateImageUrl(nominee.poster);
  if (!posterValid) {
    issues.push("Invalid or missing poster image");
    severity = 'high';
  }

  const backdropValid = nominee.backdropPath ? await validateImageUrl(nominee.backdropPath) : false;
  if (!backdropValid) {
    issues.push("Invalid or missing backdrop image");
    severity = 'medium';
  }

  if (!nominee.tmdbId) {
    issues.push("Missing TMDB ID");
    severity = 'high';
  }

  if (isPersonCategory(nominee.category)) {
    if (!nominee.biography) {
      issues.push("Missing biography");
      severity = 'medium';
    }
    if (!nominee.cast?.length && !nominee.crew?.length) {
      issues.push("Missing filmography (cast/crew information)");
      severity = 'medium';
    }
  } else {
    if (!nominee.overview) {
      issues.push("Missing overview");
      severity = 'medium';
    }
    if (!nominee.genres?.length) {
      issues.push("Missing genres");
      severity = 'low';
    }
    if (!nominee.releaseDate) {
      issues.push("Missing release date");
      severity = 'medium';
    }
    if (!nominee.runtime) {
      issues.push("Missing runtime");
      severity = 'low';
    }
  }

  if (!nominee.streamingPlatforms || nominee.streamingPlatforms.length === 0) {
    issues.push("Missing streaming platforms");
    severity = 'medium';
  }

  return {
    nomineeId: nominee.id,
    name: nominee.name,
    category: nominee.category,
    ceremonyYear: nominee.ceremonyYear,
    issues,
    severity
  };
}

async function fetchComprehensiveNomineeData(nominee: Nominee): Promise<any> {
  const isPersonCategory = [
    'Best Actor',
    'Best Actress',
    'Best Supporting Actor',
    'Best Supporting Actress',
    'Best Director'
  ].includes(nominee.category);

  try {
    if (isPersonCategory) {
      const searchResult = await searchPerson(nominee.name);
      if (!searchResult) return null;

      const personDetails = await getPersonDetails(searchResult.id);
      if (!personDetails) return null;

      const careerHighlights = {
        topRatedProjects: personDetails.movie_credits?.cast
          ?.sort((a: any, b: any) => b.vote_average - a.vote_average)
          .slice(0, 10)
          .map((project: any) => ({
            id: project.id,
            title: project.title,
            year: project.release_date ? new Date(project.release_date).getFullYear() : null,
            role: project.character || project.job,
            rating: Math.round(project.vote_average * 10)
          })) || [],
        awards: [] 
      };

      return {
        tmdbId: searchResult.id,
        biography: personDetails.biography,
        profileImage: personDetails.profile_path ? formatImageUrl(personDetails.profile_path) : null,
        externalIds: {
          imdbId: personDetails.external_ids?.imdb_id,
          instagramId: personDetails.external_ids?.instagram_id,
          twitterId: personDetails.external_ids?.twitter_id,
          facebookId: personDetails.external_ids?.facebook_id
        },
        cast: personDetails.movie_credits?.cast?.map((c: any) => ({
          movieId: c.id,
          title: c.title,
          character: c.character,
          releaseDate: c.release_date
        })) || [],
        crew: personDetails.movie_credits?.crew?.map((c: any) => ({
          movieId: c.id,
          title: c.title,
          job: c.job,
          department: c.department,
          releaseDate: c.release_date
        })) || [],
        careerHighlights,
        funFacts: [
          `Known for department: ${personDetails.known_for_department}`,
          `Place of birth: ${personDetails.place_of_birth}`,
          `Birthday: ${personDetails.birthday}`,
          `Total movies: ${(personDetails.movie_credits?.cast?.length || 0) + (personDetails.movie_credits?.crew?.length || 0)}`
        ]
      };
    } else {
      const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear);
      if (!searchResult) return null;

      const movieDetails = await getMovieDetails(searchResult.id);
      if (!movieDetails) return null;

      return {
        tmdbId: searchResult.id,
        overview: movieDetails.overview,
        releaseDate: movieDetails.release_date,
        runtime: movieDetails.runtime,
        genres: movieDetails.genres?.map((g: any) => g.name),
        poster: movieDetails.poster_path ? formatImageUrl(movieDetails.poster_path) : null,
        backdropPath: movieDetails.backdrop_path ? formatImageUrl(movieDetails.backdrop_path, 'original') : null,
        trailerUrl: movieDetails.videos?.results?.find((v: any) => 
          v.type === "Trailer" && v.site === "YouTube"
        )?.key ? `https://www.youtube.com/watch?v=${movieDetails.videos.results[0].key}` : null,
        cast: movieDetails.credits?.cast?.slice(0, 10).map((c: any) => c.name) || [],
        crew: movieDetails.credits?.crew
          ?.filter((c: any) => ["Director", "Producer", "Screenplay", "Writer"].includes(c.job))
          .map((c: any) => `${c.name} (${c.job})`) || [],
        funFacts: [
          `Budget: $${movieDetails.budget?.toLocaleString()}`,
          `Runtime: ${movieDetails.runtime} minutes`,
          `Original Language: ${movieDetails.original_language?.toUpperCase()}`,
          `Production Companies: ${movieDetails.production_companies?.map((pc: any) => pc.name).join(", ")}`
        ],
        productionCompanies: movieDetails.production_companies?.map((pc: any) => ({
          id: pc.id,
          name: pc.name,
          logoPath: pc.logo_path ? formatImageUrl(pc.logo_path) : null,
          originCountry: pc.origin_country
        })),
        externalIds: {
          imdbId: movieDetails.external_ids?.imdb_id,
          instagramId: movieDetails.external_ids?.instagram_id,
          twitterId: movieDetails.external_ids?.twitter_id,
          facebookId: movieDetails.external_ids?.facebook_id
        }
      };
    }
  } catch (error) {
    console.error(`Error fetching comprehensive data for ${nominee.name}:`, error);
    return null;
  }
}

export async function updateNomineeWithTMDBData(nominee: Nominee): Promise<Nominee> {
  try {
    console.log(`Processing nominee: "${nominee.name}" (${nominee.ceremonyYear})`);

    const comprehensiveData = await fetchComprehensiveNomineeData(nominee);
    if (!comprehensiveData) {
      console.log(`No comprehensive data found for: "${nominee.name}"`);
      return nominee;
    }

    const [updatedNominee] = await db
      .update(nominees)
      .set({
        ...comprehensiveData,
        lastTMDBSync: new Date(),
        dataComplete: true
      })
      .where(eq(nominees.id, nominee.id))
      .returning();

    return updatedNominee;
  } catch (error: any) {
    console.error(`Error updating TMDB data for "${nominee.name}":`, error.message);
    return nominee;
  }
}