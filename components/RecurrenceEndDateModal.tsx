'use client'

import { useState } from 'react'

interface RecurrenceEndDateModalProps {
  recurrenceType: string
  patternDescription?: string
  onConfirm: (endDate: Date | null) => void
  onCancel: () => void
}

export default function RecurrenceEndDateModal({
  recurrenceType,
  patternDescription,
  onConfirm,
  onCancel
}: RecurrenceEndDateModalProps) {
  const [selectedOption, setSelectedOption] = useState<'forever' | 'date'>('forever')

  const defaultEndDate = () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  }

  const [endDate, setEndDate] = useState(defaultEndDate())

  const handleConfirm = () => {
    if (selectedOption === 'forever') {
      onConfirm(null)
    } else if (endDate) {
      onConfirm(new Date(endDate))
    }
  }

  const getTypeLabel = () => {
    if (patternDescription) return patternDescription
    switch (recurrenceType) {
      case 'yearly': return 'yearly'
      case 'monthly': return 'monthly'
      case 'weekly': return 'weekly'
      case 'daily': return 'daily'
      default: return 'recurring'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50 font-outfit">
      <div className="bg-page rounded-card p-6 w-full max-w-sm max-h-[86vh] overflow-y-auto shadow-card animate-fade-in">
        <h3 className="text-lg font-semibold text-ink mb-2">
          Set Recurrence End
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          This is a {getTypeLabel()} event. When should it stop repeating?
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-card border border-accent/20 cursor-pointer hover:border-accent/40 transition-colors">
            <input
              type="radio"
              name="recurrenceEnd"
              checked={selectedOption === 'forever'}
              onChange={() => setSelectedOption('forever')}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-ink">Repeat forever</span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-card border border-accent/20 cursor-pointer hover:border-accent/40 transition-colors">
            <input
              type="radio"
              name="recurrenceEnd"
              checked={selectedOption === 'date'}
              onChange={() => setSelectedOption('date')}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-ink">End on specific date</span>
          </label>

          {selectedOption === 'date' && (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-accent/20 rounded-card focus:border-accent/40 focus:outline-none text-ink bg-surface"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-ink-muted bg-surface rounded-card hover:bg-surface-soft transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 text-white bg-accent rounded-card hover:bg-accent-hover font-medium transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
