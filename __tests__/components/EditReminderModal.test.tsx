import { render, screen, fireEvent } from '@testing-library/react'
import EditReminderModal from '@/components/EditReminderModal'
import { Reminder } from '@/components/ReminderList'

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: 'reminder-1',
  text: 'Call mom',
  date: new Date('2027-06-15T14:30:00'),
  isCompleted: false,
  ...overrides,
})

describe('EditReminderModal', () => {
  const mockConfirm = jest.fn()
  const mockCancel = jest.fn()

  beforeEach(() => {
    mockConfirm.mockClear()
    mockCancel.mockClear()
  })

  it('renders with existing reminder text pre-filled', () => {
    render(
      <EditReminderModal
        reminder={makeReminder({ text: 'Call mom' })}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    const titleInput = screen.getByDisplayValue('Call mom') as HTMLInputElement
    expect(titleInput).toBeInTheDocument()
  })

  it('renders with existing date pre-filled', () => {
    render(
      <EditReminderModal
        reminder={makeReminder({ date: new Date('2027-06-15T14:30:00') })}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    const dateInput = screen.getByDisplayValue('2027-06-15') as HTMLInputElement
    expect(dateInput).toBeInTheDocument()
  })

  it('shows Edit reminder heading', () => {
    render(
      <EditReminderModal
        reminder={makeReminder()}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    expect(screen.getByText('Edit reminder')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', () => {
    render(
      <EditReminderModal
        reminder={makeReminder()}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm with updated text when Save changes is clicked', () => {
    render(
      <EditReminderModal
        reminder={makeReminder({ text: 'Old title' })}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    const titleInput = screen.getByDisplayValue('Old title')
    fireEvent.change(titleInput, { target: { value: 'New title' } })
    fireEvent.click(screen.getByText('Save changes'))

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    const [id, text] = mockConfirm.mock.calls[0]
    expect(id).toBe('reminder-1')
    expect(text).toBe('New title')
  })

  it('passes updated date to onConfirm', () => {
    render(
      <EditReminderModal
        reminder={makeReminder()}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    const dateInput = screen.getByDisplayValue('2027-06-15')
    const timeInput = screen.getByDisplayValue('14:30')

    fireEvent.change(dateInput, { target: { value: '2028-01-10' } })
    fireEvent.change(timeInput, { target: { value: '09:00' } })
    fireEvent.click(screen.getByText('Save changes'))

    const calledDate = mockConfirm.mock.calls[0][2] as Date
    expect(calledDate.getFullYear()).toBe(2028)
    expect(calledDate.getMonth()).toBe(0) // January
    expect(calledDate.getDate()).toBe(10)
    expect(calledDate.getHours()).toBe(9)
  })

  it('disables Save button when title is empty', () => {
    render(
      <EditReminderModal
        reminder={makeReminder({ text: 'Call mom' })}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    const titleInput = screen.getByDisplayValue('Call mom')
    fireEvent.change(titleInput, { target: { value: '' } })

    const saveButton = screen.getByText('Save changes')
    expect(saveButton).toBeDisabled()
  })

  it('falls back to original text if new text is blank spaces', () => {
    render(
      <EditReminderModal
        reminder={makeReminder({ text: 'Original' })}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    // The Save button is disabled when text is blank — so this tests the disabled state
    const titleInput = screen.getByDisplayValue('Original')
    fireEvent.change(titleInput, { target: { value: '   ' } })
    // Button should be disabled since trim() yields empty
    expect(screen.getByText('Save changes')).toBeDisabled()
  })

  it('renders date input with min and max bounds', () => {
    render(
      <EditReminderModal
        reminder={makeReminder()}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    )
    const dateInput = screen.getByDisplayValue('2027-06-15') as HTMLInputElement
    const minYear = parseInt(dateInput.min.slice(0, 4))
    const maxYear = parseInt(dateInput.max.slice(0, 4))
    const currentYear = new Date().getFullYear()
    expect(minYear).toBe(currentYear - 10)
    expect(maxYear).toBe(currentYear + 10)
  })
})
