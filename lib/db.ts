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

// --- Background sync: write-through to Firestore on every localStorage save ---

export function syncReminderToFirestore(email: string, reminder: Reminder) {
  const ref = doc(remindersCol(email), reminder.id)
  setDoc(ref, {
    text: reminder.text,
    date: reminder.date instanceof Date ? reminder.date.toISOString() : reminder.date,
    isCompleted: reminder.isCompleted ?? false,
    calendarEventId: reminder.calendarEventId ?? null,
    isRecurring: reminder.isRecurring ?? false,
    isBirthday: reminder.isBirthday ?? false,
    isAnniversary: reminder.isAnniversary ?? false,
  }).catch(e => console.warn('Firestore sync (reminder) failed:', e))
}

export function deleteReminderFromFirestore(email: string, id: string) {
  const ref = doc(remindersCol(email), id)
  deleteDoc(ref).catch(e => console.warn('Firestore delete (reminder) failed:', e))
}

export function syncPersonToFirestore(email: string, person: Person) {
  const ref = doc(peopleCol(email), person.id)
  setDoc(ref, {
    name: person.name,
    linkedReminderIds: person.linkedReminderIds ?? [],
    createdAt: person.createdAt,
    avatarColor: person.avatarColor,
    relationshipType: person.relationshipType ?? 'close_friend',
    birthday: person.birthday ?? null,
    email: person.email ?? null,
  }).catch(e => console.warn('Firestore sync (person) failed:', e))
}

export function deletePersonFromFirestore(email: string, id: string) {
  const ref = doc(peopleCol(email), id)
  deleteDoc(ref).catch(e => console.warn('Firestore delete (person) failed:', e))
}

// --- Full sync: push all localStorage data to Firestore ---
// Called once on sign-in to ensure Firestore has everything.

export async function fullSyncToFirestore(email: string): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // Sync reminders
    const remindersKey = `thoughtful-reminders-${email}`
    const savedReminders = localStorage.getItem(remindersKey)
    if (savedReminders) {
      const parsed = JSON.parse(savedReminders)
      if (Array.isArray(parsed)) {
        // Get existing Firestore IDs to avoid unnecessary writes
        const existingIds = new Set<string>()
        try {
          const snap = await getDocs(query(remindersCol(email)))
          snap.docs.forEach(d => existingIds.add(d.id))
        } catch { /* ignore read errors */ }

        for (const r of parsed) {
          if (existingIds.has(r.id)) continue
          const ref = doc(remindersCol(email), r.id)
          await setDoc(ref, {
            text: r.text,
            date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString(),
            isCompleted: r.isCompleted ?? false,
            calendarEventId: r.calendarEventId ?? null,
            isRecurring: r.isRecurring ?? false,
            isBirthday: r.isBirthday ?? false,
            isAnniversary: r.isAnniversary ?? false,
          }).catch(() => {})
        }
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
        } catch { /* ignore read errors */ }

        for (const p of parsed) {
          if (existingIds.has(p.id)) continue
          const ref = doc(peopleCol(email), p.id)
          await setDoc(ref, {
            name: p.name,
            linkedReminderIds: p.linkedReminderIds ?? [],
            createdAt: p.createdAt,
            avatarColor: p.avatarColor,
            relationshipType: p.relationshipType ?? 'close_friend',
            birthday: p.birthday ?? null,
            email: p.email ?? null,
          }).catch(() => {})
        }
      }
    }
  } catch (e) {
    console.warn('Full Firestore sync failed:', e)
  }
}
