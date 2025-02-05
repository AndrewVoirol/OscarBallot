import { type Nominee, type InsertNominee, type Ballot, type InsertBallot, type User, type InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getNominees(): Promise<Nominee[]>;
  getNomineesByCategory(category: string): Promise<Nominee[]>;
  getNominee(id: number): Promise<Nominee | undefined>;
  getBallot(nomineeId: number, userId: number): Promise<Ballot | undefined>;
  updateBallot(ballot: InsertBallot & { userId: number }): Promise<Ballot>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private nominees: Map<number, Nominee>;
  private ballots: Map<number, Ballot>;
  private users: Map<number, User>;
  private currentNomineeId: number;
  private currentBallotId: number;
  private currentUserId: number;
  readonly sessionStore: session.Store;

  constructor(initialNominees: Nominee[] = []) {
    this.nominees = new Map();
    this.ballots = new Map();
    this.users = new Map();
    this.currentNomineeId = 1;
    this.currentBallotId = 1;
    this.currentUserId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });

    // Initialize with mock data
    initialNominees.forEach(nominee => {
      this.nominees.set(nominee.id, nominee);
      this.currentNomineeId = Math.max(this.currentNomineeId, nominee.id + 1);
    });
  }

  async getNominees(): Promise<Nominee[]> {
    return Array.from(this.nominees.values());
  }

  async getNomineesByCategory(category: string): Promise<Nominee[]> {
    return Array.from(this.nominees.values()).filter(
      (nominee) => nominee.category === category
    );
  }

  async getNominee(id: number): Promise<Nominee | undefined> {
    return this.nominees.get(id);
  }

  async getBallot(nomineeId: number, userId: number): Promise<Ballot | undefined> {
    return Array.from(this.ballots.values()).find(
      (ballot) => ballot.nomineeId === nomineeId && ballot.userId === userId
    );
  }

  async updateBallot(insertBallot: InsertBallot & { userId: number }): Promise<Ballot> {
    const existingBallot = await this.getBallot(insertBallot.nomineeId, insertBallot.userId);
    const id = existingBallot?.id ?? this.currentBallotId++;
    const ballot: Ballot = {
      id,
      userId: insertBallot.userId,
      nomineeId: insertBallot.nomineeId,
      hasWatched: insertBallot.hasWatched ?? false,
      predictedWinner: insertBallot.predictedWinner ?? false,
      wantToWin: insertBallot.wantToWin ?? false
    };
    this.ballots.set(id, ballot);
    return ballot;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { id, ...insertUser };
    this.users.set(id, user);
    return user;
  }
}

// Import mock data and initialize storage with it
import { mockNominees } from "../client/src/lib/data";
export const storage = new MemStorage(mockNominees);