import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { OscarCategories, nominees, type Nominee } from '@shared/schema';
import { MediaValidationService } from './media-validation';
import { ValidationReportService } from './validation-report';
import { db } from './db';
import { OscarCategoryHandler } from './category-handler';

// Add p-throttle package
const pThrottle = require('p-throttle');

interface TMDBData {
  id: number;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  runtime?: number;
  release_date?: string;
  genres?: Array<{ name: string }>;
  production_companies?: any[];
  credits?: {
    cast: Array<{ name: string }>;
    crew: Array<{ name: string; job: string }>;
  };
}

export class OscarTMDBPipeline {
  private throttledFetch: any;
  private categoryHandler: OscarCategoryHandler;

  constructor(private tmdbToken: string) {
    this.throttledFetch = pThrottle({
      limit: 40,
      interval: 10000
    })(this.fetchTMDBData.bind(this));
    this.categoryHandler = new OscarCategoryHandler(tmdbToken);
  }

  async processNominees(year: number, onProgress?: (progress: number) => void) {
    const yearNominees = await db.query.nominees.findMany({
      where: eq(nominees.ceremonyYear, year)
    });

    const total = yearNominees.length;
    let processed = 0;

    for (const nominee of yearNominees) {
      try {
        await this.throttledFetch(nominee);
        processed++;
        onProgress?.(processed / total * 100);
      } catch (error) {
        console.error(`Failed to process nominee ${nominee.name}:`, error);
      }
    }

    return {
      processed,
      total,
      success: processed === total
    };
  }

  private async fetchTMDBData(nominee: Nominee) {
    const mediaValidator = new MediaValidationService(this.tmdbToken);
    const validationService = new ValidationReportService();

    const tmdbData = await this.searchTMDB(nominee);
    if (!tmdbData) return;

    const mediaValidation = await mediaValidator.validateNomineeMedia(tmdbData.id);
    const enhancedData = await this.enrichTMDBData(tmdbData, nominee.category);
    const categoryValidation = await this.categoryHandler.validateCategory(nominee);

    if (!categoryValidation.valid) {
      console.warn(`Category validation issues for ${nominee.name}:`, categoryValidation.errors);
    }

    await db.update(nominees)
      .set({
        tmdbId: tmdbData.id,
        poster: tmdbData.poster_path,
        backdropPath: tmdbData.backdrop_path,
        overview: tmdbData.overview,
        runtime: tmdbData.runtime,
        releaseDate: tmdbData.release_date,
        genres: tmdbData.genres?.map((g: { name: string }) => g.name),
        productionCompanies: tmdbData.production_companies,
        extendedCredits: enhancedData.credits,
        dataComplete: mediaValidation.score > 70 && categoryValidation.valid,
        lastTMDBSync: new Date(),
        validationStatus: categoryValidation.valid ? 'success' : 'failed',
        validationErrors: categoryValidation.valid ? [] : categoryValidation.errors
      })
      .where(eq(nominees.id, nominee.id));

    await validationService.createReport(nominee.id, {
      mediaScore: mediaValidation.score,
      dataCompleteness: enhancedData.completeness,
      categoryValidation: categoryValidation.valid
    });
  }

  private async searchTMDB(nominee: Nominee): Promise<TMDBData | null> {
    const isMovie = nominee.category === OscarCategories.PICTURE;
    const endpoint = isMovie ? 'movie' : 'person';
    const response = await fetch(
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${this.tmdbToken}&query=${encodeURIComponent(nominee.name)}`
    );
    const data = await response.json();
    return data.results[0] || null;
  }

  private async enrichTMDBData(tmdbData: TMDBData, category: string) {
    const isMovie = category === OscarCategories.PICTURE;
    const detailsEndpoint = `https://api.themoviedb.org/3/${isMovie ? 'movie' : 'person'}/${tmdbData.id}?api_key=${this.tmdbToken}&append_to_response=credits,videos`;
    const details = await fetch(detailsEndpoint).then(r => r.json());

    return {
      credits: {
        cast: details.credits?.cast?.slice(0, 20) || [],
        crew: details.credits?.crew?.slice(0, 20) || []
      },
      completeness: this.calculateCompleteness(details)
    };
  }

  private calculateCompleteness(data: any): number {
    const requiredFields = ['overview', 'release_date', 'runtime', 'genres'];
    return (requiredFields.filter(field => !!data[field]).length / requiredFields.length) * 100;
  }
}