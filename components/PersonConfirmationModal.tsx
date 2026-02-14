'use client'

import { DetectedName } from '@/lib/types'

interface PersonConfirmationModalProps {
  detectedName: DetectedName
  onConfirm: () => void
  onDeny: () => void
}

export default function PersonConfirmationModal({
  detectedName,
  onConfirm,
  onDeny
}: PersonConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onDeny}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 animate-fade-in">
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="mx-auto w-12 h-12 bg-lavender/30 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-purple-600"
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

          {/* Question */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Is this about {detectedName.name}?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              We'll create a profile for {detectedName.name} so you can track all your
              reminders about them in one place.
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              onClick={onDeny}
              className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl text-gray-700 hover:border-gray-300 font-medium text-sm transition-all"
            >
              No
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold text-sm transition-all shadow-md"
            >
              Yes, create profile
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
