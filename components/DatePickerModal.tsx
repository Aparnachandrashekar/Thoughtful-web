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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Dialog — outer div anchors left/right to avoid 100vw overflow on iOS */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                 padding: '0 20px', zIndex: 50, pointerEvents: 'none' }}
      >
      <div
        style={{ width: '100%', maxWidth: '360px', background: 'white',
                 borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                 pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-6">
          <h3 className="text-lg font-semibold text-[#2D1810] mb-1">
            When should we remind you?
          </h3>
          <p className="text-sm text-terra/45 font-light mb-5 leading-snug">
            &ldquo;{previewText}&rdquo;
          </p>

          <label className="block text-xs font-semibold text-terra/50 uppercase tracking-widest mb-2">
            Date &amp; Time
          </label>
          <input
            type="datetime-local"
            value={datetime}
            min={`${minDate}T00:00`}
            max={`${maxDate}T23:59`}
            onChange={(e) => setDatetime(e.target.value)}
            className="w-full px-4 py-3 border-2 border-blush-light focus:border-terra/40
                       rounded-2xl outline-none text-terra-deep text-sm font-light bg-white"
          />

          <div className="flex gap-3 mt-5">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-blush-pale text-terra/70 rounded-pill
                         text-sm font-medium active:bg-blush-light transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(new Date(datetime))}
              className="flex-1 px-4 py-3 text-white bg-terra rounded-pill
                         text-sm font-medium active:scale-95 transition-all duration-200
                         shadow-[0_4px_12px_rgba(212,117,106,0.3)]"
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
