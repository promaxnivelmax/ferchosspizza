// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Cliente Supabase (navegador)
// Archivo: src/lib/supabase/client.ts
// ══════════════════════════════════════════════════════════════

import { createBrowserClient } from '@supabase/ssr';

/**
 * Crea el cliente de Supabase para uso en el navegador (componentes cliente).
 * Se usa en hooks, componentes con 'use client', y store de Zustand.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
