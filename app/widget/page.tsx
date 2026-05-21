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
        const upcoming = parsed
          .filter((r: { isCompleted: boolean }) => !r.isCompleted)
          .map((r: WidgetReminder) => ({ ...r, date: new Date(r.date) }))
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

    setReminders(prev => [{ id: newReminder.id, text: friendlyTitle, date }, ...prev].slice(0, 5))
    setStatus('Saved')
    setTimeout(() => setStatus(null), 1500)
  }, [])

  return (
    <div className="min-h-screen bg-page p-4 sm:p-5 font-sans w-full max-w-md mx-auto">
      <h1 className="font-sans text-xl font-bold text-ink tracking-tight">{copy.appName}</h1>
      <p className="font-outfit text-[16px] italic text-ink-muted font-light mt-1 leading-snug">{copy.tagline}</p>

      <div className="mt-4">
        <ReminderInput compact onSubmit={handleSubmit} />
      </div>

      {status && (
        <p className="font-outfit text-body text-accent mt-2 animate-fade-in">{status}</p>
      )}

      {reminders.length > 0 && (
        <div className="mt-5">
          <p className="font-outfit text-[15px] font-semibold text-ink-muted tracking-wide mb-2">
            {copy.sectionUpcoming}
          </p>
          <div className="flex flex-col gap-[3px]">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="reminder-card bg-page rounded-card border-[0.5px] border-accent/20 px-4 py-3.5"
              >
                <p className="font-sans text-[15px] font-bold text-ink leading-snug">{r.text}</p>
                <p className="font-outfit text-[13px] text-ink-muted mt-1">{formatDate(r.date)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
