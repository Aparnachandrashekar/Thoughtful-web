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

  // Default end date to 5 years from now
  const defaultEndDate = () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 5)
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-in">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Set Recurrence End
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          This is a {getTypeLabel()} event. When should it stop repeating?
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-lavender transition-colors">
            <input
              type="radio"
              name="recurrenceEnd"
              checked={selectedOption === 'forever'}
              onChange={() => setSelectedOption('forever')}
              className="w-4 h-4 text-lavender"
            />
            <span className="text-gray-700">Repeat forever</span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-lavender transition-colors">
            <input
              type="radio"
              name="recurrenceEnd"
              checked={selectedOption === 'date'}
              onChange={() => setSelectedOption('date')}
              className="w-4 h-4 text-lavender"
            />
            <span className="text-gray-700">End on specific date</span>
          </label>

          {selectedOption === 'date' && (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-lavender focus:outline-none text-gray-700"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 text-white bg-purple-600 rounded-xl hover:bg-purple-700 font-bold transition-colors shadow-md"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
