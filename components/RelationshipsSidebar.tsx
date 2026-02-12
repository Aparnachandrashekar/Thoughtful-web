'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Person, RELATIONSHIP_EMOJI } from '@/lib/types'
import PersonAvatar from './PersonAvatar'

interface RelationshipsSidebarProps {
  people: Person[]
  isOpen: boolean
  onToggle: () => void
  userEmail?: string | null
  onSignOut?: () => void
}

export default function RelationshipsSidebar({
  people,
  isOpen,
  onToggle,
  userEmail,
  onSignOut
}: RelationshipsSidebarProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(true)

  const handlePersonClick = (personId: string) => {
    router.push(`/person/${personId}`)
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={onToggle}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-lavender text-gray-800 p-3 rounded-full shadow-lg hover:bg-lavender/80 transition-all active:scale-95"
        aria-label="Toggle relationships sidebar"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-30
          w-64 bg-white/80 backdrop-blur-sm border-r border-gray-100
          transform transition-transform duration-200 ease-in-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:block
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={onToggle}
          className="md:hidden absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
          aria-label="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Main content */}
        <div className="flex-1 p-4 pt-16 md:pt-4 overflow-y-auto">
          {/* Collapsible Section Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-sand/50 transition-colors"
          >
            <span className="flex items-center space-x-2">
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-gray-800">Relationships</span>
            </span>
            <span className="text-sm text-gray-400">({people.length})</span>
          </button>

          {/* People List */}
          {isExpanded && (
            <div className="mt-2 space-y-1">
              {people.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">
                  No relationships yet. Create a reminder about someone to get started.
                </p>
              ) : (
                people.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => handlePersonClick(person.id)}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-sand/50 transition-colors text-left group"
                  >
                    <PersonAvatar name={person.name} color={person.avatarColor} size="sm" />
                    <span className="text-sm text-gray-700 truncate flex-1">{person.name}</span>
                    <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity" title={person.relationshipType}>
                      {RELATIONSHIP_EMOJI[person.relationshipType]}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom section with user info and sign out */}
        {userEmail && onSignOut && (
          <div className="p-4 border-t border-gray-100 bg-white/50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate">{userEmail}</p>
              </div>
              <button
                onClick={onSignOut}
                className="ml-2 text-xs text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  )
}
