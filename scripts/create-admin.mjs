/**
 * Courtly – Create Admin Account
 *
 * Creates a Firebase Auth user for the admin and sets isAdmin=true
 * in the Firestore users collection.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/create-admin.mjs
 *
 * Or place serviceAccountKey.json in scripts/ and run:
 *   node scripts/create-admin.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore }        from 'firebase-admin/firestore';
import { getAuth }             from 'firebase-admin/auth';

// ── Firebase init ──────────────────────────────────────────────

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else {
  const fs = await import('fs');
  serviceAccount = JSON.parse(fs.readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
}

initializeApp({ credential: cert(serviceAccount) });
const db   = getFirestore();
const auth = getAuth();

// ── Admin credentials ──────────────────────────────────────────

const ADMIN_EMAIL    = 'admin@courtly.com';
const ADMIN_PASSWORD = '123qwe123';
const ADMIN_USERNAME = 'Admin';

// ── Main ──────────────────────────────────────────────────────

console.log(`Creating admin account: ${ADMIN_EMAIL}`);

let uid;

// Create or fetch the Firebase Auth user
try {
  const existing = await auth.getUserByEmail(ADMIN_EMAIL);
  uid = existing.uid;
  console.log(`Auth user already exists (uid: ${uid}), updating password…`);
  await auth.updateUser(uid, { password: ADMIN_PASSWORD });
} catch (err) {
  if (err.code === 'auth/user-not-found') {
    const newUser = await auth.createUser({
      email:         ADMIN_EMAIL,
      password:      ADMIN_PASSWORD,
      displayName:   ADMIN_USERNAME,
      emailVerified: true,
    });
    uid = newUser.uid;
    console.log(`Auth user created (uid: ${uid})`);
  } else {
    throw err;
  }
}

// Write Firestore user doc with isAdmin flag
await db.collection('users').doc(uid).set({
  id:        uid,
  email:     ADMIN_EMAIL,
  username:  ADMIN_USERNAME,
  isAdmin:   true,
  createdAt: Date.now(),
}, { merge: true });

// Write minimal user_team_state (no team)
await db.collection('user_team_state').doc(uid).set({
  userId:         uid,
  teamId:         null,
  budget:         0,
  facilities:     {},
  tactics:        {},
  playersState:   [],
  fanCount:       0,
  fanEnthusiasm:  0,
  ticketPrice:    0,
  teamExposure:   0,
  chemistryGauge: 0,
  momentumBar:    0,
  reputation:     0,
  matchHistory:   [],
  seasonRecord:   { wins: 0, losses: 0 },
  profileData:    {},
  updatedAt:      Date.now(),
}, { merge: true });

console.log('');
console.log('✓ Admin account ready:');
console.log(`  Email:    ${ADMIN_EMAIL}`);
console.log(`  Password: ${ADMIN_PASSWORD}`);
console.log(`  UID:      ${uid}`);
console.log('  isAdmin:  true');
console.log('');
console.log('Log in at the app and navigate to /admin to access the admin panel.');
