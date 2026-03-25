import { render, screen, act } from '@testing-library/react'
import ReminderList, { Reminder } from '@/components/ReminderList'

const makeReminder = (overrides: Partial<Reminder> & { id: string }): Reminder => ({
  text: 'Test reminder',
  date: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  isCompleted: false,
  ...overrides,
})

describe('ReminderList', () => {
  const noop = () => {}

  it('shows empty state when no reminders', () => {
    render(<ReminderList reminders={[]} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText('No reminders yet')).toBeInTheDocument()
  })

  it('shows upcoming section for future reminders', () => {
    const reminders = [makeReminder({ id: '1', text: 'Buy milk', date: new Date(Date.now() + 3600_000) })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  it('shows history section for past reminders', () => {
    const reminders = [makeReminder({ id: '1', text: 'Old task', date: new Date(Date.now() - 3600_000) })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText(/history/i)).toBeInTheDocument()
    expect(screen.getByText('Old task')).toBeInTheDocument()
  })

  it('shows history section for completed reminders', () => {
    const reminders = [makeReminder({ id: '1', text: 'Done task', isCompleted: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText(/history/i)).toBeInTheDocument()
  })

  it('shows recurring section for recurring reminders', () => {
    const reminders = [makeReminder({ id: '1', text: 'Weekly gym', isRecurring: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    // There may be multiple elements matching "recurring" (header + label)
    expect(screen.getAllByText(/recurring/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Weekly gym')).toBeInTheDocument()
  })

  it('shows birthday emoji for birthday reminders', () => {
    const reminders = [makeReminder({ id: '1', text: "Mom's birthday", isRecurring: true, isBirthday: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText('🎂')).toBeInTheDocument()
  })

  it('shows anniversary emoji for anniversary reminders', () => {
    const reminders = [makeReminder({ id: '1', text: 'Wedding anniversary', isRecurring: true, isAnniversary: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText('💝')).toBeInTheDocument()
  })

  it('shows calendar link icon when calendarHtmlLink is set', () => {
    const reminders = [makeReminder({ id: '1', calendarHtmlLink: 'https://calendar.google.com/event/123' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    const calLink = screen.getByTitle('Open in Google Calendar')
    expect(calLink).toBeInTheDocument()
    expect(calLink).toHaveAttribute('href', 'https://calendar.google.com/event/123')
  })

  it('does not show calendar icon when no calendarHtmlLink', () => {
    const reminders = [makeReminder({ id: '1' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.queryByTitle('Open in Google Calendar')).toBeNull()
  })

  it('shows edit button when onEdit is provided', () => {
    const reminders = [makeReminder({ id: '1' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} onEdit={noop} />)
    expect(screen.getByTitle('Edit')).toBeInTheDocument()
  })

  it('does not show edit button when onEdit is not provided', () => {
    const reminders = [makeReminder({ id: '1' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.queryByTitle('Edit')).toBeNull()
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = jest.fn()
    const reminders = [makeReminder({ id: 'rem-42', text: 'Delete me' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={onDelete} />)
    const deleteBtn = screen.getByTitle('Delete')
    deleteBtn.click()
    expect(onDelete).toHaveBeenCalledWith('rem-42')
  })

  it('calls onToggle when circle button is clicked', () => {
    const onToggle = jest.fn()
    const reminders = [makeReminder({ id: 'rem-99' })]
    render(<ReminderList reminders={reminders} onToggle={onToggle} onDelete={noop} />)
    const toggleBtn = screen.getByLabelText('Mark complete')
    toggleBtn.click()
    expect(onToggle).toHaveBeenCalledWith('rem-99')
  })

  it('shows "Yearly · Birthday" label for birthday reminders', () => {
    const reminders = [makeReminder({ id: '1', isRecurring: true, isBirthday: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText('Yearly · Birthday')).toBeInTheDocument()
  })

  it('shows "Yearly · Anniversary" label for anniversary reminders', () => {
    const reminders = [makeReminder({ id: '1', isRecurring: true, isAnniversary: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText('Yearly · Anniversary')).toBeInTheDocument()
  })

  it('shows "Today" in date for upcoming reminders today', () => {
    const todayReminder = makeReminder({ id: '1', date: new Date(Date.now() + 30 * 60 * 1000) })
    render(<ReminderList reminders={[todayReminder]} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText(/today/i)).toBeInTheDocument()
  })

  it('sorts upcoming reminders by date ascending', () => {
    const reminders = [
      makeReminder({ id: 'b', text: 'Later task', date: new Date(Date.now() + 2 * 3600_000) }),
      makeReminder({ id: 'a', text: 'Earlier task', date: new Date(Date.now() + 3600_000) }),
    ]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    const items = screen.getAllByText(/task/)
    expect(items[0].textContent).toBe('Earlier task')
    expect(items[1].textContent).toBe('Later task')
  })

  it('renders WhatsApp button disabled when no phone', () => {
    const reminders = [makeReminder({ id: '1', phoneNumber: undefined })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    const whatsappBtn = screen.getByTitle('Save a phone number to enable WhatsApp')
    expect(whatsappBtn).toBeDisabled()
  })
})
