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
  timeout: 10000 // 10 second timeout
});

// Add retry logic
const withRetry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error.response?.status === 429) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

async function searchMovie(query: string, year?: number) {
  try {
    console.log(`Searching for movie: ${query}${year ? ` (${year})` : ''}`);
    const response = await withRetry(() => 
      tmdbAxios.get('/search/movie', {
        params: {
          query,
          year,
          language: "en-US",
          include_adult: false
        }
      })
    );

    if (!response.data.results?.length) {
      console.log(`No results found for: ${query}`);
      return null;
    }

    // Enhanced matching logic
    const bestMatch = response.data.results.find((movie: any) => {
      const movieTitle = movie.title.toLowerCase();
      const searchQuery = query.toLowerCase();
      const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : null;

      // Try exact match first
      if (movieTitle === searchQuery && (!year || releaseYear === year)) {
        return true;
      }

      // Then try removing special characters and comparing
      const cleanMovieTitle = movieTitle.replace(/[^a-z0-9\s]/g, '');
      const cleanSearchQuery = searchQuery.replace(/[^a-z0-9\s]/g, '');
      return cleanMovieTitle === cleanSearchQuery && (!year || releaseYear === year);
    }) || response.data.results[0];

    console.log(`Found movie match: ${bestMatch.title} (ID: ${bestMatch.id})`);
    return bestMatch;
  } catch (error: any) {
    console.error(`Error searching for movie ${query}:`, error.response?.data || error.message);
    return null;
  }
}

async function searchPerson(query: string) {
  try {
    console.log(`Searching for person: ${query}`);
    const response = await withRetry(() => tmdbAxios.get('/search/person', {
      params: {
        query,
        language: "en-US",
        include_adult: false
      }
    }));

    if (!response.data.results?.length) {
      console.log(`No results found for person: ${query}`);
      return null;
    }

    // Enhanced person matching
    const bestMatch = response.data.results.find((person: any) =>
      person.name.toLowerCase() === query.toLowerCase()
    ) || response.data.results[0];

    console.log(`Found person match: ${bestMatch.name} (ID: ${bestMatch.id})`);
    return bestMatch;
  } catch (error: any) {
    console.error(`Error searching for person ${query}:`, error.response?.data || error.message);
    return null;
  }
}

async function getMovieDetails(movieId: number) {
  try {
    console.log(`Fetching details for movie ID: ${movieId}`);
    const response = await withRetry(() => tmdbAxios.get(
      `/movie/${movieId}`,
      {
        params: {
          append_to_response: "credits,videos",
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

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    console.log(`Processing nominee: ${nominee.name} (${nominee.ceremonyYear})`);

    // Set default images
    const defaultPoster = '/placeholder-poster.jpg';
    const defaultBackdrop = '/placeholder-backdrop.jpg';

    if (isPersonCategory(nominee.category)) {
      const searchResult = await searchPerson(nominee.name);
      if (!searchResult) {
        console.log(`No TMDB results found for person: ${nominee.name}`);
        const [updatedNominee] = await db
          .update(nominees)
          .set({
            poster: defaultPoster,
            backdropPath: defaultBackdrop,
            lastTMDBSync: new Date()
          })
          .where(eq(nominees.id, nominee.id))
          .returning();
        return updatedNominee;
      }

      const personDetails = await getPersonDetails(searchResult.id);
      const [updatedNominee] = await db
        .update(nominees)
        .set({
          tmdbId: searchResult.id,
          poster: personDetails?.profile_path ? formatImageUrl(personDetails.profile_path) : defaultPoster,
          backdropPath: personDetails?.profile_path ? formatImageUrl(personDetails.profile_path, 'original') : defaultBackdrop,
          cast: personDetails?.movie_credits?.cast?.slice(0, 5).map((m: any) => m.title) || [],
          crew: personDetails?.movie_credits?.crew?.slice(0, 5).map((m: any) => `${m.job}: ${m.title}`) || [],
          lastTMDBSync: new Date(),
          dataComplete: true
        })
        .where(eq(nominees.id, nominee.id))
        .returning();

      return updatedNominee;
    } else {
      const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear - 1);
      if (!searchResult) {
        console.log(`No TMDB results found for movie: ${nominee.name}`);
        const [updatedNominee] = await db
          .update(nominees)
          .set({
            poster: defaultPoster,
            backdropPath: defaultBackdrop,
            lastTMDBSync: new Date()
          })
          .where(eq(nominees.id, nominee.id))
          .returning();
        return updatedNominee;
      }

      const movieDetails = await getMovieDetails(searchResult.id);
      if (!movieDetails) {
        return nominee;
      }

      const trailer = movieDetails.videos?.results?.find((video: any) =>
        video.site === "YouTube" && video.type === "Trailer"
      );

      const [updatedNominee] = await db
        .update(nominees)
        .set({
          tmdbId: movieDetails.id,
          runtime: movieDetails.runtime || null,
          releaseDate: movieDetails.release_date || null,
          voteAverage: movieDetails.vote_average ? Math.round(movieDetails.vote_average * 10) : null,
          poster: movieDetails.poster_path ? formatImageUrl(movieDetails.poster_path) : defaultPoster,
          backdropPath: movieDetails.backdrop_path ? formatImageUrl(movieDetails.backdrop_path, 'original') : defaultBackdrop,
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
          lastTMDBSync: new Date(),
          dataComplete: true
        })
        .where(eq(nominees.id, nominee.id))
        .returning();

      return updatedNominee;
    }
  } catch (error: any) {
    console.error(`Error updating TMDB data for ${nominee.name}:`, error.message);
    return nominee;
  }
}