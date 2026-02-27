// Shared types for the People/Relationships feature

export type RelationshipType = 'family' | 'close_friend' | 'friend' | 'work' | 'spouse' | 'other'

export interface Person {
  id: string                    // Date.now().toString()
  name: string                  // "Mom", "Sarah", etc.
  linkedReminderIds: string[]   // Linked reminder IDs
  createdAt: string             // ISO date
  avatarColor: AvatarColor      // blush | lavender | mint | peach | sky
  relationshipType: RelationshipType  // Required relationship type
  birthday?: string             // Optional birthday (ISO date string)
  email?: string                // Optional email for calendar invites
  phone?: string                // Optional phone for WhatsApp reminders
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
  emoji: string
  textTemplate: string          // "Call {name}"
  recurrence: 'weekly' | 'monthly' | 'yearly' | 'quarterly' | 'bimonthly' | null
  daysBefore?: number           // For birthday - remind 1 week before
  description?: string          // Brief description of the template
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  family: 'Family',
  close_friend: 'Close Friend',
  friend: 'Friend',
  work: 'Work',
  spouse: 'Spouse / Partner',
  other: 'Other'
}

export const RELATIONSHIP_EMOJI: Record<RelationshipType, string> = {
  family: '👨‍👩‍👧‍👦',
  close_friend: '💜',
  friend: '😊',
  work: '💼',
  spouse: '💑',
  other: '👤'
}
