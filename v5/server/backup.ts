/**
 * Git-based backup/restore for the data/ directory (v5).
 *
 * Why: Render's free plan wipes the filesystem on every restart, which used to
 * erase the admin account, site content and uploads. With a private GitHub repo
 * as a backup target, the site restores its own data on every boot and pushes
 * changes after they happen, so a wipe no longer matters.
 *
 * Configuration (Render environment variables, typed by the site owner):
 *   BACKUP_GITHUB_TOKEN  - GitHub personal access token (never logged)
 *   BACKUP_GITHUB_REPO   - e.g. "username/jeddah-water-backup" (private repo)
 * Optional:
 *   BACKUP_GIT_BRANCH    - defaults to "main"
 *   BACKUP_GIT_URL       - full git URL override (advanced/local testing)
 *
 * If the variables are not set, every function here is a safe no-op.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'jeddah_water.db');
const STORE_FILE = path.join(DATA_DIR, 'cms_store.json');
const GIT_DIR = path.join(DATA_DIR, '.git');
const RESTORE_TMP_DIR = path.join(DATA_DIR, '.restore-tmp');

const PUSH_DEBOUNCE_MS = 45_000;
const PERIODIC_PUSH_MS = 10 * 60_000;
const DEFAULT_TIMEOUT_MS = 90_000;
const NETWORK_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 25_000;

interface BackupConfig {
  token: string;
  remoteUrl: string;
  branch: string;
  configured: boolean;
}

function getBackupConfig(): BackupConfig {
  const token = (process.env.BACKUP_GITHUB_TOKEN || '').trim();
  const repo = (process.env.BACKUP_GITHUB_REPO || '').trim();
  const urlOverride = (process.env.BACKUP_GIT_URL || '').trim();
  const branch = (process.env.BACKUP_GIT_BRANCH || 'main').trim() || 'main';
  const remoteUrl = urlOverride || (repo ? `https://github.com/${repo}.git` : '');
  // URL override (e.g. local file:// remote) does not need a token.
  const configured = Boolean(remoteUrl) && (Boolean(urlOverride) || Boolean(token));
  return { token, remoteUrl, branch, configured };
}

let gitAvailable: boolean | null = null;

function ensureGit(): boolean {
  if (gitAvailable !== null) return gitAvailable;
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    gitAvailable = true;
  } catch {
    gitAvailable = false;
    console.warn('[backup] git is not available in this environment; GitHub backup disabled.');
  }
  return gitAvailable;
}

function sanitize(message: string, token: string): string {
  return token ? message.split(token).join('***') : message;
}

function runGit(
  args: string[],
  opts: { cwd: string; token?: string; timeoutMs?: number }
): string {
  const baseArgs = ['-c', 'user.email=backup@site.local', '-c', 'user.name=Site Backup'];
  if (opts.token) {
    // Token is passed through the environment and expanded by git's shell
    // helper, so it never appears in the command line or in logs.
    baseArgs.push(
      '-c',
      'credential.helper=!f() { echo username=x-access-token; echo "password=$BACKUP_GITHUB_TOKEN"; }; f'
    );
  }
  try {
    return execFileSync('git', [...baseArgs, ...args], {
      cwd: opts.cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: 'pipe',
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    }).toString('utf-8');
  } catch (err) {
    const e = err as Error & { stderr?: Buffer };
    const raw = `${e.message}\n${e.stderr ? e.stderr.toString('utf-8') : ''}`;
    throw new Error(sanitize(raw, opts.token || ''));
  }
}

function ensureBackupGitignore() {
  const gitignorePath = path.join(DATA_DIR, '.gitignore');
  const lines = ['.restore-tmp/', '*.tmp', '*.db-journal'];
  let existing = '';
  try {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    existing = '';
  }
  const missing = lines.filter((line) => !existing.split('\n').includes(line));
  if (missing.length > 0) {
    fs.writeFileSync(
      gitignorePath,
      (existing ? existing.replace(/\s*$/, '\n') : '') + missing.join('\n') + '\n',
      'utf-8'
    );
  }
}

/**
 * Fold the SQLite WAL into the main database file so the committed .db file is
 * as complete as possible. The -wal/-shm files are still committed too, so even
 * a failed checkpoint never loses recent data on restore.
 */
function checkpointDatabase() {
  if (!fs.existsSync(DB_PATH)) return;
  try {
    const snap = new DatabaseSync(DB_PATH);
    snap.exec('PRAGMA busy_timeout = 5000;');
    snap.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    snap.close();
  } catch (err) {
    console.warn('[backup] database checkpoint skipped:', (err as Error).message);
  }
}

/**
 * Boot-time restore. Runs before the store is initialized. Only restores when
 * the database file is missing (the wipe marker on ephemeral hosting); when a
 * real database exists (persistent disk, local dev), local data always wins.
 */
export function restoreFromBackupIfNeeded(): void {
  const cfg = getBackupConfig();
  if (!cfg.configured || !ensureGit()) return;
  if (fs.existsSync(DB_PATH)) return;

  console.log('[backup] database file missing; restoring data from remote backup...');
  fs.rmSync(RESTORE_TMP_DIR, { recursive: true, force: true });
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // A brand-new (empty) backup repo has no branches to clone. In that case
    // just initialize the local repo; the app seeds its built-in content and
    // the first push creates the backup.
    const heads = runGit(['ls-remote', '--heads', cfg.remoteUrl], {
      cwd: process.cwd(),
      token: cfg.token,
      timeoutMs: NETWORK_TIMEOUT_MS,
    });
    if (!heads.trim()) {
      if (!fs.existsSync(GIT_DIR)) {
        runGit(['init', '-b', cfg.branch], { cwd: DATA_DIR, token: cfg.token });
        runGit(['remote', 'add', 'origin', cfg.remoteUrl], { cwd: DATA_DIR, token: cfg.token });
      }
      console.log('[backup] remote backup is empty; starting fresh, the first push will fill it.');
      return;
    }

    try {
      runGit(
        ['clone', '--depth', '1', '--branch', cfg.branch, cfg.remoteUrl, RESTORE_TMP_DIR],
        { cwd: process.cwd(), token: cfg.token, timeoutMs: NETWORK_TIMEOUT_MS }
      );
    } catch (branchErr) {
      // The configured branch may not exist yet; fall back to the remote's default branch.
      console.warn('[backup] branch clone failed, trying the default branch:', (branchErr as Error).message);
      fs.rmSync(RESTORE_TMP_DIR, { recursive: true, force: true });
      runGit(['clone', '--depth', '1', cfg.remoteUrl, RESTORE_TMP_DIR], {
        cwd: process.cwd(),
        token: cfg.token,
        timeoutMs: NETWORK_TIMEOUT_MS,
      });
    }
    for (const entry of fs.readdirSync(RESTORE_TMP_DIR)) {
      const from = path.join(RESTORE_TMP_DIR, entry);
      const to = path.join(DATA_DIR, entry);
      try {
        fs.rmSync(to, { recursive: true, force: true });
      } catch {
        // best effort; rename will still replace files on Linux
      }
      fs.renameSync(from, to);
    }
    fs.rmSync(RESTORE_TMP_DIR, { recursive: true, force: true });
    console.log('[backup] restore complete.');
  } catch (err) {
    fs.rmSync(RESTORE_TMP_DIR, { recursive: true, force: true });
    console.warn(
      '[backup] restore failed; continuing with the built-in content:',
      (err as Error).message
    );
  }
}

let pushTimer: NodeJS.Timeout | null = null;
let pushInFlight = false;
let pushPending = false;

/** Debounced backup push; safe to call after every write. */
export function scheduleBackupPush(reason: string): void {
  const cfg = getBackupConfig();
  if (!cfg.configured || !ensureGit()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushBackupNow(reason);
  }, PUSH_DEBOUNCE_MS);
  if (typeof pushTimer.unref === 'function') pushTimer.unref();
}

/** Commit everything under data/ and push. Returns true when the remote is up to date. */
export function pushBackupNow(reason: string, timeoutMs = NETWORK_TIMEOUT_MS): boolean {
  const cfg = getBackupConfig();
  if (!cfg.configured || !ensureGit()) return false;
  if (pushInFlight) {
    pushPending = true;
    return false;
  }
  pushInFlight = true;
  try {
    if (!fs.existsSync(DATA_DIR)) return false;
    checkpointDatabase();
    ensureBackupGitignore();

    if (!fs.existsSync(GIT_DIR)) {
      runGit(['init', '-b', cfg.branch], { cwd: DATA_DIR, token: cfg.token });
      runGit(['remote', 'add', 'origin', cfg.remoteUrl], { cwd: DATA_DIR, token: cfg.token });
    }

    runGit(['add', '-A'], { cwd: DATA_DIR, token: cfg.token });
    const status = runGit(['status', '--porcelain'], { cwd: DATA_DIR, token: cfg.token });
    if (!status.trim()) return true;

    runGit(['commit', '-m', `backup (${reason}) ${new Date().toISOString()}`], {
      cwd: DATA_DIR,
      token: cfg.token,
    });

    try {
      runGit(['push', '-u', 'origin', cfg.branch], {
        cwd: DATA_DIR,
        token: cfg.token,
        timeoutMs,
      });
    } catch (firstErr) {
      // Remote moved ahead (should not happen with a single instance). Merge
      // with local data winning conflicts, then retry the push once.
      console.warn('[backup] push rejected; merging remote and retrying:', (firstErr as Error).message);
      runGit(['fetch', 'origin', cfg.branch], { cwd: DATA_DIR, token: cfg.token, timeoutMs });
      runGit(['merge', '--no-edit', '-X', 'ours', `origin/${cfg.branch}`], {
        cwd: DATA_DIR,
        token: cfg.token,
        timeoutMs,
      });
      runGit(['push', '-u', 'origin', cfg.branch], {
        cwd: DATA_DIR,
        token: cfg.token,
        timeoutMs,
      });
    }
    console.log(`[backup] pushed (${reason}).`);
    return true;
  } catch (err) {
    console.warn('[backup] push failed (will retry on the next cycle):', (err as Error).message);
    return false;
  } finally {
    pushInFlight = false;
    if (pushPending) {
      pushPending = false;
      scheduleBackupPush('pending-changes');
    }
  }
}

/**
 * Start the backup loop after the server is listening:
 * an early push so a brand-new repo gets its first backup, a periodic sweep
 * that also captures database-only changes (logins, sessions, users), and a
 * best-effort final push when the host shuts the service down (this is what
 * saves the latest state before a free-plan sleep).
 */
export function startBackupScheduler(): void {
  const cfg = getBackupConfig();
  if (!cfg.configured || !ensureGit()) {
    if (!cfg.configured) {
      console.log(
        '[backup] BACKUP_GITHUB_REPO / BACKUP_GITHUB_TOKEN not set; GitHub backup is disabled.'
      );
    }
    return;
  }

  const sweep = setInterval(() => {
    pushBackupNow('periodic');
  }, PERIODIC_PUSH_MS);
  if (typeof sweep.unref === 'function') sweep.unref();

  scheduleBackupPush('startup');

  const finalPush = () => {
    try {
      pushBackupNow('shutdown', SHUTDOWN_TIMEOUT_MS);
    } catch {
      // best effort during shutdown
    }
    process.exit(0);
  };
  process.on('SIGTERM', finalPush);
  process.on('SIGINT', finalPush);

  console.log('[backup] GitHub backup is active.');
}

/** For diagnostics/tests only: the resolved data directory path. */
export function getBackupDataDir(): string {
  return DATA_DIR;
}

// Referenced so an accidental removal of STORE_FILE usage is caught by the type checker.
void STORE_FILE;
