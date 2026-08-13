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

test("a version-11 database adopts the squashed migration without losing data", async () => {
  const db = createDatabase();
  try {
    await migrateDatabase(db);
    await db
      .insertInto("account")
      .values({
        did: "did:plc:existing",
        handle: "existing.test",
        pdsUrl: null,
        updatedAt: new Date().toISOString(),
      })
      .execute();

    await sql`DROP TABLE kysely_migration`.execute(db);
    await sql`DROP TABLE kysely_migration_lock`.execute(db);
    await sql`
      CREATE TABLE migration (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `.execute(db);
    for (let version = 1; version <= 11; version++) {
      await sql`
        INSERT INTO migration (version, applied_at)
        VALUES (${version}, ${new Date().toISOString()})
      `.execute(db);
    }

    await migrateDatabase(db);

    assert.deepEqual(await migrationNames(db), [INITIAL_MIGRATION_NAME]);
    assert.deepEqual(
      await db
        .selectFrom("account")
        .select(["did", "handle"])
        .where("did", "=", "did:plc:existing")
        .executeTakeFirst(),
      { did: "did:plc:existing", handle: "existing.test" },
    );
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
