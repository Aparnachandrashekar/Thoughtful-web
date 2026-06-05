'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getDateBounds } from '@/lib/dateFormat'

interface DatePickerModalProps {
  text: string
  onConfirm: (date: Date) => void
  onCancel: () => void
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DatePickerModal({ text, onConfirm, onCancel }: DatePickerModalProps) {
  const [mounted, setMounted] = useState(false)
  const tenMinsFromNow = new Date(Date.now() + 10 * 60 * 1000)
  const { min: minDate, max: maxDate } = getDateBounds()
  const [datetime, setDatetime] = useState(toLocalDatetimeString(tenMinsFromNow))
  const previewText = text.length > 40 ? text.slice(0, 40) + '…' : text

  useEffect(() => { setMounted(true); return () => setMounted(false) }, [])

  if (!mounted) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-5 pointer-events-none"
      >
        <div
          className="w-full max-w-[360px] max-h-[86vh] overflow-y-auto bg-page rounded-card shadow-card pointer-events-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-6 font-outfit">
            <h3 className="text-lg font-semibold text-ink mb-1">
              When should we remind you?
            </h3>
            <p className="text-sm text-ink-muted font-light mb-5 leading-snug">
              &ldquo;{previewText}&rdquo;
            </p>

            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2">
              Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={datetime}
              min={`${minDate}T00:00`}
              max={`${maxDate}T23:59`}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full px-4 py-3 border border-accent/20 focus:border-accent/40
                         rounded-card outline-none text-ink text-sm font-light bg-surface"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 bg-surface text-ink-muted rounded-card
                           text-sm font-medium hover:bg-surface-soft transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(new Date(datetime))}
                className="flex-1 px-4 py-3 text-white bg-accent rounded-card
                           text-sm font-medium hover:bg-accent-hover active:scale-95 transition-all duration-200"
              >
                Set Reminder
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
