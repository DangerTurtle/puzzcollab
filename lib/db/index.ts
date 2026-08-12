import Database from "better-sqlite3";

export const DATABASE_PATH = process.env.DATABASE_PATH ?? "bulletin.db";

let database: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!database) {
    database = new Database(DATABASE_PATH);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
  }
  return database;
}
