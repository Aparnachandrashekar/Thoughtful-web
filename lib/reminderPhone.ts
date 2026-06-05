import { Person } from './types'

interface ReminderPhoneFields {
  id: string
  phoneNumber?: string
  personName?: string
  text: string
}

export function getPhoneForReminder(
  reminder: ReminderPhoneFields,
  people?: Person[]
): string {
  if (reminder.phoneNumber) return reminder.phoneNumber.replace(/[^0-9]/g, '')
  if (!people || people.length === 0) return ''

  const linked = people.find(p => p.phone && p.linkedReminderIds.includes(reminder.id))
  if (linked?.phone) return linked.phone.replace(/[^0-9]/g, '')

  if (reminder.personName) {
    const named = people.find(
      p => p.phone && p.name.toLowerCase() === reminder.personName!.toLowerCase()
    )
    if (named?.phone) return named.phone.replace(/[^0-9]/g, '')
  }

  const textLower = reminder.text.toLowerCase()
  const textMatch = people.find(p => p.phone && textLower.includes(p.name.toLowerCase()))
  if (textMatch?.phone) return textMatch.phone.replace(/[^0-9]/g, '')

  return ''
}

export function whatsappLinkForPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent('Hey!')}`
}
