import { execSync } from "node:child_process";

/** Fresh SQLite test database (prisma/test.db) with the seeded catalog; dev.db is untouched. */
export default function setup() {
  execSync("node scripts/reset-db.mjs --quiet", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
