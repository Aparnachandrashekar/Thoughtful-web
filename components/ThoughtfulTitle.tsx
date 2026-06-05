/** Big bold title with blue full-stop — landing & profiles */

interface ThoughtfulTitleProps {
  children: string
  /** hero = landing scale; profile = sidebar names */
  variant?: 'hero' | 'profile' | 'section'
  className?: string
}

const variantClass = {
  hero: 'text-[clamp(36px,10vw,168px)] max-sm:max-w-full sm:max-w-[calc(100vw-2rem)]',
  /** Person name — large title-card scale (sidebar + profile page) */
  profile: 'text-[clamp(40px,11vw,96px)]',
  section: 'text-[clamp(32px,8vw,52px)]',
}

export default function ThoughtfulTitle({
  children,
  variant = 'hero',
  className = '',
}: ThoughtfulTitleProps) {
  return (
    <span
      className={`
        font-sans font-bold text-ink tracking-tight leading-none
        inline-flex items-baseline justify-center max-w-full
        ${variantClass[variant]} ${className}
      `}
    >
      {children}
      <span
        className="inline-block rounded-full bg-accent flex-shrink-0
                   w-[0.32em] h-[0.32em] ml-[0.06em] -translate-y-[0.06em]"
        aria-hidden
      />
    </span>
  )
}
