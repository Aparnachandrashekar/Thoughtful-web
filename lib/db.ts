// Background Firestore sync — mirrors localStorage to Firestore without
// replacing any existing app logic.  localStorage remains the source of truth.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  query,
  where,
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
function reminderToDoc(r: any, userId?: string) {
  const dateMs = r.date instanceof Date ? r.date.getTime()
    : typeof r.date === 'string' ? new Date(r.date).getTime()
    : 0

  return {
    text: r.text || '',
    date: r.date instanceof Date ? r.date.toISOString() : (typeof r.date === 'string' ? r.date : ''),
    isCompleted: r.isCompleted === true,
    calendarEventId: r.calendarEventId || null,
    calendarHtmlLink: r.calendarHtmlLink || null,
    lastSyncedAt: typeof r.lastSyncedAt === 'number' ? r.lastSyncedAt : null,
    originalStartTime: r.originalStartTime || null,
    isRecurring: r.isRecurring === true,
    isBirthday: r.isBirthday === true,
    isAnniversary: r.isAnniversary === true,
    // WhatsApp / trigger fields
    message: r.message || r.text || '',
    personName: r.personName || null,
    phoneNumber: r.phoneNumber || null,
    whatsappLink: r.phoneNumber
      ? `https://wa.me/${(r.phoneNumber || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hey!')}`
      : null,
    triggerAt: typeof r.triggerAt === 'number' ? r.triggerAt : dateMs,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    userId: userId || null,
    triggered: r.triggered === true ? true : false,
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
    setDoc(ref, reminderToDoc(reminder, email))
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

// --- Reminder trigger engine helpers ---

export function getRemindersCollection(email: string) {
  return remindersCol(email)
}

function getDueRemindersFromLocalStorage(email: string): Array<{ id: string; [key: string]: any }> {
  if (typeof window === 'undefined') return []
  try {
    const key = `thoughtful-reminders-${email}`
    const saved = localStorage.getItem(key)
    if (!saved) return []
    const reminders: any[] = JSON.parse(saved)
    const now = Date.now()
    return reminders.filter(r =>
      !r.triggered && !r.isCompleted && r.triggerAt && r.triggerAt <= now
    )
  } catch {
    return []
  }
}

export async function getDueReminders(email: string): Promise<Array<{ id: string; [key: string]: any }>> {
  try {
    const col = remindersCol(email)
    const q = query(
      col,
      where('triggered', '==', false),
      where('triggerAt', '<=', Date.now())
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('Firestore: failed to query due reminders, falling back to localStorage:', e)
    return getDueRemindersFromLocalStorage(email)
  }
}

export async function getPeopleForUser(email: string): Promise<Array<{ id: string; name: string; phone?: string; linkedReminderIds: string[] }>> {
  try {
    const snap = await getDocs(query(peopleCol(email)))
    return snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name || '',
        phone: data.phone || undefined,
        linkedReminderIds: Array.isArray(data.linkedReminderIds) ? data.linkedReminderIds : [],
      }
    })
  } catch (e) {
    console.error('Firestore: failed to fetch people:', e)
    return []
  }
}

export async function markReminderTriggered(email: string, reminderId: string): Promise<void> {
  // Update localStorage immediately so the engine doesn't re-fire on next poll
  if (typeof window !== 'undefined') {
    try {
      const key = `thoughtful-reminders-${email}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const reminders = JSON.parse(saved)
        const updated = reminders.map((r: any) =>
          r.id === reminderId ? { ...r, triggered: true } : r
        )
        localStorage.setItem(key, JSON.stringify(updated))
      }
    } catch {}
  }
  // Also update Firestore
  try {
    const ref = doc(remindersCol(email), reminderId)
    await updateDoc(ref, { triggered: true })
    console.log('Firestore: marked reminder triggered', reminderId)
  } catch (e) {
    console.error('Firestore: failed to mark triggered', reminderId, e)
  }
}

// --- Pull from Firestore: download data to localStorage on new devices ---
// Called on sign-in. If localStorage is empty, pulls everything from Firestore.
// If localStorage has data, merges (Firestore wins for items not in local).

export async function pullFromFirestore(email: string): Promise<{ reminders: number; people: number }> {
  if (typeof window === 'undefined') return { reminders: 0, people: 0 }

  console.log('Firestore: pulling data for', email)
  let reminderCount = 0
  let peopleCount = 0

  try {
    // Pull reminders
    const remindersKey = `thoughtful-reminders-${email}`
    const localReminders = localStorage.getItem(remindersKey)
    const localReminderList: any[] = localReminders ? JSON.parse(localReminders) : []
    const localReminderIds = new Set(localReminderList.map((r: any) => r.id))

    const reminderSnap = await getDocs(query(remindersCol(email)))
    const newReminders: any[] = []

    reminderSnap.docs.forEach(d => {
      if (!localReminderIds.has(d.id)) {
        const data = d.data()
        newReminders.push({
          id: d.id,
          text: data.text || '',
          date: data.date || '',
          isCompleted: data.isCompleted === true,
          calendarEventId: data.calendarEventId || undefined,
          calendarHtmlLink: data.calendarHtmlLink || undefined,
          lastSyncedAt: data.lastSyncedAt || undefined,
          originalStartTime: data.originalStartTime || undefined,
          isRecurring: data.isRecurring === true,
          isBirthday: data.isBirthday === true,
          isAnniversary: data.isAnniversary === true,
          message: data.message || undefined,
          personName: data.personName || undefined,
          phoneNumber: data.phoneNumber || undefined,
          whatsappLink: data.whatsappLink || undefined,
          triggerAt: data.triggerAt || undefined,
          createdAt: data.createdAt || undefined,
          triggered: data.triggered === true,
        })
      }
    })

    if (newReminders.length > 0) {
      const merged = [...newReminders, ...localReminderList]
      localStorage.setItem(remindersKey, JSON.stringify(merged))
      reminderCount = newReminders.length
      console.log(`Firestore: pulled ${reminderCount} reminders`)
    }

    // Pull people
    const peopleKey = `thoughtful-people-${email}`
    const localPeople = localStorage.getItem(peopleKey)
    const localPeopleList: any[] = localPeople ? JSON.parse(localPeople) : []
    const localPeopleIds = new Set(localPeopleList.map((p: any) => p.id))

    const peopleSnap = await getDocs(query(peopleCol(email)))
    const newPeople: any[] = []

    peopleSnap.docs.forEach(d => {
      if (!localPeopleIds.has(d.id)) {
        const data = d.data()
        newPeople.push({
          id: d.id,
          name: data.name || '',
          linkedReminderIds: Array.isArray(data.linkedReminderIds) ? data.linkedReminderIds : [],
          createdAt: data.createdAt || new Date().toISOString(),
          avatarColor: data.avatarColor || 'lavender',
          relationshipType: data.relationshipType || 'close_friend',
          birthday: data.birthday || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
        })
      }
    })

    if (newPeople.length > 0) {
      const merged = [...newPeople, ...localPeopleList]
      localStorage.setItem(peopleKey, JSON.stringify(merged))
      peopleCount = newPeople.length
      console.log(`Firestore: pulled ${peopleCount} people`)
    }

    console.log('Firestore: pull complete -', reminderCount, 'reminders,', peopleCount, 'people')
  } catch (e) {
    console.error('Firestore: pull failed:', e)
  }

  return { reminders: reminderCount, people: peopleCount }
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
            await setDoc(ref, reminderToDoc(r, email))
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
