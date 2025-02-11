
import { db } from './db';
import { nominees } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface ValidationReportEntry {
  nomineeId: number;
  timestamp: Date;
  mediaScore: number;
  dataCompleteness: number;
  issues: string[];
  recommendations: string[];
}

export class ValidationReportService {
  async createReport(nomineeId: number, report: Partial<ValidationReportEntry>) {
    const nominee = await db.query.nominees.findFirst({
      where: eq(nominees.id, nomineeId)
    });

    if (!nominee) {
      throw new Error('Nominee not found');
    }

    const validationReport = {
      nomineeId,
      timestamp: new Date(),
      mediaScore: report.mediaScore || 0,
      dataCompleteness: report.dataCompleteness || 0,
      issues: report.issues || [],
      recommendations: report.recommendations || []
    };

    await db.update(nominees)
      .set({
        validationReport: validationReport,
        lastValidated: new Date()
      })
      .where(eq(nominees.id, nomineeId));

    return validationReport;
  }

  async getLatestReport(nomineeId: number): Promise<ValidationReportEntry | null> {
    const nominee = await db.query.nominees.findFirst({
      where: eq(nominees.id, nomineeId)
    });

    return nominee?.validationReport || null;
  }
}
