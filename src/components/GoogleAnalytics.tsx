'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { useConsent } from './ConsentManager'

/**
 * GA4 wired to consent, the strict way: the gtag script is not injected at all
 * until the visitor grants Analytics — so no Google cookie or request happens
 * before opt-in. Consent Mode v2 signals still ride along (analytics_storage
 * from the Analytics category, the ad_* signals from Marketing) and update live
 * when the visitor changes their mind. Dormant until NEXT_PUBLIC_GA_ID is set.
 */
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export function GoogleAnalytics() {
  const { consent } = useConsent()
  const pathname = usePathname()
  const analytics = Boolean(consent?.analytics)
  const marketing = Boolean(consent?.marketing)
  const enabled = Boolean(GA_ID) && analytics

  // Keep Consent Mode in sync when the visitor changes categories after load.
  useEffect(() => {
    if (!GA_ID || typeof window.gtag !== 'function') return
    window.gtag('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_storage: marketing ? 'granted' : 'denied',
      ad_user_data: marketing ? 'granted' : 'denied',
      ad_personalization: marketing ? 'granted' : 'denied',
    })
  }, [analytics, marketing])

  // SPA page views (GA auto-tracks the first load; subsequent route changes need this).
  useEffect(() => {
    if (!enabled || typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', { page_path: pathname })
  }, [pathname, enabled])

  if (!enabled) return null

  return (
    <>
      <Script
        id="ga-lib"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('consent', 'default', {
            analytics_storage: '${analytics ? 'granted' : 'denied'}',
            ad_storage: '${marketing ? 'granted' : 'denied'}',
            ad_user_data: '${marketing ? 'granted' : 'denied'}',
            ad_personalization: '${marketing ? 'granted' : 'denied'}'
          });
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
