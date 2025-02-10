interface AwardsSeasonConfig {
  ceremonyYear: number;  // e.g., 2024 for 96th Academy Awards
  seasonStartDate: string;  // e.g., "2023-01-01"
  seasonEndDate: string;  // e.g., "2023-12-31"
  eligibilityStartDate: string;  // When films can start qualifying
  eligibilityEndDate: string;   // Final cutoff for eligibility
}

class AwardsSeasonHandler {
  private seasonConfigs: Map<number, AwardsSeasonConfig>;

  constructor() {
    // Initialize with 2024 and 2025 season configurations
    this.seasonConfigs = new Map([
      [2024, {
        ceremonyYear: 2024,
        seasonStartDate: "2023-01-01",
        seasonEndDate: "2023-12-31",
        eligibilityStartDate: "2023-01-01",
        eligibilityEndDate: "2023-12-31"
      }],
      [2025, {
        ceremonyYear: 2025,
        seasonStartDate: "2024-01-01",
        seasonEndDate: "2024-12-31",
        eligibilityStartDate: "2024-01-01",
        eligibilityEndDate: "2024-12-31"
      }]
    ]);
  }

  // Verify if a movie belongs to a specific awards season
  verifySeasonEligibility(
    releaseDate: string, 
    ceremonyYear: number
  ): { eligible: boolean; reason?: string } {
    const config = this.seasonConfigs.get(ceremonyYear);
    if (!config) {
      return { 
        eligible: false, 
        reason: `No configuration found for ${ceremonyYear} ceremony` 
      };
    }

    const movieDate = new Date(releaseDate);
    const eligibilityStart = new Date(config.eligibilityStartDate);
    const eligibilityEnd = new Date(config.eligibilityEndDate);

    if (movieDate >= eligibilityStart && movieDate <= eligibilityEnd) {
      return { eligible: true };
    }

    return { 
      eligible: false,
      reason: `Release date ${releaseDate} falls outside eligibility window 
               ${config.eligibilityStartDate} to ${config.eligibilityEndDate}`
    };
  }

  // Parse and validate nominees for a specific ceremony year
  async parseAndValidateNominees(
    nomineeData: string,
    ceremonyYear: number
  ): Promise<{
    valid: NomineeData[];
    invalid: NomineeData[];
    errors: string[];
  }> {
    const config = this.seasonConfigs.get(ceremonyYear);
    if (!config) {
      throw new Error(`No configuration found for ceremony year ${ceremonyYear}`);
    }

    const valid: NomineeData[] = [];
    const invalid: NomineeData[] = [];
    const errors: string[] = [];

    // Parse nominee data (using format from Academy's list)
    const nominees = this.parseNomineeList(nomineeData);

    for (const nominee of nominees) {
      try {
        // Basic validation
        if (!nominee.category || !nominee.name || !nominee.work) {
          invalid.push(nominee);
          errors.push(`Incomplete nominee data: ${JSON.stringify(nominee)}`);
          continue;
        }

        // Special handling for different categories
        if (this.isBestPictureCategory(nominee.category)) {
          // Best Picture has different validation rules
          if (await this.validateBestPictureNominee(nominee, config)) {
            valid.push(nominee);
          } else {
            invalid.push(nominee);
            errors.push(`Invalid Best Picture nominee: ${nominee.work}`);
          }
        } else {
          // Standard category validation
          if (await this.validateStandardNominee(nominee, config)) {
            valid.push(nominee);
          } else {
            invalid.push(nominee);
            errors.push(`Invalid nominee: ${nominee.name} - ${nominee.work}`);
          }
        }
      } catch (error) {
        errors.push(`Error processing nominee: ${error.message}`);
      }
    }

    return { valid, invalid, errors };
  }

  private parseNomineeList(data: string): NomineeData[] {
    const nominees: NomineeData[] = [];
    const lines = data.split('\n');
    let currentCategory = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (!line.startsWith(' ') && trimmedLine !== 'Nominees') {
        currentCategory = trimmedLine;
      } else if (trimmedLine && trimmedLine !== 'Nominees') {
        // Parse based on category type
        if (this.isActingCategory(currentCategory)) {
          const [name, work] = this.parseActingNominee(trimmedLine);
          nominees.push({ category: currentCategory, name, work });
        } else {
          nominees.push(this.parseStandardNominee(currentCategory, trimmedLine));
        }
      }
    }

    return nominees;
  }

  private isActingCategory(category: string): boolean {
    return category.includes('Actor') || category.includes('Actress');
  }

  private isBestPictureCategory(category: string): boolean {
    return category === 'Best Picture';
  }

  private parseActingNominee(line: string): [string, string] {
    const parts = line.split('\n');
    return [parts[0], parts[1] || ''];
  }

  private parseStandardNominee(category: string, line: string): NomineeData {
    const parts = line.split('\n');
    return {
      category,
      name: '',  // Some categories don't have individual nominees
      work: parts[0]
    };
  }

  private async validateBestPictureNominee(
    nominee: NomineeData,
    config: AwardsSeasonConfig
  ): Promise<boolean> {
    try {
      // 1. Validate basic requirements
      if (!nominee.work) {
        throw new Error('Missing film title');
      }

      // 2. Validate producer information
      const producers = nominee.work.split(',')
        .filter(p => p.toLowerCase().includes('producer'))
        .map(p => p.trim());
      
      if (producers.length === 0) {
        throw new Error('Missing producer credits');
      }

      // 3. Check runtime requirement (>40 minutes for feature films)
      const filmDetails = await this.tmdbClient.getMovieDetails(nominee.work);
      if (filmDetails?.runtime && filmDetails.runtime <= 40) {
        throw new Error('Film runtime must exceed 40 minutes');
      }

      // 4. Verify theatrical release
      const releaseInfo = await this.tmdbClient.getMovieReleaseInfo(nominee.work);
      const hasTheatricalRelease = this.verifyTheatricalRelease(
        releaseInfo,
        config.eligibilityStartDate,
        config.eligibilityEndDate
      );

      if (!hasTheatricalRelease) {
        throw new Error('Must have qualifying theatrical release');
      }

      // 5. Check for disqualifying factors
      const isDisqualified = await this.checkDisqualifyingFactors(nominee.work);
      if (isDisqualified) {
        throw new Error('Film meets disqualification criteria');
      }

      return true;
    } catch (error) {
      console.error(`Best Picture validation failed for ${nominee.work}:`, error.message);
      return false;
    }
  }

  private verifyTheatricalRelease(
    releaseInfo: any,
    startDate: string,
    endDate: string
  ): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check for theatrical releases within eligibility period
    const theatricalReleases = releaseInfo.releases.theatrical || [];
    return theatricalReleases.some((release: any) => {
      const releaseDate = new Date(release.date);
      return releaseDate >= start && releaseDate <= end;
    });
  }

  private async checkDisqualifyingFactors(title: string): Promise<boolean> {
    // Check for factors that would disqualify a film:
    // - TV movie or series
    // - Previously released films
    // - Non-feature-length films
    // - Films not in eligible formats
    const movieDetails = await this.tmdbClient.getMovieDetails(title);
    
    return !!(
      movieDetails.type === 'TV_MOVIE' ||
      movieDetails.runtime <= 40 ||
      this.wasReleasedBefore(movieDetails.release_date) ||
      !this.isEligibleFormat(movieDetails.formats)
    );
  }

  private async validateStandardNominee(
    nominee: NomineeData,
    config: AwardsSeasonConfig
  ): Promise<boolean> {
    // Add standard nominee validation rules
    return true; // Placeholder
  }
}

interface NomineeData {
  category: string;
  name: string;
  work: string;
}

export { AwardsSeasonHandler, AwardsSeasonConfig, NomineeData };