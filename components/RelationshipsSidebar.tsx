'use client'

import { useRouter } from 'next/navigation'
import { Person, RELATIONSHIP_EMOJI } from '@/lib/types'

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

  const handlePersonClick = (personId: string) => {
    router.push(`/person/${personId}`)
    onToggle()
  }

  return (
    <>
      {/* Backdrop — shown on all screen sizes when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 animate-fade-in backdrop-blur-[2px]"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel — always fixed overlay, never pushes content */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30
          w-72 bg-terra flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
          shadow-[4px_0_32px_rgba(180,80,70,0.18)]
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-8 pb-5">
          <h2 className="text-2xl font-bold text-white tracking-wide">Profiles</h2>
          <button
            onClick={onToggle}
            className="text-white/60 hover:text-white transition-colors p-1"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* People list */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto space-y-2">
          {people.length === 0 ? (
            <p className="px-3 py-4 text-sm text-white/55 leading-relaxed">
              No profiles yet. Create a reminder about someone to get started.
            </p>
          ) : (
            people.map((person, i) => (
              <button
                key={person.id}
                onClick={() => handlePersonClick(person.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5
                           bg-terra-deep/60 hover:bg-terra-deep
                           rounded-2xl transition-all duration-200
                           active:scale-[0.97] text-left
                           animate-fade-up"
                style={{ animationDelay: `${i * 45}ms`, animationFillMode: 'both' }}
              >
                <span className="text-sm font-semibold text-white truncate flex-1">
                  {person.name}
                </span>
                <span className="text-sm opacity-70" title={person.relationshipType}>
                  {RELATIONSHIP_EMOJI[person.relationshipType]}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Bottom: email + sign out */}
        {userEmail && onSignOut && (
          <div className="px-6 py-6 border-t border-white/10">
            <p className="text-xs text-white/40 truncate mb-3">{userEmail}</p>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-white font-bold text-sm
                         hover:text-white/70 transition-colors group"
            >
              Sign out
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
