// Reminder Trigger Engine
// Checks Firestore every 60s for due reminders, shows browser notifications,
// and opens WhatsApp link on click.

import { getDueReminders, getPeopleForUser, markReminderTriggered } from './db'

let intervalId: ReturnType<typeof setInterval> | null = null
let currentEmail: string | null = null

// Request browser notification permission
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

// Show notification for a due reminder
function showNotification(reminder: { id: string; message?: string; text?: string; whatsappLink?: string; personName?: string }) {
  const title = reminder.message || reminder.text || 'You have a reminder'

  const body = reminder.whatsappLink && reminder.personName
    ? `Click here to reach out to ${reminder.personName} on WhatsApp for ${title}`
    : reminder.whatsappLink
    ? `Click here to send a WhatsApp message for ${title}`
    : title

  const notification = new Notification('Thoughtful', {
    body,
    icon: '/favicon.ico',
    tag: `reminder-${reminder.id}`, // prevents duplicate notifications for same reminder
  })

  notification.onclick = () => {
    notification.close()
    if (reminder.whatsappLink) {
      window.open(reminder.whatsappLink, '_blank')
    } else {
      window.focus()
    }
  }
}

// Look up a phone number for a reminder from the people list
function findPhone(reminder: { id: string; personName?: string; text?: string }, people: Array<{ id: string; name: string; phone?: string; linkedReminderIds: string[] }>): string {
  if (!people.length) return ''

  // 1. Person who has this reminder in their linkedReminderIds
  const linked = people.find(p => p.phone && p.linkedReminderIds.includes(reminder.id))
  if (linked?.phone) return linked.phone.replace(/[^0-9]/g, '')

  // 2. Match by personName stored on the reminder
  if (reminder.personName) {
    const named = people.find(p => p.phone && p.name.toLowerCase() === reminder.personName!.toLowerCase())
    if (named?.phone) return named.phone.replace(/[^0-9]/g, '')
  }

  // 3. Check if reminder text mentions any person's name
  const textLower = (reminder.text || '').toLowerCase()
  const textMatch = people.find(p => p.phone && textLower.includes(p.name.toLowerCase()))
  if (textMatch?.phone) return textMatch.phone.replace(/[^0-9]/g, '')

  return ''
}

// Check for due reminders and trigger them
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

    // Fetch people once to enrich reminders that are missing a whatsappLink
    const anyMissingLink = dueReminders.some(r => !r.whatsappLink)
    const people = anyMissingLink ? await getPeopleForUser(currentEmail) : []

    for (const reminder of dueReminders) {
      // Enrich with whatsappLink if not already stored
      let whatsappLink = reminder.whatsappLink || undefined
      let personName = reminder.personName || undefined
      if (!whatsappLink) {
        const phone = findPhone(reminder, people)
        if (phone) {
          whatsappLink = `https://wa.me/${phone}?text=${encodeURIComponent('Hey!')}`
          // Also pick up personName from people list if not on reminder
          if (!personName) {
            const match = people.find(p => p.linkedReminderIds.includes(reminder.id))
            personName = match?.name
          }
        }
      }

      const enriched: { id: string; [key: string]: any } = { ...reminder, whatsappLink, personName }
      console.log('ReminderEngine: triggering reminder:', enriched.message, '| triggerAt:', enriched.triggerAt, '| whatsappLink:', enriched.whatsappLink)
      showNotification(enriched)
      await markReminderTriggered(currentEmail, reminder.id)
    }
  } catch (e) {
    console.error('ReminderEngine: check failed', e)
  }
}

// Start the engine — call after user logs in
export async function startReminderEngine(email: string) {
  // Stop any existing engine first
  stopReminderEngine()

  currentEmail = email
  console.log('ReminderEngine: starting for', email)

  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) {
    console.warn('ReminderEngine: notification permission not granted — notifications will not appear')
    // Dispatch a custom event so the UI can show a visible prompt
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('thoughtful:notifications-blocked'))
    }
  }

  // Run immediately, then every 15 seconds for precise timing
  checkDueReminders()
  intervalId = setInterval(checkDueReminders, 15_000)
}

// Stop the engine — call on sign-out or unmount
export function stopReminderEngine() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  currentEmail = null
  console.log('ReminderEngine: stopped')
}
