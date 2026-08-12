import type Database from "better-sqlite3";
import { getDb } from "./index";

type Migration = {
  version: number;
  up: (db: Database.Database) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE auth_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE auth_session (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE account (
          did TEXT PRIMARY KEY,
          handle TEXT,
          pds_url TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE board (
          space_uri TEXT PRIMARY KEY,
          owner_did TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );

        CREATE TABLE post (
          uri TEXT PRIMARY KEY,
          cid TEXT NOT NULL,
          space_uri TEXT NOT NULL,
          author_did TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          indexed_at TEXT NOT NULL
        );

        CREATE INDEX post_board_created_idx
          ON post(space_uri, created_at DESC);

        CREATE TABLE moderation_label (
          uri TEXT PRIMARY KEY,
          cid TEXT NOT NULL,
          space_uri TEXT NOT NULL,
          author_did TEXT NOT NULL,
          subject_uri TEXT NOT NULL,
          subject_cid TEXT,
          val TEXT NOT NULL,
          neg INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          indexed_at TEXT NOT NULL
        );

        CREATE INDEX label_subject_created_idx
          ON moderation_label(space_uri, subject_uri, created_at DESC);
      `);
    },
  },
  {
    version: 2,
    up(db) {
      db.exec(`
        ALTER TABLE post ADD COLUMN x INTEGER;
        ALTER TABLE post ADD COLUMN y INTEGER;

        CREATE TABLE note_position (
          uri TEXT PRIMARY KEY,
          cid TEXT NOT NULL,
          space_uri TEXT NOT NULL,
          author_did TEXT NOT NULL,
          subject_uri TEXT NOT NULL,
          subject_cid TEXT NOT NULL,
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          indexed_at TEXT NOT NULL
        );

        CREATE INDEX note_position_subject_created_idx
          ON note_position(space_uri, subject_uri, subject_cid, created_at DESC);
      `);
    },
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE sync_space (
          space_uri TEXT PRIMARY KEY,
          viewer_did TEXT NOT NULL,
          authority_did TEXT NOT NULL,
          registration_expires_at TEXT,
          last_error TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE sync_repo (
          space_uri TEXT NOT NULL,
          repo_did TEXT NOT NULL,
          pds_url TEXT NOT NULL,
          rev TEXT NOT NULL,
          lthash BLOB NOT NULL,
          commit_hash BLOB NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(space_uri, repo_did)
        );
      `);
    },
  },
  {
    version: 4,
    up(db) {
      db.exec(`
        ALTER TABLE post ADD COLUMN color TEXT;
        ALTER TABLE post ADD COLUMN rotation INTEGER;
      `);
    },
  },
  {
    version: 5,
    up(db) {
      db.exec(`
        DELETE FROM post
          WHERE space_uri LIKE 'at://%/space/com.example.bulletin/%';
        DELETE FROM moderation_label
          WHERE space_uri LIKE 'at://%/space/com.example.bulletin/%';
        DELETE FROM note_position
          WHERE space_uri LIKE 'at://%/space/com.example.bulletin/%';
        DELETE FROM sync_repo
          WHERE space_uri LIKE 'at://%/space/com.example.bulletin/%';
        DELETE FROM sync_space
          WHERE space_uri LIKE 'at://%/space/com.example.bulletin/%';
        DELETE FROM board
          WHERE space_uri LIKE 'at://%/space/com.example.bulletin/%';
      `);
    },
  },
  {
    version: 6,
    up(db) {
      db.exec(`
        DELETE FROM auth_session
          WHERE json_extract(value, '$.tokenSet.scope')
            LIKE '%include:com.example.bulletinPermissions%';
        DELETE FROM auth_state;
      `);
    },
  },
  {
    version: 7,
    up(db) {
      db.exec(`
        DELETE FROM auth_session;
        DELETE FROM auth_state;
      `);
    },
  },
  {
    version: 8,
    up(db) {
      db.exec(`
        DELETE FROM post
          WHERE space_uri LIKE 'at://%/space/at.dholms.bulletin/%';
        DELETE FROM moderation_label
          WHERE space_uri LIKE 'at://%/space/at.dholms.bulletin/%';
        DELETE FROM note_position
          WHERE space_uri LIKE 'at://%/space/at.dholms.bulletin/%';
        DELETE FROM sync_repo
          WHERE space_uri LIKE 'at://%/space/at.dholms.bulletin/%';
        DELETE FROM sync_space
          WHERE space_uri LIKE 'at://%/space/at.dholms.bulletin/%';
        DELETE FROM board
          WHERE space_uri LIKE 'at://%/space/at.dholms.bulletin/%';
        DELETE FROM auth_session
          WHERE json_extract(value, '$.tokenSet.scope')
            LIKE '%space:at.dholms.bulletin?%';
      `);
    },
  },
  {
    version: 9,
    up(db) {
      db.exec(`
        CREATE TABLE sync_space_v9 (
          space_uri TEXT PRIMARY KEY,
          authority_did TEXT NOT NULL,
          registration_expires_at TEXT,
          last_error TEXT,
          updated_at TEXT NOT NULL
        );

        INSERT INTO sync_space_v9(
          space_uri, authority_did, registration_expires_at, last_error, updated_at
        )
        SELECT
          space_uri, authority_did, registration_expires_at, last_error, updated_at
        FROM sync_space;

        DROP TABLE sync_space;
        ALTER TABLE sync_space_v9 RENAME TO sync_space;
      `);
    },
  },
  {
    version: 10,
    up(db) {
      db.exec(`
        ALTER TABLE post ADD COLUMN image_cid TEXT;
        ALTER TABLE post ADD COLUMN image_mime TEXT;
        ALTER TABLE post ADD COLUMN image_size INTEGER;
        ALTER TABLE post ADD COLUMN image_alt TEXT;

        CREATE TABLE space_blob (
          space_uri TEXT NOT NULL,
          repo_did TEXT NOT NULL,
          cid TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(space_uri, repo_did, cid)
        );

        DELETE FROM auth_session;
        DELETE FROM auth_state;
      `);
    },
  },
];

export function migrate(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM migration")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const apply = db.transaction((migration: Migration) => {
    migration.up(db);
    db.prepare(
      "INSERT INTO migration(version, applied_at) VALUES (?, ?)",
    ).run(migration.version, new Date().toISOString());
  });

  for (const migration of migrations) {
    if (!applied.has(migration.version)) apply(migration);
  }
}
