import { type Nominee, nomineeValidationSchema, OscarCategories } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { nominees } from "@shared/schema";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

import { MediaValidationService } from './media-validation';

const mediaValidationService = new MediaValidationService(process.env.TMDB_ACCESS_TOKEN || '');

import { ValidationReportService } from './validation-report';

const validationReportService = new ValidationReportService();

import { AwardsSeasonHandler } from './awards-season-handler';
import { OscarCategoryHandler } from './category-handler';
import { TMDBClient } from './tmdb';

const awardsHandler = new AwardsSeasonHandler();
const categoryHandler = new OscarCategoryHandler(new TMDBClient(process.env.TMDB_ACCESS_TOKEN || ''));

export async function validateNominee(nominee: Nominee): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  // Validate season eligibility
  const seasonValidation = await awardsHandler.validateNomineeForSeason(
    nominee,
    nominee.year as 2024 | 2025
  );

  if (!seasonValidation.eligible) {
    errors.push(seasonValidation.reason || 'Not eligible for season');
  }

  // Validate category-specific requirements
  const categoryValidation = await categoryHandler.validateCategory(nominee);
  if (!categoryValidation.valid) {
    errors.push(...categoryValidation.errors);
  }
  
  // Track validation metrics
  let mediaScore = 100;
  let dataCompleteness = 100;

  // Essential fields check
  if (!nominee.name || nominee.name.trim() === '') {
    errors.push('Missing nominee name');
    dataCompleteness -= 20;
  }

  if (!nominee.category || !Object.values(OscarCategories).includes(nominee.category as any)) {
    errors.push('Invalid or missing category');
    dataCompleteness -= 20;
  }

  // Media validation
  if (!nominee.poster || nominee.poster === '/placeholder-poster.jpg') {
    errors.push('Missing valid poster image');
    mediaScore -= 40;
  }

  if (!nominee.backdropPath || nominee.backdropPath === '/placeholder-backdrop.jpg') {
    warnings.push('Missing backdrop image');
    mediaScore -= 20;
  }

  if (!nominee.trailerUrl) {
    warnings.push('Missing trailer URL');
    mediaScore -= 20;
  }

  // Validate media content
  try {
    const mediaValidation = await mediaValidationService.validateNomineeMedia(nominee.id);
    if (!mediaValidation.poster) {
      missingFields.push('poster');
    }
    if (!mediaValidation.backdrop) {
      warnings.push('Missing backdrop image');
    }
    if (!mediaValidation.bestTrailer) {
      warnings.push('Missing trailer');
    }
  } catch (error) {
    errors.push(`Media validation failed: ${error.message}`);
  }

  // Validate against schema
  const schemaValidation = nomineeValidationSchema.safeParse(nominee);
  if (!schemaValidation.success) {
    errors.push(...schemaValidation.error.errors.map(e => e.message));
  }

  // Validate category-specific requirements
  if (!Object.values(OscarCategories).includes(nominee.category as any)) {
    errors.push(`Invalid category: ${nominee.category}`);
  }

  // Validate images
  if (!nominee.poster || nominee.poster === '/placeholder-poster.jpg') {
    errors.push('Missing valid poster image');
  }
  if (!nominee.backdropPath || nominee.backdropPath === '/placeholder-backdrop.jpg') {
    warnings.push('Missing backdrop image');
  }

  // Validate required fields based on category
  if (nominee.category === OscarCategories.PICTURE) {
    if (!nominee.runtime) missingFields.push('runtime');
    if (!nominee.releaseDate) missingFields.push('releaseDate');
    if (!nominee.genres || nominee.genres.length === 0) missingFields.push('genres');
    if (!nominee.productionCompanies) missingFields.push('productionCompanies');
  }

  // Validate person categories
  const personCategories = [
    OscarCategories.ACTOR,
    OscarCategories.ACTRESS,
    OscarCategories.SUPPORTING_ACTOR,
    OscarCategories.SUPPORTING_ACTRESS,
    OscarCategories.DIRECTOR
  ];

  if (personCategories.includes(nominee.category as any)) {
    if (!nominee.biography) missingFields.push('biography');
  }

  // Calculate final scores
  if (missingFields.length > 0) {
    dataCompleteness -= (missingFields.length * 10);
  }
  
  // Generate validation report
  await validationReportService.createReport(nominee.id, {
    mediaScore,
    dataCompleteness,
    issues: [...errors, ...warnings],
    recommendations: missingFields.map(field => `Add missing ${field}`)
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields
  };
}

export async function validateAllNominees(): Promise<{
  totalValidated: number;
  valid: number;
  invalid: number;
  results: Record<string, ValidationResult & { nominee: Nominee }>
}> {
  const allNominees = await db.select().from(nominees);
  const results: Record<string, ValidationResult & { nominee: Nominee }> = {};
  let valid = 0;
  let invalid = 0;

  for (const nominee of allNominees) {
    const validation = await validateNominee(nominee);
    results[nominee.name] = { ...validation, nominee };
    
    if (validation.isValid) {
      valid++;
    } else {
      invalid++;
      
      // Update nominee with validation status
      await db
        .update(nominees)
        .set({
          validationStatus: 'failed',
          validationErrors: validation.errors,
          dataComplete: false
        })
        .where(eq(nominees.id, nominee.id));
    }
  }

  return {
    totalValidated: allNominees.length,
    valid,
    invalid,
    results
  };
}
