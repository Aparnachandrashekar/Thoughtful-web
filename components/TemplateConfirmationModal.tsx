'use client'

import { useState } from 'react'
import { CareTemplate } from '@/lib/types'
import { getRecurrenceLabel, calculateNextReminderDate, getRecurrenceInterval } from '@/lib/templates'

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-lavender/20 rounded-full mb-3">
              <span className="text-2xl">{template.emoji}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">
              Create Reminder
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {template.label} for {personName}
            </p>
          </div>

          {/* Reminder Preview */}
          <div className="bg-lavender/10 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Reminder
              </label>
              <input
                type="text"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full mt-1 p-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-lavender focus:ring-1 focus:ring-lavender outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-lavender focus:ring-1 focus:ring-lavender outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-lavender focus:ring-1 focus:ring-lavender outline-none text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              {formatDatePreview(date)}
            </p>
          </div>

          {/* Recurrence Info */}
          {template.recurrence && (
            <div className="flex items-center gap-3 p-3 bg-mint/10 rounded-xl">
              <span className="text-lg">🔄</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-lavender rounded border-gray-300 focus:ring-lavender"
                  />
                  <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                    Repeat {getRecurrenceLabel(template.recurrence).toLowerCase()}
                  </label>
                </div>
                {isRecurring && (
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    This reminder will automatically recur
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Google Meet Option */}
          <div className="flex items-center gap-3 p-3 bg-sky/10 rounded-xl">
            <span className="text-lg">📹</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="meetLink"
                  checked={addMeetLink}
                  onChange={(e) => setAddMeetLink(e.target.checked)}
                  className="w-4 h-4 text-lavender rounded border-gray-300 focus:ring-lavender"
                />
                <label htmlFor="meetLink" className="text-sm font-medium text-gray-700">
                  Add Google Meet link
                </label>
              </div>
              {addMeetLink && (
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  {personEmail
                    ? `Invite will be sent to ${personEmail}`
                    : `Add ${personName}'s email to send invite`}
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="text-center text-sm text-gray-500 py-2 border-t border-gray-100">
            {isRecurring ? (
              <p>
                First reminder on <strong>{formatDatePreview(date)}</strong>,
                <br />then {getRecurrenceLabel(template.recurrence).toLowerCase()}
              </p>
            ) : (
              <p>One-time reminder on <strong>{formatDatePreview(date)}</strong></p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !editedText.trim()}
              className="flex-1 py-2.5 px-4 bg-lavender text-gray-800 rounded-xl hover:bg-lavender/80 font-medium text-sm transition-all disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
