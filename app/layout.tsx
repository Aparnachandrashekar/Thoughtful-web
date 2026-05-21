import type { Metadata, Viewport } from 'next'
import './globals.css'
import { copy } from '@/lib/copy'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { PostHogProvider } from '@/components/PostHogProvider'

export const metadata: Metadata = {
  title: copy.appName,
  description: copy.metaDescription,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: copy.appName,
  },
}

export const viewport: Viewport = {
  themeColor: '#2575E6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="app-canvas min-h-screen bg-page text-ink antialiased font-sans">
        <PostHogProvider>
          {children}
          <ServiceWorkerRegister />
        </PostHogProvider>
      </body>
    </html>
  )
}
