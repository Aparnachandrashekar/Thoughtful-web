'use client'

import { useState } from 'react'
import { RelationshipType, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'

interface RelationshipTypeModalProps {
  personName: string
  onConfirm: (relationshipType: RelationshipType, birthday?: string) => void
  onCancel: () => void
}

const RELATIONSHIP_OPTIONS: RelationshipType[] = ['family', 'close_friend', 'friend', 'work', 'spouse', 'other']

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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-xl p-6 max-w-sm w-full mx-4 animate-scale-in">
        <div className="space-y-5">

          {/* Header */}
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-blush-pale rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">👤</span>
            </div>
            <h3 className="text-lg font-semibold text-[#2D1810]">
              How do you know {personName}?
            </h3>
            <p className="text-sm text-terra/50 mt-1 font-light">
              This helps us suggest relevant reminders
            </p>
          </div>

          {/* Relationship Options */}
          <div className="space-y-2">
            {RELATIONSHIP_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2
                            transition-all duration-200 text-left
                            ${selectedType === type
                              ? 'border-terra/40 bg-blush-pale'
                              : 'border-blush-light hover:border-terra/25 hover:bg-blush-pale/40'
                            }`}
              >
                <span className="text-xl">{RELATIONSHIP_EMOJI[type]}</span>
                <span className="font-medium text-[#2D1810] text-sm">{RELATIONSHIP_LABELS[type]}</span>
                {selectedType === type && (
                  <svg className="w-4 h-4 text-terra ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Optional Birthday */}
          {selectedType && (
            <div className="pt-2 border-t border-blush-light/60">
              <button
                onClick={() => setShowBirthday(!showBirthday)}
                className="text-xs text-terra/50 hover:text-terra flex items-center gap-1.5 transition-colors"
              >
                <span>{showBirthday ? '−' : '+'}</span>
                <span>Add birthday (optional)</span>
              </button>
              {showBirthday && (
                <div className="mt-3 space-y-1.5">
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-blush-light focus:border-terra/40
                               rounded-xl outline-none text-sm text-terra-deep"
                  />
                  <p className="text-xs text-terra/40 font-light">We'll remind you before their birthday</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-blush-pale text-terra/70 rounded-pill text-sm font-medium
                         hover:bg-blush-light transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedType}
              className="flex-1 py-3 px-4 bg-terra text-white rounded-pill text-sm font-medium
                         hover:bg-terra-deep transition-all duration-200 active:scale-95
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Profile
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
