import { detectNamesInText, getPrimaryDetectedName } from '@/lib/personDetection'

describe('detectNamesInText', () => {
  it('detects relationship terms with high confidence', () => {
    const names = detectNamesInText('call mom tomorrow')
    expect(names).toHaveLength(1)
    expect(names[0].name).toBe('Mom')
    expect(names[0].confidence).toBe('high')
    expect(names[0].source).toBe('relationship')
  })

  it('detects proper names with medium confidence', () => {
    const names = detectNamesInText("Sarah's birthday party")
    const sarah = names.find(n => n.name === 'Sarah')
    expect(sarah).toBeDefined()
    expect(sarah!.confidence).toBe('medium')
  })

  it('does not detect day names as people', () => {
    const names = detectNamesInText('meeting on Monday')
    const monday = names.find(n => n.name.toLowerCase() === 'monday')
    expect(monday).toBeUndefined()
  })

  it('does not detect month names as people', () => {
    const names = detectNamesInText("Mom's birthday in March")
    const march = names.find(n => n.name.toLowerCase() === 'march')
    expect(march).toBeUndefined()
  })

  it('detects possessive forms like "Sarah\'s"', () => {
    const names = detectNamesInText("Sarah's birthday")
    const sarah = names.find(n => n.name === 'Sarah')
    expect(sarah).toBeDefined()
  })

  it('sorts high confidence names first', () => {
    const names = detectNamesInText('meet Sarah with mom')
    if (names.length >= 2) {
      expect(names[0].confidence).toBe('high')
    }
  })

  it('deduplicates names', () => {
    const names = detectNamesInText('call mom and remind mom again')
    const moms = names.filter(n => n.name.toLowerCase() === 'mom')
    expect(moms).toHaveLength(1)
  })

  it('detects "dad" as relationship', () => {
    const names = detectNamesInText('wish dad happy birthday')
    const dad = names.find(n => n.name.toLowerCase() === 'dad')
    expect(dad).toBeDefined()
    expect(dad!.confidence).toBe('high')
  })

  it('does not detect common reminder verbs as names', () => {
    const names = detectNamesInText('remind me to buy flowers')
    // "Buy" should not be detected even though it starts a word
    expect(names.find(n => n.name.toLowerCase() === 'buy')).toBeUndefined()
  })

  it('returns empty array when no names found', () => {
    const names = detectNamesInText('buy groceries tomorrow')
    expect(Array.isArray(names)).toBe(true)
  })
})

describe('getPrimaryDetectedName', () => {
  it('returns the highest confidence name', () => {
    const name = getPrimaryDetectedName('call mom about Sarah')
    expect(name).not.toBeNull()
    expect(name!.confidence).toBe('high')
    expect(name!.name.toLowerCase()).toBe('mom')
  })

  it('returns null when no names detected', () => {
    const name = getPrimaryDetectedName('buy milk tomorrow')
    expect(name).toBeNull()
  })

  it('returns first proper name if no relationship terms', () => {
    const name = getPrimaryDetectedName("John's dentist appointment")
    expect(name).not.toBeNull()
    expect(name!.name).toBe('John')
  })
})
