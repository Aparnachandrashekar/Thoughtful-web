'use client'

import { useState, useEffect, useCallback } from 'react'
import { parseReminder } from '@/lib/parser'
import { generateTitle } from '@/lib/ai'

interface WidgetReminder {
  id: string
  text: string
  date: Date
}

function formatDate(date: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === now.toDateString()) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Widget() {
  const [text, setText] = useState('')
  const [reminders, setReminders] = useState<WidgetReminder[]>([])
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('thoughtful-reminders')
    if (saved) {
      const parsed = JSON.parse(saved)
      const upcoming = parsed
        .filter((r: { isCompleted: boolean }) => !r.isCompleted)
        .map((r: WidgetReminder) => ({ ...r, date: new Date(r.date) }))
        .sort((a: WidgetReminder, b: WidgetReminder) => a.date.getTime() - b.date.getTime())
        .slice(0, 5)
      setReminders(upcoming)
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return

    const result = parseReminder(text.trim())
    const date = result.date || new Date(Date.now() + 24 * 60 * 60 * 1000)
    if (!result.date) {
      date.setHours(8, 0, 0, 0)
    }

    const friendlyTitle = await generateTitle(text.trim())

    const newReminder = {
      id: Date.now().toString(),
      text: friendlyTitle,
      date,
      isCompleted: false,
    }

    // Save to shared localStorage
    const saved = localStorage.getItem('thoughtful-reminders')
    const all = saved ? JSON.parse(saved) : []
    all.unshift(newReminder)
    localStorage.setItem('thoughtful-reminders', JSON.stringify(all))

    setReminders(prev => [{ id: newReminder.id, text: friendlyTitle, date }, ...prev].slice(0, 5))
    setText('')
    setStatus('Saved')
    setTimeout(() => setStatus(null), 1500)
  }, [text])

  return (
    <div className="min-h-screen bg-cream p-4 font-sans">
      <div className="max-w-sm mx-auto">
        {/* Compact header */}
        <h1 className="text-lg font-semibold text-gray-700 mb-3">Thoughtful</h1>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Call mom tomorrow at 3pm..."
              className="flex-1 px-3 py-2 text-sm bg-white border-2 border-lavender/50 rounded-xl
                         placeholder:text-gray-400 focus:border-lavender focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-3 py-2 bg-lavender text-gray-700 text-sm font-medium rounded-xl
                         disabled:opacity-40 active:scale-95 transition-all"
            >
              Add
            </button>
          </div>
          {status && (
            <p className="text-xs text-green-600 mt-1 animate-fade-in">{status}</p>
          )}
        </form>

        {/* Upcoming reminders */}
        {reminders.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Upcoming
            </h2>
            <div className="space-y-2">
              {reminders.map((r) => (
                <div key={r.id} className="bg-white/70 px-3 py-2 rounded-xl">
                  <p className="text-sm text-gray-700">{r.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
