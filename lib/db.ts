// Background Firestore sync — mirrors localStorage to Firestore without
// replacing any existing app logic.  localStorage remains the source of truth.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
} from 'firebase/firestore'
import { db } from './firebase'
import { Reminder } from '@/components/ReminderList'
import { Person } from './types'

// --- Helpers ---

function remindersCol(email: string) {
  return collection(db, 'users', email, 'reminders')
}

function peopleCol(email: string) {
  return collection(db, 'users', email, 'people')
}

// Convert a reminder to a Firestore-safe object (no undefined values)
function reminderToDoc(r: any) {
  return {
    text: r.text || '',
    date: r.date instanceof Date ? r.date.toISOString() : (typeof r.date === 'string' ? r.date : ''),
    isCompleted: r.isCompleted === true,
    calendarEventId: r.calendarEventId || null,
    isRecurring: r.isRecurring === true,
    isBirthday: r.isBirthday === true,
    isAnniversary: r.isAnniversary === true,
  }
}

// Convert a person to a Firestore-safe object (no undefined values)
function personToDoc(p: any) {
  return {
    name: p.name || '',
    linkedReminderIds: Array.isArray(p.linkedReminderIds) ? p.linkedReminderIds : [],
    createdAt: p.createdAt || new Date().toISOString(),
    avatarColor: p.avatarColor || 'lavender',
    relationshipType: p.relationshipType || 'close_friend',
    birthday: p.birthday || null,
    email: p.email || null,
    phone: p.phone || null,
  }
}

// --- Background sync: write-through to Firestore on every localStorage save ---

export function syncReminderToFirestore(email: string, reminder: Reminder) {
  try {
    const ref = doc(remindersCol(email), reminder.id)
    setDoc(ref, reminderToDoc(reminder))
      .then(() => console.log('Firestore: synced reminder', reminder.id))
      .catch(e => console.error('Firestore sync (reminder) FAILED:', e))
  } catch (e) {
    console.error('Firestore sync (reminder) error:', e)
  }
}

export function deleteReminderFromFirestore(email: string, id: string) {
  try {
    const ref = doc(remindersCol(email), id)
    deleteDoc(ref).catch(e => console.error('Firestore delete (reminder) FAILED:', e))
  } catch (e) {
    console.error('Firestore delete (reminder) error:', e)
  }
}

export function syncPersonToFirestore(email: string, person: Person) {
  try {
    const ref = doc(peopleCol(email), person.id)
    setDoc(ref, personToDoc(person))
      .then(() => console.log('Firestore: synced person', person.id, person.name))
      .catch(e => console.error('Firestore sync (person) FAILED:', e))
  } catch (e) {
    console.error('Firestore sync (person) error:', e)
  }
}

export function deletePersonFromFirestore(email: string, id: string) {
  try {
    const ref = doc(peopleCol(email), id)
    deleteDoc(ref).catch(e => console.error('Firestore delete (person) FAILED:', e))
  } catch (e) {
    console.error('Firestore delete (person) error:', e)
  }
}

// --- Full sync: push all localStorage data to Firestore ---
// Called once on sign-in to ensure Firestore has everything.

export async function fullSyncToFirestore(email: string): Promise<void> {
  if (typeof window === 'undefined') return

  console.log('Firestore: starting full sync for', email)

  try {
    // Sync reminders
    const remindersKey = `thoughtful-reminders-${email}`
    const savedReminders = localStorage.getItem(remindersKey)
    if (savedReminders) {
      const parsed = JSON.parse(savedReminders)
      if (Array.isArray(parsed)) {
        const existingIds = new Set<string>()
        try {
          const snap = await getDocs(query(remindersCol(email)))
          snap.docs.forEach(d => existingIds.add(d.id))
        } catch (e) {
          console.error('Firestore: failed to read existing reminders:', e)
        }

        let count = 0
        for (const r of parsed) {
          if (existingIds.has(r.id)) continue
          try {
            const ref = doc(remindersCol(email), r.id)
            await setDoc(ref, reminderToDoc(r))
            count++
          } catch (e) {
            console.error('Firestore: failed to sync reminder', r.id, e)
          }
        }
        if (count > 0) console.log(`Firestore: synced ${count} reminders`)
      }
    }

    // Sync people
    const peopleKey = `thoughtful-people-${email}`
    const savedPeople = localStorage.getItem(peopleKey)
    if (savedPeople) {
      const parsed = JSON.parse(savedPeople)
      if (Array.isArray(parsed)) {
        const existingIds = new Set<string>()
        try {
          const snap = await getDocs(query(peopleCol(email)))
          snap.docs.forEach(d => existingIds.add(d.id))
        } catch (e) {
          console.error('Firestore: failed to read existing people:', e)
        }

        let count = 0
        for (const p of parsed) {
          if (existingIds.has(p.id)) continue
          try {
            const ref = doc(peopleCol(email), p.id)
            await setDoc(ref, personToDoc(p))
            count++
          } catch (e) {
            console.error('Firestore: failed to sync person', p.id, e)
          }
        }
        if (count > 0) console.log(`Firestore: synced ${count} people`)
      }
    } else {
      console.log('Firestore: no people found in localStorage at key:', peopleKey)
    }

    console.log('Firestore: full sync complete')
  } catch (e) {
    console.error('Firestore: full sync failed:', e)
  }
}
