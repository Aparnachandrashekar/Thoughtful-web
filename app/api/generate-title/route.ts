import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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
            text: `Extract a short, clean reminder title. 2–5 words, title case. Remove all dates, times, recurrence words, and filler. Keep the core action and subject only.

Examples:
"remind me to call mom tomorrow at 5pm" → "Call Mom"
"dentist appointment on Friday" → "Dentist Appointment"
"buy anniversary flowers for Sarah" → "Anniversary Flowers for Sarah"
"check in with Raj about the project every Monday" → "Check In with Raj"
"mom's birthday March 15" → "Mom's Birthday"
"coffee with Jessica next Tuesday at 9am" → "Coffee with Jessica"
"send thank you note to the team" → "Thank You Note"

Reminder text: "${text}"

Reply with ONLY the title, nothing else.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 20,
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
