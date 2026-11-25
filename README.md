# العقد الموحد لتشغيل وصيانة قطاع المياه بمدينة جدة

منصة مؤسسية تعريفية وتوثيقية لمشروع العقد الموحد: العرض التقديمي (Showcase)، صفحة المشروع الكاملة، صفحة مدير العقد، لوحة المؤشرات التنفيذية، ومعرض الوسائط — مع لوحة تحكم متكاملة (صلاحيات RBAC، جلسات وأجهزة معتمدة، سجل تدقيق، قاعدة بيانات SQLite، كلمات مرور Argon2id).

Corporate portal for the Jeddah water sector unified O&M contract: showcase landing, full project site, contract manager page, executive dashboard, media gallery, and a full Arabic RTL admin panel (RBAC, trusted-device sessions, audit log, SQLite storage, Argon2id passwords).

## المتطلبات / Requirements

- Node.js **22.5 or newer** (uses the built-in `node:sqlite`). No external database needed.

## التشغيل محلياً / Run locally

```bash
npm install
npm run dev
```

## الإنتاج / Production

```bash
npm install
npm run build
npm start          # NODE_ENV=production tsx server.ts
```

## متغيرات البيئة / Environment variables (see `.env.example`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Yes (production) | 32+ random chars; signs sessions. Server refuses to boot in production without it. |
| `BOOTSTRAP_ADMIN_TOKEN` | Yes (production) | 16+ random chars; authorizes the one-time first Super Admin setup at `/admin/bootstrap`. You invent it yourself. |
| `PORT` | No | Injected automatically by Render/Railway. |

OTP/SMS (Unifonic) is disabled platform-wide: login is username + password. The Unifonic variables in `.env.example` are legacy.

## أول دخول / First run (one time)

1. Open `https://<your-site>/admin/bootstrap`.
2. Enter your `BOOTSTRAP_ADMIN_TOKEN`, your name, username, Saudi mobile, department, and pick your password (10+ chars, letters + numbers).
3. The route then closes permanently. Log in at `/admin`.

## البيانات والنسخ الاحتياطي / Data and backups

All runtime data lives under `data/`: `jeddah_water.db` (users, sessions, audit) and `cms_store.json` (published/draft content). The host must provide a **persistent disk** or all edits vanish on redeploy. Never commit `data/*.db*` or `data/backups/` to a public repository (already in `.gitignore`).

## النشر / Deployment

- **Render**: Web Service. Build: `npm install && npm run build`. Start: `npm start`. Free tier works for testing (sleeps after 15 min idle, ephemeral disk). For production: Starter ($7/mo) + 1 GB persistent disk mounted at `/opt/render/project/src/data` ($0.25/mo) so data survives.
- **Any VPS**: Node 22.5+, `npm install && npm run build`, run with pm2/systemd behind Caddy or Nginx for HTTPS. HTTPS is required for admin login (cookies are `Secure`).
