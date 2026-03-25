import { render, screen, fireEvent } from '@testing-library/react'
import DatePickerModal from '@/components/DatePickerModal'

describe('DatePickerModal', () => {
  const mockConfirm = jest.fn()
  const mockCancel = jest.fn()

  beforeEach(() => {
    mockConfirm.mockClear()
    mockCancel.mockClear()
  })

  it('renders the modal with title', () => {
    render(<DatePickerModal text="Call mom" onConfirm={mockConfirm} onCancel={mockCancel} />)
    expect(screen.getByText('When should we remind you?')).toBeInTheDocument()
  })

  it('renders the preview text in quotes', () => {
    render(<DatePickerModal text="Call mom" onConfirm={mockConfirm} onCancel={mockCancel} />)
    // The preview is wrapped with &ldquo; and &rdquo; which render as " "
    const para = screen.getByText((content, element) => {
      return element?.tagName === 'P' && element.textContent?.includes('Call mom') === true
    })
    expect(para).toBeInTheDocument()
  })

  it('truncates preview text to 40 characters with ellipsis', () => {
    const longText = 'This is a very long reminder text that exceeds forty characters easily'
    render(<DatePickerModal text={longText} onConfirm={mockConfirm} onCancel={mockCancel} />)
    // slice(0, 40) cuts at index 39 = 'e' in "...that e[xceeds]"
    const para = screen.getByText((content, element) => {
      return element?.tagName === 'P' && element.textContent?.includes('This is a very long reminder text that e…') === true
    })
    expect(para).toBeInTheDocument()
  })

  it('does not add ellipsis for text under 40 characters', () => {
    render(<DatePickerModal text="Short text" onConfirm={mockConfirm} onCancel={mockCancel} />)
    const para = screen.getByText((content, element) => {
      return element?.tagName === 'P' && element.textContent?.includes('Short text') === true && !element.textContent?.includes('…')
    })
    expect(para).toBeInTheDocument()
  })

  it('defaults time to approximately now + 10 minutes', () => {
    const before = new Date()
    render(<DatePickerModal text="test" onConfirm={mockConfirm} onCancel={mockCancel} />)
    const timeInputs = document.querySelectorAll('input[type="time"]')
    expect(timeInputs.length).toBeGreaterThan(0)

    const timeInput = timeInputs[0] as HTMLInputElement
    const [hours, mins] = timeInput.value.split(':').map(Number)
    const defaultDate = new Date()
    defaultDate.setHours(hours, mins, 0, 0)

    const tenMinsFromNow = new Date(before.getTime() + 10 * 60 * 1000)
    // Allow 2 minute tolerance
    expect(Math.abs(defaultDate.getTime() - tenMinsFromNow.getTime())).toBeLessThan(2 * 60 * 1000)
  })

  it('calls onCancel when Cancel is clicked', () => {
    render(<DatePickerModal text="test" onConfirm={mockConfirm} onCancel={mockCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm with a Date when Set Reminder is clicked', () => {
    render(<DatePickerModal text="test" onConfirm={mockConfirm} onCancel={mockCancel} />)
    fireEvent.click(screen.getByText('Set Reminder'))
    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockConfirm.mock.calls[0][0]).toBeInstanceOf(Date)
  })

  it('uses the date and time inputs when confirming', () => {
    render(<DatePickerModal text="test" onConfirm={mockConfirm} onCancel={mockCancel} />)

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement

    fireEvent.change(dateInput, { target: { value: '2027-06-15' } })
    fireEvent.change(timeInput, { target: { value: '14:30' } })
    fireEvent.click(screen.getByText('Set Reminder'))

    const calledDate = mockConfirm.mock.calls[0][0] as Date
    expect(calledDate.getFullYear()).toBe(2027)
    expect(calledDate.getMonth()).toBe(5) // June = 5
    expect(calledDate.getDate()).toBe(15)
    expect(calledDate.getHours()).toBe(14)
    expect(calledDate.getMinutes()).toBe(30)
  })

  it('renders date input with min and max bounds (±10 years)', () => {
    render(<DatePickerModal text="test" onConfirm={mockConfirm} onCancel={mockCancel} />)
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const minYear = parseInt(dateInput.min.slice(0, 4))
    const maxYear = parseInt(dateInput.max.slice(0, 4))
    const currentYear = new Date().getFullYear()
    expect(minYear).toBe(currentYear - 10)
    expect(maxYear).toBe(currentYear + 10)
  })
})
