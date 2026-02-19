export async function generateTitle(rawText: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return basicTitleExtraction(rawText)
    }

    const data = await response.json()
    const title = data.title?.trim()

    if (title && title.length > 0 && title.length < 100) {
      return title.replace(/^["']|["']$/g, '').trim()
    }

    return basicTitleExtraction(rawText)
  } catch (error) {
    console.error('Title generation API error:', error)
    return basicTitleExtraction(rawText)
  }
}

// Fallback basic extraction if API fails
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
