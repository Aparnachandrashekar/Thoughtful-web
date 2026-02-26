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
    if (typeof window !== 'undefined' && window.innerWidth < 768) onToggle()
  }

  return (
    <>
      {/* Mobile FAB */}
      <button
        onClick={onToggle}
        className="md:hidden fixed bottom-6 left-4 z-40 bg-terra text-white px-5 py-3 rounded-pill
                   shadow-[0_4px_20px_rgba(212,117,106,0.4)] hover:bg-terra-deep
                   transition-all duration-200 active:scale-95 flex items-center gap-2"
        aria-label="Toggle profiles"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-semibold">Profiles</span>
      </button>

      {/* Sidebar panel */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-30
          w-64 bg-terra flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-8 pb-5">
          <h2 className="text-2xl font-bold text-white tracking-wide">Profiles</h2>
          <button
            onClick={onToggle}
            className="md:hidden text-white/60 hover:text-white transition-colors p-1"
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

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/25 z-20 md:hidden animate-fade-in backdrop-blur-[1px]"
          onClick={onToggle}
        />
      )}
    </>
  )
}
