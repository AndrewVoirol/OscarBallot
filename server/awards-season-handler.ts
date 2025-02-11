
import { type Nominee, OscarCategories } from "@shared/schema";

interface SeasonValidation {
  eligible: boolean;
  reason?: string;
}

export class AwardsSeasonHandler {
  private readonly ELIGIBILITY_WINDOW = {
    2024: {
      start: new Date('2023-01-01'),
      end: new Date('2023-12-31')
    },
    2025: {
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    }
  };

  async verifySeasonEligibility(
    releaseDate: string,
    season: 2024 | 2025
  ): Promise<SeasonValidation> {
    const date = new Date(releaseDate);
    const window = this.ELIGIBILITY_WINDOW[season];

    if (date < window.start || date > window.end) {
      return {
        eligible: false,
        reason: `Release date ${releaseDate} outside of ${season} eligibility window`
      };
    }

    return { eligible: true };
  }

  async validateNomineeForSeason(nominee: Nominee, season: 2024 | 2025): Promise<SeasonValidation> {
    // Basic season eligibility
    const eligibility = await this.verifySeasonEligibility(nominee.releaseDate, season);
    if (!eligibility.eligible) {
      return eligibility;
    }

    // Category-specific validation
    if (nominee.category === OscarCategories.PICTURE) {
      if (!nominee.runtime || nominee.runtime < 40) {
        return {
          eligible: false,
          reason: "Feature films must be over 40 minutes in length"
        };
      }
    }

    return { eligible: true };
  }
}
