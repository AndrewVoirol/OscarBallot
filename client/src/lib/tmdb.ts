import axios from "axios";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

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
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  };
  production_companies: Array<{
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }>;
}

interface TMDBSearchResult {
  results: Array<{
    id: number;
    title: string;
    release_date: string;
    poster_path: string | null;
  }>;
}

export async function searchMovie(query: string): Promise<TMDBSearchResult> {
  const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
    params: {
      api_key: TMDB_API_KEY,
      query,
      language: "en-US",
      include_adult: false,
    },
  });
  return response.data;
}

export async function getMovieDetails(movieId: number): Promise<TMDBMovie> {
  const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
    params: {
      api_key: TMDB_API_KEY,
      language: "en-US",
      append_to_response: "credits",
    },
  });
  return response.data;
}

export function getTMDBImageUrl(path: string | null, size: "original" | "w500" = "w500"): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export function formatTMDBPosterUrl(path: string | null): string {
  return getTMDBImageUrl(path, 'w500');
}

export function formatTMDBBackdropUrl(path: string | null): string {
  return getTMDBImageUrl(path, 'original');
}

export function formatTMDBProfileUrl(path: string | null): string {
  return getTMDBImageUrl(path, 'w500');
}