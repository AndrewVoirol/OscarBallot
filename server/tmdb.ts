import { db } from "./db";
import { nominees, type Nominee } from "@shared/schema";
import { eq } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/4";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

if (!process.env.TMDB_ACCESS_TOKEN) {
  throw new Error("TMDB_ACCESS_TOKEN environment variable is not set");
}

async function searchMovie(query: string, year?: number) {
  try {
    console.log(`Searching for movie: ${query}${year ? ` (${year})` : ''}`);

    const headers = {
      'Authorization': `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8'
    };

    // Search using v4 API
    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?` + 
      new URLSearchParams({
        query: query,
        language: 'en-US',
        include_adult: 'false',
        ...(year && { year: year.toString() }),
        region: 'US'
      }),
      { headers }
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.results?.length) {
      console.log(`No results found for: ${query}`);
      return null;
    }

    // Get the first match that exactly matches the query, otherwise take the first result
    const bestMatch = data.results.find((movie: any) => 
      movie.title.toLowerCase() === query.toLowerCase()
    ) || data.results[0];

    console.log(`Found movie match: ${bestMatch.title} (ID: ${bestMatch.id})`);
    return bestMatch;
  } catch (error: any) {
    console.error(`Error searching for movie ${query}:`, error.message);
    return null;
  }
}

async function getMovieDetails(movieId: number) {
  try {
    console.log(`Fetching details for movie ID: ${movieId}`);

    const headers = {
      'Authorization': `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8'
    };

    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?` + 
      new URLSearchParams({
        language: 'en-US',
        append_to_response: 'credits,videos,images'
      }),
      { headers }
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    const movieData = await response.json();
    console.log(`Successfully retrieved details for movie ID ${movieId}`);
    return movieData;
  } catch (error: any) {
    console.error(`Error fetching movie details for ID ${movieId}:`, error.message);
    return null;
  }
}

function formatImageUrl(path: string | null, size: 'w500' | 'original' = 'w500'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    console.log(`Processing nominee: ${nominee.name}`);

    // Search for the movie using the ceremony year - 1 (movies typically released the year before)
    const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear - 1);
    if (!searchResult) {
      console.log(`No TMDB results found for: ${nominee.name}`);
      return null;
    }

    // Get detailed movie information
    const movieDetails = await getMovieDetails(searchResult.id);
    if (!movieDetails) {
      console.log(`Failed to get movie details for: ${nominee.name}`);
      return null;
    }

    // Get the first YouTube trailer if available
    const trailer = movieDetails.videos?.results?.find((video: any) => 
      video.site === "YouTube" && video.type === "Trailer"
    );

    // Process cast and crew data
    const castMembers = movieDetails.credits?.cast?.slice(0, 10).map((member: any) => ({
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

    // Update nominee with TMDB data
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
          cast: castMembers,
          crew
        },
        ...(trailer && {
          trailerUrl: `https://www.youtube.com/embed/${trailer.key}`
        }),
        lastUpdated: new Date().toISOString()
      })
      .where(eq(nominees.id, nominee.id))
      .returning();

    console.log(`Successfully updated nominee: ${nominee.name}`);
    return updatedNominee;
  } catch (error: any) {
    console.error(`Error updating TMDB data for ${nominee.name}:`, error.message);
    return null;
  }
}