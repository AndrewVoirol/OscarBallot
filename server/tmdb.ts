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

    // TMDb v4 movie search with proper parameters
    const searchParams = {
      query,
      include_adult: false,
      language: 'en-US',
    };

    if (year) {
      searchParams['primary_release_year'] = year;
    }

    const response = await fetch(`${TMDB_BASE_URL}/search/movie`, {
      method: 'GET',
      headers,
      body: JSON.stringify(searchParams)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('TMDB Search Error:', error);
      throw new Error(`TMDB API error: ${error.status_message}`);
    }

    const data = await response.json();
    console.log(`Found ${data.results?.length || 0} results for "${query}"`);

    if (!data.results?.length) {
      console.log(`No results found for: ${query}`);
      return null;
    }

    const bestMatch = data.results.find((movie: any) => 
      movie.title.toLowerCase() === query.toLowerCase()
    ) || data.results[0];

    console.log(`Selected match: ${bestMatch.title} (ID: ${bestMatch.id})`);
    return bestMatch;

  } catch (error: any) {
    console.error(`Error searching for movie ${query}:`, error.message);
    return null;
  }
}

function formatImageUrl(path: string | null, size: 'w500' | 'original' = 'w500'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

async function getMovieDetails(movieId: number) {
  try {
    console.log(`Fetching details for movie ID: ${movieId}`);

    const headers = {
      'Authorization': `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8'
    };

    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?append_to_response=videos,credits&language=en-US`, 
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('TMDB Details Error:', error);
      throw new Error(`TMDB API error: ${error.status_message}`);
    }

    const movieData = await response.json();
    console.log(`Successfully retrieved details for "${movieData.title}"`);
    return movieData;

  } catch (error: any) {
    console.error(`Error fetching movie details for ID ${movieId}:`, error.message);
    return null;
  }
}

export async function updateNomineeWithTMDBData(nominee: Nominee) {
  try {
    console.log(`Processing nominee: ${nominee.name}`);

    const searchResult = await searchMovie(nominee.name, nominee.ceremonyYear - 1);
    if (!searchResult) {
      console.log(`No TMDB results found for: ${nominee.name}`);
      return null;
    }

    const movieDetails = await getMovieDetails(searchResult.id);
    if (!movieDetails) {
      console.log(`Failed to get movie details for: ${nominee.name}`);
      return null;
    }

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

    const trailerVideo = movieDetails.videos?.results?.find((video: any) => 
      video.site === "YouTube" && video.type === "Trailer"
    );

    const [updatedNominee] = await db
      .update(nominees)
      .set({
        tmdbId: movieDetails.id,
        runtime: movieDetails.runtime || 0,
        releaseDate: movieDetails.release_date,
        voteAverage: Math.round((movieDetails.vote_average || 0) * 10),
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
        trailerUrl: trailerVideo ? `https://www.youtube.com/embed/${trailerVideo.key}` : '',
        dataSource: {
          tmdb: { 
            lastUpdated: new Date().toISOString(), 
            version: "4.0" 
          },
          imdb: null,
          wikidata: null
        },
        lastUpdated: new Date()
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