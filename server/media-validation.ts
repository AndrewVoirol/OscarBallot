import { Nominee } from "@shared/schema";
import fetch from "node-fetch";

export class MediaValidationService {
  constructor(private tmdbToken: string) {}

  async validateNomineeMedia(nomineeId: number): Promise<{
    poster: boolean;
    backdrop: boolean;
    bestTrailer: boolean;
    score: number;
  }> {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/movie/${nomineeId}?api_key=${this.tmdbToken}`);
      const data = await response.json();

      const posterValid = data.poster_path ? await this.validateImageUrl(data.poster_path) : false;
      const backdropValid = data.backdrop_path ? await this.validateImageUrl(data.backdrop_path) : false;

      let score = 100;
      if (!posterValid) score -= 40;
      if (!backdropValid) score -= 30;
      if (!data.videos?.results?.length) score -= 30;

      return {
        poster: posterValid,
        backdrop: backdropValid,
        bestTrailer: data.videos?.results?.length > 0,
        score
      };
    } catch (error) {
      console.error('Media validation failed:', error);
      return {
        poster: false,
        backdrop: false,
        bestTrailer: false,
        score: 0
      };
    }
  }

  private async validateImageUrl(path: string): Promise<{isValid: boolean; quality: 'high' | 'medium' | 'low'}> {
    if (!path || path === '/placeholder-poster.jpg' || path === '/placeholder-backdrop.jpg') 
      return {isValid: false, quality: 'low'};
    try {
      const response = await fetch(`https://image.tmdb.org/t/p/original${path}`);
      return response.ok ? {isValid: true, quality: 'high'} : {isValid: false, quality: 'low'};
    } catch {
      return {isValid: false, quality: 'low'};
    }
  }
}