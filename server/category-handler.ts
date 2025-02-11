import { type Nominee, OscarCategories } from "@shared/schema";
import axios from "axios";

interface CategoryValidation {
  valid: boolean;
  errors: string[];
  tmdbData?: any;
}

interface TMDBResponse {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
    }>;
  };
  runtime?: number;
  release_date?: string;
}

export class OscarCategoryHandler {
  private tmdbClient: ReturnType<typeof axios.create>;

  constructor(private tmdbToken: string) {
    this.tmdbClient = axios.create({
      baseURL: 'https://api.themoviedb.org/3',
      headers: {
        'Authorization': `Bearer ${this.tmdbToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async validateCategory(nominee: Nominee): Promise<CategoryValidation> {
    switch (nominee.category) {
      case OscarCategories.PICTURE:
        return this.validateBestPicture(nominee);
      case OscarCategories.ACTOR:
      case OscarCategories.ACTRESS:
      case OscarCategories.SUPPORTING_ACTOR:
      case OscarCategories.SUPPORTING_ACTRESS:
        return this.validateActingCategory(nominee);
      case OscarCategories.DIRECTOR:
        return this.validateDirectingCategory(nominee);
      default:
        return {
          valid: true,
          errors: [],
          tmdbData: null
        };
    }
  }

  private async validateBestPicture(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    try {
      const response = await this.tmdbClient.get<TMDBResponse>(`/movie/${nominee.tmdbId}`);
      const tmdbData = response.data;

      if (!tmdbData) {
        errors.push("Could not fetch TMDB data");
        return { valid: false, errors };
      }

      if (!tmdbData.runtime || tmdbData.runtime < 40) {
        errors.push("Film must be over 40 minutes in length");
      }

      if (!tmdbData.release_date) {
        errors.push("Missing release date");
      }

      return {
        valid: errors.length === 0,
        errors,
        tmdbData
      };
    } catch (error) {
      errors.push(`TMDB API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  private async validateActingCategory(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    try {
      const response = await this.tmdbClient.get<TMDBResponse>(`/movie/${nominee.tmdbId}/credits`);
      const tmdbData = response.data;

      if (!tmdbData?.credits?.cast?.some(actor => actor.name === nominee.name)) {
        errors.push(`${nominee.name} not found in cast list`);
      }

      return {
        valid: errors.length === 0,
        errors,
        tmdbData
      };
    } catch (error) {
      errors.push(`TMDB API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  private async validateDirectingCategory(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    try {
      const response = await this.tmdbClient.get<TMDBResponse>(`/movie/${nominee.tmdbId}/credits`);
      const tmdbData = response.data;

      if (!tmdbData?.credits?.crew?.some(crew => 
        crew.job === "Director" && crew.name === nominee.name
      )) {
        errors.push(`${nominee.name} not found as director`);
      }

      return {
        valid: errors.length === 0,
        errors,
        tmdbData
      };
    } catch (error) {
      errors.push(`TMDB API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }
}