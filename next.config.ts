import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Allow dev resources (HMR, React hydration) from local network IP.
  // Without this, React doesn't hydrate when accessing via 192.168.x.x
  // and forms submit natively (GET) instead of using JS handlers.
  allowedDevOrigins: ['192.168.1.13'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
