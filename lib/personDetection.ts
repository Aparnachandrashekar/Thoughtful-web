// Name detection logic for extracting people from reminder text

import { DetectedName } from './types'

// Relationship terms - high confidence matches
const RELATIONSHIP_TERMS = new Set([
  'mom', 'dad', 'mother', 'father',
  'sister', 'brother',
  'grandma', 'grandpa', 'grandmother', 'grandfather',
  'aunt', 'uncle', 'cousin',
  'wife', 'husband', 'partner',
  'son', 'daughter',
  'niece', 'nephew',
  'boyfriend', 'girlfriend',
  'fiance', 'fiancee', 'fiancé', 'fiancée'
])

// Words to exclude from proper name detection
const EXCLUSION_LIST = new Set([
  // Days
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // Months
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // Common words that start sentences or appear capitalized
  'birthday', 'anniversary', 'meeting', 'appointment', 'lunch', 'dinner',
  'coffee', 'breakfast', 'call', 'text', 'email', 'remind', 'remember',
  'today', 'tomorrow', 'next', 'this', 'last', 'every', 'the', 'check',
  'get', 'buy', 'send', 'schedule', 'plan', 'book', 'make', 'pick',
  'doctor', 'dentist', 'vet', 'hospital', 'office', 'work', 'home',
  'happy', 'merry', 'new', 'year', 'christmas', 'easter', 'thanksgiving',
  'valentine', 'halloween', 'party', 'wedding', 'graduation', 'shower',
  'gift', 'present', 'card', 'flowers', 'cake'
])

/**
 * Detect names in text
 * Returns all detected names with their confidence levels
 */
export function detectNamesInText(text: string): DetectedName[] {
  const detectedNames: DetectedName[] = []
  const seenNames = new Set<string>()

  // Split into words
  const words = text.split(/\s+/)

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    // Remove punctuation for matching but preserve original case
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, '')
    const lowerWord = cleanWord.toLowerCase()

    // Check for relationship terms (high confidence)
    if (RELATIONSHIP_TERMS.has(lowerWord)) {
      const normalizedName = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase()
      if (!seenNames.has(normalizedName.toLowerCase())) {
        seenNames.add(normalizedName.toLowerCase())
        detectedNames.push({
          name: normalizedName,
          confidence: 'high',
          source: 'relationship'
        })
      }
      continue
    }

    // Check for proper names (capitalized words not in exclusion list)
    // Must start with uppercase and have at least 2 characters
    if (cleanWord.length >= 2 &&
        /^[A-Z][a-z]+$/.test(cleanWord) &&
        !EXCLUSION_LIST.has(lowerWord)) {

      // Skip if it's the first word (might just be sentence start)
      // unless followed by possessive or specific patterns
      const isFirstWord = i === 0 || /[.!?]$/.test(words[i - 1] || '')
      const hasContext = word.includes("'s") ||
                         /^(call|text|meet|visit|see|for|with)$/i.test(words[i - 1] || '') ||
                         /^(birthday|appointment|meeting)$/i.test(words[i + 1] || '')

      if (!isFirstWord || hasContext) {
        if (!seenNames.has(lowerWord)) {
          seenNames.add(lowerWord)
          detectedNames.push({
            name: cleanWord,
            confidence: 'medium',
            source: 'proper'
          })
        }
      }
    }

    // Handle possessive forms: "Sarah's birthday"
    const possessiveMatch = word.match(/^([A-Z][a-z]+)'s/i)
    if (possessiveMatch) {
      const name = possessiveMatch[1]
      const lowerName = name.toLowerCase()

      // Check if it's a relationship term
      if (RELATIONSHIP_TERMS.has(lowerName)) {
        const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
        if (!seenNames.has(normalizedName.toLowerCase())) {
          seenNames.add(normalizedName.toLowerCase())
          detectedNames.push({
            name: normalizedName,
            confidence: 'high',
            source: 'relationship'
          })
        }
      } else if (!EXCLUSION_LIST.has(lowerName) && name.length >= 2) {
        if (!seenNames.has(lowerName)) {
          seenNames.add(lowerName)
          detectedNames.push({
            name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
            confidence: 'medium',
            source: 'proper'
          })
        }
      }
    }
  }

  // Sort by confidence (high first)
  return detectedNames.sort((a, b) => {
    if (a.confidence === b.confidence) return 0
    return a.confidence === 'high' ? -1 : 1
  })
}

/**
 * Get the primary detected name (highest confidence, first found)
 */
export function getPrimaryDetectedName(text: string): DetectedName | null {
  const names = detectNamesInText(text)
  return names.length > 0 ? names[0] : null
}
