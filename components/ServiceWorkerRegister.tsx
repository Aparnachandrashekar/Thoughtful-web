'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Dev server rebuilds constantly — SW caches break HMR and cause blank/glitchy pages
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
      })
      return
    }

    // Reload only when an existing SW is replaced — not on first install (avoids flash/reload loop on load)
    let hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true
        return
      }
      window.location.reload()
    })

    // updateViaCache: 'none' prevents iOS from serving sw.js from HTTP cache,
    // ensuring the browser always fetches sw.js fresh and detects new deployments.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {})
  }, [])

  return null
}
