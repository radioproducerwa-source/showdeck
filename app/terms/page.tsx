'use client'
import Link from 'next/link'

export default function Terms() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] py-16 px-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#e2e4e8] p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0d0d0f] mb-2">Terms of Service</h1>
        <p className="text-[#6b6b7a] text-sm mb-8">Last updated: July 2026</p>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">1. Acceptance of terms</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            By creating an account and using Showdeck, you agree to these Terms of Service. If you do not agree, please do not use the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">2. What Showdeck is</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            Showdeck is a collaborative show planning workspace for podcast and radio teams. It allows you to plan episodes, manage runsheets, and coordinate with your team.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">3. Your account</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            You are responsible for maintaining the security of your account and for all activity that occurs under it. You must not share your login credentials. You must be at least 13 years old to use Showdeck.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">4. Your content</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            You retain ownership of all content you create within Showdeck. By using the service, you grant Showdeck a limited licence to store and display your content for the purpose of providing the service. We do not claim ownership of your show plans, notes, or other content.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">5. Acceptable use</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            You agree not to misuse Showdeck. This includes attempting to access other users' accounts, uploading malicious content, using the service to harass others, or attempting to reverse-engineer or scrape the platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">6. Service availability</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            Showdeck is provided on an "as is" basis. We aim for high availability but do not guarantee uninterrupted access. We are not liable for any loss resulting from downtime or data loss, though we take reasonable precautions to protect your data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">7. Termination</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            You may delete your account at any time from your profile settings. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your data will be deleted within 30 days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">8. Changes to these terms</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            We may update these terms from time to time. Continued use of Showdeck after changes are posted constitutes acceptance of the updated terms. We will make reasonable efforts to notify you of significant changes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">9. Contact</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            For any questions about these terms, contact{' '}
            <a href="mailto:rcklitzing@gmail.com" className="text-[#00a870] hover:underline">rcklitzing@gmail.com</a>.
          </p>
        </section>

        <div className="mt-10 pt-6 border-t border-[#e2e4e8] flex gap-4 text-xs text-[#9a9aaa]">
          <Link href="/privacy" className="hover:text-[#00a870] transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-[#00a870] transition-colors">Back to Showdeck</Link>
        </div>
      </div>
    </main>
  )
}
