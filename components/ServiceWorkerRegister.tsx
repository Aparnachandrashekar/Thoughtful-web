'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // updateViaCache: 'none' prevents iOS from serving sw.js from HTTP cache,
      // ensuring the browser always fetches sw.js fresh and detects new deployments.
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => reg.update())
        .catch(() => {})
    }
  }, [])

  return null
}
