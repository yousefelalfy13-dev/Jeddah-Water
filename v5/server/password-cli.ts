import 'dotenv/config';
import readline from 'readline/promises';
import { Writable } from 'stream';
import { stdin as input, stdout as output } from 'process';
import { writeAuditLog } from './audit';
import { getDb, withTransaction } from './db';
import { hashPasswordArgon2id, validatePasswordStrength } from './passwords';
import { getUserAuthRecordByUsername } from './users';

let nonTtyLinesPromise: Promise<string[]> | null = null;
let nonTtyCursor = 0;

function readAllNonTtyLines(): Promise<string[]> {
  if (!nonTtyLinesPromise) {
    nonTtyLinesPromise = new Promise((resolve, reject) => {
      let data = '';
      input.setEncoding('utf8');
      input.on('data', (chunk) => {
        data += chunk;
      });
      input.on('end', () => {
        resolve(data.split(/\r?\n/));
      });
      input.on('error', reject);
    });
  }
  return nonTtyLinesPromise;
}

async function promptLine(label: string, hidden: boolean): Promise<string> {
  if (!input.isTTY) {
    output.write(label);
    const lines = await readAllNonTtyLines();
    if (nonTtyCursor >= lines.length) {
      throw new Error('نهاية الإدخال القياسي قبل استكمال الحقول المطلوبة.');
    }
    return lines[nonTtyCursor++] ?? '';
  }

  let muted = false;
  const mutableOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        output.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input,
    output: mutableOutput,
    terminal: true,
  });

  try {
    output.write(label);
    if (hidden) muted = true;
    const value = await rl.question('');
    muted = false;
    if (hidden) output.write('\n');
    return value;
  } finally {
    muted = false;
    rl.close();
  }
}

async function main() {
  getDb();

  const argUsername = (process.argv[2] || '').trim().toLowerCase();
  let username = argUsername;

  if (!username) {
    username = (await promptLine('اسم المستخدم (افتراضي: yousef.elalfy): ', false))
      .trim()
      .toLowerCase();
    if (!username) {
      username = 'yousef.elalfy';
    }
  }

  const record = getUserAuthRecordByUsername(username);
  if (!record) {
    console.error('❌ تعذر العثور على الحساب المحدد في قاعدة البيانات.');
    process.exit(1);
  }

  console.log(
    `=== تعيين كلمة المرور الآمنة (Argon2id) للحساب: ${record.user.fullName} (@${record.user.username}) ===`
  );
  console.log('المتطلبات: 10 أحرف على الأقل وتحتوي على حروف وأرقام ولا تطابق اسم المستخدم.');

  const password = await promptLine('أدخل كلمة المرور الجديدة (مخفية): ', true);
  const confirmPassword = await promptLine('أعد إدخال كلمة المرور للتأكيد: ', true);

  if (password !== confirmPassword) {
    console.error('❌ كلمتا المرور غير متطابقتين.');
    process.exit(1);
  }

  const check = validatePasswordStrength(password, record.user.username);
  if (!check.ok) {
    console.error('❌', check.error);
    process.exit(1);
  }

  const passwordHash = await hashPasswordArgon2id(password);
  const nowIso = new Date().toISOString();

  withTransaction((tx) => {
    tx.prepare(
      'UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
    ).run(passwordHash, nowIso, nowIso, record.user.id);

    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'password_set_cli' WHERE user_id = ? AND revoked_at IS NULL"
    ).run(nowIso, record.user.id);

    tx.prepare('DELETE FROM login_rate_limits WHERE limit_key = ?').run(
      `user:${record.user.username.toLowerCase()}`
    );
  });

  writeAuditLog({
    actorUserId: record.user.id,
    actorName: record.user.fullName,
    actorRole: record.user.role,
    actionType: 'تعيين كلمة المرور من الخادم',
    targetUserId: record.user.id,
    targetLabel: `${record.user.fullName} (@${record.user.username})`,
    departmentId: record.user.primaryDepartmentId,
    ipAddress: 'server-cli',
    detail: 'تم تعيين كلمة المرور بتشفير Argon2id (Salt مستقل) وإبطال أي جلسات سابقة.',
  });

  console.log('✅ تم تعيين كلمة المرور بنجاح وحفظ البصمة المشفرة Argon2id دون تخزين أي نص صريح.');
}

main().catch(() => {
  console.error('❌ حدث خطأ غير متوقع أثناء تعيين كلمة المرور.');
  process.exit(1);
});
