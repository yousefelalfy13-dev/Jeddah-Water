import argon2 from 'argon2';

const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB (OWASP recommended minimum for Argon2id)
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

// Precomputed dummy Argon2id hash used strictly to equalize timing when a username does not exist.
const DUMMY_TIMING_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHlzYWx0eXNhbHQxMg$4i0V2h6S3y6eG2B8P8mX7Y8z1X3K9Q4L2nW6R0T1U2s';

export function validatePasswordStrength(
  password: string,
  username?: string
): { ok: boolean; error?: string } {
  if (typeof password !== 'string') {
    return { ok: false, error: 'كلمة المرور غير صالحة.' };
  }
  if (password.length < 10) {
    return {
      ok: false,
      error: 'يجب أن تتكون كلمة المرور من 10 أحرف على الأقل.',
    };
  }
  if (password.length > 128) {
    return {
      ok: false,
      error: 'يجب ألا تتجاوز كلمة المرور 128 حرفاً.',
    };
  }
  if (/[\r\n\0]/.test(password)) {
    return {
      ok: false,
      error: 'تحتوي كلمة المرور على محارف غير مسموح بها.',
    };
  }

  const hasLetter = /[A-Za-z\u0600-\u06FF]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) {
    return {
      ok: false,
      error: 'يجب أن تحتوي كلمة المرور على حروف وأرقام على الأقل (ويُفضّل إضافة رموز خاصة).',
    };
  }

  if (username) {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim().toLowerCase();
    if (cleanUser && (cleanPass === cleanUser || cleanPass.includes(cleanUser))) {
      return {
        ok: false,
        error: 'يُمنع أن تطابق كلمة المرور اسم المستخدم أو تحتوي عليه.',
      };
    }
  }

  return { ok: true };
}

export async function hashPasswordArgon2id(password: string): Promise<string> {
  // argon2 automatically generates a cryptographically secure random 16-byte salt per hash
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPasswordArgon2id(
  storedHash: string | null | undefined,
  candidatePassword: string
): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('$argon2')) {
    try {
      await argon2.verify(DUMMY_TIMING_HASH, candidatePassword || '');
    } catch {
      // Ignore dummy verification errors
    }
    return false;
  }

  try {
    return await argon2.verify(storedHash, candidatePassword);
  } catch {
    return false;
  }
}
