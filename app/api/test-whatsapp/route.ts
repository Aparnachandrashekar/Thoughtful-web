import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(req: Request) {
  const { to } = await req.json()

  if (!to) {
    return NextResponse.json({ error: 'Missing "to" phone number' }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio env vars not configured' }, { status: 500 })
  }

  const client = twilio(accountSid, authToken)

  try {
    const message = await client.messages.create({
      body: 'This is a test reminder from Thoughtful',
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${to}`,
    })

    return NextResponse.json({ success: true, sid: message.sid })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
