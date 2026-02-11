'use client'

import { useState } from 'react'
import { CareTemplate } from '@/lib/types'

interface TemplateConfirmationModalProps {
  template: CareTemplate
  generatedText: string
  personName: string
  onConfirm: (data: {
    reminderText: string
    date: string
    time: string
    isRecurring: boolean
    recurrencePattern: string | null
  }) => void
  onCancel: () => void
}

export default function TemplateConfirmationModal({
  template,
  generatedText,
  personName,
  onConfirm,
  onCancel
}: TemplateConfirmationModalProps) {
  // Calculate default date based on template
  const getDefaultDate = () => {
    const date = new Date()

    // For weekly catch-up, default to next week
    if (template.id === 'weekly-catchup') {
      date.setDate(date.getDate() + 7)
    }
    // For monthly check-in, default to next month
    else if (template.id === 'monthly-checkin') {
      date.setMonth(date.getMonth() + 1)
    }
    // For birthday gift, leave as today (user should set actual birthday)

    return date.toISOString().split('T')[0]
  }

  const [editedText, setEditedText] = useState(generatedText)
  const [date, setDate] = useState(getDefaultDate())
  const [time, setTime] = useState('09:00')
  const [isRecurring, setIsRecurring] = useState(!!template.recurrence)
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'monthly' | 'yearly'>(template.recurrence || 'weekly')
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    onConfirm({
      reminderText: editedText,
      date,
      time,
      isRecurring,
      recurrencePattern: isRecurring ? recurrencePattern : null
    })
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-800">
              Create Reminder
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {template.label} for {personName}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reminder text
              </label>
              <input
                type="text"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender focus:border-lavender outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender focus:border-lavender outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(date)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender focus:border-lavender outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 text-lavender focus:ring-lavender border-gray-300 rounded"
                />
                <label htmlFor="recurring" className="text-sm text-gray-700">
                  Make this recurring
                </label>
              </div>

              {isRecurring && (
                <select
                  value={recurrencePattern}
                  onChange={(e) => setRecurrencePattern(e.target.value as 'weekly' | 'monthly' | 'yearly')}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender focus:border-lavender outline-none transition-all"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl text-gray-700 hover:border-gray-300 font-medium text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !editedText.trim()}
              className="flex-1 py-2.5 px-4 bg-lavender text-gray-800 rounded-xl hover:bg-lavender/80 font-medium text-sm disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
