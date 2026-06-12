// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Layout raíz
// Archivo: src/app/layout.tsx
// ══════════════════════════════════════════════════════════════

import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'sonner';
import '@/styles/globals.css';

// ── Fuentes optimizadas (Next.js font subsetting) ─────────────
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
  preload: true,
});

// ── Metadata SEO ──────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "FERCHOS POS — Restaurante y Pizzería",
    template: "%s | FERCHOS POS",
  },
  description: 'Sistema de punto de venta profesional para FERCHOS Restaurante y Pizzería. Desayunos, almuerzos y pizzas en Bucaramanga.',
  keywords: ['restaurante', 'pizzería', 'pos', 'punto de venta', 'ferchos', 'bucaramanga'],
  authors: [{ name: 'FERCHOS' }],
  robots: 'noindex,nofollow',          // Sistema interno — no indexar
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,               // Evita zoom en inputs móvil
  themeColor: '#f97316',
};

// ── Layout raíz ───────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconectar a Supabase para latencia mínima */}
        <link rel="preconnect" href="https://asywerfhslaqgdkkizyn.supabase.co" />
        <link rel="dns-prefetch" href="https://asywerfhslaqgdkkizyn.supabase.co" />
      </head>
      <body>
        {children}

        {/* Notificaciones toast globales */}
        <Toaster
          position="top-right"
          expand={false}
          richColors
          closeButton
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-inter)',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  );
}
