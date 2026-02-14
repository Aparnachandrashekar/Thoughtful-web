// localStorage CRUD operations for people/relationships

import { Person, AvatarColor, RelationshipType } from './types'

const AVATAR_COLORS: AvatarColor[] = ['blush', 'lavender', 'mint', 'peach', 'sky']

function getPeopleKey(email?: string): string {
  if (email) {
    return `thoughtful-people-${email}`
  }
  return 'thoughtful-people'
}

export function loadPeople(email?: string): Person[] {
  if (typeof window === 'undefined') return []

  const key = getPeopleKey(email)
  const stored = localStorage.getItem(key)

  if (!stored) return []

  try {
    const people = JSON.parse(stored) as Person[]

    // Migrate existing profiles without relationshipType to 'close_friend'
    let needsSave = false
    for (const person of people) {
      if (!person.relationshipType) {
        person.relationshipType = 'close_friend'
        needsSave = true
      }
    }

    // Save migrated data
    if (needsSave) {
      localStorage.setItem(key, JSON.stringify(people))
    }

    return people
  } catch {
    return []
  }
}

export function savePeople(people: Person[], email?: string): void {
  if (typeof window === 'undefined') return

  const key = getPeopleKey(email)
  localStorage.setItem(key, JSON.stringify(people))
}

export function findPersonByName(name: string, email?: string): Person | undefined {
  const people = loadPeople(email)
  const normalizedName = name.toLowerCase().trim()
  return people.find(p => p.name.toLowerCase().trim() === normalizedName)
}

export function createPerson(
  name: string,
  relationshipType: RelationshipType,
  email?: string,
  birthday?: string
): Person {
  const people = loadPeople(email)

  // Pick a color that's least used
  const colorCounts = AVATAR_COLORS.reduce((acc, color) => {
    acc[color] = people.filter(p => p.avatarColor === color).length
    return acc
  }, {} as Record<AvatarColor, number>)

  const leastUsedColor = AVATAR_COLORS.reduce((min, color) =>
    colorCounts[color] < colorCounts[min] ? color : min
  , AVATAR_COLORS[0])

  const newPerson: Person = {
    id: Date.now().toString(),
    name: name.trim(),
    linkedReminderIds: [],
    createdAt: new Date().toISOString(),
    avatarColor: leastUsedColor,
    relationshipType,
    birthday
  }

  people.push(newPerson)
  savePeople(people, email)

  return newPerson
}

export function linkReminderToPerson(personId: string, reminderId: string, email?: string): void {
  const people = loadPeople(email)
  const person = people.find(p => p.id === personId)

  if (person && !person.linkedReminderIds.includes(reminderId)) {
    person.linkedReminderIds.push(reminderId)
    savePeople(people, email)
  }
}

export function unlinkReminderFromPerson(personId: string, reminderId: string, email?: string): void {
  const people = loadPeople(email)
  const person = people.find(p => p.id === personId)

  if (person) {
    person.linkedReminderIds = person.linkedReminderIds.filter(id => id !== reminderId)
    savePeople(people, email)
  }
}

export function getPersonById(personId: string, email?: string): Person | undefined {
  const people = loadPeople(email)
  const person = people.find(p => p.id === personId)

  // Ensure relationshipType exists (migration for existing data)
  if (person && !person.relationshipType) {
    person.relationshipType = 'close_friend'
  }

  return person
}

export function deletePerson(personId: string, email?: string): void {
  const people = loadPeople(email)
  const filtered = people.filter(p => p.id !== personId)
  savePeople(filtered, email)
}

export function updatePerson(
  personId: string,
  updates: Partial<Pick<Person, 'name' | 'avatarColor' | 'relationshipType' | 'birthday' | 'email'>>,
  userEmail?: string
): void {
  const people = loadPeople(userEmail)
  const person = people.find(p => p.id === personId)

  if (person) {
    if (updates.name !== undefined) person.name = updates.name.trim()
    if (updates.avatarColor !== undefined) person.avatarColor = updates.avatarColor
    if (updates.relationshipType !== undefined) person.relationshipType = updates.relationshipType
    if (updates.birthday !== undefined) person.birthday = updates.birthday
    if (updates.email !== undefined) person.email = updates.email?.trim() || undefined
    savePeople(people, userEmail)
  }
}
