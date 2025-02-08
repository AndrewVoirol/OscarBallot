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
    console.log(`Searching for person: "${query}"`);
    const response = await withRetry(() => tmdbAxios.get('/search/person', {
      params: {
        query,
        language: "en-US",
        include_adult: false
      }
    }));

    if (!response.data.results?.length) {
      console.log(`No results found for person: "${query}"`);
      return null;
    }

    // Enhanced person matching
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
    console.log(`Fetching details for movie ID: ${movieId}`);
    const response = await withRetry(() => tmdbAxios.get(
      `/movie/${movieId}`,
      {
        params: {
          append_to_response: "credits,videos,images",
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
    console.log(`Fetching details for person ID: ${personId}`);
    const response = await withRetry(() => tmdbAxios.get(
      `/person/${personId}`,
      {
        params: {
          append_to_response: "movie_credits,images",
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

export async function updateNomineeWithTMDBData(nominee: Nominee): Promise<Nominee> {
  try {
    console.log(`Processing nominee: "${nominee.name}" (${nominee.ceremonyYear})`);
    let retryCount = 0;
    const maxRetries = 3;

    // Common update fields
    const baseUpdateFields = {
      lastTMDBSync: new Date(),
      dataComplete: false
    };

    while (retryCount < maxRetries) {
      try {
        if (isPersonCategory(nominee.category)) {
          const searchResult = await searchPerson(nominee.name);
          if (!searchResult) {
            console.log(`No TMDB results found for person: "${nominee.name}"`);
            const [updatedNominee] = await db
              .update(nominees)
              .set({
                ...baseUpdateFields,
                poster: '/placeholder-poster.jpg',
                backdropPath: '/placeholder-backdrop.jpg'
              })
              .where(eq(nominees.id, nominee.id))
              .returning();
            return updatedNominee;
          }

          const personDetails = await getPersonDetails(searchResult.id);
          if (!personDetails) {
            throw new Error("Failed to fetch person details");
          }

          // Validate images before updating
          const posterUrl = personDetails.profile_path ? formatImageUrl(personDetails.profile_path) : '/placeholder-poster.jpg';
          const posterValid = await validateImageUrl(posterUrl);

          if (!posterValid && retryCount < maxRetries - 1) {
            console.log(`Invalid poster image, retrying... (attempt ${retryCount + 1})`);
            retryCount++;
            continue;
          }

          const [updatedNominee] = await db
            .update(nominees)
            .set({
              ...baseUpdateFields,
              tmdbId: searchResult.id,
              poster: posterValid ? posterUrl : '/placeholder-poster.jpg',
              backdropPath: posterValid ? formatImageUrl(personDetails.profile_path, 'original') : '/placeholder-backdrop.jpg',
              biography: personDetails.biography || '',
              cast: personDetails.movie_credits?.cast?.slice(0, 5).map((m: any) => m.title) || [],
              crew: personDetails.movie_credits?.crew?.slice(0, 5).map((m: any) => `${m.job}: ${m.title}`) || [],
              dataComplete: true
            })
            .where(eq(nominees.id, nominee.id))
            .returning();

          // Validate the updated nominee data
          const validationReport = await validateNomineeData(updatedNominee);
          if (validationReport.issues.length > 0) {
            console.log(`Validation issues for ${nominee.name}:`, validationReport.issues);
          }

          return updatedNominee;
        } else {
          const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear);
          if (!searchResult) {
            console.log(`No TMDB results found for movie: "${nominee.name}"`);
            const [updatedNominee] = await db
              .update(nominees)
              .set({
                ...baseUpdateFields,
                poster: '/placeholder-poster.jpg',
                backdropPath: '/placeholder-backdrop.jpg'
              })
              .where(eq(nominees.id, nominee.id))
              .returning();
            return updatedNominee;
          }

          const movieDetails = await getMovieDetails(searchResult.id);
          if (!movieDetails) {
            throw new Error("Failed to fetch movie details");
          }

          // Validate images before updating
          const posterUrl = movieDetails.poster_path ? formatImageUrl(movieDetails.poster_path) : '/placeholder-poster.jpg';
          const backdropUrl = movieDetails.backdrop_path ? formatImageUrl(movieDetails.backdrop_path, 'original') : '/placeholder-backdrop.jpg';

          const [posterValid, backdropValid] = await Promise.all([
            validateImageUrl(posterUrl),
            validateImageUrl(backdropUrl)
          ]);

          if ((!posterValid || !backdropValid) && retryCount < maxRetries - 1) {
            console.log(`Invalid images, retrying... (attempt ${retryCount + 1})`);
            retryCount++;
            continue;
          }

          const trailer = movieDetails.videos?.results?.find((video: any) =>
            video.site === "YouTube" && 
            (video.type === "Trailer" || video.type === "Teaser")
          );

          const [updatedNominee] = await db
            .update(nominees)
            .set({
              ...baseUpdateFields,
              tmdbId: movieDetails.id,
              runtime: movieDetails.runtime || null,
              releaseDate: movieDetails.release_date || null,
              voteAverage: movieDetails.vote_average ? Math.round(movieDetails.vote_average * 10) : null,
              poster: posterValid ? posterUrl : '/placeholder-poster.jpg',
              backdropPath: backdropValid ? backdropUrl : '/placeholder-backdrop.jpg',
              overview: movieDetails.overview || '',
              genres: movieDetails.genres?.map((g: { name: string }) => g.name) || [],
              productionCompanies: movieDetails.production_companies?.map((company: any) => ({
                id: company.id,
                name: company.name,
                logoPath: company.logo_path ? formatImageUrl(company.logo_path) : null,
                originCountry: company.origin_country
              })) || [],
              extendedCredits: {
                cast: movieDetails.credits?.cast?.slice(0, 10).map((member: any) => ({
                  id: member.id,
                  name: member.name,
                  character: member.character,
                  profileImage: member.profile_path ? formatImageUrl(member.profile_path) : null
                })) || [],
                crew: movieDetails.credits?.crew?.filter((member: any) =>
                  ['Director', 'Producer', 'Writer', 'Director of Photography'].includes(member.job)
                ).map((member: any) => ({
                  id: member.id,
                  name: member.name,
                  job: member.job,
                  department: member.department,
                  profileImage: member.profile_path ? formatImageUrl(member.profile_path) : null
                })) || []
              },
              ...(trailer && {
                trailerUrl: `https://www.youtube.com/embed/${trailer.key}`
              }),
              dataComplete: true
            })
            .where(eq(nominees.id, nominee.id))
            .returning();

          // Validate the updated nominee data
          const validationReport = await validateNomineeData(updatedNominee);
          if (validationReport.issues.length > 0) {
            console.log(`Validation issues for ${nominee.name}:`, validationReport.issues);
          }

          return updatedNominee;
        }
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed for ${nominee.name}:`, error);
        if (retryCount === maxRetries - 1) throw error;
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }

    throw new Error(`Failed to update nominee after ${maxRetries} attempts`);
  } catch (error: any) {
    console.error(`Error updating TMDB data for "${nominee.name}":`, error.message);
    return nominee;
  }
}