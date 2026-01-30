import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Thoughtful',
  description: 'Your guide to building beautiful relationships by being thoughtful',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Thoughtful',
  },
}

export const viewport: Viewport = {
  themeColor: '#E8E0F0',
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
      <body className="min-h-screen bg-cream antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
