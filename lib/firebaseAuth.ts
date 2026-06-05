import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

let readyPromise: Promise<void> | null = null

/** Ensure Firebase anonymous auth with LOCAL persistence (survives refresh/tab switch). */
export function ensureFirebaseAuth(): Promise<void> {
  if (readyPromise) return readyPromise

  readyPromise = new Promise((resolve) => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsub()
            resolve()
            return
          }
          signInAnonymously(auth)
            .then(() => {
              unsub()
              resolve()
            })
            .catch((err) => {
              console.warn('Anonymous Firebase auth failed:', err?.code)
              unsub()
              resolve()
            })
        })
      })
      .catch((err) => {
        console.warn('Firebase persistence setup failed:', err?.code)
        resolve()
      })
  })

  return readyPromise
}
