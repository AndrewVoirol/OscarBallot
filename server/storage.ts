import { type Nominee, type InsertNominee, type Ballot, type InsertBallot } from "@shared/schema";

export interface IStorage {
  getNominees(): Promise<Nominee[]>;
  getNomineesByCategory(category: string): Promise<Nominee[]>;
  getNominee(id: number): Promise<Nominee | undefined>;
  getBallot(nomineeId: number): Promise<Ballot | undefined>;
  updateBallot(ballot: InsertBallot): Promise<Ballot>;
}

export class MemStorage implements IStorage {
  private nominees: Map<number, Nominee>;
  private ballots: Map<number, Ballot>;
  private currentNomineeId: number;
  private currentBallotId: number;

  constructor(initialNominees: Nominee[] = []) {
    this.nominees = new Map();
    this.ballots = new Map();
    this.currentNomineeId = 1;
    this.currentBallotId = 1;

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

  async getBallot(nomineeId: number): Promise<Ballot | undefined> {
    return Array.from(this.ballots.values()).find(
      (ballot) => ballot.nomineeId === nomineeId
    );
  }

  async updateBallot(insertBallot: InsertBallot): Promise<Ballot> {
    const existingBallot = await this.getBallot(insertBallot.nomineeId);
    const id = existingBallot?.id ?? this.currentBallotId++;
    const ballot: Ballot = {
      id,
      nomineeId: insertBallot.nomineeId,
      hasWatched: insertBallot.hasWatched ?? false,
      predictedWinner: insertBallot.predictedWinner ?? false,
      wantToWin: insertBallot.wantToWin ?? false
    };
    this.ballots.set(id, ballot);
    return ballot;
  }
}

// Import mock data and initialize storage with it
import { mockNominees } from "../client/src/lib/data";
export const storage = new MemStorage(mockNominees);