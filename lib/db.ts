import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { Reminder } from '@/components/ReminderList'
import { Person } from './types'

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
