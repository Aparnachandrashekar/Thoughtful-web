'use client'

import { useState } from 'react'

const Icon = () => (
  <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

interface WhatsAppButtonProps {
  phone: string
  className?: string
}

export default function WhatsAppButton({ phone, className = '' }: WhatsAppButtonProps) {
  const baseClass =
    'p-2 rounded-lg text-ink-faint hover:text-ink hover:bg-white/70 transition-all duration-150'
  const [showToast, setShowToast] = useState(false)

  if (!phone) {
    const handleClick = () => {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
    }

    return (
      <div className="relative">
        <button onClick={handleClick} className={`${baseClass} ${className}`} title="WhatsApp">
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
      className={`${baseClass} inline-flex items-center justify-center ${className}`}
      title="Send via WhatsApp"
    >
      <Icon />
    </a>
  )
}
