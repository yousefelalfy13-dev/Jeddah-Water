import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { Department } from '../src/types/cms';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'jeddah_water.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'server', 'migrations');

let dbInstance: DatabaseSync | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const isAppliedStmt = db.prepare(
    'SELECT version FROM schema_migrations WHERE version = ?'
  );
  const insertMigStmt = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const file of files) {
    const version = file.split('_')[0];
    const existing = isAppliedStmt.get(version) as { version: string } | undefined;
    if (existing) continue;

    const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(sqlContent);
      insertMigStmt.run(version, file, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  runMigrations(db);
  dbInstance = db;
  return dbInstance;
}

export function withTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback errors if transaction already aborted
    }
    throw err;
  }
}

export function syncDepartmentsToDb(departments: Department[]) {
  if (!Array.isArray(departments) || departments.length === 0) return;
  const now = new Date().toISOString();

  withTransaction((db) => {
    const upsert = db.prepare(`
      INSERT INTO departments (id, code, name, parent_division, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        name = excluded.name,
        parent_division = excluded.parent_division,
        is_active = 1,
        updated_at = excluded.updated_at
    `);

    for (const dept of departments) {
      upsert.run(
        dept.id,
        dept.code,
        dept.name,
        dept.parentDivision || 'إدارة المشروع',
        now,
        now
      );
    }
  });
}

export function getDbDepartments(): {
  id: string;
  code: string;
  name: string;
  parentDivision: string;
}[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, code, name, parent_division FROM departments WHERE is_active = 1 ORDER BY code ASC'
    )
    .all() as { id: string; code: string; name: string; parent_division: string }[];

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    parentDivision: r.parent_division,
  }));
}
