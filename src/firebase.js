import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDOxzjvssJO-CvCKRJqmid-KNRlXoWFAyE",
  authDomain: "courtly-660c3.firebaseapp.com",
  projectId: "courtly-660c3",
  storageBucket: "courtly-660c3.firebasestorage.app",
  messagingSenderId: "153101800240",
  appId: "1:153101800240:web:3b341eddccc8a51d85aef5",
  measurementId: "G-W11EGH8C62"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
