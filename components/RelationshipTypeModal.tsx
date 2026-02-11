'use client'

import { useState } from 'react'
import { RelationshipType, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'

interface RelationshipTypeModalProps {
  personName: string
  onConfirm: (relationshipType: RelationshipType, birthday?: string) => void
  onCancel: () => void
}

const RELATIONSHIP_OPTIONS: RelationshipType[] = ['family', 'close_friend', 'friend', 'work', 'other']

export default function RelationshipTypeModal({
  personName,
  onConfirm,
  onCancel
}: RelationshipTypeModalProps) {
  const [selectedType, setSelectedType] = useState<RelationshipType | null>(null)
  const [birthday, setBirthday] = useState('')
  const [showBirthday, setShowBirthday] = useState(false)

  const handleConfirm = () => {
    if (selectedType) {
      onConfirm(selectedType, birthday || undefined)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 animate-fade-in">
        <div className="space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-lavender/30 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">👤</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">
              How do you know {personName}?
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              This helps us suggest relevant reminders
            </p>
          </div>

          {/* Relationship Options */}
          <div className="space-y-2">
            {RELATIONSHIP_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                  ${selectedType === type
                    ? 'border-lavender bg-lavender/10'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
              >
                <span className="text-xl">{RELATIONSHIP_EMOJI[type]}</span>
                <span className="font-medium text-gray-700">{RELATIONSHIP_LABELS[type]}</span>
                {selectedType === type && (
                  <svg className="w-5 h-5 text-lavender ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Optional Birthday */}
          {selectedType && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowBirthday(!showBirthday)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span>{showBirthday ? '−' : '+'}</span>
                <span>Add birthday (optional)</span>
              </button>

              {showBirthday && (
                <div className="mt-3">
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-lavender focus:ring-1 focus:ring-lavender outline-none text-sm"
                    placeholder="Birthday"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    We'll remind you before their birthday
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedType}
              className="flex-1 py-2.5 px-4 bg-lavender text-gray-800 rounded-xl hover:bg-lavender/80 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
