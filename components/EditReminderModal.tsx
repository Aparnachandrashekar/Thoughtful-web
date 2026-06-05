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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in p-4">
      <div className="bg-page rounded-card shadow-card p-6 w-full max-w-sm max-h-[86vh] overflow-y-auto font-outfit animate-fade-in">

        <h3 className="text-lg font-semibold text-ink mb-1">Edit reminder</h3>
        <p className="text-xs text-ink-muted font-light mb-5">Update the title, date, or time.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted uppercase tracking-[0.12em] mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 border border-accent/20 focus:border-accent/40
                         rounded-card outline-none text-ink text-sm font-light bg-surface"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted uppercase tracking-[0.12em] mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border border-accent/20 focus:border-accent/40
                         rounded-card outline-none text-ink text-sm bg-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted uppercase tracking-[0.12em] mb-1.5">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 border border-accent/20 focus:border-accent/40
                         rounded-card outline-none text-ink text-sm bg-surface"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-surface text-ink-muted rounded-card
                       text-sm font-medium hover:bg-surface-soft transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!text.trim()}
            className="flex-1 px-4 py-3 text-white bg-accent rounded-card
                       text-sm font-medium hover:bg-accent-hover transition-all duration-200
                       active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
        </div>

      </div>
    </div>
  )
}
