import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { copy } from '@/lib/copy'

export const metadata: Metadata = {
  title: `${copy.appName} Widget`,
}

export const viewport: Viewport = {
  themeColor: '#2575E6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="app-canvas min-h-screen bg-page text-ink antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
