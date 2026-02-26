// Reminder Trigger Engine
// Checks Firestore every 60s for due reminders, shows browser notifications,
// and opens WhatsApp link on click.

import { getDueReminders, markReminderTriggered } from './db'

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

// Check for due reminders and trigger them
async function checkDueReminders() {
  if (!currentEmail) return

  console.log('ReminderEngine: checking reminders', Date.now(), new Date().toLocaleTimeString())

  try {
    const dueReminders = await getDueReminders(currentEmail)

    if (dueReminders.length > 0) {
      console.log(`ReminderEngine: ${dueReminders.length} due reminder(s) found`)
    } else {
      console.log('ReminderEngine: no due reminders')
    }

    for (const reminder of dueReminders) {
      console.log('ReminderEngine: triggering reminder:', reminder.message, '| triggerAt:', reminder.triggerAt, '| whatsappLink:', reminder.whatsappLink)
      showNotification(reminder)
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
    console.warn('ReminderEngine: running without notification permission')
  }

  // Run immediately, then every 60 seconds
  checkDueReminders()
  intervalId = setInterval(checkDueReminders, 60_000)
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
