const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function generateTitle(rawText: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY

  // If no API key, fall back to basic extraction
  if (!apiKey) {
    return basicTitleExtraction(rawText)
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Extract only the event/reminder name from this text. Remove all dates, times, recurrence patterns (like "every Friday", "last Saturday of the month"), and filler words (like "remind me to", "is", "that"). Return ONLY the clean event name, nothing else. Keep it short (2-5 words max).

Examples:
- "Tomorrow is Mom's birthday" → "Mom's birthday"
- "Team standup every Friday" → "Team standup"
- "Last Saturday of the month brunch" → "Brunch"
- "Remind me to pay rent on the 1st" → "Pay rent"
- "Call dentist at 3pm tomorrow" → "Call dentist"
- "Sarah's anniversary on June 20 yearly" → "Sarah's anniversary"

Text: "${rawText}"

Event name:`
          }]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 50,
        }
      }),
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status)
      return basicTitleExtraction(rawText)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (generatedText && generatedText.length > 0 && generatedText.length < 100) {
      // Clean up any quotes or extra whitespace
      return generatedText.replace(/^["']|["']$/g, '').trim()
    }

    return basicTitleExtraction(rawText)
  } catch (error) {
    console.error('Gemini API error:', error)
    return basicTitleExtraction(rawText)
  }
}

// Fallback basic extraction if Gemini fails
function basicTitleExtraction(text: string): string {
  let title = text
    // Remove recurrence patterns
    .replace(/\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)s?\b/gi, '')
    .replace(/\b(last|first|second|third|fourth)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)(?:day)?\s+of\s+(?:the\s+)?(?:every\s+)?month\b/gi, '')
    .replace(/\bday\s+\d{1,2}\s+of\s+(?:the\s+)?(?:every\s+)?month\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+of\s+every\s+month\b/gi, '')
    .replace(/\b(every\s+year|yearly|annual|monthly|weekly|every\s*day|everyday|daily)\b/gi, '')
    .replace(/\b(alternating|every\s+other)\s+\w+s?\b/gi, '')
    .replace(/\buntil\s+.+?(?:\s*$|,|\.|;)/gi, '')
    // Remove dates/times
    .replace(/\b(today|tonight|tomorrow|yesterday)\b/gi, '')
    .replace(/\b(this|next|last)\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?(,?\s+\d{4})?\b/gi, '')
    .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    // Remove filler words
    .replace(/^(is|it's|it is|that|remind me to|remind me that|reminder|remember to|remember that|don't forget to|don't forget)\s+/i, '')
    .replace(/\s+(is|that)\s+/gi, ' ')
    // Clean up
    .replace(/^[\s,.\-:]+/, '')
    .replace(/[\s,.\-:]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1)
  }

  return title || text
}
