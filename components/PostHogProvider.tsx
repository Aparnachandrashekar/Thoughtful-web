'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
  posthog.init('phc_Cwul5G6dKvGYytUBtWsImkuIc61Et3gcwu8aVdamJFF', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    loaded: (ph) => {
      ph.capture('test_event')
    }
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>
}
