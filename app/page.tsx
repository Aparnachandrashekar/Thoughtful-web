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
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  RecurrenceOptions
} from '@/lib/google'
import { generateTitle } from '@/lib/ai'
import { Person, DetectedName, AvatarColor } from '@/lib/types'
import { getPrimaryDetectedName } from '@/lib/personDetection'
import {
  subscribeReminders,
  addReminder as addReminderDB,
  updateReminder as updateReminderDB,
  deleteReminder as deleteReminderDB,
  subscribePeople,
  addPerson as addPersonDB,
  updatePersonDoc,
} from '@/lib/db'

const AVATAR_COLORS: AvatarColor[] = ['blush', 'lavender', 'mint', 'peach', 'sky']

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
  if (recurrence.type === 'daily' && recurrence.interval && recurrence.interval > 1) {
    return `every ${recurrence.interval} days`
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
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)
  const [pendingNameConfirmation, setPendingNameConfirmation] = useState<{
    detectedName: DetectedName
    reminderId?: string
    originalText?: string
  } | null>(null)

  // Refs for Firestore unsubscribe functions
  const unsubReminders = useRef<(() => void) | null>(null)
  const unsubPeople = useRef<(() => void) | null>(null)

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
          // Restore auth state from localStorage
          if (isSignedIn()) {
            const email = getUserEmail()
            setSignedIn(true)
            setUserEmail(email)
          }
        }
      }
      script.onerror = () => {
        console.error('Failed to load Google Identity Services script')
      }
      document.head.appendChild(script)
    } catch {
      // Google auth failed to load, app still works without it
    }
  }, [])

  // Subscribe to Firestore reminders & people when userEmail changes
  useEffect(() => {
    // Cleanup previous subscriptions
    if (unsubReminders.current) {
      unsubReminders.current()
      unsubReminders.current = null
    }
    if (unsubPeople.current) {
      unsubPeople.current()
      unsubPeople.current = null
    }

    if (!userEmail) {
      setReminders([])
      setPeople([])
      return
    }

    unsubReminders.current = subscribeReminders(userEmail, setReminders)
    unsubPeople.current = subscribePeople(userEmail, setPeople)

    return () => {
      if (unsubReminders.current) unsubReminders.current()
      if (unsubPeople.current) unsubPeople.current()
    }
  }, [userEmail])

  // Handle person confirmation - create profile with default 'close_friend' type
  const handleConfirmPerson = useCallback(async () => {
    if (!pendingNameConfirmation || isCreatingProfile) return

    if (!userEmail) {
      console.error('Cannot create profile: no user email')
      setPendingNameConfirmation(null)
      return
    }

    setIsCreatingProfile(true)

    try {
      // Dedup: check if person already exists in current people state
      const normalizedName = pendingNameConfirmation.detectedName.name.toLowerCase().trim()
      const existing = people.find(p => p.name.toLowerCase().trim() === normalizedName)

      let person: Person
      if (existing) {
        person = existing
      } else {
        // Pick a color that's least used
        const colorCounts = AVATAR_COLORS.reduce((acc, color) => {
          acc[color] = people.filter(p => p.avatarColor === color).length
          return acc
        }, {} as Record<AvatarColor, number>)
        const leastUsedColor = AVATAR_COLORS.reduce((min, color) =>
          colorCounts[color] < colorCounts[min] ? color : min
        , AVATAR_COLORS[0])

        person = {
          id: Date.now().toString(),
          name: pendingNameConfirmation.detectedName.name.trim(),
          linkedReminderIds: [],
          createdAt: new Date().toISOString(),
          avatarColor: leastUsedColor,
          relationshipType: 'close_friend',
        }
        await addPersonDB(userEmail, person)
      }

      // Link reminder to person
      if (pendingNameConfirmation.reminderId) {
        const updatedIds = [...person.linkedReminderIds]
        if (!updatedIds.includes(pendingNameConfirmation.reminderId)) {
          updatedIds.push(pendingNameConfirmation.reminderId)
          await updatePersonDoc(userEmail, person.id, { linkedReminderIds: updatedIds })
        }
      }
    } finally {
      setPendingNameConfirmation(null)
      setIsCreatingProfile(false)
    }
  }, [pendingNameConfirmation, userEmail, people, isCreatingProfile])

  const handleDenyPerson = useCallback(() => {
    setPendingNameConfirmation(null)
  }, [])

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
    rawText: string,
    date: Date,
    isUpdate = false,
    existingReminder?: Reminder,
    recurrenceOptions?: RecurrenceOptions
  ) => {
    if (!userEmail) return

    const id = existingReminder?.id || Date.now().toString()

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

    // Write to Firestore (onSnapshot will update local state)
    await addReminderDB(userEmail, newReminder)

    // Detect names for person profile creation
    if (!isUpdate) {
      const detectedName = getPrimaryDetectedName(rawText)
      if (detectedName) {
        const normalizedName = detectedName.name.toLowerCase().trim()
        const existingPerson = people.find(p => p.name.toLowerCase().trim() === normalizedName)
        if (existingPerson) {
          // Auto-link to existing person
          const updatedIds = [...existingPerson.linkedReminderIds]
          if (!updatedIds.includes(id)) {
            updatedIds.push(id)
            await updatePersonDoc(userEmail, existingPerson.id, { linkedReminderIds: updatedIds })
          }
        } else {
          setPendingNameConfirmation({
            detectedName,
            reminderId: id,
            originalText: rawText
          })
        }
      }
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
          const result = await createCalendarEvent({
            title: friendlyTitle,
            date: date.toISOString(),
            recurrence: recurrenceOptions
          })
          if (result?.id) {
            await updateReminderDB(userEmail, id, { calendarEventId: result.id })
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
          if (result?.id) {
            await updateReminderDB(userEmail, id, { calendarEventId: result.id })
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
        setStatus('Saved (calendar sync failed)')
        setTimeout(() => setStatus(null), 3000)
      }
    } else {
      setStatus('Saved. Sign in to Google for calendar reminders.')
      setTimeout(() => setStatus(null), 3000)
    }
  }, [userEmail, people])

  const handleAddReminder = (text: string) => {
    const lowerText = text.toLowerCase()
    const isUpdateRequest = lowerText.includes('update')

    if (isUpdateRequest) {
      const cleanText = text.replace(/update/gi, '').trim()

      const existingReminder = reminders.find(r => {
        const reminderWords = r.text.toLowerCase().split(/\s+/)
        const inputWords = cleanText.toLowerCase().split(/\s+/)

        const reminderName = r.text.toLowerCase()
        if (cleanText.toLowerCase().includes(reminderName)) return true

        const matchWords = reminderWords.slice(0, 3).filter(w =>
          !['at', 'on', 'to', 'the', 'a', 'an'].includes(w)
        )
        return matchWords.every(word => inputWords.includes(word))
      })

      if (existingReminder) {
        const result = parseReminder(cleanText)
        if (result.date) {
          addReminderWithDate(cleanText, result.date, true, existingReminder)
        } else {
          setStatus(`Select new date/time for "${existingReminder.text}"`)
          setPendingText(cleanText)
        }
        return
      } else {
        setStatus('No matching reminder found to update')
        setTimeout(() => setStatus(null), 3000)
        return
      }
    }

    const result = parseReminder(text)

    if (result.date) {
      const { recurrence } = result

      if (recurrence.isBirthday || recurrence.isAnniversary) {
        const recurrenceOptions: RecurrenceOptions = {
          type: 'yearly',
          isBirthday: recurrence.isBirthday,
          isAnniversary: recurrence.isAnniversary,
          endDate: null
        }
        addReminderWithDate(text, result.date, false, undefined, recurrenceOptions)
      }
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
        addReminderWithDate(text, result.date, false, undefined, recurrenceOptions)
      }
      else if (recurrence.type && recurrence.needsEndDate) {
        setPendingRecurrence({
          text: text,
          date: result.date,
          recurrence
        })
      }
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
      addReminderWithDate(text, date, false, undefined, recurrenceOptions)
      setPendingRecurrence(null)
    }
  }

  const handleToggle = async (id: string) => {
    if (!userEmail) return
    const reminder = reminders.find(r => r.id === id)
    if (!reminder) return

    const newCompletedState = !reminder.isCompleted

    // Update Firestore (onSnapshot will update local state)
    await updateReminderDB(userEmail, id, { isCompleted: newCompletedState })

    // If marking as complete and has calendar event, remove from calendar
    if (newCompletedState && reminder.calendarEventId && isSignedIn()) {
      try {
        setStatus('Removing from calendar...')
        await deleteCalendarEvent(reminder.calendarEventId)
        await updateReminderDB(userEmail, id, { calendarEventId: null })
        setStatus('Completed and removed from calendar')
        setTimeout(() => setStatus(null), 2000)
      } catch {
        setStatus('Marked complete (calendar removal failed)')
        setTimeout(() => setStatus(null), 2000)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!userEmail) return
    const reminder = reminders.find(r => r.id === id)
    if (reminder?.calendarEventId && isSignedIn()) {
      try {
        await deleteCalendarEvent(reminder.calendarEventId)
        setStatus('Removed from calendar')
        setTimeout(() => setStatus(null), 2000)
      } catch {
        // Still delete from Firestore even if calendar delete fails
      }
    }
    await deleteReminderDB(userEmail, id)
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
          isLoading={isCreatingProfile}
        />
      )}
    </div>
  )
}
