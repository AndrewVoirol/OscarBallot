import { type Nominee, nomineeValidationSchema, OscarCategories } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { nominees } from "@shared/schema";
import { MediaValidationService } from './media-validation';
import { ValidationReportService } from './validation-report';
import { AwardsSeasonHandler } from './awards-season-handler';
import { OscarCategoryHandler } from './category-handler';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

const mediaValidationService = new MediaValidationService(process.env.TMDB_ACCESS_TOKEN || '');
const validationReportService = new ValidationReportService();
const awardsHandler = new AwardsSeasonHandler();
const categoryHandler = new OscarCategoryHandler(process.env.TMDB_ACCESS_TOKEN || '');

export async function validateNominee(nominee: Nominee): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  // Validate season eligibility
  const seasonValidation = await awardsHandler.validateNomineeForSeason(
    nominee,
    nominee.ceremonyYear
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
  try {
    const mediaValidation = await mediaValidationService.validateNomineeMedia(nominee.id);
    if (!mediaValidation.poster) {
      missingFields.push('poster');
      mediaScore -= 40;
    }
    if (!mediaValidation.backdrop) {
      warnings.push('Missing backdrop image');
      mediaScore -= 20;
    }
    if (!mediaValidation.bestTrailer) {
      warnings.push('Missing trailer');
      mediaScore -= 20;
    }
  } catch (error) {
    if (error instanceof Error) {
      errors.push(`Media validation failed: ${error.message}`);
    } else {
      errors.push('Media validation failed with unknown error');
    }
  }

  // Validate against schema
  const schemaValidation = nomineeValidationSchema.safeParse(nominee);
  if (!schemaValidation.success) {
    errors.push(...schemaValidation.error.errors.map(e => e.message));
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