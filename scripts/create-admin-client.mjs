/**
 * Courtly – Create Admin Account (client SDK version)
 * Uses the Firebase client SDK so no service account key is required.
 *
 * Usage:
 *   node scripts/create-admin-client.mjs
 */

import { initializeApp }                    from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getFirestore, doc, setDoc }        from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyDOxzjvssJO-CvCKRJqmid-KNRlXoWFAyE',
  authDomain:        'courtly-660c3.firebaseapp.com',
  projectId:         'courtly-660c3',
  storageBucket:     'courtly-660c3.firebasestorage.app',
  messagingSenderId: '153101800240',
  appId:             '1:153101800240:web:3b341eddccc8a51d85aef5',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const ADMIN_EMAIL    = 'admin@courtly.com';
const ADMIN_PASSWORD = '123qwe123';
const ADMIN_USERNAME = 'Admin';

console.log(`Setting up admin account: ${ADMIN_EMAIL}`);

let uid;

// Try to create the user; if it already exists, sign in instead
try {
  const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  uid = cred.user.uid;
  console.log(`✓ Auth user created (uid: ${uid})`);
} catch (err) {
  if (err.code === 'auth/email-already-in-use') {
    console.log('  User already exists — signing in to get UID…');
    const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = cred.user.uid;
    console.log(`✓ Signed in as existing user (uid: ${uid})`);
  } else {
    console.error('Failed to create user:', err.message);
    process.exit(1);
  }
}

// Write Firestore user doc with isAdmin flag
await setDoc(doc(db, 'users', uid), {
  id:        uid,
  email:     ADMIN_EMAIL,
  username:  ADMIN_USERNAME,
  isAdmin:   true,
  createdAt: Date.now(),
}, { merge: true });

console.log('✓ Firestore users document written (isAdmin: true)');

// Write minimal user_team_state (no team required for admin)
await setDoc(doc(db, 'user_team_state', uid), {
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

console.log('✓ Firestore user_team_state document written');
console.log('');
console.log('Admin account ready:');
console.log(`  Email:    ${ADMIN_EMAIL}`);
console.log(`  Password: ${ADMIN_PASSWORD}`);
console.log(`  UID:      ${uid}`);
console.log('');
console.log('Log in at the app → Admin Panel will appear in the sidebar.');

process.exit(0);
