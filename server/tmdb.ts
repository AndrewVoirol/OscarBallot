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

const tmdbAxios = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json;charset=utf-8'
  },
  timeout: 15000
});

// Enhanced retry logic with exponential backoff
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

// Enhanced TMDB query parameters for comprehensive data
const PERSON_APPEND_PARAMS = "movie_credits,images,combined_credits,external_ids,tagged_images";
const MOVIE_APPEND_PARAMS = "credits,videos,images,keywords,recommendations,similar,release_dates,external_ids";

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

    // Enhanced matching algorithm
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

  // Exact match gives highest score
  if (normalizedTitle === normalizedQuery) {
    score += 100;
  } else if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    score += 50;
  }

  // Year matching
  if (searchYear && movieYear === searchYear) {
    score += 30;
  }

  // Popularity and vote count as tiebreakers
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

    // Enhanced person matching with more criteria
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

  // Exact match gives highest score
  if (normalizedName === normalizedQuery) {
    score += 100;
  } else if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
    score += 50;
  }

  // Known for department bonus
  if (person.known_for_department === "Acting" || person.known_for_department === "Directing") {
    score += 20;
  }

  // Popularity and known credits as tiebreakers
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

// Enhanced image validation with size and format checks
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

    // Verify it's an image and has reasonable size (> 5KB)
    return contentType?.startsWith('image/') && contentLength > 5000;
  } catch (error) {
    console.error(`Failed to validate image URL: ${url}`, error);
    return false;
  }
}

// Enhanced validation report interface
export interface ValidationReport {
  nomineeId: number;
  name: string;
  category: string;
  ceremonyYear: number;
  issues: string[];
  severity: 'high' | 'medium' | 'low';
}

// Enhanced data validation with more detailed checks
export async function validateNomineeData(nominee: Nominee): Promise<ValidationReport> {
  const issues: string[] = [];
  let severity: 'high' | 'medium' | 'low' = 'low';

  // Critical data validation
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

  // Image validation with improved error messages
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

  // TMDB data validation
  if (!nominee.tmdbId) {
    issues.push("Missing TMDB ID");
    severity = 'high';
  }

  if (isPersonCategory(nominee.category)) {
    // Person-specific validations
    if (!nominee.biography) {
      issues.push("Missing biography");
      severity = 'medium';
    }
    if (!nominee.cast?.length && !nominee.crew?.length) {
      issues.push("Missing filmography (cast/crew information)");
      severity = 'medium';
    }
  } else {
    // Movie-specific validations
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

  // Enhanced streaming platform validation
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

// Add new function to fetch comprehensive nominee data
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

      // Extract comprehensive career data
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
        awards: [] // To be populated from additional sources
      };

      return {
        tmdbId: searchResult.id,
        biography: personDetails.biography,
        externalIds: {
          imdbId: personDetails.external_ids?.imdb_id,
          instagramId: personDetails.external_ids?.instagram_id,
          twitterId: personDetails.external_ids?.twitter_id,
          facebookId: personDetails.external_ids?.facebook_id
        },
        careerHighlights,
        profileImage: personDetails.profile_path ? formatImageUrl(personDetails.profile_path) : null
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
        externalIds: {
          imdbId: movieDetails.external_ids?.imdb_id,
          instagramId: movieDetails.external_ids?.instagram_id,
          twitterId: movieDetails.external_ids?.twitter_id,
          facebookId: movieDetails.external_ids?.facebook_id
        },
        poster: movieDetails.poster_path ? formatImageUrl(movieDetails.poster_path) : null,
        backdropPath: movieDetails.backdrop_path ? formatImageUrl(movieDetails.backdrop_path, 'original') : null
      };
    }
  } catch (error) {
    console.error(`Error fetching comprehensive data for ${nominee.name}:`, error);
    return null;
  }
}

// Update the existing updateNomineeWithTMDBData function to use the new comprehensive data
export async function updateNomineeWithTMDBData(nominee: Nominee): Promise<Nominee> {
  try {
    console.log(`Processing nominee: "${nominee.name}" (${nominee.ceremonyYear})`);

    const comprehensiveData = await fetchComprehensiveNomineeData(nominee);
    if (!comprehensiveData) {
      console.log(`No comprehensive data found for: "${nominee.name}"`);
      return nominee;
    }

    // Update nominee with comprehensive data
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