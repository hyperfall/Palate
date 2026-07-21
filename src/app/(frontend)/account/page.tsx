import type { Metadata } from 'next'

import { AccountPanel } from '@/components/AccountPanel'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Sign in to save recipes into your own collections.',
  // A private, functional page — keep it out of the index.
  robots: { index: false, follow: false },
}

export default function AccountPage() {
  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Account</p>
        <h1 className="mt-1 text-[clamp(1.875rem,3vw,2.75rem)]">Your shelf behind the pass.</h1>
        <p className="mt-3 text-slate">
          An account exists for one thing: saving recipes into collections you name yourself.
          No feed, no notifications, no life story.
        </p>
      </header>

      <div className="mt-10">
        <AccountPanel />
      </div>
    </div>
  )
}
