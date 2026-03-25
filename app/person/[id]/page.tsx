'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CareActionsPanel from '@/components/CareActionsPanel'
import TemplateConfirmationModal from '@/components/TemplateConfirmationModal'
import RelationshipTypeModal from '@/components/RelationshipTypeModal'
import DatePickerModal from '@/components/DatePickerModal'
import { Reminder } from '@/components/ReminderList'
import { Person, CareTemplate, RelationshipType, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'
import { getPersonById, linkReminderToPerson, updatePerson, deletePerson } from '@/lib/people'
import { getRemindersKey, isSignedIn, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, RecurrenceOptions, getStoredEmail } from '@/lib/google'
import { generateTitle } from '@/lib/ai'
import { syncReminderToFirestore, deleteReminderFromFirestore, syncPersonToFirestore, deletePersonFromFirestore, pullFromFirestore } from '@/lib/db'
import { parseReminder, RecurrenceInfo } from '@/lib/parser'
import EditReminderModal from '@/components/EditReminderModal'
import WhatsAppButton from '@/components/WhatsAppButton'
import { formatDate as sharedFormatDate } from '@/lib/dateFormat'

export default function PersonProfilePage() {
  const params = useParams()
  const router = useRouter()

  const personId = params.id as string
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    setUserEmail(getStoredEmail())
  }, [])

  const [person, setPerson] = useState<Person | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const [templateModal, setTemplateModal] = useState<{
    template: CareTemplate
    generatedText: string
  } | null>(null)
  const [showEditRelationship, setShowEditRelationship] = useState(false)
  const [showEditEmail, setShowEditEmail] = useState(false)
  const [editingEmail, setEditingEmail] = useState('')
  const [showEditPhone, setShowEditPhone] = useState(false)
  const [editingPhone, setEditingPhone] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newReminderText, setNewReminderText] = useState('')
  const [addingReminder, setAddingReminder] = useState(false)
  const [pendingProfileReminder, setPendingProfileReminder] = useState<string | null>(null)
  const [editingProfileReminder, setEditingProfileReminder] = useState<Reminder | null>(null)

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  const loadReminders = useCallback(() => {
    try {
      const key = getRemindersKey()
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed.map((r: Reminder) => ({ ...r, date: new Date(r.date) }))
        }
      }
    } catch {}
    return []
  }, [])

  const saveReminders = useCallback((newReminders: Reminder[]) => {
    const key = getRemindersKey()
    localStorage.setItem(key, JSON.stringify(newReminders))
  }, [])

  useEffect(() => {
    const email = getStoredEmail()

    const loadPersonData = () => {
      const loadedPerson = getPersonById(personId, email || undefined)
      if (loadedPerson) {
        setPerson(loadedPerson)
        setEditingEmail(loadedPerson.email || '')
        setEditingPhone(loadedPerson.phone || '')
        const allReminders = loadReminders()
        const linkedReminders = allReminders.filter((r: Reminder) =>
          loadedPerson.linkedReminderIds.includes(r.id) ||
          r.text.toLowerCase().includes(loadedPerson.name.toLowerCase())
        )
        setReminders(linkedReminders)
        return true
      }
      return false
    }

    // Try loading from localStorage first
    if (loadPersonData()) {
      setIsLoading(false)
      // Also pull from Firestore in background to get latest data
      if (email) {
        pullFromFirestore(email).then(({ reminders, people }) => {
          if (reminders > 0 || people > 0) {
            loadPersonData() // Reload with fresh data
          }
        }).catch(() => {})
      }
    } else if (email) {
      // Person not in localStorage — try pulling from Firestore first
      pullFromFirestore(email).then(() => {
        if (!loadPersonData()) {
          setError('Person not found')
        }
        setIsLoading(false)
      }).catch(() => {
        setError('Person not found')
        setIsLoading(false)
      })
    } else {
      setError('Person not found')
      setIsLoading(false)
    }
  }, [personId, loadReminders])

  const handleSelectTemplate = (template: CareTemplate, generatedText: string) => {
    setTemplateModal({ template, generatedText })
  }

  const handleEditRelationship = () => {
    setShowEditRelationship(true)
  }

  const handleUpdateRelationship = (relationshipType: RelationshipType, birthday?: string) => {
    if (person) {
      updatePerson(person.id, { relationshipType, birthday }, userEmail || undefined)
      const updated = { ...person, relationshipType, birthday }
      setPerson(updated)
      if (userEmail) syncPersonToFirestore(userEmail, updated)
      setShowEditRelationship(false)
      setStatus('Profile updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const handleSaveEmail = () => {
    if (person) {
      const emailToSave = editingEmail.trim() || undefined
      updatePerson(person.id, { email: emailToSave }, userEmail || undefined)
      const updated = { ...person, email: emailToSave }
      setPerson(updated)
      if (userEmail) syncPersonToFirestore(userEmail, updated)
      setShowEditEmail(false)
      setStatus('Email updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const handleSavePhone = () => {
    if (person) {
      const phoneToSave = editingPhone.trim() || undefined
      updatePerson(person.id, { phone: phoneToSave }, userEmail || undefined)
      const updated = { ...person, phone: phoneToSave }
      setPerson(updated)
      if (userEmail) syncPersonToFirestore(userEmail, updated)
      setShowEditPhone(false)
      setStatus('Phone updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const createReminderWithDate = async (text: string, dateTime: Date, recurrence?: RecurrenceInfo) => {
    if (!person) return
    setAddingReminder(true)
    try {
      let friendlyTitle: string
      try {
        friendlyTitle = await generateTitle(text)
      } catch {
        friendlyTitle = text
      }

      const id = Date.now().toString()
      const phoneNumber = person.phone ? person.phone.replace(/[^0-9+]/g, '') : undefined
      const message = friendlyTitle
      // For birthdays/anniversaries: calendar event + display on actual date,
      // notification fires 1 day before
      const triggerAt = (recurrence?.isBirthday || recurrence?.isAnniversary)
        ? new Date(dateTime.getTime() - 24 * 60 * 60 * 1000).getTime()
        : dateTime.getTime()
      const whatsappLink = phoneNumber
        ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hey!')}`
        : undefined

      const newReminder: Reminder = {
        id,
        text: friendlyTitle,
        date: dateTime,
        isCompleted: false,
        message,
        personName: person.name,
        phoneNumber,
        whatsappLink,
        triggerAt,
        createdAt: Date.now(),
        triggered: false,
      }

      const allReminders = loadReminders()
      const updatedReminders = [newReminder, ...allReminders]
      saveReminders(updatedReminders)

      linkReminderToPerson(person.id, id, userEmail || undefined)
      if (userEmail) syncReminderToFirestore(userEmail, newReminder)
      setReminders(prev => [newReminder, ...prev])

      if (isSignedIn()) {
        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
        })

        if (result?.id) {
          const calFields = {
            calendarEventId: result.id,
            calendarHtmlLink: result.htmlLink || undefined,
            lastSyncedAt: Date.now(),
            originalStartTime: result.start?.dateTime || undefined,
          }
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, ...calFields } : r
          )
          saveReminders(updated)
          setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, ...calFields } : r
          ))
        }
        setStatus('Reminder created')
      } else {
        setStatus('Saved locally')
      }

      setNewReminderText('')
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      console.error('Error adding reminder:', err)
      setStatus('Failed to create reminder')
      setTimeout(() => setStatus(null), 2000)
    } finally {
      setAddingReminder(false)
    }
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReminderText.trim() || !person || addingReminder) return

    const parsed = parseReminder(newReminderText.trim())

    if (parsed.date) {
      await createReminderWithDate(newReminderText.trim(), parsed.date, parsed.recurrence)
    } else {
      // No date found — open date picker
      setPendingProfileReminder(newReminderText.trim())
    }
  }

  const handleProfileDatePicked = (date: Date) => {
    if (pendingProfileReminder) {
      createReminderWithDate(pendingProfileReminder, date)
      setPendingProfileReminder(null)
    }
  }

  const handleDeleteProfile = () => {
    if (person) {
      deletePerson(person.id, userEmail || undefined)
      if (userEmail) deletePersonFromFirestore(userEmail, person.id)
      router.push('/')
    }
  }

  const handleDeleteReminder = async (id: string) => {
    const reminder = reminders.find(r => r.id === id)

    if (reminder?.calendarEventId && isSignedIn()) {
      try {
        setStatus('Removing from calendar...')
        await deleteCalendarEvent(reminder.calendarEventId)
        setStatus('Removed from calendar')
        setTimeout(() => setStatus(null), 2000)
      } catch {
        setStatus('Removed locally')
        setTimeout(() => setStatus(null), 2000)
      }
    }

    const allReminders = loadReminders()
    const updatedReminders = allReminders.filter((r: Reminder) => r.id !== id)
    saveReminders(updatedReminders)
    setReminders(prev => prev.filter(r => r.id !== id))
    if (userEmail) deleteReminderFromFirestore(userEmail, id)
  }

  const handleEditProfileReminder = async (id: string, text: string, date: Date) => {
    setEditingProfileReminder(null)
    const reminder = reminders.find(r => r.id === id)
    if (!reminder) return
    const updated: Reminder = { ...reminder, text, date, triggerAt: date.getTime() }
    const allReminders = loadReminders()
    const updatedAll = allReminders.map((r: Reminder) => r.id === id ? updated : r)
    saveReminders(updatedAll)
    setReminders(prev => prev.map(r => r.id === id ? updated : r))
    if (userEmail) syncReminderToFirestore(userEmail, updated)
    if (reminder.calendarEventId && isSignedIn()) {
      try {
        await updateCalendarEvent(reminder.calendarEventId, { title: text, date: date.toISOString() })
        setStatus('Reminder updated')
      } catch {
        setStatus('Updated locally (calendar sync failed)')
      }
    } else {
      setStatus('Reminder updated')
    }
    setTimeout(() => setStatus(null), 2000)
  }

  const handleConfirmTemplate = async (data: {
    reminderText: string
    date: string
    time: string
    isRecurring: boolean
    recurrenceType: string | null
    recurrenceInterval: number
    addMeetLink?: boolean
  }) => {
    if (!person) return

    try {
      const dateTime = new Date(`${data.date}T${data.time}`)
      const friendlyTitle = await generateTitle(data.reminderText)

      const id = Date.now().toString()
      const phoneNumber = person.phone ? person.phone.replace(/[^0-9+]/g, '') : undefined
      const message = friendlyTitle
      const triggerAt = dateTime.getTime()
      const whatsappLink = phoneNumber
        ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hey!')}`
        : undefined

      const newReminder: Reminder = {
        id,
        text: friendlyTitle,
        date: dateTime,
        isCompleted: false,
        isRecurring: data.isRecurring,
        message,
        personName: person.name,
        phoneNumber,
        whatsappLink,
        triggerAt,
        createdAt: Date.now(),
        triggered: false,
      }

      const allReminders = loadReminders()
      const updatedReminders = [newReminder, ...allReminders]
      saveReminders(updatedReminders)

      linkReminderToPerson(person.id, id, userEmail || undefined)
      if (userEmail) syncReminderToFirestore(userEmail, newReminder)
      setReminders(prev => [newReminder, ...prev])

      if (isSignedIn()) {
        const recurrenceOptions: RecurrenceOptions | undefined = data.isRecurring && data.recurrenceType ? {
          type: data.recurrenceType as 'weekly' | 'monthly' | 'yearly',
          isBirthday: false,
          isAnniversary: false,
          endDate: null,
          interval: data.recurrenceInterval
        } : undefined

        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
          recurrence: recurrenceOptions,
          addMeetLink: data.addMeetLink,
          attendeeEmail: data.addMeetLink ? person.email : undefined
        })

        if (result?.id) {
          const calFields = {
            calendarEventId: result.id,
            calendarHtmlLink: result.htmlLink || undefined,
            lastSyncedAt: Date.now(),
            originalStartTime: result.start?.dateTime || undefined,
          }
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, ...calFields } : r
          )
          saveReminders(updated)
          setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, ...calFields } : r
          ))
        }

        const statusMsg = data.addMeetLink
          ? 'Reminder created with Google Meet link' + (person.email ? ` (invite sent to ${person.email})` : '')
          : 'Reminder created'
        setStatus(statusMsg)
        setTimeout(() => setStatus(null), 3000)
      } else {
        setStatus('Saved locally')
        setTimeout(() => setStatus(null), 2000)
      }

      setTemplateModal(null)
    } catch (err) {
      console.error('Error creating reminder from template:', err)
      setError('Failed to create reminder')
      setStatus(null)
    }
  }

  const formatDate = (date: Date) => sharedFormatDate(date, new Date())

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center p-8 animate-fade-up">
          <p className="text-terra/60 mb-6 text-base font-light">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blush-pale text-terra rounded-pill text-sm font-medium
                       hover:bg-blush-light transition-all duration-200 active:scale-95"
          >
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !person) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-terra/40 text-sm font-light animate-pulse-soft">Loading…</div>
      </div>
    )
  }

  const now = new Date()
  // History is purely date-based - no isCompleted check
  const upcomingReminders = reminders
    .filter(r => r.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const pastReminders = reminders
    .filter(r => r.date < now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const displayedReminders = activeTab === 'upcoming' ? upcomingReminders : pastReminders

  return (
    <main className="min-h-screen bg-cream">

      {/* Header */}
      <div className="bg-white border-b border-blush-light/50">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 md:px-14 py-6 sm:py-8">

          {/* Back */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-terra/60 hover:text-terra mb-8 transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-light">Back</span>
          </button>

          {/* Profile identity */}
          <div className="flex items-start gap-5 sm:gap-7">
            {/* Initial circle */}
            <div className="flex-shrink-0 w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-blush-pale
                            flex items-center justify-center text-terra font-semibold text-lg sm:text-xl">
              {person.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-semibold text-[#2D1810] tracking-tight leading-tight">
                {person.name}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blush-pale rounded-pill
                                 text-xs font-medium text-terra-deep">
                  {RELATIONSHIP_EMOJI[person.relationshipType]}&nbsp;{RELATIONSHIP_LABELS[person.relationshipType]}
                </span>
                {person.birthday && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blush-pale rounded-pill
                                   text-xs font-medium text-terra-deep">
                    🎂&nbsp;{new Date(person.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <span className="text-xs text-terra/35 font-light">
                  {upcomingReminders.length} upcoming · {pastReminders.length} past
                </span>
              </div>

              {/* Contact + actions row */}
              <div className="flex flex-wrap gap-2 mt-4">
                {/* Email */}
                {showEditEmail ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blush-pale rounded-pill">
                    <input
                      type="email"
                      value={editingEmail}
                      onChange={(e) => setEditingEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="text-xs bg-transparent text-terra-deep placeholder:text-terra/40
                                 focus:outline-none w-44"
                      autoFocus
                    />
                    <button onClick={handleSaveEmail}
                      className="text-xs font-medium text-terra hover:text-terra-deep transition-colors">Save</button>
                    <button onClick={() => { setShowEditEmail(false); setEditingEmail(person.email || '') }}
                      className="text-xs text-terra/40 hover:text-terra/60 transition-colors">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setShowEditEmail(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-light
                               bg-blush-pale text-terra hover:bg-blush-light transition-all duration-200">
                    📧 {person.email || 'Add email'}
                  </button>
                )}

                {/* Phone */}
                {showEditPhone ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blush-pale rounded-pill">
                    <input
                      type="tel"
                      value={editingPhone}
                      onChange={(e) => setEditingPhone(e.target.value)}
                      placeholder="919962593404 (no spaces or + symbol)"
                      className="text-xs bg-transparent text-terra-deep placeholder:text-terra/40
                                 focus:outline-none w-48"
                      autoFocus
                    />
                    <button onClick={handleSavePhone}
                      className="text-xs font-medium text-terra hover:text-terra-deep transition-colors">Save</button>
                    <button onClick={() => { setShowEditPhone(false); setEditingPhone(person.phone || '') }}
                      className="text-xs text-terra/40 hover:text-terra/60 transition-colors">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setShowEditPhone(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-light
                               bg-blush-pale text-terra hover:bg-blush-light transition-all duration-200">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {person.phone || 'Add phone'}
                  </button>
                )}

                <button onClick={handleEditRelationship}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-light
                             bg-blush-pale text-terra hover:bg-blush-light transition-all duration-200">
                  ✏️ Edit
                </button>

                <button onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-light
                             bg-blush-pale text-terra/60 hover:bg-blush-light hover:text-terra transition-all duration-200">
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status toast */}
      {status && (
        <div className="max-w-5xl mx-auto px-5 sm:px-8 md:px-14 pt-4">
          <div className="animate-scale-in text-center">
            <span className="inline-block text-xs text-terra-deep/80 font-light
                             bg-blush-pale px-5 py-2.5 rounded-pill border border-blush-light">
              {status}
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 md:px-14 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">

          {/* Care actions — first on mobile, right on desktop */}
          <div className="order-1 lg:order-2 lg:col-span-1">
            <div className="lg:sticky lg:top-8 space-y-4">
              <CareActionsPanel
                personName={person.name}
                relationshipType={person.relationshipType}
                birthday={person.birthday}
                onSelectTemplate={handleSelectTemplate}
                onEditRelationship={handleEditRelationship}
              />
              {!person.email && (
                <div className="px-4 py-3.5 bg-blush-pale rounded-2xl border border-blush-light">
                  <p className="text-xs text-terra-deep/70 leading-relaxed font-light">
                    Add {person.name}&apos;s email to send calendar invites with Google Meet links.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reminders — second on mobile, left on desktop */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-5">

            {/* Add reminder input */}
            <form onSubmit={handleAddReminder}>
              <div className="flex items-center gap-3 px-5 py-4 bg-blush-pale rounded-pill
                              border-2 border-transparent focus-within:border-terra/25
                              transition-all duration-300 focus-within:shadow-[0_4px_20px_rgba(212,117,106,0.12)]">
                <input
                  type="text"
                  value={newReminderText}
                  onChange={(e) => setNewReminderText(e.target.value)}
                  placeholder={`Add a reminder for ${person.name}…`}
                  className="flex-1 min-w-0 bg-transparent text-sm text-terra-deep font-light
                             placeholder:text-terra/45 focus:outline-none focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={!newReminderText.trim() || addingReminder}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                              transition-all duration-200 active:scale-90
                              ${newReminderText.trim() && !addingReminder
                                ? 'bg-terra text-white hover:bg-terra-deep shadow-[0_3px_10px_rgba(212,117,106,0.35)]'
                                : 'bg-terra/20 text-terra/40 cursor-not-allowed'
                              }`}
                  aria-label="Add reminder"
                >
                  {addingReminder ? (
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </form>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-blush-pale rounded-pill w-fit">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-4 py-2 rounded-pill text-xs font-medium transition-all duration-200 ${
                  activeTab === 'upcoming'
                    ? 'bg-terra text-white shadow-sm'
                    : 'text-terra/60 hover:text-terra'
                }`}
              >
                Upcoming ({upcomingReminders.length})
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`px-4 py-2 rounded-pill text-xs font-medium transition-all duration-200 ${
                  activeTab === 'past'
                    ? 'bg-terra text-white shadow-sm'
                    : 'text-terra/60 hover:text-terra'
                }`}
              >
                History ({pastReminders.length})
              </button>
            </div>

            {/* Reminder cards */}
            {displayedReminders.length === 0 ? (
              <div className="py-12 text-center animate-fade-in">
                <p className="text-terra/40 text-sm font-light">
                  {activeTab === 'upcoming' ? 'No upcoming reminders' : 'No past reminders yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedReminders.map((reminder, index) => (
                  <div
                    key={reminder.id}
                    className={`group bg-white rounded-2xl px-5 py-4
                               border border-blush-light/60
                               shadow-[0_2px_12px_rgba(212,117,106,0.06)]
                               hover:shadow-[0_6px_24px_rgba(212,117,106,0.12)]
                               hover:-translate-y-0.5
                               transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                               animate-fade-up
                               ${activeTab === 'past' ? 'opacity-60' : ''}`}
                    style={{ animationDelay: `${index * 55}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[#2D1810] font-medium text-sm leading-snug
                                      ${activeTab === 'past' ? 'line-through text-terra/50' : ''}`}>
                          {reminder.text}
                          {reminder.isRecurring && (
                            <span className="ml-1.5 text-sm">
                              {reminder.isBirthday ? '🎂' : reminder.isAnniversary ? '💝' : '🔄'}
                            </span>
                          )}
                        </p>
                        <p className="text-terra/45 text-xs mt-1 font-light">
                          {formatDate(reminder.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {reminder.calendarHtmlLink && (
                          <a
                            href={reminder.calendarHtmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-terra/35 hover:text-terra rounded-xl
                                       hover:bg-blush-pale transition-all duration-150"
                            title="Open in Google Calendar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </a>
                        )}
                        {activeTab === 'upcoming' && (
                          <button
                            onClick={() => setEditingProfileReminder(reminder)}
                            className="p-1.5 text-terra/35 hover:text-terra rounded-xl
                                       hover:bg-blush-pale transition-all duration-150"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        <WhatsAppButton phone={(reminder.phoneNumber || person.phone || '').replace(/[^0-9]/g, '')} />
                        <button
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="p-1.5 text-terra/35 hover:text-red-400 rounded-xl
                                     hover:bg-red-50 transition-all duration-150"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Confirmation Modal */}
      {templateModal && (
        <TemplateConfirmationModal
          template={templateModal.template}
          generatedText={templateModal.generatedText}
          personName={person.name}
          birthday={person.birthday}
          personEmail={person.email}
          onConfirm={handleConfirmTemplate}
          onCancel={() => setTemplateModal(null)}
        />
      )}

      {/* Edit Relationship Modal */}
      {showEditRelationship && (
        <RelationshipTypeModal
          personName={person.name}
          onConfirm={handleUpdateRelationship}
          onCancel={() => setShowEditRelationship(false)}
        />
      )}

      {/* Date Picker for new profile reminder */}
      {pendingProfileReminder && (
        <DatePickerModal
          text={pendingProfileReminder}
          onConfirm={handleProfileDatePicked}
          onCancel={() => setPendingProfileReminder(null)}
        />
      )}

      {/* Edit Reminder Modal */}
      {editingProfileReminder && (
        <EditReminderModal
          reminder={editingProfileReminder}
          onConfirm={handleEditProfileReminder}
          onCancel={() => setEditingProfileReminder(null)}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in"
               onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full mx-4 animate-scale-in">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-[#2D1810]">Delete profile?</h3>
              <p className="text-terra/60 text-sm font-light leading-relaxed">
                This will permanently delete {person.name}&apos;s profile. This cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 px-4 rounded-pill text-sm font-medium text-terra/70
                             bg-blush-pale hover:bg-blush-light transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  className="flex-1 py-3 px-4 bg-terra text-white rounded-pill text-sm font-medium
                             hover:bg-terra-deep transition-all active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
