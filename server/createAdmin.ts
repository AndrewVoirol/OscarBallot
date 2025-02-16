import { db } from "./db";
import { users } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  try {
    const hashedPassword = await hashPassword("admin123");

    // Delete existing admin user if exists
    await db.delete(users).where(eq(users.username, "admin"));

    // Create new admin user
    const [adminUser] = await db
      .insert(users)
      .values({
        username: "admin",
        password: hashedPassword,
        isAdmin: true
      })
      .returning();

    console.log("Admin user created successfully:", adminUser);
    return adminUser;
  } catch (error) {
    console.error("Error creating admin user:", error);
    throw error;
  }
}

createAdminUser().catch(console.error);