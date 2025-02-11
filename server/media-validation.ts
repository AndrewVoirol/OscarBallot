
import { MediaValidator } from './validation';
import { db } from './db';
import { nominees } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class MediaValidationService {
  private mediaValidator: MediaValidator;

  constructor(tmdbAccessToken: string) {
    this.mediaValidator = new MediaValidator(tmdbAccessToken);
  }

  async validateNomineeMedia(nomineeId: number) {
    const nominee = await db.query.nominees.findFirst({
      where: eq(nominees.id, nomineeId)
    });

    if (!nominee) {
      throw new Error('Nominee not found');
    }

    // Validate images
    const { poster, backdrop } = await this.mediaValidator.validateAndFormatImages(
      nominee.poster,
      nominee.backdropPath
    );

    // Get best trailer if available
    const trailers = nominee.videos || [];
    const bestTrailer = await this.mediaValidator.getBestTrailer(trailers);

    // Update nominee with validated media
    await db.update(nominees)
      .set({
        mediaValidation: {
          images: { poster, backdrop },
          videos: bestTrailer ? [bestTrailer] : [],
          lastValidated: new Date().toISOString()
        },
        validationScore: this.calculateValidationScore({ poster, backdrop }, bestTrailer)
      })
      .where(eq(nominees.id, nomineeId));

    return {
      poster,
      backdrop,
      bestTrailer
    };
  }

  private calculateValidationScore(
    images: { poster: any; backdrop: any },
    trailer: any
  ): number {
    let score = 0;
    if (images.poster) score += 40;
    if (images.backdrop) score += 30;
    if (trailer) score += 30;
    return score;
  }
}
