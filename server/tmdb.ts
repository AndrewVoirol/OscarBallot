import axios from "axios";
import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  throw new Error("TMDB_API_KEY environment variable is not set");
}

// Create axios instance with default config
const tmdbAxios = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_API_KEY}`,
    'Content-Type': 'application/json;charset=utf-8'
  }
});

async function searchMovie(query: string, year?: number) {
  try {
    console.log(`Searching for movie: ${query}${year ? ` (${year})` : ''}`);
    const response = await tmdbAxios.get('/search/movie', {
      params: {
        query,
        language: "en-US",
        include_adult: false,
        year: year || undefined,
        region: "US"
      }
    });

    if (!response.data.results?.length) {
      console.log(`No results found for: ${query}`);
      return null;
    }

    // Get the first match that exactly matches the query, otherwise take the first result
    const bestMatch = response.data.results.find((movie: any) => 
      movie.title.toLowerCase() === query.toLowerCase()
    ) || response.data.results[0];

    console.log(`Found movie match: ${bestMatch.title} (ID: ${bestMatch.id})`);
    return bestMatch;
  } catch (error: any) {
    console.error(`Error searching for movie ${query}:`, error.response?.data || error.message);
    return null;
  }
}

async function getMovieDetails(movieId: number) {
  try {
    console.log(`Fetching details for movie ID: ${movieId}`);
    const response = await tmdbAxios.get(`/movie/${movieId}`, {
      params: {
        language: "en-US",
        append_to_response: "credits,videos,images"
      }
    });

    const movieData = response.data;
    console.log(`Successfully retrieved details for movie ID ${movieId}`);
    return movieData;
  } catch (error: any) {
    console.error(`Error fetching movie details for ID ${movieId}:`, error.response?.data || error.message);
    return null;
  }
}

function getImageUrl(path: string, size: 'w500' | 'original' = 'w500'): string {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : '';
}

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    console.log(`Processing nominee: ${nominee.name}`);

    // Search for the movie using the ceremony year - 1 (movies typically released the year before)
    const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear - 1);
    if (!searchResult) {
      console.error(`No TMDB results found for: ${nominee.name}`);
      return null;
    }

    // Get detailed movie information
    const movieDetails = await getMovieDetails(searchResult.id);
    if (!movieDetails) {
      console.error(`Failed to get movie details for: ${nominee.name}`);
      return null;
    }

    // Get the first YouTube trailer if available
    const trailer = movieDetails.videos?.results?.find((video: any) => 
      video.site === "YouTube" && video.type === "Trailer"
    );

    // Process cast and crew data
    const cast = movieDetails.credits?.cast?.slice(0, 10).map((member: any) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      profileImage: getImageUrl(member.profile_path)
    })) || [];

    const crew = movieDetails.credits?.crew?.filter((member: any) => 
      ['Director', 'Producer', 'Screenplay', 'Writer'].includes(member.job)
    ).map((member: any) => ({
      id: member.id,
      name: member.name,
      job: member.job,
      department: member.department,
      profileImage: getImageUrl(member.profile_path)
    })) || [];

    // Update nominee with TMDB data
    const [updatedNominee] = await db
      .update(nominees)
      .set({
        tmdbId: movieDetails.id,
        runtime: movieDetails.runtime || null,
        releaseDate: movieDetails.release_date || null,
        voteAverage: movieDetails.vote_average ? Math.round(movieDetails.vote_average * 10) : null,
        poster: getImageUrl(movieDetails.poster_path),
        backdropPath: getImageUrl(movieDetails.backdrop_path, 'original'),
        genres: movieDetails.genres?.map((g: { name: string }) => g.name) || [],
        productionCompanies: movieDetails.production_companies?.map((company: any) => ({
          id: company.id,
          name: company.name,
          logoPath: getImageUrl(company.logo_path),
          originCountry: company.origin_country
        })) || [],
        extendedCredits: {
          cast,
          crew
        },
        ...(trailer && {
          trailerUrl: `https://www.youtube.com/embed/${trailer.key}`
        })
      })
      .where(eq(nominees.id, nominee.id))
      .returning();

    console.log(`Successfully updated nominee: ${nominee.name}`);
    return updatedNominee;
  } catch (error: any) {
    console.error(`Error updating TMDB data for ${nominee.name}:`, error.response?.data || error.message);
    return null;
  }
}