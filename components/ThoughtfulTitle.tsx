/** Big bold title with blue full-stop — landing & profiles */

interface ThoughtfulTitleProps {
  children: string
  /** hero = landing scale; profile = sidebar names */
  variant?: 'hero' | 'profile' | 'section'
  className?: string
}

const variantClass = {
  hero: 'text-[clamp(64px,20vw,168px)] max-lg:text-[clamp(56px,16vw,120px)]',
  profile: 'text-[clamp(28px,7vw,44px)]',
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
