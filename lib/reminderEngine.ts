// Reminder Trigger Engine
// Polls localStorage for due reminders, shows browser notifications.

import { getDueReminders, getPeopleForUser, markReminderTriggered } from './db'

let intervalId: ReturnType<typeof setInterval> | null = null
let currentEmail: string | null = null
let visibilityHandler: (() => void) | null = null
let focusHandler: (() => void) | null = null

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('ReminderEngine: Notifications not supported')
    return false
  }

  if (Notification.permission === 'granted') return true

  if (Notification.permission === 'denied') {
    console.warn('ReminderEngine: Notifications denied by user')
    return false
  }

  const result = await Notification.requestPermission()
  return result === 'granted'
}

async function showNotification(reminder: {
  id: string
  message?: string
  text?: string
  whatsappLink?: string
  personName?: string
}) {
  const title = reminder.message || reminder.text || 'You have a reminder'

  const body =
    reminder.whatsappLink && reminder.personName
      ? `Click here to reach out to ${reminder.personName} on WhatsApp for ${title}`
      : reminder.whatsappLink
        ? `Click here to send a WhatsApp message for ${title}`
        : title

  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    tag: `reminder-${reminder.id}`,
    data: { whatsappLink: reminder.whatsappLink || null },
  }

  const isDev = process.env.NODE_ENV === 'development'

  // Dev: SW is unregistered — use Notification constructor directly
  if (isDev && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Thoughtful', options)
    notification.onclick = () => {
      notification.close()
      if (reminder.whatsappLink) {
        window.open(reminder.whatsappLink, '_blank')
      } else {
        window.focus()
      }
    }
    return
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification('Thoughtful', options)
      return
    } catch (e) {
      console.warn('ReminderEngine: SW notification failed, falling back', e)
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Thoughtful', options)
    notification.onclick = () => {
      notification.close()
      if (reminder.whatsappLink) {
        window.open(reminder.whatsappLink, '_blank')
      } else {
        window.focus()
      }
    }
  }
}

function findPhone(
  reminder: { id: string; personName?: string; text?: string },
  people: Array<{ id: string; name: string; phone?: string; linkedReminderIds: string[] }>
): string {
  if (!people.length) return ''

  const linked = people.find(p => p.phone && p.linkedReminderIds.includes(reminder.id))
  if (linked?.phone) return linked.phone.replace(/[^0-9]/g, '')

  if (reminder.personName) {
    const named = people.find(
      p => p.phone && p.name.toLowerCase() === reminder.personName!.toLowerCase()
    )
    if (named?.phone) return named.phone.replace(/[^0-9]/g, '')
  }

  const textLower = (reminder.text || '').toLowerCase()
  const textMatch = people.find(p => p.phone && textLower.includes(p.name.toLowerCase()))
  if (textMatch?.phone) return textMatch.phone.replace(/[^0-9]/g, '')

  return ''
}

async function checkDueReminders() {
  if (!currentEmail) return

  console.log('ReminderEngine: checking reminders', Date.now(), new Date().toLocaleTimeString())

  try {
    const dueReminders = await getDueReminders(currentEmail)

    if (dueReminders.length === 0) {
      console.log('ReminderEngine: no due reminders')
      return
    }

    console.log(`ReminderEngine: ${dueReminders.length} due reminder(s) found`)

    const anyMissingLink = dueReminders.some(r => !r.whatsappLink)
    const people = anyMissingLink ? await getPeopleForUser(currentEmail) : []

    for (const reminder of dueReminders) {
      let whatsappLink = reminder.whatsappLink || undefined
      let personName = reminder.personName || undefined
      if (!whatsappLink) {
        const phone = findPhone(reminder, people)
        if (phone) {
          whatsappLink = `https://wa.me/${phone}?text=${encodeURIComponent('Hey!')}`
          if (!personName) {
            const match = people.find(p => p.linkedReminderIds.includes(reminder.id))
            personName = match?.name
          }
        }
      }

      const enriched: { id: string; [key: string]: any } = { ...reminder, whatsappLink, personName }
      console.log(
        'ReminderEngine: triggering reminder:',
        enriched.message,
        '| triggerAt:',
        enriched.triggerAt
      )
      await showNotification(enriched)
      await markReminderTriggered(currentEmail, reminder.id)
    }
  } catch (e) {
    console.error('ReminderEngine: check failed', e)
  }
}

/** Run an immediate due-reminder check (e.g. on tab focus). */
export function checkDueRemindersNow(): void {
  void checkDueReminders()
}

export async function startReminderEngine(email: string) {
  stopReminderEngine()

  currentEmail = email
  console.log('ReminderEngine: starting for', email)

  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) {
    console.warn('ReminderEngine: notification permission not granted')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('thoughtful:notifications-blocked'))
    }
  }

  checkDueReminders()
  intervalId = setInterval(checkDueReminders, 15_000)

  if (typeof window !== 'undefined') {
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        checkDueReminders()
      }
    }
    focusHandler = () => checkDueReminders()
    document.addEventListener('visibilitychange', visibilityHandler)
    window.addEventListener('focus', focusHandler)
  }
}

export function stopReminderEngine() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (typeof window !== 'undefined') {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
    if (focusHandler) {
      window.removeEventListener('focus', focusHandler)
      focusHandler = null
    }
  }
  currentEmail = null
  console.log('ReminderEngine: stopped')
}
