import { type InsertNominee } from "@shared/schema";
import { type NeonDatabase } from "@neondatabase/serverless";
import { nominees } from "@shared/schema";

export async function insertNominee(nominee: InsertNominee, db: NeonDatabase) {
  try {
    const [inserted] = await db
      .insert(nominees)
      .values(nominee)
      .onConflictDoUpdate({
        target: [nominees.name, nominees.category, nominees.ceremonyYear],
        set: nominee
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error(`Error inserting nominee ${nominee.name}:`, error);
    throw error;
  }
}
