'use client'

import { useState } from 'react'

interface ReminderInputProps {
  onSubmit: (text: string) => void
}

export default function ReminderInput({ onSubmit }: ReminderInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      onSubmit(text.trim())
      setText('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2 sm:gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Call mom tomorrow at 3pm..."
          className="flex-1 min-w-0 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-lg bg-white border-2 border-lavender/50 rounded-2xl
                     placeholder:text-gray-400 focus:border-lavender focus:ring-0 focus:outline-none
                     shadow-sm hover:shadow-md transition-shadow"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0
                     bg-lavender text-gray-700 font-medium rounded-2xl
                     hover:bg-lavender/80 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all active:scale-95"
        >
          Add
        </button>
      </div>
      <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-400 text-center italic">
        Title &mdash; Day/Date &mdash; Time &nbsp;to create a reminder
      </p>
    </form>
  )
}
