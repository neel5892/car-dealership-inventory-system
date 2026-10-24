
import 'dotenv/config';
import db from './database';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error(
    'Usage: npx tsx src/makeAdmin.ts your-email@example.com'
  );
  process.exit(1);
}

const result = db.prepare(
  "UPDATE users SET role = 'admin' WHERE email = ?"
).run(email);

if (result.changes === 0) {
  console.error(`No account found for ${email}. Register first.`);
  process.exit(1);
}

console.log(`${email} is now an admin.`);
