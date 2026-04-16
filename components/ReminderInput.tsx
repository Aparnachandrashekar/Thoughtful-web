'use client'

import { useState } from 'react'

interface ReminderInputProps {
  onSubmit: (text: string) => void
}

export default function ReminderInput({ onSubmit }: ReminderInputProps) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      onSubmit(text.trim())
      setText('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full animate-fade-up delay-200">
      <div
        className={`
          flex items-center gap-3 px-6 sm:px-8 py-4 sm:py-5
          bg-blush-pale rounded-pill
          border-2 transition-all duration-300
          ${focused
            ? 'border-terra/30 shadow-[0_6px_32px_rgba(212,117,106,0.16)]'
            : 'border-transparent shadow-[0_2px_16px_rgba(212,117,106,0.06)]'
          }
        `}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Type here: Title — Date/Day — Time"
          className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-terra-deep font-light
                     placeholder:text-terra/60 focus:ring-0 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Add reminder"
          className={`
            flex-shrink-0 w-9 h-9 rounded-full
            flex items-center justify-center
            transition-all duration-300
            ${text.trim()
              ? 'bg-terra text-white hover:bg-terra-deep active:scale-90 shadow-[0_4px_12px_rgba(212,117,106,0.35)] animate-scale-in'
              : 'bg-terra/20 text-terra/40 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="mt-3 text-xs sm:text-sm text-terra/65 text-center font-light tracking-widest uppercase">
        Title &nbsp;·&nbsp; Day / Date &nbsp;·&nbsp; Time
      </p>
    </form>
  )
}
