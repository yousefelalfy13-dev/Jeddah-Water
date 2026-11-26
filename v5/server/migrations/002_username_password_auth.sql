-- Migration 002: Username & Password Authentication (Argon2id), Login Rate Limiting, and Administrative Password Recovery
-- Strictly additive migration preserving all existing user accounts, roles, permissions, and audit history.

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_updated_at TEXT;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS login_rate_limits (
  limit_key TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT,
  last_failed_at TEXT,
  locked_until TEXT,
  lockout_tier INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_recovery_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  issued_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  invalidated_at TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_user
  ON password_recovery_tokens(user_id, created_at DESC);
