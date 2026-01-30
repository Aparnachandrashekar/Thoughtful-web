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
      <div className="relative">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Call mom tomorrow at 3pm..."
          className="w-full px-6 py-4 text-lg bg-white border-2 border-lavender/50 rounded-2xl
                     placeholder:text-gray-400 focus:border-lavender focus:ring-0 focus:outline-none
                     shadow-sm hover:shadow-md transition-shadow"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2
                     bg-lavender text-gray-700 font-medium rounded-xl
                     hover:bg-lavender/80 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all active:scale-95"
        >
          Add
        </button>
      </div>
      <p className="mt-3 text-sm text-gray-500 text-center">
        Type naturally — we&apos;ll figure out the date and time
      </p>
    </form>
  )
}
