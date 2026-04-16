import type { Metadata, Viewport } from 'next'
import { DM_Sans, Dancing_Script } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { PostHogProvider } from '@/components/PostHogProvider'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dancing-script',
  display: 'swap',
})

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
  themeColor: '#D4756A',
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
    <html lang="en" className={`${dmSans.variable} ${dancingScript.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-cream antialiased">
        <PostHogProvider>
          {children}
          <ServiceWorkerRegister />
        </PostHogProvider>
      </body>
    </html>
  )
}
