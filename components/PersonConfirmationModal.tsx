'use client'

import { DetectedName } from '@/lib/types'

interface PersonConfirmationModalProps {
  detectedName: DetectedName
  onConfirm: () => void
  onDeny: () => void
  isLoading?: boolean
}

export default function PersonConfirmationModal({
  detectedName,
  onConfirm,
  onDeny,
  isLoading = false
}: PersonConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onDeny}
      />

      <div className="relative bg-page rounded-card shadow-card p-6 max-w-sm w-full max-h-[86vh] overflow-y-auto animate-fade-in font-outfit">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-surface rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink">
              Is this about {detectedName.name}?
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              We&apos;ll create a profile for {detectedName.name} so you can track all your
              reminders about them in one place.
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              onClick={onDeny}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 border border-accent/20 rounded-card text-ink-muted hover:bg-surface font-medium text-sm transition-all disabled:opacity-50"
            >
              No
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-accent text-white rounded-card hover:bg-accent-hover font-medium text-sm transition-all disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Yes, create profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
