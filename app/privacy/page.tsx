import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy – Thoughtful',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-terra hover:underline mb-8 inline-block"
        >
          ← Back to Thoughtful
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: 5 March 2026</p>

        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed">
              <li>Google account email (via Google OAuth)</li>
              <li>Calendar data created by the application</li>
              <li>Basic usage analytics via PostHog</li>
            </ul>
            <p className="text-sm mt-3">We do not access or store calendars not created by this app.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Information</h2>
            <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed">
              <li>To create and manage calendar entries</li>
              <li>To improve product performance</li>
              <li>To maintain security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Data Storage</h2>
            <p className="text-sm leading-relaxed">User account data is stored using Google Firebase (Google Cloud infrastructure).</p>
            <p className="text-sm leading-relaxed mt-2">Calendar events remain within the user's Google Calendar account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Analytics</h2>
            <p className="text-sm leading-relaxed">We use PostHog to collect anonymized product usage data.</p>
            <p className="text-sm leading-relaxed mt-2">No advertising tracking is used.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Sharing</h2>
            <p className="text-sm leading-relaxed">We do not sell or share personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Revoking Access</h2>
            <p className="text-sm leading-relaxed">
              Users may revoke Google access at any time via their{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-terra hover:underline"
              >
                Google Account permissions page
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Contact</h2>
            <p className="text-sm">
              <a href="mailto:aparnacs008@gmail.com" className="text-terra hover:underline">
                aparnacs008@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
