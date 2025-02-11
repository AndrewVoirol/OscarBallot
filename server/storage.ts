import { type Nominee, type InsertNominee, type User, type InsertUser, type Prediction, type InsertPrediction, nominees, predictions, users } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getNominees(year?: number): Promise<Nominee[]>;
  getNomineesByCategory(category: string, year?: number): Promise<Nominee[]>;
  getNominee(id: number): Promise<Nominee | undefined>;
  getPrediction(nomineeId: number, userId: number): Promise<Prediction | undefined>;
  updatePrediction(prediction: InsertPrediction & { userId: number }): Promise<Prediction>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
      stale: false,
    });
  }

  async getNominees(year?: number): Promise<Nominee[]> {
    if (!year) {
      return await db
        .select()
        .from(nominees)
        .orderBy(desc(nominees.ceremonyYear));
    }
    return await db
      .select()
      .from(nominees)
      .where(eq(nominees.ceremonyYear, year))
      .orderBy(desc(nominees.ceremonyYear));
  }

  async getNomineesByCategory(category: string, year?: number): Promise<Nominee[]> {
    if (!year) {
      return await db
        .select()
        .from(nominees)
        .where(eq(nominees.category, category))
        .orderBy(desc(nominees.ceremonyYear));
    }
    return await db
      .select()
      .from(nominees)
      .where(
        and(
          eq(nominees.category, category),
          eq(nominees.ceremonyYear, year)
        )
      )
      .orderBy(desc(nominees.ceremonyYear));
  }

  async getNominee(id: number): Promise<Nominee | undefined> {
    const [nominee] = await db
      .select()
      .from(nominees)
      .where(eq(nominees.id, id));
    return nominee;
  }

  async getPrediction(nomineeId: number, userId: number): Promise<Prediction | undefined> {
    const [prediction] = await db
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.nomineeId, nomineeId),
          eq(predictions.userId, userId)
        )
      );
    return prediction;
  }

  async updatePrediction(insertPrediction: InsertPrediction & { userId: number }): Promise<Prediction> {
    const existingPrediction = await this.getPrediction(insertPrediction.nomineeId, insertPrediction.userId);
    if (existingPrediction) {
      const [prediction] = await db
        .update(predictions)
        .set(insertPrediction)
        .where(eq(predictions.id, existingPrediction.id))
        .returning();
      return prediction;
    }
    const [prediction] = await db
      .insert(predictions)
      .values(insertPrediction)
      .returning();
    return prediction;
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

export const storage = new DatabaseStorage();