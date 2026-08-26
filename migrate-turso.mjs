import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (!url || !url.startsWith("libsql://")) {
    console.error("Please set a valid Turso DATABASE_URL in .env");
    process.exit(1);
  }

  console.log(`Connecting to Turso: ${url}`);
  const client = createClient({ url, authToken });

  const sql = readFileSync("migrate-turso.sql", "utf-8");

  const statements = sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      console.log(`Executed successfully`);
    } catch (err) {
      console.error("Error executing statement:", err);
    }
  }

  console.log("Migration completed!");
}

main().catch(console.error);
