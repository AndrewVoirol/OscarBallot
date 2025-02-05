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

  constructor() {
    this.nominees = new Map();
    this.ballots = new Map();
    this.currentNomineeId = 1;
    this.currentBallotId = 1;
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
    const ballot: Ballot = { ...insertBallot, id };
    this.ballots.set(id, ballot);
    return ballot;
  }
}

export const storage = new MemStorage();
