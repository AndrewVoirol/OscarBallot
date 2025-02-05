import { db } from "./db";
import { nominees } from "@shared/schema";
import { mockNominees } from "../client/src/lib/data";

async function seed() {
  try {
    // Insert mock nominees
    await db.insert(nominees).values(mockNominees);
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    process.exit(0);
  }
}

seed();
