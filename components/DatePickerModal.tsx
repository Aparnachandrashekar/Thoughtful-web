'use client'

import { useState } from 'react'
import { getDateBounds } from '@/lib/dateFormat'

interface DatePickerModalProps {
  text: string
  onConfirm: (date: Date) => void
  onCancel: () => void
}

export default function DatePickerModal({ text, onConfirm, onCancel }: DatePickerModalProps) {
  const now = new Date()
  // Default to 10 minutes from now
  const tenMinsFromNow = new Date(now.getTime() + 10 * 60 * 1000)
  const defaultDate = tenMinsFromNow.toISOString().slice(0, 10)
  const defaultTime = `${String(tenMinsFromNow.getHours()).padStart(2, '0')}:${String(tenMinsFromNow.getMinutes()).padStart(2, '0')}`
  const { min: minDate, max: maxDate } = getDateBounds()

  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultTime)
  const previewText = text.length > 40 ? text.slice(0, 40) + '…' : text

  const handleConfirm = () => {
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = time.split(':').map(Number)
    const selected = new Date(year, month - 1, day, hours, minutes)
    onConfirm(selected)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl animate-slide-up"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pt-4">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-terra/20 rounded-full mx-auto mb-5" />

          <h3 className="text-lg font-semibold text-[#2D1810] mb-1">
            When should we remind you?
          </h3>
          <p className="text-sm text-terra/50 mb-5 font-light">
            &ldquo;{previewText}&rdquo;
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-terra/50 uppercase tracking-wider mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-4 border-2 border-blush-light
                           focus:border-terra/40 rounded-xl outline-none text-terra-deep text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-terra/50 uppercase tracking-wider mb-2">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-4 border-2 border-blush-light
                           focus:border-terra/40 rounded-xl outline-none text-terra-deep text-base"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-4 bg-blush-pale text-terra/70 rounded-pill
                         text-sm font-medium hover:bg-blush-light transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-4 text-white bg-terra rounded-pill
                         text-sm font-medium hover:bg-terra-deep transition-all duration-200
                         active:scale-95 shadow-[0_4px_12px_rgba(212,117,106,0.3)]"
            >
              Set Reminder
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
