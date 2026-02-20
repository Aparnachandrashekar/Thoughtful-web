'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ReminderInput from '@/components/ReminderInput'
import ReminderList, { Reminder } from '@/components/ReminderList'
import DatePickerModal from '@/components/DatePickerModal'
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
  RecurrenceOptions
} from '@/lib/google'
import { generateTitle } from '@/lib/ai'
import { Person, DetectedName } from '@/lib/types'
import { loadPeople, createPerson, findPersonByName, linkReminderToPerson } from '@/lib/people'
import { getPrimaryDetectedName } from '@/lib/personDetection'
import { syncReminderToFirestore, deleteReminderFromFirestore, syncPersonToFirestore, fullSyncToFirestore } from '@/lib/db'

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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

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

  // Save reminders for current user
  const saveReminders = useCallback((newReminders: Reminder[]) => {
    const key = getRemindersKey()
    localStorage.setItem(key, JSON.stringify(newReminders))
  }, [])

  useEffect(() => {
    setMounted(true)
    // Init Google auth
    try {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
        if (clientId) {
          initGoogleAuth(clientId)
          setGoogleReady(true)
          // Check if already signed in (from localStorage)
          if (isSignedIn()) {
            setSignedIn(true)
            setUserEmail(getUserEmail())
          }
        }
      }
      document.head.appendChild(script)
    } catch {
      // Google auth failed to load, app still works without it
    }
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

  // Background sync to Firestore when user signs in
  useEffect(() => {
    if (userEmail) {
      fullSyncToFirestore(userEmail).catch(() => {})
    }
  }, [userEmail])

  const handleGoogleSignIn = () => {
    signIn((email) => {
      setSignedIn(true)
      setUserEmail(email)
      setStatus(`Signed in as ${email}`)
      setTimeout(() => setStatus(null), 2000)
    })
  }

  const handleGoogleSignOut = () => {
    signOut()
    setSignedIn(false)
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
    if (!isUpdate) {
      const detectedName = getPrimaryDetectedName(rawText)
      if (detectedName) {
        const existingPerson = findPersonByName(detectedName.name, userEmail || undefined)
        if (existingPerson) {
          linkReminderToPerson(existingPerson.id, id, userEmail || undefined)
          refreshPeople()
        } else {
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
      friendlyTitle = existingReminder.text
    } else {
      setStatus('Creating reminder...')
      try {
        friendlyTitle = await generateTitle(rawText)
      } catch (e) {
        console.error('Title generation failed:', e)
        friendlyTitle = rawText
      }
    }

    const newReminder: Reminder = {
      id,
      text: friendlyTitle,
      date,
      isCompleted: false,
      calendarEventId: existingReminder?.calendarEventId,
      isRecurring: !!recurrenceOptions?.type,
      isBirthday: recurrenceOptions?.isBirthday,
      isAnniversary: recurrenceOptions?.isAnniversary,
    }

    if (isUpdate && existingReminder) {
      setReminders(prev => prev.map(r => r.id === id ? newReminder : r))
    } else {
      setReminders(prev => [newReminder, ...prev])
    }

    // Sync with Google Calendar if signed in
    if (isSignedIn()) {
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
              r.id === id ? { ...r, calendarEventId: result.id } : r
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
          // Store the calendar event ID
          if (result?.id) {
            setReminders(prev => prev.map(r =>
              r.id === id ? { ...r, calendarEventId: result.id } : r
            ))
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
        setStatus('Saved locally (calendar sync failed)')
        setTimeout(() => setStatus(null), 3000)
      }
    } else {
      setStatus('Saved locally. Sign in to Google for calendar reminders.')
      setTimeout(() => setStatus(null), 3000)
    }
  }, [userEmail, refreshPeople])

  const handleAddReminder = (text: string) => {
    // Check if this is an update request
    const lowerText = text.toLowerCase()
    const isUpdateRequest = lowerText.includes('update')

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
    setReminders(prev =>
      prev.map(r =>
        r.id === id ? { ...r, isCompleted: newCompletedState } : r
      )
    )

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

  return (
    <div className="flex min-h-screen">
      {/* Relationships Sidebar */}
      {signedIn && (
        <RelationshipsSidebar
          people={people}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          userEmail={userEmail}
          onSignOut={handleGoogleSignOut}
        />
      )}

      <main className="flex-1 px-6 md:px-12 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 tracking-tight">
            Thoughtful
          </h1>
          <p className="mt-4 text-gray-500 text-lg md:text-xl max-w-2xl mx-auto">
            Your guide to building beautiful relationships by being thoughtful
          </p>
        </div>

        {/* Google Sign-in */}
        <div className="flex justify-center mb-8 animate-fade-in">
          {googleReady && !signedIn ? (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-200
                         rounded-2xl text-base font-semibold text-gray-700 hover:border-lavender
                         hover:shadow-lg hover:scale-[1.02] transition-all duration-200 active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          ) : null}
        </div>

        {/* Status message */}
        {status && (
          <div className="text-center mb-6 animate-fade-in">
            <p className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm inline-block px-5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              {status}
            </p>
          </div>
        )}

        {/* Show input and reminders only when signed in */}
        {signedIn ? (
          <>
            {/* Input */}
            <div className="mb-8 animate-slide-up">
              <ReminderInput onSubmit={handleAddReminder} />
            </div>

            {/* Help text */}
            <div className="text-center mb-8 p-4 bg-white/50 rounded-2xl border border-gray-100">
              <p className="text-sm text-gray-500">
                Click X to delete. To edit, type <span className="font-semibold text-gray-600">&quot;update&quot;</span> followed by the event name and new details.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Recurring: &quot;every Friday&quot;, &quot;alternating Mondays&quot;, &quot;last Saturday of the month&quot;, &quot;until Dec 2026&quot;
              </p>
            </div>

            {/* Reminder List */}
            <ReminderList
              reminders={reminders}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          </>
        ) : (
          <div className="text-center py-16 animate-fade-in">
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-12 border border-gray-100 max-w-md mx-auto">
              <div className="text-5xl mb-4">💜</div>
              <p className="text-gray-500 text-lg">Sign in with Google to start creating reminders</p>
            </div>
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
    </div>
  )
}
