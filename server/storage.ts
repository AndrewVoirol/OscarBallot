import { type Nominee, type InsertNominee, type Ballot, type InsertBallot, type User, type InsertUser, nominees, ballots, users } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getNominees(year?: number): Promise<Nominee[]>;
  getNomineesByCategory(category: string, year?: number): Promise<Nominee[]>;
  getNominee(id: number): Promise<Nominee | undefined>;
  getBallot(nomineeId: number, userId: number): Promise<Ballot | undefined>;
  updateBallot(ballot: InsertBallot & { userId: number }): Promise<Ballot>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
      stale: false, // Do not serve stale sessions
    });
  }

  async getNominees(year: number = 2025): Promise<Nominee[]> {
    return await db
      .select()
      .from(nominees)
      .where(eq(nominees.ceremonyYear, year));
  }

  async getNomineesByCategory(category: string, year: number = 2025): Promise<Nominee[]> {
    return await db
      .select()
      .from(nominees)
      .where(
        and(
          eq(nominees.category, category),
          eq(nominees.ceremonyYear, year)
        )
      );
  }

  async getNominee(id: number): Promise<Nominee | undefined> {
    const [nominee] = await db
      .select()
      .from(nominees)
      .where(eq(nominees.id, id));
    return nominee;
  }

  async getBallot(nomineeId: number, userId: number): Promise<Ballot | undefined> {
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
  }

  async updateBallot(insertBallot: InsertBallot & { userId: number }): Promise<Ballot> {
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
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
}

// Initialize storage with database implementation
export const storage = new DatabaseStorage();