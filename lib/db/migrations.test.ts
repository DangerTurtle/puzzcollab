import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { CamelCasePlugin, Kysely, sql, SqliteDialect } from "kysely";
import type { DatabaseSchema } from "./schema";
import {
  INITIAL_MIGRATION_NAME,
  migrateDatabase,
} from "./migrations";

test("a fresh database records one squashed migration", async () => {
  const db = createDatabase();
  try {
    await migrateDatabase(db);

    assert.deepEqual(await migrationNames(db), [INITIAL_MIGRATION_NAME]);
    const tables = (await db.introspection.getTables()).map(({ name }) => name);
    assert.equal(tables.includes("removal"), true);
    assert.equal(
      (await db.introspection.getTables()).some(
        ({ name }) => name === "migration",
      ),
      false,
    );
  } finally {
    await db.destroy();
  }
});

function createDatabase(): Kysely<DatabaseSchema> {
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: new Database(":memory:") }),
    plugins: [new CamelCasePlugin()],
  });
}

async function migrationNames(
  db: Kysely<DatabaseSchema>,
): Promise<string[]> {
  const result = await sql<{ name: string }>`
    SELECT name FROM kysely_migration ORDER BY name
  `.execute(db);
  return result.rows.map(({ name }) => name);
}
