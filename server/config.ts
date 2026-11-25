import crypto from 'crypto';

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getSessionSecret(): string | null {
  const secret = (process.env.SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

export type AuthSmsMode = 'unifonic' | 'mock';

export function getUnifonicConfig() {
  const appSid = (process.env.UNIFONIC_APP_SID || '').trim();
  const senderId = (process.env.UNIFONIC_SENDER_ID || '').trim();
  const baseUrl = (
    process.env.UNIFONIC_BASE_URL || 'https://el.cloud.unifonic.com/rest/SMS/messages'
  ).trim();

  return {
    configured: appSid.length > 0 && senderId.length > 0,
    appSid,
    senderId,
    baseUrl,
  };
}

export function getAuthSmsConfig(): {
  mode: AuthSmsMode;
  explicitRaw: string;
  unifonicConfigured: boolean;
} {
  const explicitRaw = (process.env.AUTH_SMS_MODE || '').trim().toLowerCase();
  const unifonic = getUnifonicConfig();

  if (isProductionEnv()) {
    return {
      mode: 'unifonic',
      explicitRaw,
      unifonicConfigured: unifonic.configured,
    };
  }

  if (explicitRaw === 'mock') {
    return {
      mode: 'mock',
      explicitRaw,
      unifonicConfigured: unifonic.configured,
    };
  }

  if (explicitRaw === 'unifonic') {
    return {
      mode: 'unifonic',
      explicitRaw,
      unifonicConfigured: unifonic.configured,
    };
  }

  // In non-production, if Unifonic credentials are not set yet, operate in mock terminal OTP test mode
  return {
    mode: unifonic.configured ? 'unifonic' : 'mock',
    explicitRaw,
    unifonicConfigured: unifonic.configured,
  };
}

// One-time ephemeral console token used ONLY in non-production when BOOTSTRAP_ADMIN_TOKEN is unset
const EPHEMERAL_DEV_BOOTSTRAP_TOKEN = crypto.randomBytes(18).toString('hex');
let bootstrapBannerPrinted = false;

export function getBootstrapTokenConfig(): {
  expectedToken: string;
  isEnvConfigured: boolean;
} {
  const envToken = (process.env.BOOTSTRAP_ADMIN_TOKEN || '').trim();
  if (envToken.length >= 16) {
    return { expectedToken: envToken, isEnvConfigured: true };
  }
  return { expectedToken: EPHEMERAL_DEV_BOOTSTRAP_TOKEN, isEnvConfigured: false };
}

export function logBootstrapInstructionsIfNeeded(needsBootstrap: boolean) {
  if (!needsBootstrap || bootstrapBannerPrinted) return;
  bootstrapBannerPrinted = true;
  const cfg = getBootstrapTokenConfig();
  if (cfg.isEnvConfigured) {
    console.log(
      '[BOOTSTRAP] النظام مهيأ لإنشاء أول حساب Super Admin باستخدام BOOTSTRAP_ADMIN_TOKEN عبر /admin/bootstrap أو npm run bootstrap:admin'
    );
  } else if (!isProductionEnv()) {
    console.log('==================================================================');
    console.log('[BOOTSTRAP DEV] لم يتم العثور على أي حساب Super Admin في قاعدة البيانات.');
    console.log(
      `[BOOTSTRAP DEV] رمز التهيئة الأولية لمرة واحدة (صالح لهذه الجلسة فقط): ${cfg.expectedToken}`
    );
    console.log('[BOOTSTRAP DEV] افتح /admin/bootstrap لإعداد أول حساب Super Admin.');
    console.log('==================================================================');
  }
}

export function validateStartupConfiguration() {
  const sessionSecret = (process.env.SESSION_SECRET || '').trim();

  if (isProductionEnv()) {
    if (sessionSecret.length < 32) {
      throw new Error(
        '[FATAL] تعذر تشغيل الخادم في وضع الإنتاج لغياب أو ضعف SESSION_SECRET (يجب أن لا يقل عن 32 حرفاً).'
      );
    }
    console.log(
      '[AUTH MODE] نظام المصادقة المعتمد في الإنتاج: Username + Password (Argon2id) — تسجيل الدخول عبر OTP/Unifonic متوقف.'
    );
  } else {
    if (sessionSecret.length > 0 && sessionSecret.length < 32) {
      console.warn(
        '[SECURITY WARNING] SESSION_SECRET أقل من 32 حرفاً. يرجى تعزيزه قبل الانتقال للإنتاج.'
      );
    } else if (!sessionSecret) {
      console.warn(
        '[SECURITY INFO] SESSION_SECRET غير مضبوط في البيئة التطويرية؛ في الإنتاج يُرفض التشغيل بدونه.'
      );
    }

    console.log(
      '[AUTH MODE] نظام المصادقة النشط في التطوير: Username + Password (Argon2id) — تسجيل الدخول عبر OTP و Unifonic متوقف.'
    );
  }
}

/**
 * Normalizes Saudi mobile phone numbers into strict E.164 format: +9665XXXXXXXX
 * Accepts: 05XXXXXXXX, 5XXXXXXXX, 9665XXXXXXXX, +9665XXXXXXXX, 009665XXXXXXXX
 */
export function normalizeSaudiPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  // Convert Arabic-Indic digits if user typed Arabic numerals
  const westernDigits = raw
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\d+]/g, '');

  let digits = westernDigits;
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    digits = '966' + digits;
  }

  if (!/^9665[0-9]{8}$/.test(digits)) {
    return null;
  }
  return `+${digits}`;
}

export function maskSaudiPhone(phoneE164: string): string {
  const clean = normalizeSaudiPhone(phoneE164) || phoneE164;
  if (clean.length >= 13) {
    // +9665••••1234
    return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
  }
  return '••••';
}
