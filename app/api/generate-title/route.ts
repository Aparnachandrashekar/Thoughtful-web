import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: NextRequest) {
  const { text } = await request.json()
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ title: text }, { status: 200 })
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a warm, gentle reminder assistant. Given this raw reminder text, rewrite it as a short, friendly nudge. Keep it brief (under 12 words). Don't be overly enthusiastic or use exclamation marks. Be calm and thoughtful, like a kind friend. Examples of tone:
- "Call mom" → "A gentle nudge to call Mom today"
- "Buy flowers anniversary" → "Time to pick up flowers for the anniversary"
- "Check in with Raj" → "Maybe drop Raj a quick hello"
- "Dentist Friday" → "Heads up — dentist appointment on Friday"

Now rewrite this: "${text}"

Respond with ONLY the rewritten title, nothing else.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 30,
        }
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ title: text })
    }

    const data = await response.json()
    const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return NextResponse.json({ title: title || text })
  } catch {
    return NextResponse.json({ title: text })
  }
}
