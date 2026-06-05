// src/app/layout.tsx

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import ThemeProvider from '@/components/ThemeProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'РидМаркет — Поездки и объявления',
    template: '%s | РидМаркет',
  },
  description: 'Сервис совместных поездок с договорной ценой. Найди попутчика или водителя рядом с тобой.',
  keywords: ['такси', 'поездки', 'попутчики', 'водитель', 'пассажир', 'карпулинг'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'РидМаркет',
  },
}

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <ThemeProvider />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1F2937',
              color: '#F9FAFB',
              borderRadius: '12px',
              fontSize: '14px',
              padding: '12px 16px',
            },
            success: {
              iconTheme: { primary: '#22C55E', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#F43F5E', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}
