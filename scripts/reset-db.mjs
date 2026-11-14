// Recreates the local SQLite database from scratch: delete the file, push the schema, seed.
// Refuses anything that is not a local file: URL inside prisma/.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (existsSync(".env")) {
    const match = readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (match) return match[1];
  }
  return "file:./dev.db";
}

const url = databaseUrl();
if (!url.startsWith("file:")) {
  console.error(`Refusing to reset non-SQLite database: ${url}`);
  process.exit(1);
}
const prismaDir = resolve("prisma");
const file = resolve(prismaDir, url.slice("file:".length));
if (!file.startsWith(prismaDir + sep) || !file.endsWith(".db")) {
  console.error(`Refusing to delete ${file}: only *.db files inside prisma/ are reset`);
  process.exit(1);
}

for (const f of [file, `${file}-journal`]) rmSync(f, { force: true });
const env = { ...process.env, DATABASE_URL: url };
const quiet = process.argv.includes("--quiet");
execSync("npx prisma db push --skip-generate", { env, stdio: quiet ? "pipe" : "inherit" });
execSync("npx tsx prisma/seed.ts", { env, stdio: quiet ? "pipe" : "inherit" });
console.log(`Reset ${file}`);
