import axios from "axios";
import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
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

async function searchMovie(query: string) {
  try {
    console.log(`Searching for movie: ${query}`);
    const response = await tmdbAxios.get('/search/movie', {
      params: {
        query,
        language: "en-US",
        include_adult: false,
        year: 2023, // Since these are Oscar 2024 nominees, they're likely from 2023
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
        append_to_response: "credits,videos"
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

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    console.log(`Processing nominee: ${nominee.name}`);

    // Search for the movie
    const searchResult = await searchMovie(nominee.name);
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

    console.log(`Retrieved movie details for: ${nominee.name}`, {
      runtime: movieDetails.runtime,
      releaseDate: movieDetails.release_date,
      voteAverage: movieDetails.vote_average,
      genres: movieDetails.genres?.map((g: { name: string }) => g.name)
    });

    // Get the first YouTube trailer if available
    const trailer = movieDetails.videos?.results?.find((video: any) => 
      video.site === "YouTube" && video.type === "Trailer"
    );

    // Update nominee with TMDB data
    const [updatedNominee] = await db
      .update(nominees)
      .set({
        tmdbId: movieDetails.id,
        runtime: movieDetails.runtime || null,
        releaseDate: movieDetails.release_date || null,
        voteAverage: movieDetails.vote_average ? Math.round(movieDetails.vote_average * 10) : null,
        backdropPath: movieDetails.backdrop_path || null,
        genres: movieDetails.genres?.map((g: { name: string }) => g.name) || [],
        productionCompanies: movieDetails.production_companies || [],
        extendedCredits: {
          cast: movieDetails.credits?.cast || [],
          crew: movieDetails.credits?.crew || []
        },
        // Only update trailerUrl if we found a valid YouTube trailer
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