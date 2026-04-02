'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Script from 'next/script'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import ReminderInput from '@/components/ReminderInput'
import ReminderList, { Reminder } from '@/components/ReminderList'
import DatePickerModal from '@/components/DatePickerModal'
import EditReminderModal from '@/components/EditReminderModal'
import RecurrenceEndDateModal from '@/components/RecurrenceEndDateModal'
import RelationshipsSidebar from '@/components/RelationshipsSidebar'
import PersonConfirmationModal from '@/components/PersonConfirmationModal'
import { parseReminder, RecurrenceInfo } from '@/lib/parser'
import {
  initGoogleAuth,
  signIn,
  signOut,
  isSignedIn,
  getUserEmail,
  getRemindersKey,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  getOrCreateThoughtfulCalendar,
  trySilentRefresh,
  RecurrenceOptions,
  getStoredEmail
} from '@/lib/google'
import { generateTitle } from '@/lib/ai'
import { Person, DetectedName } from '@/lib/types'
import { loadPeople, createPerson, findPersonByName, linkReminderToPerson } from '@/lib/people'
import { getPrimaryDetectedName } from '@/lib/personDetection'
import { syncReminderToFirestore, deleteReminderFromFirestore, syncPersonToFirestore, fullSyncToFirestore, pullFromFirestore } from '@/lib/db'
import { startReminderEngine, stopReminderEngine } from '@/lib/reminderEngine'

// Helper to generate human-readable pattern description
function getPatternDescription(recurrence: RecurrenceInfo): string {
  const dayNames: Record<string, string> = {
    'SU': 'Sunday', 'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday',
    'TH': 'Thursday', 'FR': 'Friday', 'SA': 'Saturday'
  }
  const positionNames: Record<number, string> = {
    1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last'
  }

  if (recurrence.bySetPos && recurrence.byDay) {
    const pos = positionNames[recurrence.bySetPos] || ''
    const day = dayNames[recurrence.byDay] || recurrence.byDay
    return `${pos} ${day} of every month`
  }
  if (recurrence.byMonthDay) {
    return `day ${recurrence.byMonthDay} of every month`
  }
  if (recurrence.interval && recurrence.interval > 1 && recurrence.byDay) {
    const day = dayNames[recurrence.byDay] || recurrence.byDay
    return `every ${recurrence.interval} weeks on ${day}`
  }
  if (recurrence.byDay) {
    const day = dayNames[recurrence.byDay] || recurrence.byDay
    return `every ${day}`
  }
  return recurrence.type || 'recurring'
}

export default function Home() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [mounted, setMounted] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)
  // True while a silent token refresh is in flight — hides the "Reconnect Calendar" button during the attempt
  const [refreshingCalendar, setRefreshingCalendar] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [gcalUpdates, setGcalUpdates] = useState<Array<{ id: string; text: string; change: string }>>([])

  // For date picker fallback
  const [pendingText, setPendingText] = useState<string | null>(null)

  // For recurrence end date prompt
  const [pendingRecurrence, setPendingRecurrence] = useState<{
    text: string
    date: Date
    recurrence: RecurrenceInfo
  } | null>(null)

  // People/Relationships state
  const [people, setPeople] = useState<Person[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingNameConfirmation, setPendingNameConfirmation] = useState<{
    detectedName: DetectedName
    reminderId?: string
    originalText?: string
  } | null>(null)

  // Load reminders for current user
  const loadReminders = useCallback(() => {
    try {
      const key = getRemindersKey()
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setReminders(parsed.map((r: Reminder) => ({ ...r, date: new Date(r.date) })))
          return
        }
      }
    } catch {}
    setReminders([])
  }, [])

  // Track whether reminders have been loaded (prevents saving [] on mount)
  const remindersLoaded = useRef(false)

  // Rate-limit GCal change polling: at most once every 30 seconds (reset on tab hide)
  const lastGcalCheck = useRef<number>(0)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [notificationsBlocked, setNotificationsBlocked] = useState(false)

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const PULL_THRESHOLD = 72

  // Save reminders for current user
  const saveReminders = useCallback((newReminders: Reminder[]) => {
    const key = getRemindersKey()
    localStorage.setItem(key, JSON.stringify(newReminders))
  }, [])

  useEffect(() => {
    setMounted(true)

    // Restore session from localStorage immediately
    const storedEmail = getStoredEmail()
    if (storedEmail) {
      setSignedIn(true)
      setUserEmail(storedEmail)
    }

    // Init GIS auth (restores cached token from localStorage)
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    initGoogleAuth(clientId)
    const tokenValid = isSignedIn()
    setCalendarConnected(tokenValid)
    if (tokenValid && !storedEmail) {
      setSignedIn(true)
      setUserEmail(getUserEmail())
    }

    // Backfill lastSignInTime for users who were already signed in before this key existed.
    // Without this, the 90-day "don't show Reconnect Calendar" window never applies
    // to existing sessions and the button always appears after a token refresh failure.
    if (storedEmail && !localStorage.getItem('thoughtful-last-signin')) {
      localStorage.setItem('thoughtful-last-signin', Date.now().toString())
    }

    // If GIS script is already loaded (e.g. after back navigation), set googleReady immediately
    if ((window as any).google?.accounts?.oauth2) {
      setGoogleReady(true)
      // Proactively refresh expired token on app open so calendar sync just works
      if (!tokenValid && storedEmail) {
        setRefreshingCalendar(true)
        trySilentRefresh().then(ok => {
          if (ok) setCalendarConnected(true)
          setRefreshingCalendar(false)
        })
      }
    }

    // Sign in to Firebase anonymously so Firestore security rules (request.auth != null) pass.
    // Must run before the Firestore sync effect — setFirebaseReady(true) gates that effect.
    signInAnonymously(auth)
      .then(() => setFirebaseReady(true))
      .catch((err) => {
        console.warn('Anonymous Firebase auth failed (Firestore sync may not work):', err?.code)
        setFirebaseReady(true) // Still unblock sync — Firestore calls will fail gracefully
      })

  }, [])

  // Load reminders when user changes or on mount
  useEffect(() => {
    if (mounted) {
      loadReminders()
      remindersLoaded.current = true
    }
  }, [mounted, userEmail, loadReminders])

  // Load people when user changes
  useEffect(() => {
    if (mounted) {
      setPeople(loadPeople(userEmail || undefined))
    }
  }, [mounted, userEmail])

  // Refresh people list
  const refreshPeople = useCallback(() => {
    setPeople(loadPeople(userEmail || undefined))
  }, [userEmail])

  // Check Google Calendar for changes to synced reminders (called on tab becoming visible)
  const checkForCalendarChanges = useCallback(async () => {
    if (!userEmail) return
    if (!isSignedIn()) {
      // Token expired mid-session — trigger silent re-auth (the useEffect will call tryRefreshToken)
      setCalendarConnected(false)
      return
    }

    // Debounce: skip if already ran in last 30 seconds
    const now = Date.now()
    if (now - lastGcalCheck.current < 30 * 1000) return
    lastGcalCheck.current = now

    const key = getRemindersKey()
    const saved = localStorage.getItem(key)
    if (!saved) return
    let allReminders: Reminder[]
    try {
      allReminders = JSON.parse(saved).map((r: any) => ({ ...r, date: new Date(r.date) }))
    } catch {
      return
    }

    const upcoming = allReminders.filter(r =>
      r.calendarEventId && !r.isCompleted && r.date >= new Date()
    )

    if (upcoming.length === 0) return

    const updatedMap = new Map(allReminders.map(r => [r.id, { ...r }]))
    const newUpdates: Array<{ id: string; text: string; change: string }> = []
    let hasChanges = false

    for (const reminder of upcoming) {
      try {
        const event = await getCalendarEvent(reminder.calendarEventId!)
        const calStart = new Date(event.start?.dateTime || event.start?.date)
        const timeDiff = Math.abs(calStart.getTime() - reminder.date.getTime())
        const timeChanged = timeDiff > 60000
        const titleChanged = !!(event.summary && event.summary !== reminder.text)
        const linkMissing = !reminder.calendarHtmlLink && !!event.htmlLink

        if (timeChanged || titleChanged || linkMissing) {
          const current = updatedMap.get(reminder.id)!
          updatedMap.set(reminder.id, {
            ...current,
            date: timeChanged ? calStart : current.date,
            text: titleChanged ? event.summary : current.text,
            calendarHtmlLink: event.htmlLink || current.calendarHtmlLink,
            lastSyncedAt: now,
            originalStartTime: event.start?.dateTime,
          })
          hasChanges = true
        }

        if (timeChanged || titleChanged) {
          const changeDesc = timeChanged && titleChanged
            ? `Renamed to "${event.summary}" and rescheduled to ${calStart.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : timeChanged
            ? `Rescheduled to ${calStart.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : `Renamed to "${event.summary}"`
          newUpdates.push({ id: reminder.id, text: reminder.text, change: changeDesc })
        }
      } catch (e) {
        console.error('GCal sync: failed to fetch event', reminder.calendarEventId, e)
      }
    }

    if (hasChanges) {
      const updated = allReminders.map(r => updatedMap.get(r.id) || r)
      localStorage.setItem(key, JSON.stringify(updated))
      setReminders(updated.map(r => ({ ...r, date: new Date(r.date) })))
      updated.forEach(r => {
        if ((r as any).lastSyncedAt === now) syncReminderToFirestore(userEmail, r)
      })
    }

    if (newUpdates.length > 0) {
      setGcalUpdates(prev => {
        const existingIds = new Set(prev.map(u => u.id))
        return [...prev, ...newUpdates.filter(u => !existingIds.has(u.id))]
      })
    }
  }, [userEmail])

  // Periodically check token validity; silently refresh before showing Reconnect button
  useEffect(() => {
    if (!signedIn) return
    const interval = setInterval(() => {
      const valid = isSignedIn()
      if (!valid && googleReady) {
        setRefreshingCalendar(true)
        trySilentRefresh().then(ok => {
          setCalendarConnected(ok)
          setRefreshingCalendar(false)
        })
      } else {
        setCalendarConnected(valid)
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [signedIn, googleReady])

  // Listen for notification permission being blocked (e.g. incognito)
  useEffect(() => {
    const handler = () => setNotificationsBlocked(true)
    window.addEventListener('thoughtful:notifications-blocked', handler)
    return () => window.removeEventListener('thoughtful:notifications-blocked', handler)
  }, [])

  // Listen for window focus and tab visibility to check for Google Calendar changes
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastGcalCheck.current = 0  // reset so returning always triggers a fresh check
      } else if (document.visibilityState === 'visible') {
        // Proactively refresh expired token when user returns to the tab
        if (!isSignedIn() && getStoredEmail() && (window as any).google?.accounts?.oauth2) {
          setRefreshingCalendar(true)
          trySilentRefresh().then(ok => {
            if (ok) setCalendarConnected(true)
            setRefreshingCalendar(false)
          })
        }
        checkForCalendarChanges()
      }
    }
    window.addEventListener('focus', checkForCalendarChanges)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', checkForCalendarChanges)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkForCalendarChanges])

  // Handle person confirmation - create profile with default 'close_friend' type
  // User can edit relationship type later from profile page
  const handleConfirmPerson = useCallback(() => {
    console.log('handleConfirmPerson called, pendingNameConfirmation:', pendingNameConfirmation)
    if (pendingNameConfirmation) {
      console.log('Creating person:', pendingNameConfirmation.detectedName.name, 'email:', userEmail)
      const newPerson = createPerson(
        pendingNameConfirmation.detectedName.name,
        'close_friend',  // Default relationship type - can be edited later
        userEmail || undefined
      )
      console.log('Person created:', newPerson)
      if (userEmail) syncPersonToFirestore(userEmail, newPerson)
      if (pendingNameConfirmation.reminderId) {
        linkReminderToPerson(newPerson.id, pendingNameConfirmation.reminderId, userEmail || undefined)
        console.log('Linked reminder to person')
      }
      refreshPeople()
      setPendingNameConfirmation(null)
      console.log('Profile creation complete')
    }
  }, [pendingNameConfirmation, userEmail, refreshPeople])

  const handleDenyPerson = useCallback(() => {
    setPendingNameConfirmation(null)
  }, [])

  // Persist reminders to localStorage when they change (only after initial load)
  useEffect(() => {
    if (mounted && remindersLoaded.current) {
      saveReminders(reminders)
    }
  }, [reminders, mounted, saveReminders])

  // Sync with Firestore: pull first (for new devices), then push, then reload UI.
  // Gated on firebaseReady so anonymous auth is established before any Firestore call.
  const engineStarted = useRef(false)
  useEffect(() => {
    if (userEmail && firebaseReady) {
      // Pull from Firestore first (restores data on this device if localStorage was cleared),
      // then push any local-only data, then reload UI state
      pullFromFirestore(userEmail)
        .then(({ reminders, people }) => {
          if (reminders > 0 || people > 0) {
            // Reload UI from localStorage which now has Firestore data
            loadReminders()
            setPeople(loadPeople(userEmail || undefined))
          }
          // Then push any local-only items to Firestore
          return fullSyncToFirestore(userEmail)
        })
        .catch(() => {})

      if (!engineStarted.current) {
        engineStarted.current = true
        startReminderEngine(userEmail)
      }
    }
    return () => {
      stopReminderEngine()
      engineStarted.current = false
    }
  }, [userEmail, firebaseReady, loadReminders])

  const handleGoogleSignIn = () => {
    setSigningIn(true)
    // Safety: clear loading state after 60s in case the popup is closed without completing
    const signingInTimeout = setTimeout(() => setSigningIn(false), 60_000)
    signIn((email) => {
      clearTimeout(signingInTimeout)
      setSigningIn(false)
      setSignedIn(true)
      setCalendarConnected(true)
      setUserEmail(email)
      // Record explicit sign-in time — used to avoid showing "Reconnect Calendar" for 90 days
      localStorage.setItem('thoughtful-last-signin', Date.now().toString())
      setStatus(`Signed in as ${email}`)
      setTimeout(() => setStatus(null), 2000)
      // Proactively create "Thoughtful" calendar right after sign-in
      getOrCreateThoughtfulCalendar().catch((err) => {
        console.error('Failed to create Thoughtful calendar:', err)
      })
    })
  }

  const handleGoogleSignOut = () => {
    stopReminderEngine()
    signOut()
    setSignedIn(false)
    setCalendarConnected(false)
    setUserEmail(null)
    setReminders([])
    setStatus('Signed out')
    setTimeout(() => setStatus(null), 2000)
  }

  const addReminderWithDate = useCallback(async (
    rawText: string,  // Original user input for AI title generation
    date: Date,
    isUpdate = false,
    existingReminder?: Reminder,
    recurrenceOptions?: RecurrenceOptions
  ) => {
    const id = existingReminder?.id || Date.now().toString()

    // Detect names IMMEDIATELY (before any async work) so the modal shows right away
    let detectedPersonName: string | undefined
    let detectedPhone: string | undefined
    if (!isUpdate) {
      const detectedName = getPrimaryDetectedName(rawText)
      if (detectedName) {
        const existingPerson = findPersonByName(detectedName.name, userEmail || undefined)
        if (existingPerson) {
          linkReminderToPerson(existingPerson.id, id, userEmail || undefined)
          refreshPeople()
          detectedPersonName = existingPerson.name
          detectedPhone = existingPerson.phone
        } else {
          detectedPersonName = detectedName.name
          setPendingNameConfirmation({
            detectedName,
            reminderId: id,
            originalText: rawText
          })
        }
      }
    }

    // For updates, keep the existing title unless user explicitly changed it
    // For new reminders, generate a friendly title
    let friendlyTitle: string
    if (isUpdate && existingReminder) {
      setStatus(`Updating "${existingReminder.text}"...`)
      // rawText is the new title from the edit modal; fall back to existing if blank
      friendlyTitle = rawText.trim() || existingReminder.text
    } else {
      setStatus('Creating reminder...')
      try {
        friendlyTitle = await generateTitle(rawText)
      } catch (e) {
        console.error('Title generation failed:', e)
        friendlyTitle = rawText
      }
    }

    const phoneNumber = detectedPhone ? detectedPhone.replace(/[^0-9+]/g, '') : undefined
    const message = friendlyTitle
    // For birthdays/anniversaries: calendar event + display stay on the actual date,
    // but the notification fires 1 day before so the user has time to prepare
    const triggerAt = (recurrenceOptions?.isBirthday || recurrenceOptions?.isAnniversary)
      ? new Date(date.getTime() - 24 * 60 * 60 * 1000).getTime()
      : date.getTime()
    const whatsappLink = phoneNumber
      ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hey!')}`
      : undefined

    // When editing, preserve recurrence flags from the existing reminder
    // (the edit modal only changes title/date, not recurrence pattern)
    const isRecurring = isUpdate && existingReminder
      ? (existingReminder.isRecurring ?? !!recurrenceOptions?.type)
      : !!recurrenceOptions?.type
    const isBirthday = isUpdate && existingReminder
      ? existingReminder.isBirthday
      : recurrenceOptions?.isBirthday
    const isAnniversary = isUpdate && existingReminder
      ? existingReminder.isAnniversary
      : recurrenceOptions?.isAnniversary

    const newReminder: Reminder = {
      id,
      text: friendlyTitle,
      date,
      isCompleted: false,
      calendarEventId: existingReminder?.calendarEventId,
      calendarHtmlLink: existingReminder?.calendarHtmlLink,
      lastSyncedAt: existingReminder?.lastSyncedAt,
      originalStartTime: existingReminder?.originalStartTime,
      isRecurring,
      isBirthday,
      isAnniversary,
      message,
      personName: detectedPersonName || undefined,
      phoneNumber,
      whatsappLink,
      triggerAt,
      createdAt: Date.now(),
      triggered: false,
    }

    if (isUpdate && existingReminder) {
      setReminders(prev => prev.map(r => r.id === id ? newReminder : r))
    } else {
      setReminders(prev => [newReminder, ...prev])
    }

    // Sync reminder to Firestore
    if (userEmail) syncReminderToFirestore(userEmail, newReminder)

    // If token is expired but user was previously signed in, try a silent refresh first
    let calendarReady = isSignedIn()
    if (!calendarReady && signedIn && (window as any).google?.accounts?.oauth2) {
      calendarReady = await trySilentRefresh()
      if (calendarReady) setCalendarConnected(true)
    }

    // Sync with Google Calendar if signed in
    if (calendarReady) {
      try {
        if (isUpdate && existingReminder?.calendarEventId) {
          await updateCalendarEvent(existingReminder.calendarEventId, {
            title: friendlyTitle,
            date: date.toISOString()
          })
          setStatus(`Updated "${friendlyTitle}" to ${date.toLocaleString()}`)
        } else if (isUpdate && existingReminder) {
          // Update exists locally but no calendar event - create one
          const result = await createCalendarEvent({
            title: friendlyTitle,
            date: date.toISOString(),
            recurrence: recurrenceOptions
          })
          if (result?.id) {
            setReminders(prev => prev.map(r =>
              r.id === id ? {
                ...r,
                calendarEventId: result.id,
                calendarHtmlLink: result.htmlLink || undefined,
                lastSyncedAt: Date.now(),
                originalStartTime: result.start?.dateTime || undefined,
              } : r
            ))
          }
          setStatus(`Updated and synced to calendar`)
        } else {
          const statusMsg = recurrenceOptions?.type
            ? `Creating recurring ${recurrenceOptions.isBirthday ? 'birthday' : recurrenceOptions.isAnniversary ? 'anniversary' : ''} event...`
            : 'Creating calendar event...'
          setStatus(statusMsg)
          const result = await createCalendarEvent({
            title: friendlyTitle,
            date: date.toISOString(),
            recurrence: recurrenceOptions
          })
          // Store the calendar event ID, html link, and sync metadata
          if (result?.id) {
            const calFields = {
              calendarEventId: result.id,
              calendarHtmlLink: result.htmlLink || undefined,
              lastSyncedAt: Date.now(),
              originalStartTime: result.start?.dateTime || undefined,
            }
            // Write directly to localStorage immediately (don't rely on useEffect timing)
            const key = getRemindersKey()
            const saved = localStorage.getItem(key)
            if (saved) {
              try {
                const parsed = JSON.parse(saved)
                const updated = parsed.map((r: any) => r.id === id ? { ...r, ...calFields } : r)
                localStorage.setItem(key, JSON.stringify(updated))
                const updatedReminder = updated.find((r: any) => r.id === id)
                if (updatedReminder && userEmail) syncReminderToFirestore(userEmail, updatedReminder)
              } catch {}
            }
            setReminders(prev => prev.map(r => r.id === id ? { ...r, ...calFields } : r))
          }
          const successMsg = recurrenceOptions?.isBirthday
            ? 'Birthday reminder created (yearly, with 1-day advance notice)'
            : recurrenceOptions?.isAnniversary
            ? 'Anniversary reminder created (yearly, with 1-day advance notice)'
            : recurrenceOptions?.type
            ? `Recurring ${recurrenceOptions.type} event created`
            : 'Calendar event created'
          setStatus(successMsg)
        }
        setTimeout(() => setStatus(null), 3000)
      } catch (e) {
        console.error('Calendar sync failed:', e)
        // If token expired, update UI immediately so Reconnect Calendar button appears
        if (!isSignedIn()) setCalendarConnected(false)
        setStatus('Saved locally (calendar sync failed)')
        setTimeout(() => setStatus(null), 3000)
      }
    } else {
      setStatus(signedIn ? 'Saved locally (reconnecting calendar…)' : 'Saved locally. Sign in to Google for calendar reminders.')
      setTimeout(() => setStatus(null), 3000)
    }
  }, [userEmail, refreshPeople, signedIn])

  const handleAddReminder = (text: string) => {
    // Check if this is an update request — must start with "update " to avoid false positives
    const lowerText = text.toLowerCase()
    const isUpdateRequest = /^update\s/i.test(lowerText)

    if (isUpdateRequest) {
      // Find matching reminder by keyword
      // Format: "update [reminder name] to [new time/date]"
      const cleanText = text.replace(/update/gi, '').trim()

      // Try to find the best matching reminder
      // Extract meaningful keywords from user input (strip filler/time words)
      const fillerWords = new Set(['at', 'on', 'to', 'the', 'a', 'an', 'for', 'by', 'am', 'pm', 'today', 'tomorrow', 'tonight', 'this', 'next'])
      const inputKeywords = cleanText.toLowerCase().split(/\s+/).filter(w =>
        !fillerWords.has(w) && !/^\d+/.test(w)
      )

      const existingReminder = reminders.find(r => {
        const reminderName = r.text.toLowerCase()

        // Check if reminder title is contained in input or vice versa
        if (cleanText.toLowerCase().includes(reminderName)) return true
        if (reminderName.includes(cleanText.toLowerCase().replace(/\s*(to|at|on)\s+.*$/, '').trim())) return true

        // Check if all input keywords appear in the reminder text
        if (inputKeywords.length > 0 && inputKeywords.every(kw => reminderName.includes(kw))) return true

        return false
      })

      if (existingReminder) {
        const result = parseReminder(cleanText)
        if (result.date) {
          addReminderWithDate(cleanText, result.date, true, existingReminder)
        } else {
          // No date found - open date picker for the update
          setStatus(`Select new date/time for "${existingReminder.text}"`)
          setPendingText(cleanText)
        }
        return
      } else {
        // No matching reminder found
        setStatus('No matching reminder found to update')
        setTimeout(() => setStatus(null), 3000)
        return
      }
    }

    const result = parseReminder(text)
    console.log('Parse result:', result)

    if (result.date) {
      const { recurrence } = result
      console.log('Recurrence detected:', recurrence)

      // For birthdays/anniversaries, auto-create as yearly recurring (no end date prompt)
      if (recurrence.isBirthday || recurrence.isAnniversary) {
        const recurrenceOptions: RecurrenceOptions = {
          type: 'yearly',
          isBirthday: recurrence.isBirthday,
          isAnniversary: recurrence.isAnniversary,
          endDate: null  // Forever
        }
        console.log('Creating birthday/anniversary with options:', recurrenceOptions)
        addReminderWithDate(text, result.date, false, undefined, recurrenceOptions)
      }
      // For recurring events with "until" date already specified, create directly
      else if (recurrence.type && recurrence.untilDate) {
        const recurrenceOptions: RecurrenceOptions = {
          type: recurrence.type,
          isBirthday: false,
          isAnniversary: false,
          endDate: recurrence.untilDate,
          interval: recurrence.interval,
          byDay: recurrence.byDay,
          byMonthDay: recurrence.byMonthDay,
          bySetPos: recurrence.bySetPos
        }
        console.log('Creating recurring event with until date:', recurrenceOptions)
        addReminderWithDate(text, result.date, false, undefined, recurrenceOptions)
      }
      // For other recurring events, prompt for end date
      else if (recurrence.type && recurrence.needsEndDate) {
        setPendingRecurrence({
          text: text,  // Store original text for AI title generation
          date: result.date,
          recurrence
        })
      }
      // Recurring events that don't need end date prompt (shouldn't happen but handle it)
      else if (recurrence.type) {
        const recurrenceOptions: RecurrenceOptions = {
          type: recurrence.type,
          isBirthday: false,
          isAnniversary: false,
          endDate: null,
          interval: recurrence.interval,
          byDay: recurrence.byDay,
          byMonthDay: recurrence.byMonthDay,
          bySetPos: recurrence.bySetPos
        }
        addReminderWithDate(text, result.date, false, undefined, recurrenceOptions)
      }
      // Non-recurring events
      else {
        addReminderWithDate(text, result.date)
      }
    } else {
      setPendingText(text)
    }
  }

  const handleDatePicked = (date: Date) => {
    if (pendingText) {
      addReminderWithDate(pendingText, date)
      setPendingText(null)
    }
  }

  const handleRecurrenceEndDatePicked = (endDate: Date | null) => {
    if (pendingRecurrence) {
      const { text, date, recurrence } = pendingRecurrence
      const recurrenceOptions: RecurrenceOptions = {
        type: recurrence.type,
        isBirthday: recurrence.isBirthday,
        isAnniversary: recurrence.isAnniversary,
        endDate,
        interval: recurrence.interval,
        byDay: recurrence.byDay,
        byMonthDay: recurrence.byMonthDay,
        bySetPos: recurrence.bySetPos
      }
      console.log('Creating recurring event with options:', recurrenceOptions)
      addReminderWithDate(text, date, false, undefined, recurrenceOptions)
      setPendingRecurrence(null)
    }
  }

  const handleToggle = async (id: string) => {
    const reminder = reminders.find(r => r.id === id)
    if (!reminder) return

    const newCompletedState = !reminder.isCompleted

    // Update local state
    const updatedReminder = { ...reminder, isCompleted: newCompletedState }
    setReminders(prev =>
      prev.map(r =>
        r.id === id ? updatedReminder : r
      )
    )
    if (userEmail) syncReminderToFirestore(userEmail, updatedReminder)

    // If marking as complete and has calendar event, offer to remove from calendar
    if (newCompletedState && reminder.calendarEventId && isSignedIn()) {
      try {
        setStatus('Removing from calendar...')
        await deleteCalendarEvent(reminder.calendarEventId)
        // Clear the calendar event ID since it's deleted
        setReminders(prev =>
          prev.map(r =>
            r.id === id ? { ...r, calendarEventId: undefined } : r
          )
        )
        setStatus('Completed and removed from calendar')
        setTimeout(() => setStatus(null), 2000)
      } catch {
        setStatus('Marked complete (calendar removal failed)')
        setTimeout(() => setStatus(null), 2000)
      }
    }
  }

  const handleEdit = (id: string) => {
    const r = reminders.find(rem => rem.id === id)
    if (r) setEditingReminder(r)
  }

  const handleDelete = async (id: string) => {
    const reminder = reminders.find(r => r.id === id)
    if (reminder?.calendarEventId && isSignedIn()) {
      try {
        await deleteCalendarEvent(reminder.calendarEventId)
        setStatus('Removed from calendar')
        setTimeout(() => setStatus(null), 2000)
      } catch {
        // Still delete locally even if calendar delete fails
      }
    }
    setReminders(prev => prev.filter(r => r.id !== id))
    if (userEmail) deleteReminderFromFirestore(userEmail, id)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || isRefreshing) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD + 20))
  }

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(0)
      loadReminders()
      await checkForCalendarChanges()
      setIsRefreshing(false)
    } else {
      setPullDistance(0)
    }
  }

  return (
    <div
      className="min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 inset-x-0 z-50 flex justify-center transition-transform"
          style={{ transform: `translateY(${isRefreshing ? 16 : pullDistance - 32}px)` }}
        >
          <div className={`w-9 h-9 rounded-full bg-white shadow-lg border border-blush-light
                           flex items-center justify-center
                           ${isRefreshing ? 'animate-spin' : ''}`}>
            <svg className="w-4 h-4 text-terra" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* GIS script — sets googleReady when loaded */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          setGoogleReady(true)
          // Proactively refresh if the token expired while the GIS script was loading
          if (!isSignedIn() && getStoredEmail()) {
            setRefreshingCalendar(true)
            trySilentRefresh().then(ok => {
              if (ok) setCalendarConnected(true)
              setRefreshingCalendar(false)
            })
          }
        }}
      />
      {/* Profiles Sidebar — always overlay, never pushes content */}
      {signedIn && (
        <RelationshipsSidebar
          people={people}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          userEmail={userEmail}
          onSignOut={handleGoogleSignOut}
        />
      )}

      <main className="px-5 sm:px-8 md:px-14 py-8 sm:py-10 md:py-14">
        <div className="max-w-3xl mx-auto">

          {/* Top bar: only shown when signed in */}
          {signedIn && (
            <div className="flex items-center justify-between mb-8 sm:mb-10 animate-fade-in">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-terra hover:text-terra-deep transition-colors p-1 -ml-1"
                aria-label="Open profiles"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                {/* Manual refresh button for PWA — browser refresh unavailable in standalone mode */}
                <button
                  onClick={() => { loadReminders(); checkForCalendarChanges() }}
                  className="p-2 text-terra/40 hover:text-terra rounded-xl hover:bg-blush-pale
                             transition-all duration-150"
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {googleReady && !calendarConnected && !refreshingCalendar && (() => {
                  // Don't show "Reconnect Calendar" within 90 days of last explicit sign-in.
                  // Silent refresh handles token renewal automatically — only prompt the user
                  // when the Google session has genuinely expired (i.e. after 3 months).
                  const lastSignIn = parseInt(localStorage.getItem('thoughtful-last-signin') || '0', 10)
                  const ninetyDays = 90 * 24 * 60 * 60 * 1000
                  const recentlySignedIn = lastSignIn > 0 && (Date.now() - lastSignIn) < ninetyDays
                  if (recentlySignedIn) return null
                  return (
                    <button
                      onClick={handleGoogleSignIn}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-pill text-xs font-medium
                                 text-terra border border-terra/30 hover:bg-blush-pale
                                 transition-all duration-200 active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 000-2H5a1 1 0 000 2zm0 0v.01" />
                      </svg>
                      Reconnect Calendar
                    </button>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Hero header */}
          <div className="text-center mb-10 sm:mb-14 animate-fade-up">
            <h1 className="font-script text-6xl sm:text-7xl md:text-8xl text-terra leading-none select-none">
              Thoughtful
            </h1>
            <p className="mt-8 sm:mt-10 text-terra/55 text-sm sm:text-base font-light tracking-wide">
              An easy way to remember things that matter
            </p>
          </div>

          {/* Notifications blocked banner */}
          {notificationsBlocked && (
            <div className="text-center mb-4 animate-scale-in">
              <span className="inline-flex items-center gap-2 text-xs text-amber-700
                               bg-amber-50 px-4 py-2.5 rounded-pill border border-amber-200">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications are blocked. Enable them in your browser settings.
                <button
                  onClick={async () => {
                    if (typeof Notification !== 'undefined') {
                      const result = await Notification.requestPermission()
                      if (result === 'granted') {
                        setNotificationsBlocked(false)
                        return
                      }
                    }
                    setNotificationsBlocked(false)
                  }}
                  className="underline hover:no-underline font-medium"
                >
                  Check again
                </button>
                <button onClick={() => setNotificationsBlocked(false)} className="ml-1 opacity-50 hover:opacity-100">✕</button>
              </span>
            </div>
          )}

          {/* Status toast */}
          {status && (
            <div className="text-center mb-6 animate-scale-in">
              <span className="inline-block text-xs sm:text-sm text-terra-deep/80 font-light
                               bg-blush-pale px-5 py-2.5 rounded-pill border border-blush-light">
                {status}
              </span>
            </div>
          )}

          {/* Signed-in content */}
          {signedIn ? (
            <>
              {/* Input */}
              <div className="mb-10">
                <ReminderInput onSubmit={handleAddReminder} />
              </div>


              {/* Help text */}
              <div className="text-center mb-8 animate-fade-up delay-300">
                <p className="text-xs text-terra/35 font-light leading-relaxed">
                  To edit, type <span className="italic">&quot;update [event name] to&hellip;&quot;</span>
                  &nbsp;·&nbsp; Recurring: &quot;every Friday&quot;, &quot;last Saturday of the month&quot;
                </p>
              </div>

              {/* GCal change notifications */}
              {gcalUpdates.length > 0 && (
                <div className="mb-6 space-y-2 animate-fade-up">
                  {gcalUpdates.map(update => (
                    <div
                      key={update.id}
                      className="flex items-start gap-3 px-4 py-3.5
                                 bg-blush-pale border border-blush-medium/50 rounded-2xl"
                    >
                      <svg className="w-4 h-4 text-terra mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="flex-1 text-sm text-terra-deep/80 font-light">
                        <span className="font-medium">Calendar update:</span>{' '}
                        &quot;{update.text}&quot; — {update.change}
                      </p>
                      <button
                        onClick={() => setGcalUpdates(prev => prev.filter(u => u.id !== update.id))}
                        className="text-terra/30 hover:text-terra/60 flex-shrink-0 transition-colors"
                        aria-label="Dismiss"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Reminders */}
              <ReminderList
                reminders={reminders}
                people={people}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            </>
          ) : (
            <div className="text-center py-10 animate-fade-up delay-200">
              {googleReady ? (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white
                               border border-blush-light rounded-pill text-sm font-medium text-terra-deep
                               hover:border-terra/30 hover:shadow-[0_4px_20px_rgba(212,117,106,0.18)]
                               transition-all duration-250 active:scale-95
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {signingIn ? 'Opening Google…' : 'Sign in with Google'}
                  </button>
                  {signingIn && (
                    <p className="text-xs text-terra/40 font-light">
                      Complete sign-in in the Google window, then return here
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-terra/40 text-sm font-light">Loading…</p>
              )}
            </div>
          )}
      </div>

      {/* Date Picker Modal */}
      {pendingText && (
        <DatePickerModal
          text={pendingText}
          onConfirm={handleDatePicked}
          onCancel={() => setPendingText(null)}
        />
      )}

      {/* Recurrence End Date Modal */}
      {pendingRecurrence && (
        <RecurrenceEndDateModal
          recurrenceType={pendingRecurrence.recurrence.type || 'yearly'}
          patternDescription={getPatternDescription(pendingRecurrence.recurrence)}
          onConfirm={handleRecurrenceEndDatePicked}
          onCancel={() => setPendingRecurrence(null)}
        />
      )}
      </main>

      {/* Person Confirmation Modal */}
      {pendingNameConfirmation && (
        <PersonConfirmationModal
          detectedName={pendingNameConfirmation.detectedName}
          onConfirm={handleConfirmPerson}
          onDeny={handleDenyPerson}
        />
      )}

      {/* Edit Reminder Modal */}
      {editingReminder && (
        <EditReminderModal
          reminder={editingReminder}
          onConfirm={(id, text, date) => {
            const r = reminders.find(rem => rem.id === id)
            if (r) {
              setEditingReminder(null)
              addReminderWithDate(text, date, true, r)
            }
          }}
          onCancel={() => setEditingReminder(null)}
        />
      )}

      {/* Footer */}
      <footer className="text-center py-8 px-5">
        <div className="flex items-center justify-center gap-4 text-xs text-terra/35 font-light">
          <a href="/privacy" className="hover:text-terra transition-colors">Privacy</a>
          <span>·</span>
          <a href="/terms" className="hover:text-terra transition-colors">Terms</a>
          <span>·</span>
          <a href="mailto:aparnacs008@gmail.com" className="hover:text-terra transition-colors">Contact</a>
          <span>·</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}
