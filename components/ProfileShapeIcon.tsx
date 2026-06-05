'use client'

/** Profile sidebar bullets — cycles through provided shape SVGs in order */
const SHAPE_FILES = [
  '/icons/profile-shapes/shape-52.svg',
  '/icons/profile-shapes/shape-57.svg',
  '/icons/profile-shapes/shape-3.svg',
  '/icons/profile-shapes/shape-4.svg',
  '/icons/profile-shapes/shape-22.svg',
  '/icons/profile-shapes/shape-25.svg',
  '/icons/profile-shapes/shape-36.svg',
  '/icons/profile-shapes/shape-47.svg',
] as const

interface ProfileShapeIconProps {
  index: number
  className?: string
}

export default function ProfileShapeIcon({ index, className = '' }: ProfileShapeIconProps) {
  const src = SHAPE_FILES[index % SHAPE_FILES.length]

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center h-[0.78em] w-[0.78em] ${className}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
    </span>
  )
}
