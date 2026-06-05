'use client'

import { useState } from 'react'
import OutlineIcon from '@/components/OutlineIcon'
import { copy } from '@/lib/copy'

interface ReminderInputProps {
  onSubmit: (text: string) => void
  placeholder?: string
  compact?: boolean
  hero?: boolean
  /** Flat bar style for fixed mobile bottom input */
  bottomBar?: boolean
}

export default function ReminderInput({
  onSubmit,
  placeholder = copy.inputPlaceholder,
  compact = false,
  hero = false,
  bottomBar = false,
}: ReminderInputProps) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      onSubmit(text.trim())
      setText('')
    }
  }

  const isHero = hero && !compact && !bottomBar

  return (
    <form onSubmit={handleSubmit} className="w-full font-outfit">
      <div
        className={`
          flex items-center font-outfit transition-all duration-300 ease-out
          ${bottomBar
            ? `gap-3 py-3 px-4 bg-page border-t border-accent/10`
            : `bg-surface ${isHero
              ? `rounded-2xl gap-4 py-5 px-6
                 ${focused ? 'shadow-input bg-surface-soft' : 'shadow-input'}
                 border border-surface-soft/60`
              : `rounded-card gap-3 overflow-hidden
                 ${focused ? 'shadow-card bg-surface-soft' : ''}
                 ${compact ? 'py-2.5 px-3' : 'py-3.5 px-4'}`
            }`
          }
        `}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`
            flex-1 min-w-0 bg-transparent text-ink font-outfit text-body font-light
            placeholder:text-ink-faint placeholder:font-light
            focus:ring-0 focus:outline-none
          `}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={isHero ? 'Create reminder' : 'Add reminder'}
          className={`
            flex-shrink-0 flex items-center justify-center rounded-full font-sans
            transition-all duration-200 ease-out
            ${isHero || bottomBar ? 'w-11 h-11 min-w-[44px] min-h-[44px]' : compact ? 'w-9 h-9 min-w-[44px] min-h-[44px]' : 'w-10 h-10 min-w-[44px] min-h-[44px]'}
            ${text.trim()
              ? 'text-accent hover:bg-accent hover:text-white'
              : 'text-ink-faint/50 cursor-not-allowed'
            }
          `}
        >
          <OutlineIcon name={isHero ? 'arrow' : 'add'} size={isHero ? 'md' : 'sm'} />
        </button>
      </div>
    </form>
  )
}
