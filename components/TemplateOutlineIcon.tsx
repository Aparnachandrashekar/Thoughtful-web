'use client'

import type { ReactNode } from 'react'
import { getTemplateIconName, type TemplateIconName } from '@/lib/templateIcons'

const paths: Record<TemplateIconName, ReactNode> = {
  phone: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  ),
  gift: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
    />
  ),
  party: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l1.5 4.5L19 9l-4.5 1.5L13 15l-1.5-4.5L7 9l4.5-1.5L13 3z" />
    </>
  ),
  coffee: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 10l1.5-6h15L21 10M6 14h12"
    />
  ),
  cake: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v3m0 0v3m0-3h3m-3 0H9" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 15h14a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 012-2zm0 0V11a7 7 0 0114 0v4"
      />
    </>
  ),
  target: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a2 2 0 100-4 2 2 0 000 4z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
      />
    </>
  ),
  chat: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  ),
  wave: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 6.75a3 3 0 11-6 0 3 3 0 016 0zM4.5 18.75a7.5 7.5 0 0115 0v.75H4.5v-.75z"
    />
  ),
  handshake: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m9 0H7.5m9 0h1.125c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H16.5m-9 0H6.375c-.621 0-1.125-.504-1.125-1.125v-2.25c0-.621.504-1.125 1.125-1.125H7.5"
    />
  ),
  mail: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  ),
  heart: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  ),
  map: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
    />
  ),
  sparkles: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 3v4M3 5h4M6 17v4M4 19h4M15 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM17 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
    />
  ),
}

const sizes = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
}

interface TemplateOutlineIconProps {
  templateId: string
  size?: 'sm' | 'md'
  className?: string
}

export default function TemplateOutlineIcon({
  templateId,
  size = 'md',
  className = '',
}: TemplateOutlineIconProps) {
  const name = getTemplateIconName(templateId)
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-full bg-accent/8 ${sizes[size]} ${className}`}
      aria-hidden
    >
      <svg
        className={size === 'sm' ? 'w-4 h-4' : 'w-[22px] h-[22px]'}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.35}
      >
        {paths[name]}
      </svg>
    </span>
  )
}
