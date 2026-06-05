'use client'

import { useState } from 'react'

/** Recognizable WhatsApp-style outline icon */
const Icon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 2C6.48 2 2 6.15 2 11.25c0 1.82.49 3.53 1.35 5L2 22l5.9-1.28A9.77 9.77 0 0012 20.5c5.52 0 10-4.15 10-9.25S17.52 2 12 2z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.5 10.5c.35.95 1.4 2.05 2.55 2.55.75.35 1.25.5 1.65.35.4-.15.95-.6 1.15-.75.2-.15.35-.1.5.05l.95 1.05c.15.15.1.35-.05.5-.2.2-.75.75-1.05.95-.3.2-.65.35-1.15.2-.95-.3-2.35-1.15-3.25-2.35-1.15-1.5-1.55-2.75-1.55-3.45 0-.55.15-.85.4-1.1.2-.2.45-.55.65-.75.15-.15.35-.1.5.05l.7.65c.15.15.15.35.05.5-.15.25-.35.55-.5.75-.1.15-.05.3.05.45z"
    />
  </svg>
)

interface WhatsAppButtonProps {
  phone: string
  className?: string
}

export default function WhatsAppButton({ phone, className = '' }: WhatsAppButtonProps) {
  const baseClass =
    'p-1.5 sm:p-2 rounded-lg text-ink-faint hover:text-[#25D366] hover:bg-white/70 transition-all duration-150'
  const [showToast, setShowToast] = useState(false)

  if (!phone) {
    const handleClick = () => {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          className={`${baseClass} ${className}`}
          title="Save a phone number to enable WhatsApp"
          aria-label="WhatsApp — save a phone number in profile"
        >
          <Icon />
        </button>
        {showToast && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 text-center
                          text-xs bg-ink text-white px-3 py-2 rounded-card shadow-card-hover
                          pointer-events-none z-50 leading-snug animate-fade-in"
          >
            Save a number in their profile to enable WhatsApp
          </div>
        )}
      </div>
    )
  }

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent('Hey!')}`

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} inline-flex items-center justify-center text-[#25D366]/80 hover:text-[#25D366] ${className}`}
      title="Send via WhatsApp"
      aria-label="Open WhatsApp chat"
    >
      <Icon />
    </a>
  )
}
