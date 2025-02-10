
import axios from "axios";
import { env } from "@/lib/env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const TMDB_API_KEY = env.TMDB_API_KEY;

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  runtime: number;
  vote_average: number;
  genres: Array<{ id: number; name: string }>;
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  };
  videos: {
    results: Array<{
      id: string;
      key: string;
      site: string;
      type: string;
      name: string;
      official: boolean;
    }>;
  };
  production_companies: Array<{
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }>;
}

interface TMDBPerson {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  movie_credits: {
    cast: Array<{
      id: number;
      title: string;
      character: string;
      release_date: string;
    }>;
    crew: Array<{
      id: number;
      title: string;
      job: string;
      department: string;
      release_date: string;
    }>;
  };
}

const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
    language: "en-US",
  },
});

export async function searchMovie(query: string, year?: number): Promise<TMDBMovie[]> {
  try {
    const response = await tmdbClient.get("/search/movie", {
      params: {
        query,
        year,
        include_adult: false,
      },
    });
    return response.data.results;
  } catch (error) {
    console.error("Error searching movies:", error);
    return [];
  }
}

export async function getMovieDetails(movieId: number): Promise<TMDBMovie | null> {
  try {
    const response = await tmdbClient.get(`/movie/${movieId}`, {
      params: {
        append_to_response: "credits,videos",
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching movie details for ID ${movieId}:`, error);
    return null;
  }
}

export async function searchPerson(query: string): Promise<TMDBPerson[]> {
  try {
    const response = await tmdbClient.get("/search/person", {
      params: {
        query,
        include_adult: false,
      },
    });
    return response.data.results;
  } catch (error) {
    console.error("Error searching people:", error);
    return [];
  }
}

export async function getPersonDetails(personId: number): Promise<TMDBPerson | null> {
  try {
    const response = await tmdbClient.get(`/person/${personId}`, {
      params: {
        append_to_response: "movie_credits",
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching person details for ID ${personId}:`, error);
    return null;
  }
}

export function getTMDBImageUrl(path: string | null, size: "original" | "w500" = "w500"): string {
  if (!path) return "/placeholder-image.jpg";
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export function formatTMDBPosterUrl(path: string | null): string {
  return getTMDBImageUrl(path, "w500");
}

export function formatTMDBBackdropUrl(path: string | null): string {
  return getTMDBImageUrl(path, "original");
}

export function formatTMDBProfileUrl(path: string | null): string {
  return getTMDBImageUrl(path, "w500");
}

export function getYoutubeEmbedUrl(key: string): string {
  return `https://www.youtube.com/embed/${key}`;
}
