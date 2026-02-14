'use client'

import { useState } from 'react'

interface DatePickerModalProps {
  text: string
  onConfirm: (date: Date) => void
  onCancel: () => void
}

export default function DatePickerModal({ text, onConfirm, onCancel }: DatePickerModalProps) {
  const now = new Date()
  const defaultDate = now.toISOString().slice(0, 10)
  const defaultTime = '08:00'

  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultTime)

  const handleConfirm = () => {
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = time.split(':').map(Number)
    const selected = new Date(year, month - 1, day, hours, minutes)
    onConfirm(selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm mx-4 animate-slide-up">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          When should we remind you?
        </h3>
        <p className="text-sm text-gray-500 mb-5 line-clamp-2">
          &ldquo;{text}&rdquo;
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-lavender/50 rounded-xl
                         focus:border-lavender focus:outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 border-2 border-lavender/50 rounded-xl
                         focus:border-lavender focus:outline-none text-gray-800"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-gray-600 bg-sand rounded-xl
                       font-medium hover:bg-sand/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 text-white bg-purple-600 rounded-xl
                       font-bold hover:bg-purple-700 transition-colors active:scale-95 shadow-md"
          >
            Set Reminder
          </button>
        </div>
      </div>
    </div>
  )
}
