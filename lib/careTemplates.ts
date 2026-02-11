// Care action templates for quick reminder creation

import { CareTemplate } from './types'

export const CARE_TEMPLATES: CareTemplate[] = [
  {
    id: 'weekly-catchup',
    label: 'Weekly catch-up',
    textTemplate: 'Call {name}',
    recurrence: 'weekly'
  },
  {
    id: 'birthday-gift',
    label: 'Birthday gift',
    textTemplate: 'Get birthday gift for {name}',
    recurrence: 'yearly',
    daysBefore: 7  // Remind 1 week before
  },
  {
    id: 'monthly-checkin',
    label: 'Monthly check-in',
    textTemplate: 'Check in with {name}',
    recurrence: 'monthly'
  }
]

/**
 * Generate reminder text from a template
 */
export function generateReminderText(template: CareTemplate, personName: string): string {
  return template.textTemplate.replace('{name}', personName)
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): CareTemplate | undefined {
  return CARE_TEMPLATES.find(t => t.id === templateId)
}

/**
 * Calculate the reminder date based on template
 * For birthday template, subtracts daysBefore from the target date
 */
export function calculateReminderDate(template: CareTemplate, targetDate?: Date): Date {
  const date = targetDate ? new Date(targetDate) : new Date()

  // For templates with daysBefore (like birthday), subtract those days
  if (template.daysBefore) {
    date.setDate(date.getDate() - template.daysBefore)
  }

  return date
}

/**
 * Get the next occurrence date based on recurrence pattern
 */
export function getNextRecurrenceDate(pattern: 'weekly' | 'monthly' | 'yearly', fromDate?: Date): Date {
  const date = fromDate ? new Date(fromDate) : new Date()

  switch (pattern) {
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }

  return date
}
