import { type Nominee, type InsertNominee, type Ballot, type InsertBallot, type User, type InsertUser, nominees, ballots, users } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import createMemoryStore from "memorystore";
import type { DatabaseError } from "pg";
import { type SyncStatus, syncStatus } from "@shared/schema";
import { sql } from 'drizzle-orm';

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getNominees(year?: number): Promise<Nominee[]>;
  getNomineesByCategory(category: string, year?: number): Promise<Nominee[]>;
  getNominee(id: number): Promise<Nominee | undefined>;
  getBallot(nomineeId: number, userId: number): Promise<Ballot | undefined>;
  getBallotsByUser(userId: number): Promise<Ballot[]>;
  updateBallot(ballot: InsertBallot & { userId: number }): Promise<Ballot>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;
  getSyncStatus(): Promise<SyncStatus[]>;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
      stale: false, // Do not serve stale sessions
    });
  }

  private handleDatabaseError(error: unknown, operation: string): never {
    console.error(`Database error during ${operation}:`, error);
    if ((error as DatabaseError).code === '23505') {
      throw new Error('Duplicate entry found');
    }
    throw new Error(`Database operation failed: ${operation}`);
  }

  async getNominees(year: number = 2024): Promise<Nominee[]> {
    try {
      return await db
        .select()
        .from(nominees)
        .where(eq(nominees.ceremonyYear, year));
    } catch (error) {
      this.handleDatabaseError(error, 'getNominees');
    }
  }

  async getNomineesByCategory(category: string, year: number = 2024): Promise<Nominee[]> {
    try {
      return await db
        .select()
        .from(nominees)
        .where(
          and(
            eq(nominees.category, category),
            eq(nominees.ceremonyYear, year)
          )
        );
    } catch (error) {
      this.handleDatabaseError(error, 'getNomineesByCategory');
    }
  }

  async getNominee(id: number): Promise<Nominee | undefined> {
    try {
      const [nominee] = await db
        .select()
        .from(nominees)
        .where(eq(nominees.id, id));
      return nominee;
    } catch (error) {
      this.handleDatabaseError(error, 'getNominee');
    }
  }

  async getBallot(nomineeId: number, userId: number): Promise<Ballot | undefined> {
    try {
      const [ballot] = await db
        .select()
        .from(ballots)
        .where(
          and(
            eq(ballots.nomineeId, nomineeId),
            eq(ballots.userId, userId)
          )
        );
      return ballot;
    } catch (error) {
      this.handleDatabaseError(error, 'getBallot');
    }
  }

  async getBallotsByUser(userId: number): Promise<Ballot[]> {
    try {
      return await db
        .select()
        .from(ballots)
        .where(eq(ballots.userId, userId));
    } catch (error) {
      this.handleDatabaseError(error, 'getBallotsByUser');
    }
  }

  async updateBallot(insertBallot: InsertBallot & { userId: number }): Promise<Ballot> {
    try {
      const existingBallot = await this.getBallot(insertBallot.nomineeId, insertBallot.userId);
      if (existingBallot) {
        const [ballot] = await db
          .update(ballots)
          .set(insertBallot)
          .where(eq(ballots.id, existingBallot.id))
          .returning();
        return ballot;
      }
      const [ballot] = await db
        .insert(ballots)
        .values(insertBallot)
        .returning();
      return ballot;
    } catch (error) {
      this.handleDatabaseError(error, 'updateBallot');
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id));
      return user;
    } catch (error) {
      this.handleDatabaseError(error, 'getUser');
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      return user;
    } catch (error) {
      this.handleDatabaseError(error, 'getUserByUsername');
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(insertUser)
        .returning();
      return user;
    } catch (error) {
      this.handleDatabaseError(error, 'createUser');
    }
  }

  async getSyncStatus(): Promise<SyncStatus[]> {
    try {
      return await db
        .select()
        .from(syncStatus)
        .orderBy(sql`${syncStatus.lastSyncStarted} DESC`)
        .limit(1);
    } catch (error) {
      this.handleDatabaseError(error, 'getSyncStatus');
    }
  }
}

export const storage = new DatabaseStorage();