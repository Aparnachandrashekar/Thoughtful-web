// Shared types for the People/Relationships feature

export interface Person {
  id: string                    // Date.now().toString()
  name: string                  // "Mom", "Sarah", etc.
  linkedReminderIds: string[]   // Linked reminder IDs
  createdAt: string             // ISO date
  avatarColor: AvatarColor      // blush | lavender | mint | peach | sky
}

export type AvatarColor = 'blush' | 'lavender' | 'mint' | 'peach' | 'sky'

export interface DetectedName {
  name: string
  confidence: 'high' | 'medium'
  source: 'relationship' | 'proper'
}

export interface CareTemplate {
  id: string
  label: string
  textTemplate: string          // "Call {name}"
  recurrence: 'weekly' | 'monthly' | 'yearly' | null
  daysBefore?: number           // For birthday - remind 1 week before
}
