/** Maps care template IDs to outline icon keys for profile template cards */

export type TemplateIconName =
  | 'phone'
  | 'gift'
  | 'party'
  | 'coffee'
  | 'cake'
  | 'target'
  | 'chat'
  | 'wave'
  | 'handshake'
  | 'mail'
  | 'heart'
  | 'map'
  | 'sparkles'

const TEMPLATE_ICON_BY_ID: Record<string, TemplateIconName> = {
  'family-weekly-call': 'phone',
  'family-birthday': 'gift',
  'family-monthly-checkin': 'party',
  'close-friend-weekly': 'phone',
  'close-friend-monthly': 'coffee',
  'close-friend-birthday': 'cake',
  'close-friend-activity': 'target',
  'friend-monthly': 'chat',
  'friend-quarterly': 'wave',
  'friend-birthday': 'cake',
  'work-quarterly': 'handshake',
  'work-monthly-update': 'mail',
  'work-special-event': 'party',
  'other-monthly': 'chat',
  'spouse-date-night': 'heart',
  'spouse-adventure': 'map',
  'spouse-anniversary': 'gift',
  'spouse-checkin': 'heart',
  'spouse-appreciation': 'sparkles',
}

export function getTemplateIconName(templateId: string): TemplateIconName {
  return TEMPLATE_ICON_BY_ID[templateId] ?? 'chat'
}
