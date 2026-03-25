'use client'

import { useState } from 'react'
import { getDateBounds } from '@/lib/dateFormat'

interface DatePickerModalProps {
  text: string
  onConfirm: (date: Date) => void
  onCancel: () => void
}

// Format a Date to the "YYYY-MM-DDTHH:mm" local-time string required by datetime-local inputs
function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DatePickerModal({ text, onConfirm, onCancel }: DatePickerModalProps) {
  const tenMinsFromNow = new Date(Date.now() + 10 * 60 * 1000)
  const { min: minDate, max: maxDate } = getDateBounds()

  const [datetime, setDatetime] = useState(toLocalDatetimeString(tenMinsFromNow))
  const previewText = text.length > 40 ? text.slice(0, 40) + '…' : text

  const handleConfirm = () => {
    // datetime-local value is local time — new Date() treats no-timezone strings as local
    onConfirm(new Date(datetime))
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Bottom sheet — max-h prevents overflow when native picker expands */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl
                   max-h-[85vh] overflow-y-auto animate-slide-up"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-terra/20" />
        </div>

        <div className="px-6 pt-4 pb-6">
          <h3 className="text-lg font-semibold text-[#2D1810] mb-1">
            When should we remind you?
          </h3>
          <p className="text-sm text-terra/45 font-light mb-6 leading-snug">
            &ldquo;{previewText}&rdquo;
          </p>

          {/* Single datetime-local input — avoids two-input overflow on mobile */}
          <label className="block text-xs font-semibold text-terra/50 uppercase tracking-widest mb-2">
            Date &amp; Time
          </label>
          <input
            type="datetime-local"
            value={datetime}
            min={`${minDate}T00:00`}
            max={`${maxDate}T23:59`}
            onChange={(e) => setDatetime(e.target.value)}
            className="w-full px-4 py-4 border-2 border-blush-light focus:border-terra/40
                       rounded-2xl outline-none text-terra-deep text-base font-light bg-white"
          />

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-4 bg-blush-pale text-terra/70 rounded-pill
                         text-sm font-medium active:bg-blush-light transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-4 text-white bg-terra rounded-pill
                         text-sm font-medium active:scale-95 transition-all duration-200
                         shadow-[0_4px_12px_rgba(212,117,106,0.3)]"
            >
              Set Reminder
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
