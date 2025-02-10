interface CategoryRequirements {
    tmdbDataFields: string[];
    validationRules: ValidationRule[];
    requiredCredits?: string[];
  }
  
  interface ValidationRule {
    field: string;
    validator: (value: any) => boolean;
    errorMessage: string;
  }
  
  class OscarCategoryTMDBHandler {
    private categoryRequirements: Map<string, CategoryRequirements>;
  
    constructor(private tmdbClient: any) {
      this.initializeCategoryRequirements();
    }
  
    private initializeCategoryRequirements() {
      this.categoryRequirements = new Map([
        ['Best Picture', {
          tmdbDataFields: ['title', 'runtime', 'release_date', 'production_companies', 'credits'],
          validationRules: [
            {
              field: 'runtime',
              validator: (runtime: number) => runtime > 40,
              errorMessage: 'Film must be over 40 minutes'
            }
          ],
          requiredCredits: ['Producer']
        }],
        ['Directing', {
          tmdbDataFields: ['credits', 'crew'],
          validationRules: [
            {
              field: 'credits.crew',
              validator: (crew: any[]) => crew.some(c => c.job === 'Director'),
              errorMessage: 'Must have credited director'
            }
          ],
          requiredCredits: ['Director']
        }],
        ['Cinematography', {
          tmdbDataFields: ['credits', 'crew'],
          validationRules: [],
          requiredCredits: ['Director of Photography', 'Cinematographer']
        }],
        ['Film Editing', {
          tmdbDataFields: ['credits', 'crew'],
          validationRules: [],
          requiredCredits: ['Editor', 'Film Editor']
        }],
        ['Visual Effects', {
          tmdbDataFields: ['credits', 'crew'],
          validationRules: [
            {
              field: 'hasVisualEffects',
              validator: (hasVFX: boolean) => hasVFX,
              errorMessage: 'Must have visual effects work'
            }
          ],
          requiredCredits: ['Visual Effects Supervisor']
        }],
        ['Music (Original Score)', {
          tmdbDataFields: ['credits', 'crew'],
          validationRules: [],
          requiredCredits: ['Original Music Composer']
        }]
      ]);
    }
  
    async fetchTMDBDataForCategory(
      nominee: NomineeData,
      category: string
    ): Promise<{
      tmdbData: any;
      isValid: boolean;
      errors: string[];
    }> {
      const requirements = this.categoryRequirements.get(category);
      if (!requirements) {
        throw new Error(`Unknown category: ${category}`);
      }
  
      try {
        // 1. Fetch basic movie data
        const movieData = await this.tmdbClient.getMovieDetails(nominee.work);
  
        // 2. Fetch additional required data
        const tmdbData = await this.fetchRequiredFields(
          movieData.id,
          requirements.tmdbDataFields
        );
  
        // 3. Validate against category requirements
        const validation = this.validateCategoryRequirements(
          tmdbData,
          requirements
        );
  
        // 4. Enhance with category-specific data
        const enhancedData = await this.enhanceCategorySpecificData(
          tmdbData,
          category
        );
  
        return {
          tmdbData: enhancedData,
          isValid: validation.isValid,
          errors: validation.errors
        };
      } catch (error) {
        return {
          tmdbData: null,
          isValid: false,
          errors: [error.message]
        };
      }
    }
  
    private async fetchRequiredFields(
      movieId: number,
      fields: string[]
    ): Promise<any> {
      const data: any = {};
      
      for (const field of fields) {
        switch (field) {
          case 'credits':
            data.credits = await this.tmdbClient.getMovieCredits(movieId);
            break;
          case 'production_companies':
            data.production_companies = await this.tmdbClient.getMovieCompanies(movieId);
            break;
          // Add other field-specific fetching logic
        }
      }
  
      return data;
    }
  
    private validateCategoryRequirements(
      data: any,
      requirements: CategoryRequirements
    ): {
      isValid: boolean;
      errors: string[];
    } {
      const errors: string[] = [];
  
      // Check validation rules
      for (const rule of requirements.validationRules) {
        const value = this.getNestedValue(data, rule.field);
        if (!rule.validator(value)) {
          errors.push(rule.errorMessage);
        }
      }
  
      // Check required credits
      if (requirements.requiredCredits) {
        const hasRequiredCredits = this.validateRequiredCredits(
          data.credits?.crew || [],
          requirements.requiredCredits
        );
        if (!hasRequiredCredits) {
          errors.push(`Missing required credits: ${requirements.requiredCredits.join(', ')}`);
        }
      }
  
      return {
        isValid: errors.length === 0,
        errors
      };
    }
  
    private async enhanceCategorySpecificData(
      data: any,
      category: string
    ): Promise<any> {
      switch (category) {
        case 'Visual Effects':
          return this.enhanceVisualEffectsData(data);
        case 'Music (Original Score)':
          return this.enhanceMusicData(data);
        // Add other category-specific enhancements
        default:
          return data;
      }
    }
  
    private validateRequiredCredits(
      crew: any[],
      requiredCredits: string[]
    ): boolean {
      return requiredCredits.some(credit =>
        crew.some(member =>
          member.job.toLowerCase().includes(credit.toLowerCase())
        )
      );
    }
  
    private getNestedValue(obj: any, path: string): any {
      return path.split('.').reduce((curr, key) => curr?.[key], obj);
    }
  
    private async enhanceVisualEffectsData(data: any): Promise<any> {
      // Add VFX-specific data enrichment
      return {
        ...data,
        vfxCompanies: await this.extractVFXCompanies(data.credits?.crew)
      };
    }
  
    private async enhanceMusicData(data: any): Promise<any> {
      // Add music-specific data enrichment
      return {
        ...data,
        composers: this.extractComposers(data.credits?.crew)
      };
    }
  }
  
  export { OscarCategoryTMDBHandler };