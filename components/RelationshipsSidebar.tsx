'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Person, RELATIONSHIP_LABELS } from '@/lib/types'
import OutlineIcon from '@/components/OutlineIcon'
import ThoughtfulTitle from '@/components/ThoughtfulTitle'
import { copy } from '@/lib/copy'

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
  onSignOut,
}: RelationshipsSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handlePersonClick = (personId: string) => {
    router.push(`/person/${personId}`)
    onToggle()
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink/10 z-20 animate-fade-in"
          onClick={onToggle}
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-full max-w-md flex flex-col
          bg-page transition-transform duration-[350ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="relative px-8 pt-10 pb-8 text-left">
          <button
            onClick={onToggle}
            className="absolute top-8 right-6 p-2 text-ink-muted hover:text-accent transition-colors"
            aria-label="Close sidebar"
          >
            <OutlineIcon name="close" size="lg" />
          </button>
          <OutlineIcon name="profiles" size="lg" className="text-ink-muted mb-5" />
          <h2>
            <ThoughtfulTitle variant="section" className="!justify-start">
              {copy.profiles}
            </ThoughtfulTitle>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-6">
          {people.length === 0 ? (
            <p className="text-left text-sm text-ink-muted font-light leading-relaxed py-12">
              {copy.profilesEmpty}
            </p>
          ) : (
            <ul className="space-y-8">
              {people.map((person) => {
                const isSelected = pathname === `/person/${person.id}`
                return (
                  <li key={person.id}>
                    <button
                      onClick={() => handlePersonClick(person.id)}
                      className={`
                        w-full flex flex-col items-start text-left py-2 min-h-[44px]
                        transition-opacity duration-150
                        ${isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'}
                      `}
                    >
                      <span className="block leading-none">
                        <ThoughtfulTitle variant="profile" className="!justify-start">
                          {person.name}
                        </ThoughtfulTitle>
                      </span>
                      <p className="text-xs text-ink-muted mt-2 font-light tracking-wide">
                        {RELATIONSHIP_LABELS[person.relationshipType]}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {userEmail && onSignOut && (
          <div className="px-8 py-8 bg-page text-left">
            <p className="text-xs text-ink-faint truncate mb-4 font-light">{userEmail}</p>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 text-ink-muted hover:text-accent transition-colors min-h-[44px]"
            >
              <OutlineIcon name="signOut" size="lg" />
              <span className="text-sm font-light">{copy.signOut}</span>
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
