
import { type Nominee, OscarCategories } from "@shared/schema";
import { TMDBClient } from "./tmdb";

interface CategoryValidation {
  valid: boolean;
  errors: string[];
  tmdbData?: any;
}

export class OscarCategoryHandler {
  constructor(private tmdbClient: TMDBClient) {}

  async validateCategory(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    let tmdbData;

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
        errors.push(`Unsupported category: ${nominee.category}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      tmdbData
    };
  }

  private async validateBestPicture(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    const tmdbData = await this.tmdbClient.getMovieDetails(nominee.tmdbId);

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
  }

  private async validateActingCategory(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    const tmdbData = await this.tmdbClient.getMovieCredits(nominee.tmdbId);

    if (!tmdbData?.cast?.some(actor => actor.name === nominee.name)) {
      errors.push(`${nominee.name} not found in cast list`);
    }

    return {
      valid: errors.length === 0,
      errors,
      tmdbData
    };
  }

  private async validateDirectingCategory(nominee: Nominee): Promise<CategoryValidation> {
    const errors: string[] = [];
    const tmdbData = await this.tmdbClient.getMovieCredits(nominee.tmdbId);

    if (!tmdbData?.crew?.some(crew => 
      crew.job === "Director" && crew.name === nominee.name
    )) {
      errors.push(`${nominee.name} not found as director`);
    }

    return {
      valid: errors.length === 0,
      errors,
      tmdbData
    };
  }
}
