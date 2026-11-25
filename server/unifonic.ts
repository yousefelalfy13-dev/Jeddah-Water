import { getUnifonicConfig, normalizeSaudiPhone } from './config';

export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendUnifonicOtpSms(
  phoneE164: string,
  otpCode: string
): Promise<SmsSendResult> {
  const cfg = getUnifonicConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      error:
        'خدمة إرسال رسائل SMS عبر Unifonic غير مفعّلة بعد. يرجى إعداد UNIFONIC_APP_SID و UNIFONIC_SENDER_ID على الخادم.',
    };
  }

  const normalized = normalizeSaudiPhone(phoneE164);
  if (!normalized) {
    return {
      ok: false,
      error: 'رقم الجوال السعودي غير صالح.',
    };
  }

  // Unifonic REST v1 expects numeric recipient without leading '+' (e.g., 9665XXXXXXXX)
  const recipient = normalized.replace(/^\+/, '');
  const bodyText = `رمز التحقق للدخول إلى منصة العقد الموحد لمياه جدة: ${otpCode}\nصالح لمدة 5 دقائق ولمرة واحدة فقط. لا تشارك الرمز مع أي شخص.`;

  const params = new URLSearchParams({
    AppSid: cfg.appSid,
    SenderID: cfg.senderId,
    Recipient: recipient,
    Body: bodyText,
  });

  try {
    const response = await fetch(cfg.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    const rawText = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      console.error('[Unifonic SMS Error] HTTP status:', response.status);
      return {
        ok: false,
        error: 'تعذر إرسال رسالة التحقق عبر مزود SMS حالياً.',
      };
    }

    const successFlag =
      parsed?.success === true ||
      parsed?.success === 'true' ||
      String(parsed?.Status || '').toLowerCase() === 'queued' ||
      String(parsed?.Status || '').toLowerCase() === 'sent';

    if (!successFlag) {
      console.error(
        '[Unifonic SMS Rejected] errorCode:',
        parsed?.errorCode || 'unknown',
        'message:',
        parsed?.message || 'rejected'
      );
      return {
        ok: false,
        error: 'لم يقبل مزود SMS إرسال الرسالة. يرجى التحقق من إعدادات المرسل.',
      };
    }

    const dataObj = parsed?.data as Record<string, unknown> | undefined;
    const messageId = String(
      dataObj?.MessageID || parsed?.MessageID || 'unifonic-queued'
    );

    return {
      ok: true,
      providerMessageId: messageId,
    };
  } catch (err) {
    console.error('[Unifonic SMS Exception]:', err instanceof Error ? err.message : 'network error');
    return {
      ok: false,
      error: 'تعذر الاتصال بخادم رسائل Unifonic.',
    };
  }
}
