// Contextual care templates based on relationship type

import { CareTemplate, RelationshipType } from './types'

// Templates organized by relationship type
const FAMILY_TEMPLATES: CareTemplate[] = [
  {
    id: 'family-weekly-call',
    label: 'Weekly call',
    emoji: '📞',
    textTemplate: 'Call {name}',
    recurrence: 'weekly',
    description: 'Stay connected with a weekly call'
  },
  {
    id: 'family-birthday',
    label: 'Birthday gift',
    emoji: '🎁',
    textTemplate: 'Get birthday gift for {name}',
    recurrence: 'yearly',
    daysBefore: 7,
    description: 'Reminder 1 week before birthday'
  },
  {
    id: 'family-monthly-checkin',
    label: 'Festival/occasion check-in',
    emoji: '🎉',
    textTemplate: 'Check in with {name} for upcoming occasions',
    recurrence: 'monthly',
    description: 'Monthly reminder for family occasions'
  }
]

const CLOSE_FRIEND_TEMPLATES: CareTemplate[] = [
  {
    id: 'close-friend-monthly',
    label: 'Monthly catch-up',
    emoji: '☕',
    textTemplate: 'Catch up with {name}',
    recurrence: 'monthly',
    description: 'Keep the friendship strong'
  },
  {
    id: 'close-friend-birthday',
    label: 'Birthday reminder',
    emoji: '🎂',
    textTemplate: 'Wish {name} happy birthday',
    recurrence: 'yearly',
    daysBefore: 1,
    description: 'Never forget their birthday'
  },
  {
    id: 'close-friend-activity',
    label: 'Plan activity together',
    emoji: '🎯',
    textTemplate: 'Plan something fun with {name}',
    recurrence: 'bimonthly',
    description: 'Every 2 months, do something together'
  }
]

const FRIEND_TEMPLATES: CareTemplate[] = [
  {
    id: 'friend-quarterly',
    label: 'Quarterly check-in',
    emoji: '👋',
    textTemplate: 'Check in with {name}',
    recurrence: 'quarterly',
    description: 'Stay in touch every few months'
  },
  {
    id: 'friend-birthday',
    label: 'Birthday reminder',
    emoji: '🎂',
    textTemplate: 'Wish {name} happy birthday',
    recurrence: 'yearly',
    daysBefore: 1,
    description: 'Send birthday wishes'
  }
]

const WORK_TEMPLATES: CareTemplate[] = [
  {
    id: 'work-quarterly',
    label: 'Quarterly professional check-in',
    emoji: '🤝',
    textTemplate: 'Professional check-in with {name}',
    recurrence: 'quarterly',
    description: 'Maintain professional relationship'
  },
  {
    id: 'work-monthly-update',
    label: 'Send update',
    emoji: '📧',
    textTemplate: 'Send update to {name}',
    recurrence: 'monthly',
    description: 'Keep them in the loop'
  },
  {
    id: 'work-special-event',
    label: 'Special event wishes',
    emoji: '🎊',
    textTemplate: 'Wish {name} on special occasion',
    recurrence: null,
    description: 'Promotions, work anniversaries, etc.'
  }
]

const OTHER_TEMPLATES: CareTemplate[] = [
  {
    id: 'other-monthly',
    label: 'Monthly check-in',
    emoji: '💬',
    textTemplate: 'Check in with {name}',
    recurrence: 'monthly',
    description: 'Regular monthly touchpoint'
  }
]

// Map relationship types to their templates
const TEMPLATES_BY_RELATIONSHIP: Record<RelationshipType, CareTemplate[]> = {
  family: FAMILY_TEMPLATES,
  close_friend: CLOSE_FRIEND_TEMPLATES,
  friend: FRIEND_TEMPLATES,
  work: WORK_TEMPLATES,
  other: OTHER_TEMPLATES
}

/**
 * Get templates for a specific relationship type
 */
export function getTemplatesForRelationship(relationshipType: RelationshipType): CareTemplate[] {
  return TEMPLATES_BY_RELATIONSHIP[relationshipType] || OTHER_TEMPLATES
}

/**
 * Get all available templates
 */
export function getAllTemplates(): CareTemplate[] {
  return [
    ...FAMILY_TEMPLATES,
    ...CLOSE_FRIEND_TEMPLATES,
    ...FRIEND_TEMPLATES,
    ...WORK_TEMPLATES,
    ...OTHER_TEMPLATES
  ]
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): CareTemplate | undefined {
  return getAllTemplates().find(t => t.id === templateId)
}

/**
 * Generate reminder text from a template
 */
export function generateReminderText(template: CareTemplate, personName: string): string {
  return template.textTemplate.replace('{name}', personName)
}

/**
 * Convert recurrence type to interval for calendar
 */
export function getRecurrenceInterval(recurrence: CareTemplate['recurrence']): { type: string; interval: number } | null {
  switch (recurrence) {
    case 'weekly':
      return { type: 'weekly', interval: 1 }
    case 'monthly':
      return { type: 'monthly', interval: 1 }
    case 'bimonthly':
      return { type: 'monthly', interval: 2 }
    case 'quarterly':
      return { type: 'monthly', interval: 3 }
    case 'yearly':
      return { type: 'yearly', interval: 1 }
    default:
      return null
  }
}

/**
 * Get human-readable recurrence label
 */
export function getRecurrenceLabel(recurrence: CareTemplate['recurrence']): string {
  switch (recurrence) {
    case 'weekly':
      return 'Weekly'
    case 'monthly':
      return 'Monthly'
    case 'bimonthly':
      return 'Every 2 months'
    case 'quarterly':
      return 'Quarterly'
    case 'yearly':
      return 'Yearly'
    default:
      return 'One-time'
  }
}

/**
 * Calculate the next reminder date based on template
 */
export function calculateNextReminderDate(template: CareTemplate, birthday?: string): Date {
  const now = new Date()
  const date = new Date()

  // For birthday templates with a known birthday
  if (template.id.includes('birthday') && birthday) {
    const bday = new Date(birthday)
    date.setMonth(bday.getMonth())
    date.setDate(bday.getDate())

    // If birthday has passed this year, set to next year
    if (date < now) {
      date.setFullYear(date.getFullYear() + 1)
    }

    // Subtract daysBefore if specified
    if (template.daysBefore) {
      date.setDate(date.getDate() - template.daysBefore)
    }
  } else {
    // For other templates, calculate based on recurrence
    switch (template.recurrence) {
      case 'weekly':
        date.setDate(date.getDate() + 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() + 1)
        break
      case 'bimonthly':
        date.setMonth(date.getMonth() + 2)
        break
      case 'quarterly':
        date.setMonth(date.getMonth() + 3)
        break
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1)
        break
      default:
        // One-time: default to 1 week from now
        date.setDate(date.getDate() + 7)
    }
  }

  date.setHours(9, 0, 0, 0) // Default to 9 AM
  return date
}
