'use client'

import { useState } from 'react'
import { Reminder } from './ReminderList'
import { getDateBounds } from '@/lib/dateFormat'

interface EditReminderModalProps {
  reminder: Reminder
  onConfirm: (id: string, text: string, date: Date) => void
  onCancel: () => void
}

export default function EditReminderModal({ reminder, onConfirm, onCancel }: EditReminderModalProps) {
  const [text, setText] = useState(reminder.text)
  const [date, setDate] = useState(reminder.date.toISOString().slice(0, 10))
  const [time, setTime] = useState(
    reminder.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  )
  const { min: minDate, max: maxDate } = getDateBounds()

  const handleConfirm = () => {
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = time.split(':').map(Number)
    const newDate = new Date(year, month - 1, day, hours, minutes)
    onConfirm(reminder.id, text.trim() || reminder.text, newDate)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in">
      <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm mx-4 animate-scale-in">

        <h3 className="text-lg font-semibold text-[#2D1810] mb-1">Edit reminder</h3>
        <p className="text-xs text-terra/45 font-light mb-5">Update the title, date, or time.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-terra/45 uppercase tracking-[0.12em] mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blush-light focus:border-terra/40
                         rounded-xl outline-none text-[#2D1810] text-sm font-light"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-terra/45 uppercase tracking-[0.12em] mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blush-light focus:border-terra/40
                         rounded-xl outline-none text-terra-deep text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-terra/45 uppercase tracking-[0.12em] mb-1.5">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blush-light focus:border-terra/40
                         rounded-xl outline-none text-terra-deep text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-blush-pale text-terra/70 rounded-pill
                       text-sm font-medium hover:bg-blush-light transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!text.trim()}
            className="flex-1 px-4 py-3 text-white bg-terra rounded-pill
                       text-sm font-medium hover:bg-terra-deep transition-all duration-200
                       active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-[0_4px_12px_rgba(212,117,106,0.3)]"
          >
            Save changes
          </button>
        </div>

      </div>
    </div>
  )
}
