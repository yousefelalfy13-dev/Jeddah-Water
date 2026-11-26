import 'dotenv/config';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { getDb, getDbDepartments, syncDepartmentsToDb } from './db';
import { getPublicPublishedContent } from './store';
import { createFirstSuperAdminAtomic, needsBootstrapSuperAdmin } from './users';

async function main() {
  const published = getPublicPublishedContent();
  getDb();
  syncDepartmentsToDb(published.departments);

  if (!needsBootstrapSuperAdmin()) {
    console.error('❌ تم إنشاء حساب Super Admin مسبقاً. إجراء التهيئة معطل نهائياً.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  try {
    console.log('=== تهيئة أول حساب Super Admin لمشروع العقد الموحد لمياه جدة ===');
    const fullName = await rl.question('الاسم الكامل: ');
    const username = await rl.question('اسم المستخدم (إنجليزي بدون مسافات): ');
    const phone = await rl.question('رقم الجوال السعودي (مثال 05XXXXXXXX أو +9665XXXXXXXX): ');
    const jobTitle =
      (await rl.question('المسمى الوظيفي (افتراضي: مدير النظام الرئيسي): ')).trim() ||
      'مدير النظام الرئيسي';

    const depts = getDbDepartments();
    console.log('\nالإدارات المتاحة للإدارة الأساسية:');
    depts.forEach((d) => console.log(` - ${d.id}: ${d.name}`));
    const deptChoice = (
      await rl.question(`معرّف الإدارة الأساسية (افتراضي: ${depts[0]?.id || 'dept-pm'}): `)
    ).trim();

    const result = createFirstSuperAdminAtomic({
      fullName,
      username,
      phone,
      jobTitle,
      primaryDepartmentId: deptChoice || depts[0]?.id || 'dept-pm',
      ipAddress: 'server-cli',
    });

    if (!result.ok || !result.user) {
      console.error('❌ فشل إنشاء الحساب:', result.error);
      process.exit(1);
    }

    console.log(
      `✅ تم إنشاء أول حساب Super Admin بنجاح: ${result.user.fullName} (@${result.user.username}) — ${result.user.maskedPhone}`
    );
    console.log('🔒 تم قفل التهيئة الأولية نهائياً.');
  } finally {
    rl.close();
  }
}

main();
