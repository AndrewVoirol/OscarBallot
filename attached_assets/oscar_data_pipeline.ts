import { Pool } from 'pg';
import fetch from 'node-fetch';
import pThrottle from 'p-throttle';

interface OscarNominee {
  name: string;
  work: string;
  category: string;
  year: number;
}

interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  vote_average: number;
  belongs_to_collection?: {
    id: number;
    name: string;
  };
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string; logo_path: string }>;
  runtime: number;
  budget: number;
  revenue: number;
  credits?: {
    cast: TMDBPerson[];
    crew: TMDBPerson[];
  };
  videos?: {
    results: Array<{
      key: string;
      site: string;
      type: string;
    }>;
  };
  similar?: {
    results: TMDBMovie[];
  };
}

interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string;
  character?: string;
  job?: string;
  biography?: string;
  birthday?: string;
  place_of_birth?: string;
  popularity: number;
}

class OscarTMDBPipeline {
  private pool: Pool;
  private tmdbAccessToken: string;
  private throttledFetch: Function;
  
  constructor(dbConfig: any, tmdbAccessToken: string) {
    this.pool = new Pool(dbConfig);
    this.tmdbAccessToken = tmdbAccessToken;
    
    // Rate limit: 40 requests per 10 seconds
    this.throttledFetch = pThrottle({
      limit: 40,
      interval: 10000
    })(this.fetchTMDB.bind(this));
  }

  // Enhanced database initialization with additional tables
  async initializeDatabase() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS movies (
          id SERIAL PRIMARY KEY,
          tmdb_id INTEGER UNIQUE,
          title TEXT NOT NULL,
          original_title TEXT,
          release_date DATE,
          poster_path TEXT,
          backdrop_path TEXT,
          overview TEXT,
          vote_average DECIMAL(3,1),
          runtime INTEGER,
          budget BIGINT,
          revenue BIGINT,
          collection_id INTEGER,
          collection_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS people (
          id SERIAL PRIMARY KEY,
          tmdb_id INTEGER UNIQUE,
          name TEXT NOT NULL,
          profile_path TEXT,
          biography TEXT,
          birthday DATE,
          place_of_birth TEXT,
          popularity DECIMAL(10,3),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS genres (
          id SERIAL PRIMARY KEY,
          tmdb_id INTEGER UNIQUE,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS movie_genres (
          movie_id INTEGER REFERENCES movies(id),
          genre_id INTEGER REFERENCES genres(id),
          PRIMARY KEY (movie_id, genre_id)
        );

        CREATE TABLE IF NOT EXISTS production_companies (
          id SERIAL PRIMARY KEY,
          tmdb_id INTEGER UNIQUE,
          name TEXT NOT NULL,
          logo_path TEXT
        );

        CREATE TABLE IF NOT EXISTS movie_companies (
          movie_id INTEGER REFERENCES movies(id),
          company_id INTEGER REFERENCES production_companies(id),
          PRIMARY KEY (movie_id, company_id)
        );

        CREATE TABLE IF NOT EXISTS movie_videos (
          id SERIAL PRIMARY KEY,
          movie_id INTEGER REFERENCES movies(id),
          key TEXT NOT NULL,
          site TEXT NOT NULL,
          type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS movie_credits (
          id SERIAL PRIMARY KEY,
          movie_id INTEGER REFERENCES movies(id),
          person_id INTEGER REFERENCES people(id),
          role_type TEXT NOT NULL,
          role_detail TEXT,
          ordering INTEGER
        );

        CREATE TABLE IF NOT EXISTS similar_movies (
          movie_id INTEGER REFERENCES movies(id),
          similar_movie_id INTEGER REFERENCES movies(id),
          PRIMARY KEY (movie_id, similar_movie_id)
        );

        CREATE TABLE IF NOT EXISTS oscar_nominations (
          id SERIAL PRIMARY KEY,
          year INTEGER NOT NULL,
          category TEXT NOT NULL,
          nominee_id INTEGER REFERENCES people(id),
          movie_id INTEGER REFERENCES movies(id),
          is_winner BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(year, category, nominee_id, movie_id)
        );

        -- Add indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
        CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date);
        CREATE INDEX IF NOT EXISTS idx_oscar_nominations_year ON oscar_nominations(year);
        CREATE INDEX IF NOT EXISTS idx_oscar_nominations_category ON oscar_nominations(category);
      `);
    } finally {
      client.release();
    }
  }

  // Rate-limited TMDB API fetcher
  private async fetchTMDB(endpoint: string): Promise<any> {
    const response = await fetch(
      `https://api.themoviedb.org/4${endpoint}`,
      {
        headers: {
          'Authorization': `Bearer ${this.tmdbAccessToken}`,
          'Content-Type': 'application/json;charset=utf-8'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  // Enhanced TMDB movie fetcher with all additional data
  async fetchTMDBMovie(title: string, year: string): Promise<TMDBMovie | null> {
    try {
      // Search for the movie
      const searchData = await this.throttledFetch(
        `/search/movie?query=${encodeURIComponent(title)}&year=${year}`
      );
      
      if (!searchData.results?.length) return null;

      // Get detailed movie info with all additional data
      const movieId = searchData.results[0].id;
      const movieData = await this.throttledFetch(
        `/movie/${movieId}?append_to_response=credits,videos,similar`
      );

      return movieData;
    } catch (error) {
      console.error(`Error fetching TMDB data for ${title}:`, error);
      return null;
    }
  }

  // Enhanced person data fetcher
  async fetchTMDBPerson(personId: number): Promise<TMDBPerson | null> {
    try {
      return await this.throttledFetch(`/person/${personId}`);
    } catch (error) {
      console.error(`Error fetching person data for ID ${personId}:`, error);
      return null;
    }
  }

  // Store all movie-related data
  async storeMovieData(movie: TMDBMovie): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Store main movie data
      const { rows: [{ id: movieId }] } = await client.query(
        `INSERT INTO movies 
         (tmdb_id, title, original_title, release_date, poster_path, 
          backdrop_path, overview, vote_average, runtime, budget, revenue,
          collection_id, collection_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (tmdb_id) DO UPDATE SET
           title = EXCLUDED.title,
           poster_path = EXCLUDED.poster_path,
           overview = EXCLUDED.overview,
           vote_average = EXCLUDED.vote_average,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          movie.id, movie.title, movie.original_title, movie.release_date,
          movie.poster_path, movie.backdrop_path, movie.overview, movie.vote_average,
          movie.runtime, movie.budget, movie.revenue,
          movie.belongs_to_collection?.id, movie.belongs_to_collection?.name
        ]
      );

      // Store genres
      for (const genre of movie.genres) {
        await client.query(
          `INSERT INTO genres (tmdb_id, name)
           VALUES ($1, $2)
           ON CONFLICT (tmdb_id) DO NOTHING`,
          [genre.id, genre.name]
        );

        await client.query(
          `INSERT INTO movie_genres (movie_id, genre_id)
           SELECT $1, id FROM genres WHERE tmdb_id = $2
           ON CONFLICT DO NOTHING`,
          [movieId, genre.id]
        );
      }

      // Store production companies
      for (const company of movie.production_companies) {
        await client.query(
          `INSERT INTO production_companies (tmdb_id, name, logo_path)
           VALUES ($1, $2, $3)
           ON CONFLICT (tmdb_id) DO NOTHING`,
          [company.id, company.name, company.logo_path]
        );

        await client.query(
          `INSERT INTO movie_companies (movie_id, company_id)
           SELECT $1, id FROM production_companies WHERE tmdb_id = $2
           ON CONFLICT DO NOTHING`,
          [movieId, company.id]
        );
      }

      // Store videos
      if (movie.videos?.results) {
        for (const video of movie.videos.results) {
          await client.query(
            `INSERT INTO movie_videos (movie_id, key, site, type)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [movieId, video.key, video.site, video.type]
          );
        }
      }

      // Store credits
      if (movie.credits) {
        for (const [index, person] of movie.credits.cast.entries()) {
          const personId = await this.storePersonData(person);
          await client.query(
            `INSERT INTO movie_credits 
             (movie_id, person_id, role_type, role_detail, ordering)
             VALUES ($1, $2, 'cast', $3, $4)
             ON CONFLICT DO NOTHING`,
            [movieId, personId, person.character, index]
          );
        }

        for (const [index, person] of movie.credits.crew.entries()) {
          const personId = await this.storePersonData(person);
          await client.query(
            `INSERT INTO movie_credits 
             (movie_id, person_id, role_type, role_detail, ordering)
             VALUES ($1, $2, 'crew', $3, $4)
             ON CONFLICT DO NOTHING`,
            [movieId, personId, person.job, index]
          );
        }
      }

      // Store similar movies
      if (movie.similar?.results) {
        for (const similarMovie of movie.similar.results) {
          const similarMovieId = await this.storeMovieData(similarMovie);
          await client.query(
            `INSERT INTO similar_movies (movie_id, similar_movie_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [movieId, similarMovieId]
          );
        }
      }

      await client.query('COMMIT');
      return movieId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Query utilities
  async getMoviesByYear(year: number) {
    const { rows } = await this.pool.query(`
      SELECT DISTINCT m.*
      FROM movies m
      JOIN oscar_nominations n ON m.id = n.movie_id
      WHERE n.year = $1
    `, [year]);
    return rows;
  }

  async getNomineesByCategory(year: number, category: string) {
    const { rows } = await this.pool.query(`
      SELECT 
        n.category,
        p.name as nominee_name,
        m.title as movie_title,
        n.is_winner
      FROM oscar_nominations n
      LEFT JOIN people p ON n.nominee_id = p.id
      JOIN movies m ON n.movie_id = m.id
      WHERE n.year = $1 AND n.category = $2
      ORDER BY p.name
    `, [year, category]);
    return rows;
  }

  async getMovieDetails(movieId: number) {
    const { rows: [movie] } = await this.pool.query(`
      SELECT 
        m.*,
        array_agg(DISTINCT g.name) as genres,
        array_agg(DISTINCT pc.name) as production_companies,
        array_agg(DISTINCT jsonb_build_object(
          'key', mv.key,
          'site', mv.site,
          'type', mv.type
        )) as videos,
        array_agg(DISTINCT jsonb_build_object(
          'name', p.name,
          'role_type', mc.role_type,
          'role_detail', mc.role_detail
        )) as credits
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      LEFT JOIN movie_companies mc ON m.id = mc.movie_id
      LEFT JOIN production_companies pc ON mc.company_id = pc.id
      LEFT JOIN movie_videos mv ON m.id = mv.movie_id
      LEFT JOIN movie_credits mc ON m.id = mc.movie_id
      LEFT JOIN people p ON mc.person_id = p.id
      WHERE m.id = $1
      GROUP BY m.id
    `, [movieId]);
    return movie;
  }

  // Parse 2024 Oscar data (different format handling)
  parseOscar2024Data(content: string): OscarNominee[] {
    // This method would be implemented based on the specific format of the 2024 data
    // For now, returning an empty array as placeholder
    return [];
  }

  // Process all nominees with progress tracking
  async processNominees(nominees: OscarNominee[], onProgress?: (progress: number) => void) {
    const total = nominees.length;
    let processed = 0;

    for (const nominee of nominees) {
      try {
        const movieData = await this.fetchTMDBMovie(nominee.work, nominee.year.toString());
        if (!movieData) continue;

        const movieId = await this.storeMovieData(movieData);

        if (nominee.name) {
          const person = movieData.credits?.cast?.find(p => p.name === nominee.name) ||
                        movieData.credits?.crew?.find(p => p.name === nominee.name);
          
          if (person) {
            const personId = await this.storePersonData(person);
            
            await this.pool.query(
              `INSERT INTO oscar_nominations (year, category, nominee_id, movie_id)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (year, category, nominee_id, movie_id) DO NOTHING`,
              [nominee.year, nominee.category, personId, movieId]
            );
          }
        } else {
          // Store nomination for categories without specific people (e.g., Best Picture)
          await this.pool.query(
            `INSERT INTO oscar_nominations (year, category, movie_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (year, category, movie_id) DO NOTHING`,
            [nominee.year, nominee.category, movieId]
          );
        }

        processed++;
        if (onProgress) {
          onProgress((processed / total) * 100);
        }
      } catch (error) {
        console.error(`Error processing nominee ${nominee.name || nominee.work}:`, error);
      }
    }
  }

  // Additional query utilities for common access patterns
  async getWinnersByYear(year: number) {
    const { rows } = await this.pool.query(`
      SELECT 
        n.category,
        p.name as nominee_name,
        m.title as movie_title,
        m.poster_path,
        array_agg(DISTINCT g.name) as genres
      FROM oscar_nominations n
      JOIN movies m ON n.movie_id = m.id
      LEFT JOIN people p ON n.nominee_id = p.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE n.year = $1 AND n.is_winner = true
      GROUP BY n.category, p.name, m.title, m.poster_path
      ORDER BY n.category
    `, [year]);
    return rows;
  }

  async getMovieTrailers(movieId: number) {
    const { rows } = await this.pool.query(`
      SELECT key, site, type
      FROM movie_videos
      WHERE movie_id = $1 AND type = 'Trailer'
      ORDER BY id
    `, [movieId]);
    return rows;
  }

  async getPersonFilmography(personId: number) {
    const { rows } = await this.pool.query(`
      SELECT 
        m.title,
        m.release_date,
        mc.role_type,
        mc.role_detail,
        array_agg(DISTINCT n.category) as oscar_nominations
      FROM movie_credits mc
      JOIN movies m ON mc.movie_id = m.id
      LEFT JOIN oscar_nominations n ON m.id = n.movie_id
      WHERE mc.person_id = $1
      GROUP BY m.title, m.release_date, mc.role_type, mc.role_detail
      ORDER BY m.release_date DESC
    `, [personId]);
    return rows;
  }

  async getMovieStats(year: number) {
    const { rows: [stats] } = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT m.id) as total_nominated_movies,
        AVG(m.vote_average) as avg_rating,
        AVG(m.runtime) as avg_runtime,
        array_agg(DISTINCT g.name) as common_genres
      FROM oscar_nominations n
      JOIN movies m ON n.movie_id = m.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE n.year = $1
      GROUP BY n.year
    `, [year]);
    return stats;
  }

  // Usage example with the new features
  static async example() {
    const pipeline = new OscarTMDBPipeline({
      host: 'localhost',
      database: 'oscars_db',
      user: 'your_user',
      password: 'your_password'
    }, 'your_tmdb_access_token');

    // Initialize database with enhanced schema
    await pipeline.initializeDatabase();

    // Process 2025 nominees with progress tracking
    const nominees2025 = pipeline.parseOscarNominees(oscar2025Data, 2025);
    await pipeline.processNominees(nominees2025, (progress) => {
      console.log(`Processing 2025 nominees: ${progress.toFixed(1)}% complete`);
    });

    // Process 2024 nominees
    const nominees2024 = pipeline.parseOscar2024Data(oscar2024Data);
    await pipeline.processNominees(nominees2024, (progress) => {
      console.log(`Processing 2024 nominees: ${progress.toFixed(1)}% complete`);
    });

    // Example queries using the new utilities
    const winners2025 = await pipeline.getWinnersByYear(2025);
    console.log('2025 Winners:', winners2025);

    const movieStats = await pipeline.getMovieStats(2025);
    console.log('2025 Movie Statistics:', movieStats);

    // Get detailed movie information including trailers
    const movie = await pipeline.getMovieDetails(1);
    const trailers = await pipeline.getMovieTrailers(1);
    console.log('Movie Details:', movie);
    console.log('Movie Trailers:', trailers);
  }
}

export default OscarTMDBPipeline;