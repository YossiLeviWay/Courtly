/**
 * Courtly — Import existing users from Firestore into Firebase Authentication.
 *
 * Why this is needed:
 *   The data migration copied user records into the Firestore `users` collection,
 *   but Firebase Authentication is a completely separate service. Without this
 *   step, existing users cannot log in because Firebase Auth has no record of them.
 *
 * What it does:
 *   1. Reads every document from the Firestore `users` collection.
 *   2. Imports each one into Firebase Auth, preserving the original bcrypt
 *      password hash so users can log in with their existing passwords.
 *   3. Uses the Neon UUID as the Firebase UID so all existing Firestore
 *      documents (user_team_state, etc.) continue to work without changes.
 *
 * Run via GitHub Actions (recommended):
 *   Actions tab → "Import Users to Firebase Auth" → Run workflow
 *   Requires secret: FIREBASE_SERVICE_ACCOUNT_KEY
 *
 * Run locally:
 *   node scripts/import-users-to-firebase-auth.mjs
 *   (requires scripts/serviceAccountKey.json)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try { return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY); }
    catch { console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.'); process.exit(1); }
  }
  const filePath = path.join(__dirname, 'serviceAccountKey.json');
  if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, 'utf8'));
  console.error('ERROR: No Firebase credentials found.\nSet FIREBASE_SERVICE_ACCOUNT_KEY or add scripts/serviceAccountKey.json');
  process.exit(1);
}

async function main() {
  const admin = (await import('firebase-admin')).default;
  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
    projectId: 'courtly-660c3',
  });

  const db    = admin.firestore();
  const auths = admin.auth();

  // Read all users from Firestore (populated by the migration script)
  const snap = await db.collection('users').get();
  if (snap.empty) {
    console.log('No users found in Firestore. Nothing to import.');
    process.exit(0);
  }

  const firestoreUsers = snap.docs.map(d => d.data());
  console.log(`Found ${firestoreUsers.length} user(s) in Firestore.`);

  // Build the import list. Each user record needs:
  //   uid          — reuse the existing Neon UUID so all Firestore docs still match
  //   email        — for login
  //   displayName  — username shown in app
  //   passwordHash — the original bcrypt hash as a Buffer
  //
  // Users without a password_hash (e.g. already-Firebase users) are skipped.
  const toImport = [];
  const skipped  = [];

  for (const u of firestoreUsers) {
    const hash = u.password_hash || u.passwordHash;
    if (!hash) {
      skipped.push(u.email || u.id);
      continue;
    }
    toImport.push({
      uid:          String(u.id),
      email:        u.email || '',
      displayName:  u.username || '',
      passwordHash: Buffer.from(hash),  // bcrypt hash includes the salt
    });
  }

  if (skipped.length) {
    console.log(`Skipped ${skipped.length} user(s) with no password hash (already Firebase users):`);
    skipped.forEach(e => console.log(`  - ${e}`));
  }

  if (!toImport.length) {
    console.log('No users to import.');
    process.exit(0);
  }

  console.log(`Importing ${toImport.length} user(s) into Firebase Auth...`);

  // Firebase allows max 1000 users per importUsers call
  const CHUNK = 1000;
  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < toImport.length; i += CHUNK) {
    const chunk = toImport.slice(i, i + CHUNK);
    const result = await auths.importUsers(chunk, {
      hash: { algorithm: 'BCRYPT' },
    });

    successCount += chunk.length - result.errors.length;
    failCount    += result.errors.length;

    if (result.errors.length) {
      result.errors.forEach(e => {
        const user = chunk[e.index];
        // Code 17 = user already exists — not a real error
        if (e.error?.code === 'auth/uid-already-exists' ||
            e.error?.code === 'auth/email-already-exists') {
          console.log(`  Already exists (skipping): ${user.email}`);
          successCount++;
          failCount--;
        } else {
          console.error(`  Failed (${user.email}): ${e.error?.message}`);
        }
      });
    }
  }

  console.log('');
  console.log('Import complete!');
  console.log(`  Imported / already existed: ${successCount}`);
  console.log(`  Failed:                     ${failCount}`);
  if (failCount > 0) {
    console.log('  Failed users will need to use "Forgot Password" to reset their credentials.');
  }

  process.exit(0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
