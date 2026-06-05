'use client'

interface StatusBannerProps {
  message: string | null
  className?: string
}

/** Centered inline status — e.g. between tagline and input while syncing to calendar */
export default function StatusBanner({ message, className = '' }: StatusBannerProps) {
  if (!message) return null

  return (
    <p
      role="status"
      aria-live="polite"
      className={[
        'text-center font-outfit text-body text-ink font-medium',
        'bg-surface px-5 py-2.5 rounded-card shadow-card',
        'border border-accent/15 animate-fade-in',
        'max-w-[min(100%,20rem)]',
        className,
      ].join(' ')}
    >
      {message}
    </p>
  )
}
