import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  // Aceita tanto o Turso (libsql://) quanto o SQLite local (file:), para a
  // mesma migracao rodar em producao e no dev.db. O alvo vem do DATABASE_URL,
  // e o dotenv nao sobrescreve variavel ja definida — entao para mirar o banco
  // local basta prefixar o comando:
  //   DATABASE_URL="file:./dev.db" node migrate-turso.mjs migrate-notes.sql
  if (!url || !/^(libsql:|https?:|file:)/.test(url)) {
    console.error("DATABASE_URL invalida. Use libsql://... (Turso) ou file:./dev.db (local).");
    process.exit(1);
  }

  // Mostra o alvo antes de escrever: migrar o banco errado e o tipo de engano
  // que so aparece depois. O token de auth nunca vai para o log.
  const target = url.startsWith("file:") ? url : new URL(url).host;
  console.log(`Target: ${target}`);
  const client = createClient({ url, authToken });

  // Cada migracao vive em seu proprio .sql; o primeiro argumento escolhe qual.
  const file = process.argv[2] || "migrate-turso.sql";
  console.log(`Applying: ${file}`);
  const sql = readFileSync(file, "utf-8");

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
