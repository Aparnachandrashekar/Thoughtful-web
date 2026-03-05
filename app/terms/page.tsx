import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service – Thoughtful',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-terra hover:underline mb-8 inline-block"
        >
          ← Back to Thoughtful
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-10">Terms of Service</h1>

        <ul className="space-y-3 text-sm text-gray-700 leading-relaxed list-disc list-inside">
          <li>This product is provided "as is".</li>
          <li>Users are responsible for reviewing calendar entries.</li>
          <li>We are not liable for missed events or errors.</li>
          <li>Access may be revoked for misuse.</li>
          <li>Service may change or be discontinued.</li>
        </ul>
      </div>
    </div>
  )
}
