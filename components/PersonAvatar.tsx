'use client'

import { AvatarColor } from '@/lib/types'

interface PersonAvatarProps {
  name: string
  color: AvatarColor
  size?: 'sm' | 'md' | 'lg'
}

const COLOR_CLASSES: Record<AvatarColor, string> = {
  blush: 'bg-pink-100 text-pink-700',
  lavender: 'bg-purple-100 text-purple-700',
  mint: 'bg-emerald-100 text-emerald-700',
  peach: 'bg-orange-100 text-orange-700',
  sky: 'bg-sky-100 text-sky-700'
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg'
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    // Single word: take first two letters
    return words[0].slice(0, 2).toUpperCase()
  }
  // Multiple words: take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function PersonAvatar({ name, color, size = 'md' }: PersonAvatarProps) {
  const initials = getInitials(name)

  return (
    <div
      className={`
        ${COLOR_CLASSES[color]}
        ${SIZE_CLASSES[size]}
        rounded-full flex items-center justify-center font-medium
        flex-shrink-0
      `}
    >
      {initials}
    </div>
  )
}
