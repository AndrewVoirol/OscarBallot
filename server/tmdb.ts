import axios from "axios";
import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/4"; // Updated to V4
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN; // Required for V4

if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
  throw new Error("TMDB_API_KEY and TMDB_ACCESS_TOKEN environment variables are required");
}

const tmdbAxios = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
});

async function searchMovie(query: string, year?: number) {
  try {
    console.log(`Searching for movie: ${query}${year ? ` (${year})` : ''}`);
    // V4 endpoint for movie search with additional filters
    const response = await tmdbAxios.get('/search/movie', {
      params: {
        query: encodeURIComponent(query),
        language: "en-US",
        include_adult: false,
        year,
        region: "US",
        primary_release_year: year // Added for more precise year filtering
      }
    });

    const data = await response.data;
    if (!data.results?.length) {
      console.log(`No results found for: ${query}`);
      return null;
    }

    // Enhanced matching logic
    const bestMatch = data.results.find((movie: any) => {
      const movieTitle = movie.title.toLowerCase();
      const searchQuery = query.toLowerCase();
      const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : null;

      return movieTitle === searchQuery && (!year || releaseYear === year);
    }) || data.results[0];

    console.log(`Found movie match: ${bestMatch.title} (ID: ${bestMatch.id})`);
    return bestMatch;
  } catch (error: any) {
    console.error(`Error searching for movie ${query}:`, error.message);
    return null;
  }
}

async function searchPerson(query: string) {
  try {
    console.log(`Searching for person: ${query}`);
    // V4 endpoint for person search with enhanced filters
    const response = await tmdbAxios.get('/search/person', {
      params: {
        query: encodeURIComponent(query),
        language: "en-US",
        include_adult: false,
        append_to_response: "images,combined_credits"
      }
    });

    const data = await response.data;
    if (!data.results?.length) {
      console.log(`No results found for person: ${query}`);
      return null;
    }

    // Enhanced person matching
    const bestMatch = data.results.find((person: any) => 
      person.name.toLowerCase() === query.toLowerCase()
    ) || data.results[0];

    console.log(`Found person match: ${bestMatch.name} (ID: ${bestMatch.id})`);
    return bestMatch;
  } catch (error: any) {
    console.error(`Error searching for person ${query}:`, error.message);
    return null;
  }
}

async function getMovieDetails(movieId: number) {
  try {
    console.log(`Fetching details for movie ID: ${movieId}`);
    // V4 endpoint for detailed movie information
    const response = await tmdbAxios.get(
      `/movie/${movieId}`, {
        params: {
          language: "en-US",
          append_to_response: "credits,videos,images,keywords,alternative_titles"
        }
      }
    );

    const movieData = await response.data;
    console.log(`Successfully retrieved details for movie ID ${movieId}`);
    return movieData;
  } catch (error: any) {
    console.error(`Error fetching movie details for ID ${movieId}:`, error.message);
    return null;
  }
}

async function getPersonDetails(personId: number) {
  try {
    console.log(`Fetching details for person ID: ${personId}`);
    // V4 endpoint for detailed person information
    const response = await tmdbAxios.get(
      `/person/${personId}`, {
        params: {
          language: "en-US",
          append_to_response: "movie_credits,images,combined_credits,tagged_images"
        }
      }
    );

    const personData = await response.data;
    console.log(`Successfully retrieved details for person ID ${personId}`);
    return personData;
  } catch (error: any) {
    console.error(`Error fetching person details for ID ${personId}:`, error.message);
    return null;
  }
}

// Rest of the utility functions remain the same
function formatImageUrl(path: string | null, size: 'w500' | 'original' = 'w500'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

function isPersonCategory(category: string): boolean {
  return ['Best Actor', 'Best Actress', 'Best Supporting Actor', 'Best Supporting Actress', 'Best Director'].includes(category);
}

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    console.log(`Processing nominee: ${nominee.name} (${nominee.ceremonyYear})`);

    if (isPersonCategory(nominee.category)) {
      // Handle person-based nominees
      const searchResult = await searchPerson(nominee.name);
      if (!searchResult) {
        console.error(`No TMDB results found for person: ${nominee.name}`);
        return nominee;
      }

      const personDetails = await getPersonDetails(searchResult.id);
      if (!personDetails) {
        console.error(`Failed to get person details for: ${nominee.name}`);
        return nominee;
      }

      // Update nominee with enhanced person data
      const [updatedNominee] = await db
        .update(nominees)
        .set({
          tmdbId: personDetails.id,
          poster: formatImageUrl(personDetails.profile_path),
          backdropPath: formatImageUrl(personDetails.profile_path, 'original'),
          // Add additional person-specific data
          cast: personDetails.movie_credits?.cast?.slice(0, 5).map((m: any) => m.title) || [],
          crew: personDetails.movie_credits?.crew?.slice(0, 5).map((m: any) => `${m.job}: ${m.title}`) || [],
          lastTMDBSync: new Date(),
          dataComplete: true
        })
        .where(eq(nominees.id, nominee.id))
        .returning();

      console.log(`Successfully updated nominee: ${nominee.name}`);
      return updatedNominee;
    } else {
      // Handle movie-based nominees with enhanced search
      const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear - 1);
      if (!searchResult) {
        console.error(`No TMDB results found for movie: ${nominee.name}`);
        return nominee;
      }

      const movieDetails = await getMovieDetails(searchResult.id);
      if (!movieDetails) {
        console.error(`Failed to get movie details for: ${nominee.name}`);
        return nominee;
      }

      // Get the first YouTube trailer if available
      const trailer = movieDetails.videos?.results?.find((video: any) => 
        video.site === "YouTube" && video.type === "Trailer"
      );

      // Enhanced cast and crew processing
      const cast = movieDetails.credits?.cast?.slice(0, 10).map((member: any) => ({
        id: member.id,
        name: member.name,
        character: member.character,
        profileImage: formatImageUrl(member.profile_path)
      })) || [];

      const crew = movieDetails.credits?.crew?.filter((member: any) => 
        ['Director', 'Producer', 'Screenplay', 'Writer'].includes(member.job)
      ).map((member: any) => ({
        id: member.id,
        name: member.name,
        job: member.job,
        department: member.department,
        profileImage: formatImageUrl(member.profile_path)
      })) || [];

      // Update nominee with enhanced movie data
      const [updatedNominee] = await db
        .update(nominees)
        .set({
          tmdbId: movieDetails.id,
          runtime: movieDetails.runtime || null,
          releaseDate: movieDetails.release_date || null,
          voteAverage: movieDetails.vote_average ? Math.round(movieDetails.vote_average * 10) : null,
          poster: formatImageUrl(movieDetails.poster_path),
          backdropPath: formatImageUrl(movieDetails.backdrop_path, 'original'),
          genres: movieDetails.genres?.map((g: { name: string }) => g.name) || [],
          productionCompanies: movieDetails.production_companies?.map((company: any) => ({
            id: company.id,
            name: company.name,
            logoPath: formatImageUrl(company.logo_path),
            originCountry: company.origin_country
          })) || [],
          extendedCredits: {
            cast,
            crew
          },
          ...(trailer && {
            trailerUrl: `https://www.youtube.com/embed/${trailer.key}`
          }),
          lastTMDBSync: new Date(),
          dataComplete: true
        })
        .where(eq(nominees.id, nominee.id))
        .returning();

      console.log(`Successfully updated nominee: ${nominee.name}`);
      return updatedNominee;
    }
  } catch (error: any) {
    console.error(`Error updating TMDB data for ${nominee.name}:`, error.message);
    return nominee;
  }
}