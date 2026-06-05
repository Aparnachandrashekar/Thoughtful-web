'use client'

import { useState, useEffect, useCallback } from 'react'
import { parseReminder } from '@/lib/parser'
import { generateTitle } from '@/lib/ai'
import { copy } from '@/lib/copy'
import ReminderInput from '@/components/ReminderInput'
import { getRemindersKey } from '@/lib/google'

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
  const [reminders, setReminders] = useState<WidgetReminder[]>([])
  const [status, setStatus] = useState<string | null>(null)

  const loadReminders = useCallback(() => {
    try {
      const key = getRemindersKey()
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        const now = Date.now()
        const upcoming = parsed
          .filter((r: { isCompleted: boolean; date: string }) => !r.isCompleted)
          .map((r: WidgetReminder) => ({ ...r, date: new Date(r.date) }))
          .filter((r: WidgetReminder) => r.date.getTime() >= now)
          .sort((a: WidgetReminder, b: WidgetReminder) => a.date.getTime() - b.date.getTime())
          .slice(0, 5)
        setReminders(upcoming)
      }
    } catch {
      setReminders([])
    }
  }, [])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  const handleSubmit = useCallback(async (input: string) => {
    const result = parseReminder(input)
    const date = result.date || new Date(Date.now() + 24 * 60 * 60 * 1000)
    if (!result.date) {
      date.setHours(8, 0, 0, 0)
    }

    const friendlyTitle = await generateTitle(input)

    const newReminder = {
      id: Date.now().toString(),
      text: friendlyTitle,
      date,
      isCompleted: false,
    }

    const key = getRemindersKey()
    const saved = localStorage.getItem(key)
    const all = saved ? JSON.parse(saved) : []
    all.unshift(newReminder)
    localStorage.setItem(key, JSON.stringify(all))

    loadReminders()
    setStatus('Saved')
    setTimeout(() => setStatus(null), 1500)
  }, [loadReminders])

  return (
    <div className="w-full min-h-0 overflow-x-hidden bg-page px-4 py-3 font-sans">
      <h1 className="text-mobile-title font-bold text-ink tracking-tight">{copy.appName}</h1>

      <div className="mt-3">
        <ReminderInput compact onSubmit={handleSubmit} />
      </div>

      {status && (
        <p className="font-outfit text-xs text-accent mt-2 animate-fade-in">{status}</p>
      )}

      {reminders.length > 0 ? (
        <div className="mt-4">
          <p className="font-outfit text-mobile-caption font-semibold text-ink-muted tracking-wide mb-2 uppercase">
            {copy.sectionUpcoming}
          </p>
          <ul className="flex flex-col gap-2">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="rounded-card border-[0.5px] border-accent/20 bg-page px-4 py-3"
              >
                <p className="text-mobile-title font-semibold text-ink leading-snug">{r.text}</p>
                <p className="font-outfit text-mobile-secondary text-ink-muted mt-0.5">{formatDate(r.date)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="font-outfit text-mobile-secondary text-ink-faint mt-4">{copy.remindersEmpty}</p>
      )}
    </div>
  )
}
