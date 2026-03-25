import { render, screen } from '@testing-library/react'
import WhatsAppButton from '@/components/WhatsAppButton'

describe('WhatsAppButton', () => {
  it('renders a disabled button when no phone number provided', () => {
    render(<WhatsAppButton phone="" />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Save a phone number to enable WhatsApp')
  })

  it('renders a link when phone number is provided', () => {
    render(<WhatsAppButton phone="14155551234" />)
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    // encodeURIComponent('Hey!') → 'Hey!' (! is not encoded)
    expect(link).toHaveAttribute('href', 'https://wa.me/14155551234?text=Hey!')
  })

  it('opens WhatsApp link in new tab', () => {
    render(<WhatsAppButton phone="14155551234" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not render a link when phone is empty', () => {
    render(<WhatsAppButton phone="" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('applies custom className', () => {
    render(<WhatsAppButton phone="" className="my-class" />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('my-class')
  })

  it('shows the correct title for WhatsApp link', () => {
    render(<WhatsAppButton phone="14155551234" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('title', 'Send via WhatsApp')
  })
})
