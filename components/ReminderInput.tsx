'use client'

import { useState } from 'react'
import OutlineIcon from '@/components/OutlineIcon'
import { copy } from '@/lib/copy'

interface ReminderInputProps {
  onSubmit: (text: string) => void
  placeholder?: string
  compact?: boolean
  hero?: boolean
}

export default function ReminderInput({
  onSubmit,
  placeholder = copy.inputPlaceholder,
  compact = false,
  hero = false,
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

  const isHero = hero && !compact

  return (
    <form onSubmit={handleSubmit} className="w-full font-outfit">
      <div
        className={`
          flex items-center font-outfit transition-all duration-300 ease-out
          bg-surface ${isHero
            ? `rounded-2xl gap-3 sm:gap-4 py-4 px-4 sm:py-5 sm:px-6
               max-md:min-h-[60px] max-md:py-5 max-md:px-5 max-md:gap-4
               ${focused ? 'shadow-input bg-surface-soft' : 'shadow-input'}
               border border-surface-soft/60 max-md:border-accent/15`
            : `rounded-card gap-3 overflow-hidden
               ${focused ? 'shadow-card bg-surface-soft' : ''}
               ${compact ? 'py-2.5 px-3' : 'py-3.5 px-4'}`
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
            flex-1 min-w-0 bg-transparent text-ink font-outfit text-mobile-body sm:text-body font-light
            max-md:text-[16px] max-md:font-normal
            placeholder:text-ink-faint placeholder:font-light
            max-md:placeholder:text-ink-muted max-md:placeholder:font-normal
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
            ${isHero ? 'w-11 h-11 min-w-[44px] min-h-[44px] max-md:w-12 max-md:h-12 max-md:min-w-[48px] max-md:min-h-[48px]' : compact ? 'w-9 h-9 min-w-[44px] min-h-[44px]' : 'w-10 h-10 min-w-[44px] min-h-[44px]'}
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
