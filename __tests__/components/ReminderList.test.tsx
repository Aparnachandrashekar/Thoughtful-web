import { render, screen, fireEvent } from '@testing-library/react'
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

  it('shows birthday label for birthday reminders', () => {
    const reminders = [makeReminder({ id: '1', text: "Mom's birthday", isRecurring: true, isBirthday: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getAllByText(/birthday/i).length).toBeGreaterThan(0)
  })

  it('shows anniversary label for anniversary reminders', () => {
    const reminders = [makeReminder({ id: '1', text: 'Wedding anniversary', isRecurring: true, isAnniversary: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getAllByText(/anniversary/i).length).toBeGreaterThan(0)
  })

  it('shows calendar link icon when calendarHtmlLink is set', () => {
    const reminders = [makeReminder({ id: '1', calendarHtmlLink: 'https://calendar.google.com/event/123' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    const calLink = screen.getByTitle('View in Google Calendar')
    expect(calLink).toBeInTheDocument()
    expect(calLink).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))
  })

  it('does not show calendar icon when no calendarHtmlLink', () => {
    const reminders = [makeReminder({ id: '1' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.queryByTitle('View in Google Calendar')).toBeNull()
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

  it('calls onDelete when delete button is clicked', async () => {
    jest.useFakeTimers()
    const onDelete = jest.fn()
    const reminders = [makeReminder({ id: 'rem-42', text: 'Delete me' })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={onDelete} />)
    fireEvent.click(screen.getByTitle('Delete'))
    jest.advanceTimersByTime(200)
    expect(onDelete).toHaveBeenCalledWith('rem-42')
    jest.useRealTimers()
  })

  it('calls onToggle when circle button is clicked', async () => {
    jest.useFakeTimers()
    const onToggle = jest.fn()
    const reminders = [makeReminder({ id: 'rem-99' })]
    render(<ReminderList reminders={reminders} onToggle={onToggle} onDelete={noop} />)
    fireEvent.click(screen.getByLabelText('Mark complete'))
    jest.advanceTimersByTime(200)
    expect(onToggle).toHaveBeenCalledWith('rem-99')
    jest.useRealTimers()
  })

  it('shows birthday recurring label', () => {
    const reminders = [makeReminder({ id: '1', isRecurring: true, isBirthday: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText(/Birthday · yearly/i)).toBeInTheDocument()
  })

  it('shows anniversary recurring label', () => {
    const reminders = [makeReminder({ id: '1', isRecurring: true, isAnniversary: true })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    expect(screen.getByText(/Anniversary · yearly/i)).toBeInTheDocument()
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

  it('renders WhatsApp button when no phone', () => {
    const reminders = [makeReminder({ id: '1', phoneNumber: undefined })]
    render(<ReminderList reminders={reminders} onToggle={noop} onDelete={noop} />)
    const whatsappBtn = screen.getByTitle('Save a phone number to enable WhatsApp')
    expect(whatsappBtn).toBeInTheDocument()
  })
})
