import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Firebase Client Initialization (Authentication Only)
 *
 * OsmoLab uses Firebase strictly for cryptographic user authentication.
 * All application state (Catalog, My Shelf, Formulas, Accords, Evaluations,
 * Experiments, Scent Memories) is persisted through the authenticated
 * Express API backed by PostgreSQL.
 */
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');
