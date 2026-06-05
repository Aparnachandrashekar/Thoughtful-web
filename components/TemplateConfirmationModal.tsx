'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CareTemplate } from '@/lib/types'
import { getRecurrenceLabel, calculateNextReminderDate, getRecurrenceInterval } from '@/lib/templates'
import TemplateOutlineIcon from '@/components/TemplateOutlineIcon'

interface TemplateConfirmationModalProps {
  template: CareTemplate
  generatedText: string
  personName: string
  birthday?: string
  personEmail?: string
  onConfirm: (data: {
    reminderText: string
    date: string
    time: string
    isRecurring: boolean
    recurrenceType: string | null
    recurrenceInterval: number
    addMeetLink?: boolean
  }) => void
  onCancel: () => void
}

export default function TemplateConfirmationModal({
  template,
  generatedText,
  personName,
  birthday,
  personEmail,
  onConfirm,
  onCancel
}: TemplateConfirmationModalProps) {
  const nextDate = calculateNextReminderDate(template, birthday)

  const [editedText, setEditedText] = useState(generatedText)
  const [date, setDate] = useState(nextDate.toISOString().split('T')[0])
  const [time, setTime] = useState('09:00')
  const [isRecurring, setIsRecurring] = useState(!!template.recurrence)
  const [addMeetLink, setAddMeetLink] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const recurrenceInfo = getRecurrenceInterval(template.recurrence)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); return () => setMounted(false) }, [])

  const handleConfirm = () => {
    setIsLoading(true)
    onConfirm({
      reminderText: editedText,
      date,
      time,
      isRecurring,
      recurrenceType: isRecurring && recurrenceInfo ? recurrenceInfo.type : null,
      recurrenceInterval: recurrenceInfo?.interval || 1,
      addMeetLink
    })
  }

  const formatDatePreview = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 font-outfit">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />

      <div className="absolute inset-0 flex items-center justify-center px-5 pointer-events-none">
        <div
          className="flex flex-col overflow-hidden w-full max-w-[400px] max-h-[86vh] bg-page rounded-card shadow-card pointer-events-auto"
        >
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            <div className="text-center">
              <div className="inline-flex items-center justify-center mb-3">
                <TemplateOutlineIcon templateId={template.id} className="text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Create Reminder</h3>
              <p className="text-sm text-ink-muted mt-1 font-light">
                {template.label} for {personName}
              </p>
            </div>

            <div className="bg-surface rounded-card p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-muted uppercase tracking-[0.12em]">
                  Reminder
                </label>
                <input
                  type="text"
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2.5 bg-page border border-accent/20
                             focus:border-accent/40 rounded-card outline-none text-sm text-ink font-light"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-muted uppercase tracking-[0.12em]">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2.5 bg-page border border-accent/20
                               focus:border-accent/40 rounded-card outline-none text-sm text-ink"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-muted uppercase tracking-[0.12em]">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2.5 bg-page border border-accent/20
                               focus:border-accent/40 rounded-card outline-none text-sm text-ink"
                  />
                </div>
              </div>

              <p className="text-xs text-ink-muted font-light">{formatDatePreview(date)}</p>
            </div>

            {template.recurrence && (
              <div className="flex items-center gap-3 px-4 py-3 bg-surface rounded-card">
                <span className="text-base">🔄</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded accent-accent"
                    />
                    <label htmlFor="recurring" className="text-sm font-medium text-ink">
                      Repeat {getRecurrenceLabel(template.recurrence).toLowerCase()}
                    </label>
                  </div>
                  {isRecurring && (
                    <p className="text-xs text-ink-muted mt-1 ml-6 font-light">
                      This reminder will automatically recur
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 px-4 py-3 bg-surface rounded-card">
              <span className="text-base">📹</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="meetLink"
                    checked={addMeetLink}
                    onChange={(e) => setAddMeetLink(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent"
                  />
                  <label htmlFor="meetLink" className="text-sm font-medium text-ink">
                    Add Google Meet link
                  </label>
                </div>
                {addMeetLink && (
                  <p className="text-xs text-ink-muted mt-1 ml-6 font-light">
                    {personEmail
                      ? `Invite will be sent to ${personEmail}`
                      : `Add ${personName}'s email to send invite`}
                  </p>
                )}
              </div>
            </div>

            <div className="text-center text-xs text-ink-muted font-light py-1 border-t border-accent/10">
              {isRecurring ? (
                <p>
                  First on <span className="font-medium text-ink">{formatDatePreview(date)}</span>,
                  <br />then {getRecurrenceLabel(template.recurrence).toLowerCase()}
                </p>
              ) : (
                <p>One-time on <span className="font-medium text-ink">{formatDatePreview(date)}</span></p>
              )}
            </div>

          </div>

          <div
            className="flex gap-3 px-5 py-4 border-t border-accent/10 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-surface text-ink-muted rounded-card text-sm font-medium
                         hover:bg-surface-soft transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !editedText.trim()}
              className="flex-1 py-3 px-4 bg-accent text-white rounded-card text-sm font-medium
                         hover:bg-accent-hover transition-all duration-200 active:scale-95
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating…' : 'Create Reminder'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
