import Database from "better-sqlite3";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";
import { getRuntimeConfig } from "../config";
import type { DatabaseSchema } from "./schema";

let database: Database.Database | undefined;
let queryDatabase: Kysely<DatabaseSchema> | undefined;

export function getDb(): Database.Database {
  if (!database) {
    database = new Database(getRuntimeConfig().databasePath);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
  }
  return database;
}

export function getQueryDb(): Kysely<DatabaseSchema> {
  if (!queryDatabase) {
    queryDatabase = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: getDb() }),
      plugins: [new CamelCasePlugin()],
    });
  }
  return queryDatabase;
}
