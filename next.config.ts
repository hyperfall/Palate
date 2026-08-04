import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/**
 * Baseline security headers on every response — clickjacking, MIME-sniffing,
 * referrer leakage, and unused device APIs.
 *
 * The Content-Security-Policy is NOT here: it needs a per-request nonce, so it's
 * built in the proxy/middleware (`src/proxy.ts`) as a strict, nonce-based
 * `strict-dynamic` policy with a `/csp-report` violation sink. Keep policy edits
 * there; this list is only the static, nonce-free headers.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    return [
      // The price book briefly lived at /prices before it became a calculator.
      // The route was noindex and days old, so nothing external points at it —
      // but anyone who bookmarked it in that window should still land somewhere.
      { source: '/prices', destination: '/calculator', permanent: true },
    ]
  },
  images: {
    // Food photography is the product — serve modern formats and let the
    // optimizer emit AVIF (then WebP) per device instead of the source JPEG/PNG.
    formats: ['image/avif', 'image/webp'],
    // Allowed `quality` values (Next 16 requires the set to be explicit).
    qualities: [75, 82, 90],
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
