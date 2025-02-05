import axios from "axios";
import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  throw new Error("TMDB_API_KEY environment variable is not set");
}

async function searchMovie(query: string) {
  const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
    params: {
      api_key: TMDB_API_KEY,
      query,
      language: "en-US",
      include_adult: false,
    },
  });
  return response.data.results[0]; // Get the first match
}

async function getMovieDetails(movieId: number) {
  const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
    params: {
      api_key: TMDB_API_KEY,
      language: "en-US",
      append_to_response: "credits",
    },
  });
  return response.data;
}

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    // Search for the movie
    const searchResult = await searchMovie(nominee.name);
    if (!searchResult) {
      console.error(`No TMDB results found for: ${nominee.name}`);
      return null;
    }

    // Get detailed movie information
    const movieDetails = await getMovieDetails(searchResult.id);

    // Update nominee with TMDB data
    const [updatedNominee] = await db
      .update(nominees)
      .set({
        tmdbId: movieDetails.id,
        runtime: movieDetails.runtime,
        releaseDate: movieDetails.release_date,
        voteAverage: Math.round(movieDetails.vote_average * 10),
        backdropPath: movieDetails.backdrop_path,
        genres: movieDetails.genres.map((g: { name: string }) => g.name),
        productionCompanies: movieDetails.production_companies,
        extendedCredits: {
          cast: movieDetails.credits.cast,
          crew: movieDetails.credits.crew,
        },
      })
      .where(eq(nominees.id, nominee.id))
      .returning();

    return updatedNominee;
  } catch (error) {
    console.error(`Error updating TMDB data for ${nominee.name}:`, error);
    return null;
  }
}
