'use client'

export default function Privacy() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] py-16 px-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#e2e4e8] p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0d0d0f] mb-2">Privacy Policy</h1>
        <p className="text-[#6b6b7a] text-sm mb-8">Last updated: June 2026</p>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">What we collect</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            Showdeck collects your name and email address when you create an account, either directly or via Google or Facebook OAuth. We store show planning content you create within the app.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">How we use it</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            Your data is used solely to provide the Showdeck service — show planning, collaboration, and runsheet management. We do not sell or share your data with third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">Data deletion</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            You can request deletion of your account and all associated data at any time by emailing <a href="mailto:rcklitzing@gmail.com" className="text-[#00a870] hover:underline">rcklitzing@gmail.com</a>. We will process your request within 30 days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">Facebook Login</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            If you sign in with Facebook, we receive your name and email address from Facebook. We do not store your Facebook password or access your Facebook posts, friends, or other data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#0d0d0f] mb-3">Contact</h2>
          <p className="text-sm text-[#4a4a5a] leading-relaxed">
            For any privacy questions, contact <a href="mailto:rcklitzing@gmail.com" className="text-[#00a870] hover:underline">rcklitzing@gmail.com</a>.
          </p>
        </section>
      </div>
    </main>
  )
}
