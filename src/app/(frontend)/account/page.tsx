import type { Metadata } from 'next'
import Link from 'next/link'

import { AccountPanel } from '@/components/AccountPanel'
import { SupporterStatus } from '@/components/SupporterStatus'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Sign in to save recipes into your own collections.',
  // A private, functional page — keep it out of the index.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function AccountPage() {
  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Account</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Settings.</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Your name, handle, avatar and membership. Your saved recipes and week live on your{' '}
          <Link href="/dashboard" className="text-flame underline underline-offset-4">
            dashboard
          </Link>
          .
        </p>
      </header>

      <div className="mt-10">
        <AccountPanel />
        <SupporterStatus />
      </div>
    </div>
  )
}
