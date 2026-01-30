import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Thoughtful Widget',
}

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-cream antialiased">
        {children}
      </body>
    </html>
  )
}
