// Types for media content
interface MovieMedia {
    images: {
      poster: ImageSizes;
      backdrop: ImageSizes;
      still: ImageSizes;
    };
    videos: VideoContent[];
  }
  
  interface ImageSizes {
    original: string;
    w500: string;
    w780: string;
    w1280: string;
    w300: string;
    w92: string;
  }
  
  interface VideoContent {
    id: string;
    key: string;
    site: string;
    type: string;
    name: string;
    official: boolean;
    quality: string;
  }
  
  class MediaValidator {
    private readonly TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
    private readonly VALID_VIDEO_SITES = ['YouTube', 'Vimeo'];
    private readonly REQUIRED_IMAGE_SIZES = ['original', 'w500', 'w780', 'w1280', 'w300', 'w92'];
  
    constructor(private tmdbAccessToken: string) {}
  
    // Validate and format image URLs for all sizes
    async validateAndFormatImages(posterPath: string | null, backdropPath: string | null): Promise<{
      poster: ImageSizes | null;
      backdrop: ImageSizes | null;
    }> {
      const poster = posterPath ? this.generateImageSizes(posterPath) : null;
      const backdrop = backdropPath ? this.generateImageSizes(backdropPath) : null;
  
      // Verify image availability
      if (poster) {
        await this.verifyImageAvailability(poster.w500);
      }
      if (backdrop) {
        await this.verifyImageAvailability(backdrop.w780);
      }
  
      return { poster, backdrop };
    }
  
    private generateImageSizes(path: string): ImageSizes {
      return {
        original: `${this.TMDB_IMAGE_BASE}original${path}`,
        w500: `${this.TMDB_IMAGE_BASE}w500${path}`,
        w780: `${this.TMDB_IMAGE_BASE}w780${path}`,
        w1280: `${this.TMDB_IMAGE_BASE}w1280${path}`,
        w300: `${this.TMDB_IMAGE_BASE}w300${path}`,
        w92: `${this.TMDB_IMAGE_BASE}w92${path}`
      };
    }
  
    // Verify that images are actually available
    private async verifyImageAvailability(url: string): Promise<boolean> {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
      } catch (error) {
        console.error(`Error verifying image availability for ${url}:`, error);
        return false;
      }
    }
  
    // Get and validate the best available trailer
    async getBestTrailer(videos: VideoContent[]): Promise<VideoContent | null> {
      if (!videos || !videos.length) return null;
  
      // Filter for valid video sites and trailer type
      const validTrailers = videos
        .filter(video => 
          this.VALID_VIDEO_SITES.includes(video.site) && 
          video.type === 'Trailer' &&
          video.official
        )
        .sort((a, b) => {
          // Prioritize official trailers
          if (a.official !== b.official) return b.official ? 1 : -1;
          // Then by quality
          if (a.quality !== b.quality) {
            return a.quality === '1080p' ? -1 : 1;
          }
          // Finally by date (assuming newer is better)
          return a.id > b.id ? -1 : 1;
        });
  
      return validTrailers[0] || null;
    }
  }
  
  class DataValidator {
    private readonly REQUIRED_MOVIE_FIELDS = [
      'title',
      'release_date',
      'overview'
    ];
  
    private readonly REQUIRED_PERSON_FIELDS = [
      'name',
      'id'
    ];
  
    // Validate movie data completeness
    validateMovie(movie: any): { isValid: boolean; issues: string[] } {
      const issues: string[] = [];
  
      // Check required fields
      this.REQUIRED_MOVIE_FIELDS.forEach(field => {
        if (!movie[field]) {
          issues.push(`Missing required field: ${field}`);
        }
      });
  
      // Validate release date format
      if (movie.release_date && !this.isValidDate(movie.release_date)) {
        issues.push('Invalid release date format');
      }
  
      // Validate numeric fields
      if (movie.runtime && (!Number.isInteger(movie.runtime) || movie.runtime <= 0)) {
        issues.push('Invalid runtime');
      }
  
      if (movie.vote_average && (typeof movie.vote_average !== 'number' || movie.vote_average < 0 || movie.vote_average > 10)) {
        issues.push('Invalid vote average');
      }
  
      return {
        isValid: issues.length === 0,
        issues
      };
    }
  
    // Validate person data completeness
    validatePerson(person: any): { isValid: boolean; issues: string[] } {
      const issues: string[] = [];
  
      this.REQUIRED_PERSON_FIELDS.forEach(field => {
        if (!person[field]) {
          issues.push(`Missing required field: ${field}`);
        }
      });
  
      // Validate birth date if present
      if (person.birthday && !this.isValidDate(person.birthday)) {
        issues.push('Invalid birth date format');
      }
  
      return {
        isValid: issues.length === 0,
        issues
      };
    }
  
    private isValidDate(dateString: string): boolean {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date.getTime());
    }
  }
  
  // Enhanced database schema for media content
  const mediaSchemaSQL = `
    CREATE TABLE IF NOT EXISTS movie_images (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER REFERENCES movies(id),
      type TEXT NOT NULL,
      size TEXT NOT NULL,
      url TEXT NOT NULL,
      verified BOOLEAN DEFAULT false,
      last_verified TIMESTAMP,
      UNIQUE(movie_id, type, size)
    );
  
    CREATE TABLE IF NOT EXISTS movie_trailers (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER REFERENCES movies(id),
      video_id TEXT NOT NULL,
      site TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      quality TEXT,
      official BOOLEAN DEFAULT false,
      type TEXT NOT NULL,
      added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(movie_id, video_id)
    );
  
    CREATE INDEX IF NOT EXISTS idx_movie_trailers_official ON movie_trailers(official) WHERE official = true;
    CREATE INDEX IF NOT EXISTS idx_movie_images_verified ON movie_images(verified) WHERE verified = true;
  `;
  
  export { MediaValidator, DataValidator, mediaSchemaSQL };