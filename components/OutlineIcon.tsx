/** Large thin-stroke icons for primary actions */

import type { ReactNode } from 'react'

type IconName = 'menu' | 'profiles' | 'signOut' | 'add' | 'arrow' | 'refresh' | 'calendar' | 'close'

const paths: Record<IconName, ReactNode> = {
  menu: (
    <>
      <path strokeLinecap="round" d="M5 7h22M5 12h22M5 17h22" />
    </>
  ),
  profiles: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </>
  ),
  signOut: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </>
  ),
  add: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </>
  ),
  arrow: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  refresh: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </>
  ),
  calendar: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </>
  ),
  close: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </>
  ),
}

interface OutlineIconProps {
  name: IconName
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

export default function OutlineIcon({ name, size = 'md', className = '' }: OutlineIconProps) {
  return (
    <svg
      className={`${sizes[size]} ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.25}
      aria-hidden
    >
      {paths[name]}
    </svg>
  )
}
