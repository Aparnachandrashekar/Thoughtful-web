const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function getApiKey(): string {
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
}

export async function generateTitle(rawText: string): Promise<string> {
  const apiKey = getApiKey()

  // If no API key, use local heuristic fallback
  if (!apiKey) {
    return heuristicTitle(rawText)
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

Now rewrite this: "${rawText}"

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
      return heuristicTitle(rawText)
    }

    const data = await response.json()
    const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return title || heuristicTitle(rawText)
  } catch {
    return heuristicTitle(rawText)
  }
}

// Free fallback when no API key is set
function heuristicTitle(text: string): string {
  const lower = text.toLowerCase()

  if (lower.includes('birthday')) {
    return `Don\u2019t forget to wish them a happy birthday`
  }
  if (lower.includes('anniversary')) {
    return `A little reminder about the anniversary`
  }
  if (lower.includes('call') || lower.includes('check in') || lower.includes('catch up')) {
    const person = extractPerson(text)
    return person
      ? `Maybe reach out to ${person} today`
      : `A gentle nudge to make that call`
  }
  if (lower.includes('wish') || lower.includes('congrat')) {
    return `Time to send some warm wishes`
  }
  if (lower.includes('buy') || lower.includes('pick up') || lower.includes('get')) {
    return `A small errand to take care of`
  }
  if (lower.includes('doctor') || lower.includes('dentist') || lower.includes('appointment')) {
    return `Heads up \u2014 you have an appointment coming up`
  }

  // Default: gentle prefix
  return `A gentle reminder \u2014 ${text.charAt(0).toLowerCase() + text.slice(1)}`
}

function extractPerson(text: string): string | null {
  // Simple heuristic: find a capitalized word that's not a common verb
  const skip = new Set(['call', 'check', 'catch', 'with', 'the', 'and', 'for', 'about', 'from', 'send', 'buy', 'get', 'pick', 'wish'])
  const words = text.split(/\s+/)
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, '')
    if (clean.length > 1 && clean[0] === clean[0].toUpperCase() && !skip.has(clean.toLowerCase())) {
      return clean
    }
  }
  return null
}
