import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

const geistSans = Geist({
  variable:   '--font-geist-sans',
  subsets:    ['latin'],
  display:    'swap',
})

const geistMono = Geist_Mono({
  variable:   '--font-geist-mono',
  subsets:    ['latin'],
  display:    'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Plataforma Producción',
    default:  'Plataforma de Producción Audiovisual',
  },
  description:
    'Gestión colaborativa de proyectos audiovisuales, musicales y fotográficos.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable:    true,
    statusBarStyle: 'default',
    title:      'Producción',
  },
}

export const viewport: Viewport = {
  themeColor:       '#09090b',
  width:            'device-width',
  initialScale:     1,
  maximumScale:     1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale   = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
