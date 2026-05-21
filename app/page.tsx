'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Script from 'next/script'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import ReminderInput from '@/components/ReminderInput'
import OutlineIcon from '@/components/OutlineIcon'
import ThoughtfulTitle from '@/components/ThoughtfulTitle'
import { copy } from '@/lib/copy'
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
  connectCalendar,
  hasCalendarAccess,
  getUserEmail,
  getRemindersKey,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  getOrCreateThoughtfulCalendar,
  trySilentCalendarRefresh,
  RecurrenceOptions,
  getStoredEmail
} from '@/lib/google'
import { logGoogleAuthEvent } from '@/lib/googleAuthAnalytics'
import { generateTitle } from '@/lib/ai'
import { Person, DetectedName } from '@/lib/types'
import { loadPeople, createPerson, findPersonByName, linkReminderToPerson } from '@/lib/people'
import { getPrimaryDetectedName } from '@/lib/personDetection'
import { syncReminderToFirestore, deleteReminderFromFirestore, syncPersonToFirestore, fullSyncToFirestore, pullFromFirestore } from '@/lib/db'
import { startReminderEngine, stopReminderEngine } from '@/lib/reminderEngine'

function oauthErrorMessage(reason: string): string {
  if (reason.startsWith('state_')) {
    if (reason === 'state_expired') return 'Sign-in timed out. Please try again.'
    if (reason === 'state_mismatch') return 'Security check failed. Please try again.'
    if (reason === 'state_missing') return 'Sign-in did not complete securely. Please try again.'
    if (reason === 'state_no_pending') return 'Sign-in session was interrupted. Please try again.'
    return 'Sign-in could not be verified. Please try again.'
  }
  if (reason === 'popup_closed') return 'Sign-in window was closed before completing.'
  if (reason === 'popup_failed_to_open') return 'Could not open sign-in window. Allow popups and try again.'
  return 'Something went wrong. Please try again.'
}

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
  const [connectingCalendar, setConnectingCalendar] = useState(false)
  const [gisLoadError, setGisLoadError] = useState(false)
  const [signInTimedOut, setSignInTimedOut] = useState(false)
  const silentRefreshInFlight = useRef(false)
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [newReminderId, setNewReminderId] = useState<string | null>(null)
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

  // Rate-limit Firestore pull: at most once per 60 seconds
  const lastFirestorePull = useRef(0)

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

  const attemptSilentCalendarRefresh = useCallback(() => {
    if (silentRefreshInFlight.current || !getStoredEmail()) return
    silentRefreshInFlight.current = true
    setRefreshingCalendar(true)
    trySilentCalendarRefresh()
      .then(ok => {
        if (ok) setCalendarConnected(true)
      })
      .finally(() => {
        silentRefreshInFlight.current = false
        setRefreshingCalendar(false)
      })
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
    const tokenValid = hasCalendarAccess()
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
      if (!tokenValid && storedEmail) {
        attemptSilentCalendarRefresh()
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

  }, [attemptSilentCalendarRefresh])

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

  // Bidirectional Firestore sync: pull data from Firestore, then push any local-only data.
  // Called on mount (via the Firestore effect), on app foreground, and on pull-to-refresh.
  // Throttled to once per 10 s to avoid hammering Firestore on rapid tab switches.
  const syncFromFirestore = useCallback(async (force = false) => {
    if (!userEmail || !firebaseReady) return
    const now = Date.now()
    if (!force && now - lastFirestorePull.current < 10_000) return
    lastFirestorePull.current = now

    try {
      // Pull: get Firestore data not yet in localStorage
      const { reminders: r, people: p } = await pullFromFirestore(userEmail)
      // Always reload reminders after pull so UI reflects latest localStorage state
      loadReminders()
      setPeople(loadPeople(userEmail))
      if (r > 0 || p > 0) {
        console.log(`Sync: pulled ${r} reminders, ${p} people`)
      }
    } catch (e: any) {
      const msg = e?.code || e?.message || String(e)
      console.error('Firestore pull failed:', msg)
      // Don't surface raw Firestore errors to users — data is safe in localStorage
    }

    // Push: send any localStorage data not yet in Firestore
    await fullSyncToFirestore(userEmail).catch(() => {})
  }, [userEmail, firebaseReady, loadReminders])

  // Check Google Calendar for changes to synced reminders (called on tab becoming visible)
  const checkForCalendarChanges = useCallback(async () => {
    if (!userEmail) return
    if (!hasCalendarAccess()) {
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
      const valid = hasCalendarAccess()
      if (valid) {
        setCalendarConnected(true)
      } else if (googleReady) {
        attemptSilentCalendarRefresh()
      } else {
        setCalendarConnected(false)
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [signedIn, googleReady, attemptSilentCalendarRefresh])

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
        if (!hasCalendarAccess() && getStoredEmail() && (window as any).google?.accounts?.oauth2) {
          attemptSilentCalendarRefresh()
        }
        checkForCalendarChanges()
        // Bidirectional sync so data created on another device/browser shows up
        syncFromFirestore(false)
      }
    }
    window.addEventListener('focus', checkForCalendarChanges)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', checkForCalendarChanges)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkForCalendarChanges, syncFromFirestore, attemptSilentCalendarRefresh])

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

  // Sync with Firestore on mount (and whenever userEmail/firebaseReady changes).
  // Uses syncFromFirestore (force=true) so throttle is bypassed on first load.
  const engineStarted = useRef(false)
  useEffect(() => {
    if (userEmail && firebaseReady) {
      syncFromFirestore(true)

      if (!engineStarted.current) {
        engineStarted.current = true
        startReminderEngine(userEmail)
      }
    }
    return () => {
      stopReminderEngine()
      engineStarted.current = false
    }
  }, [userEmail, firebaseReady, syncFromFirestore])

  const handleGoogleSignIn = () => {
    setSigningIn(true)
    setSignInTimedOut(false)
    // Reset after 30s — covers closed popups, blocked popups, and failed userinfo calls
    const signingInTimeout = setTimeout(() => {
      setSigningIn(false)
      setSignInTimedOut(true)
    }, 30_000)
    signIn(
      (email) => {
        clearTimeout(signingInTimeout)
        setSigningIn(false)
        setSignInTimedOut(false)
        setSignedIn(true)
        setUserEmail(email)
        setCalendarConnected(hasCalendarAccess())
        localStorage.setItem('thoughtful-last-signin', Date.now().toString())
        setStatus(`Signed in as ${email}`)
        setTimeout(() => setStatus(null), 2000)
        if (hasCalendarAccess()) {
          getOrCreateThoughtfulCalendar().catch((err) => {
            console.error('Failed to create Thoughtful calendar:', err)
          })
        }
        const pending = sessionStorage.getItem('thoughtful-pending-input')
        if (pending) {
          sessionStorage.removeItem('thoughtful-pending-input')
          setTimeout(() => handleAddReminder(pending), 300)
        }
      },
      (reason) => {
        clearTimeout(signingInTimeout)
        setSigningIn(false)
        setStatus(oauthErrorMessage(reason))
        setTimeout(() => setStatus(null), 5000)
      }
    )
  }

  const handleConnectCalendar = () => {
    if (!signedIn) return
    setConnectingCalendar(true)
    connectCalendar((success, reason) => {
      setConnectingCalendar(false)
      if (success) {
        setCalendarConnected(true)
        setStatus('Google Calendar connected')
        setTimeout(() => setStatus(null), 2000)
        getOrCreateThoughtfulCalendar().catch((err) => {
          console.error('Failed to create Thoughtful calendar:', err)
        })
      } else {
        logGoogleAuthEvent('calendar_reconnect_prompt_shown')
        setStatus(
          reason ? oauthErrorMessage(reason) : 'Could not connect calendar. Try again or check popup settings.'
        )
        setTimeout(() => setStatus(null), 4000)
      }
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
      setNewReminderId(id)
      setTimeout(() => setNewReminderId(null), 3000)
    }

    // Sync reminder to Firestore
    if (userEmail) syncReminderToFirestore(userEmail, newReminder)

    // If token is expired but user was previously signed in, try a silent refresh first
    let calendarReady = hasCalendarAccess()
    if (!calendarReady && signedIn && (window as any).google?.accounts?.oauth2) {
      calendarReady = await trySilentCalendarRefresh()
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
      } catch (e: any) {
        console.error('Calendar sync failed:', e)
        const msg = (e?.message || '').toLowerCase()
        const isAuth = !hasCalendarAccess() || msg.includes('401') || msg.includes('403') ||
          msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('insufficient')
        if (isAuth) {
          // Token expired or revoked — show reconnect prompt
          setCalendarConnected(false)
          setStatus('Reminder saved. Tap "Connect Calendar" to sync.')
          setTimeout(() => setStatus(null), 6000)
        } else {
          // Network/timeout/other — reminder is safely stored locally + Firestore
          setStatus('Reminder saved')
          setTimeout(() => setStatus(null), 2000)
        }
      }
    } else {
      setStatus(signedIn ? 'Reminder saved (calendar reconnection needed)' : 'Reminder saved. Sign in with Google for calendar sync.')
      setTimeout(() => setStatus(null), 3000)
    }
  }, [userEmail, refreshPeople, signedIn])

  const handleAddReminder = (text: string) => {
    if (!signedIn) {
      sessionStorage.setItem('thoughtful-pending-input', text)
      setStatus(copy.signInSaveReminder)
      setTimeout(() => setStatus(null), 5000)
      return
    }

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
    if (newCompletedState && reminder.calendarEventId && hasCalendarAccess()) {
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
    if (reminder?.calendarEventId && hasCalendarAccess()) {
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
      // Force bidirectional Firestore sync on manual refresh (bypass throttle)
      await Promise.all([syncFromFirestore(true), checkForCalendarChanges()])
      loadReminders()
      setIsRefreshing(false)
    } else {
      setPullDistance(0)
    }
  }

  return (
    <div
      className="app-canvas min-h-screen bg-page animate-page-in"
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
          <div className={`w-9 h-9 rounded-full bg-surface shadow-card
                           flex items-center justify-center
                           ${isRefreshing ? 'animate-spin' : ''}`}>
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
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
        onError={() => setGisLoadError(true)}
        onLoad={() => {
          setGoogleReady(true)
          // Proactively refresh if the token expired while the GIS script was loading
          if (!hasCalendarAccess() && getStoredEmail()) {
            attemptSilentCalendarRefresh()
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

      <main className="relative z-10 w-full bg-page">
          {/* Signed-in toolbar — floats over hero */}
          {signedIn && (
            <header className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-5 sm:px-8 max-w-3xl mx-auto">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-ink-muted hover:text-accent transition-colors"
                aria-label="Open profiles"
              >
                <OutlineIcon name="profiles" size="lg" />
              </button>
              <div className="flex items-center gap-1">
                {googleReady && !calendarConnected && !refreshingCalendar && (
                  <button
                    type="button"
                    onClick={handleConnectCalendar}
                    disabled={connectingCalendar}
                    className="p-2 text-ink-muted hover:text-accent rounded-card transition-colors disabled:opacity-40"
                    title="Connect Google Calendar"
                  >
                    <OutlineIcon name="calendar" size="lg" />
                  </button>
                )}
                <button
                  onClick={() => { syncFromFirestore(true); checkForCalendarChanges() }}
                  className="p-2 text-ink-muted hover:text-accent transition-colors"
                  title="Sync"
                  aria-label="Sync"
                >
                  <OutlineIcon name="refresh" size="lg" />
                </button>
                <button
                  onClick={handleGoogleSignOut}
                  className="p-2 text-ink-muted hover:text-accent transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <OutlineIcon name="signOut" size="lg" />
                </button>
              </div>
            </header>
          )}

          {/* Notifications blocked banner */}
          {notificationsBlocked && (
            <div className="relative z-20 px-5 sm:px-8 max-w-3xl mx-auto pt-4 mb-4 animate-fade-in">
              <span className="inline-flex items-center gap-2 text-xs text-ink-muted
                               bg-surface px-4 py-2.5 rounded-card">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {copy.notificationsBlocked}
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
                  {copy.checkAgain}
                </button>
                <button onClick={() => setNotificationsBlocked(false)} className="ml-1 opacity-50 hover:opacity-100">✕</button>
              </span>
            </div>
          )}

          {/* Status toast */}
          {status && (
            <div className="relative z-20 px-5 sm:px-8 max-w-3xl mx-auto pt-2 mb-2 animate-fade-in">
              <span className="inline-block font-outfit text-body text-ink-muted font-light bg-surface px-4 py-2 rounded-card">
                {status}
              </span>
            </div>
          )}

          {/* sm+: one column sized to the title; mobile: hero full width, compact cards below */}
          <div className="w-full mx-auto flex flex-col items-center px-4 sm:px-6">
            <div className="w-full sm:w-fit max-w-[calc(100vw-2rem)] sm:max-w-none flex flex-col items-stretch">
            <section className="min-h-screen flex flex-col items-center justify-center w-full">
              <h1 className="leading-none text-center w-full">
                <ThoughtfulTitle variant="hero">{copy.appName}</ThoughtfulTitle>
              </h1>
              <p className="font-outfit text-[18px] sm:text-[20px] italic text-ink-muted font-light mt-5 sm:mt-6 text-center leading-snug px-1">
                {copy.tagline}
              </p>
              <div className="w-full mt-8">
                <ReminderInput hero onSubmit={handleAddReminder} />
              </div>
              {signedIn && googleReady && !calendarConnected && !refreshingCalendar && (
                <p className="mt-4 font-outfit text-body text-accent font-medium text-center">
                  {connectingCalendar ? copy.connectingCalendar : (
                    <button type="button" onClick={handleConnectCalendar} className="hover:underline">
                      {copy.connectCalendar}
                    </button>
                  )}
                </p>
              )}
              {signedIn && (
                <p className="mt-5 font-outfit text-body text-ink-faint text-center leading-relaxed max-w-[17.5rem] sm:max-w-md mx-auto">
                  {copy.helpText}
                </p>
              )}
              {!signedIn && (
                <div className="mt-8 w-full text-center">
                  {gisLoadError ? (
                    <div className="space-y-2">
                      <p className="font-outfit text-body text-ink-muted">{copy.gisLoadError}</p>
                      <p className="font-outfit text-body text-ink-faint max-w-xs mx-auto">
                        {copy.gisLoadErrorDetail}
                      </p>
                      <button onClick={() => window.location.reload()} className="font-outfit text-body text-accent font-medium">
                        {copy.refreshPage}
                      </button>
                    </div>
                  ) : googleReady ? (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={signingIn}
                        className="font-outfit text-body font-medium text-ink-muted hover:text-accent transition-colors disabled:opacity-50"
                      >
                        {signingIn ? copy.signingIn : copy.signIn}
                      </button>
                      {signingIn && (
                        <p className="font-outfit text-body text-ink-faint">{copy.signInHint}</p>
                      )}
                      {signInTimedOut && (
                        <p className="font-outfit text-body text-ink-faint max-w-xs mx-auto">{copy.signInTimedOut}</p>
                      )}
                    </div>
                  ) : (
                    <p className="font-outfit text-body text-ink-faint">{copy.loading}</p>
                  )}
                </div>
              )}
            </section>

            {signedIn && (
              <section className="w-full pb-24 pt-4">
                {/* Mobile: narrower cards; desktop: same width as title column */}
                <div className="w-full max-w-[17.5rem] mx-auto sm:max-w-none sm:mx-0">
                {gcalUpdates.length > 0 && (
                  <div className="mb-6 bg-surface rounded-card overflow-hidden divide-y divide-white">
                    {gcalUpdates.map(update => (
                      <div key={update.id} className="flex items-start gap-3 px-5 py-3.5">
                        <svg className="w-3.5 h-3.5 text-ink-muted mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="flex-1 font-outfit text-body text-ink-muted font-light">
                          <span className="font-medium text-ink">{copy.calendarUpdate}</span>{' '}
                          &quot;{update.text}&quot; — {update.change}
                        </p>
                        <button
                          onClick={() => setGcalUpdates(prev => prev.filter(u => u.id !== update.id))}
                          className="text-ink-faint hover:text-ink flex-shrink-0 transition-colors p-2"
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

                <ReminderList
                  reminders={reminders}
                  people={people}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  newReminderId={newReminderId}
                />
                </div>
              </section>
            )}
            </div>
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
      <footer className="text-center py-8 px-5 bg-page">
        <div className="flex items-center justify-center gap-4 font-outfit text-body text-ink-faint font-light">
          <a href="/privacy" className="hover:text-accent transition-colors">Privacy</a>
          <span>·</span>
          <a href="/terms" className="hover:text-accent transition-colors">Terms</a>
          <span>·</span>
          <a href="mailto:aparnacs008@gmail.com" className="hover:text-accent transition-colors">Contact</a>
          <span>·</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}
