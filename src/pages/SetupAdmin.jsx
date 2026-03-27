import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const ADMIN_EMAIL    = 'admin@courtly.com';
const ADMIN_PASSWORD = '123qwe123';

export default function SetupAdmin() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [log, setLog]       = useState([]);
  const [uid, setUid]       = useState(null);

  function addLog(msg) {
    setLog(prev => [...prev, msg]);
  }

  async function handleCreate() {
    setStatus('running');
    setLog([]);

    try {
      // Step 1: Create or sign in
      let userUid;
      try {
        addLog('Creating Firebase Auth user…');
        const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        userUid = cred.user.uid;
        addLog(`✓ Auth user created (uid: ${userUid})`);
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          addLog('  User already exists — signing in to get UID…');
          const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
          userUid = cred.user.uid;
          addLog(`✓ Signed in as existing user (uid: ${userUid})`);
        } else {
          throw err;
        }
      }

      // Step 2: Write users doc
      addLog('Writing Firestore users document…');
      await setDoc(doc(db, 'users', userUid), {
        id:        userUid,
        email:     ADMIN_EMAIL,
        username:  'Admin',
        isAdmin:   true,
        createdAt: Date.now(),
      }, { merge: true });
      addLog('✓ users document written (isAdmin: true)');

      // Step 3: Write minimal user_team_state
      addLog('Writing Firestore user_team_state document…');
      await setDoc(doc(db, 'user_team_state', userUid), {
        userId:         userUid,
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
      addLog('✓ user_team_state document written');

      setUid(userUid);
      setStatus('done');
    } catch (err) {
      addLog(`✗ Error: ${err.message}`);
      setStatus('error');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
    }}>
      <div style={{
        background: '#1a1d27',
        border: '1px solid #2a2d3a',
        borderRadius: 12,
        padding: '40px 48px',
        maxWidth: 520,
        width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <svg viewBox="0 0 64 64" width="36" height="36">
            <circle cx="32" cy="32" r="30" fill="#E8621A"/>
            <path d="M32 2 Q50 18 32 32 Q14 46 32 62" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
            <path d="M2 32 Q18 14 32 32 Q46 50 62 32" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
          </svg>
          <div>
            <h1 style={{ color: '#fff', margin: 0, fontSize: 20, fontWeight: 700 }}>Admin Setup</h1>
            <p style={{ color: '#888', margin: 0, fontSize: 13 }}>One-time admin account creation</p>
          </div>
        </div>

        <div style={{
          background: '#0f1117',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
          fontSize: 13,
          color: '#ccc',
          lineHeight: 1.8,
        }}>
          <div><span style={{ color: '#888' }}>Email:</span>    <strong style={{ color: '#E8621A' }}>{ADMIN_EMAIL}</strong></div>
          <div><span style={{ color: '#888' }}>Password:</span> <strong style={{ color: '#E8621A' }}>{ADMIN_PASSWORD}</strong></div>
        </div>

        {status === 'idle' && (
          <button
            onClick={handleCreate}
            style={{
              width: '100%',
              padding: '12px 0',
              background: '#E8621A',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Create Admin Account
          </button>
        )}

        {log.length > 0 && (
          <div style={{
            background: '#0f1117',
            borderRadius: 8,
            padding: '14px 18px',
            marginTop: 20,
            fontSize: 13,
            color: '#ccc',
            lineHeight: 2,
          }}>
            {log.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('✓') ? '#4ade80' : line.startsWith('✗') ? '#f87171' : '#ccc' }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {status === 'running' && (
          <div style={{ color: '#888', fontSize: 13, marginTop: 16, textAlign: 'center' }}>Working…</div>
        )}

        {status === 'done' && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 8,
              padding: '14px 18px',
              color: '#4ade80',
              fontSize: 14,
              marginBottom: 16,
            }}>
              Admin account is ready! Go to the login page and sign in.
            </div>
            <a
              href="/Courtly/login"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '12px 0',
                background: '#E8621A',
                color: '#fff',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Go to Login →
            </a>
          </div>
        )}

        {status === 'error' && (
          <button
            onClick={handleCreate}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '12px 0',
              background: '#374151',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
