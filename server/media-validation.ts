import { Nominee } from "@shared/schema";
import axios from "axios";

export class MediaValidationService {
  constructor(private tmdbToken: string) {}

  async validateNomineeMedia(nominee: Nominee): Promise<{
    poster: boolean;
    backdrop: boolean;
    bestTrailer: boolean;
    score: number;
  }> {
    try {
      const isPersonCategory = [
        'Best Actor',
        'Best Actress',
        'Best Supporting Actor',
        'Best Supporting Actress',
        'Best Director'
      ].includes(nominee.category);

      const endpoint = isPersonCategory ? 'person' : 'movie';
      const response = await axios.get(
        `https://api.themoviedb.org/3/${endpoint}/${nominee.tmdbId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.tmdbToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;
      const posterPath = isPersonCategory ? data.profile_path : data.poster_path;
      const posterValid = posterPath ? await this.validateImageUrl(posterPath) : false;
      const backdropValid = !isPersonCategory && data.backdrop_path ? 
        await this.validateImageUrl(data.backdrop_path) : true;

      let score = 100;
      if (!posterValid) score -= 40;
      if (!isPersonCategory && !backdropValid) score -= 30;
      if (!isPersonCategory && !data.videos?.results?.length) score -= 30;

      return {
        poster: posterValid,
        backdrop: backdropValid,
        bestTrailer: !isPersonCategory && data.videos?.results?.length > 0,
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

  private async validateImageUrl(path: string): Promise<boolean> {
    if (!path) return false;
    try {
      const response = await axios.head(`https://image.tmdb.org/t/p/original${path}`, {
        timeout: 5000,
        validateStatus: (status) => status === 200
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}