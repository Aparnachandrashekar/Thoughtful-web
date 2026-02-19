import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { Reminder } from '@/components/ReminderList'
import { Person } from './types'

// --- One-time migration from localStorage to Firestore ---

const MIGRATION_KEY = 'thoughtful-firestore-migrated'

export async function migrateLocalStorageToFirestore(email: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Check if already migrated for this email
  const migrated = localStorage.getItem(`${MIGRATION_KEY}-${email}`)
  if (migrated) return false

  let didMigrate = false

  // Collect existing Firestore IDs so we don't overwrite
  const existingReminderIds = new Set<string>()
  const existingPeopleIds = new Set<string>()
  try {
    const remSnap = await getDocs(query(remindersCol(email)))
    remSnap.docs.forEach(d => existingReminderIds.add(d.id))
    const pplSnap = await getDocs(query(peopleCol(email)))
    pplSnap.docs.forEach(d => existingPeopleIds.add(d.id))
  } catch (e) {
    console.error('Migration: could not read Firestore, skipping:', e)
    return false
  }

  // Migrate reminders (merge — only add items not already in Firestore)
  const remindersKey = `thoughtful-reminders-${email}`
  const savedReminders = localStorage.getItem(remindersKey)
  if (savedReminders) {
    try {
      const parsed = JSON.parse(savedReminders)
      if (Array.isArray(parsed)) {
        let count = 0
        for (const r of parsed) {
          if (existingReminderIds.has(r.id)) continue
          const ref = doc(remindersCol(email), r.id)
          await setDoc(ref, {
            text: r.text,
            date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString(),
            isCompleted: r.isCompleted ?? false,
            calendarEventId: r.calendarEventId ?? null,
            isRecurring: r.isRecurring ?? false,
            isBirthday: r.isBirthday ?? false,
            isAnniversary: r.isAnniversary ?? false,
          })
          count++
        }
        if (count > 0) {
          didMigrate = true
          console.log(`Migrated ${count} reminders to Firestore`)
        }
      }
    } catch (e) {
      console.error('Failed to migrate reminders:', e)
    }
  }

  // Migrate people (merge)
  const peopleKey = `thoughtful-people-${email}`
  const savedPeople = localStorage.getItem(peopleKey)
  if (savedPeople) {
    try {
      const parsed = JSON.parse(savedPeople)
      if (Array.isArray(parsed)) {
        let count = 0
        for (const p of parsed) {
          if (existingPeopleIds.has(p.id)) continue
          const ref = doc(peopleCol(email), p.id)
          await setDoc(ref, {
            name: p.name,
            linkedReminderIds: p.linkedReminderIds ?? [],
            createdAt: p.createdAt,
            avatarColor: p.avatarColor,
            relationshipType: p.relationshipType ?? 'close_friend',
            birthday: p.birthday ?? null,
            email: p.email ?? null,
          })
          count++
        }
        if (count > 0) {
          didMigrate = true
          console.log(`Migrated ${count} people to Firestore`)
        }
      }
    } catch (e) {
      console.error('Failed to migrate people:', e)
    }
  }

  // Mark as migrated
  localStorage.setItem(`${MIGRATION_KEY}-${email}`, 'true')
  return didMigrate
}

// --- Reminders ---

function remindersCol(email: string) {
  return collection(db, 'users', email, 'reminders')
}

export function subscribeReminders(
  email: string,
  callback: (reminders: Reminder[]) => void
): Unsubscribe {
  const q = query(remindersCol(email))
  return onSnapshot(q, (snapshot) => {
    const reminders: Reminder[] = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        text: data.text,
        date: new Date(data.date),
        isCompleted: data.isCompleted ?? false,
        calendarEventId: data.calendarEventId,
        isRecurring: data.isRecurring,
        isBirthday: data.isBirthday,
        isAnniversary: data.isAnniversary,
      }
    })
    callback(reminders)
  }, (error) => {
    console.error('Firestore reminders subscription error:', error)
  })
}

export async function addReminder(email: string, reminder: Reminder) {
  const ref = doc(remindersCol(email), reminder.id)
  await setDoc(ref, {
    text: reminder.text,
    date: reminder.date instanceof Date ? reminder.date.toISOString() : reminder.date,
    isCompleted: reminder.isCompleted,
    calendarEventId: reminder.calendarEventId ?? null,
    isRecurring: reminder.isRecurring ?? false,
    isBirthday: reminder.isBirthday ?? false,
    isAnniversary: reminder.isAnniversary ?? false,
  })
}

export async function updateReminder(
  email: string,
  id: string,
  updates: Partial<Record<string, unknown>>
) {
  const ref = doc(remindersCol(email), id)
  // Convert Date to ISO string if present
  const cleaned = { ...updates }
  if (cleaned.date instanceof Date) {
    cleaned.date = cleaned.date.toISOString()
  }
  await updateDoc(ref, cleaned)
}

export async function deleteReminder(email: string, id: string) {
  const ref = doc(remindersCol(email), id)
  await deleteDoc(ref)
}

// --- People ---

function peopleCol(email: string) {
  return collection(db, 'users', email, 'people')
}

export function subscribePeople(
  email: string,
  callback: (people: Person[]) => void
): Unsubscribe {
  const q = query(peopleCol(email))
  return onSnapshot(q, (snapshot) => {
    const people: Person[] = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name,
        linkedReminderIds: data.linkedReminderIds ?? [],
        createdAt: data.createdAt,
        avatarColor: data.avatarColor,
        relationshipType: data.relationshipType ?? 'close_friend',
        birthday: data.birthday,
        email: data.email,
      }
    })
    callback(people)
  }, (error) => {
    console.error('Firestore people subscription error:', error)
  })
}

export async function addPerson(email: string, person: Person) {
  const ref = doc(peopleCol(email), person.id)
  await setDoc(ref, {
    name: person.name,
    linkedReminderIds: person.linkedReminderIds,
    createdAt: person.createdAt,
    avatarColor: person.avatarColor,
    relationshipType: person.relationshipType,
    birthday: person.birthday ?? null,
    email: person.email ?? null,
  })
}

export async function updatePersonDoc(
  email: string,
  id: string,
  updates: Partial<Record<string, unknown>>
) {
  const ref = doc(peopleCol(email), id)
  await updateDoc(ref, updates)
}

export async function deletePersonDoc(email: string, id: string) {
  const ref = doc(peopleCol(email), id)
  await deleteDoc(ref)
}

export async function getPersonByIdDB(
  email: string,
  id: string
): Promise<Person | null> {
  const ref = doc(peopleCol(email), id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: snap.id,
    name: data.name,
    linkedReminderIds: data.linkedReminderIds ?? [],
    createdAt: data.createdAt,
    avatarColor: data.avatarColor,
    relationshipType: data.relationshipType ?? 'close_friend',
    birthday: data.birthday,
    email: data.email,
  }
}
