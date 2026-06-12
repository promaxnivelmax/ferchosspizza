// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Inventario
// Archivo: src/app/inventory/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell         from '@/components/layout/AppShell';
import InventoryClient  from './InventoryClient';

export const metadata = { title: 'Inventario' };

export default async function InventoryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('*')
    .order('name');

  return (
    <AppShell profile={profile}>
      <InventoryClient initialIngredients={ingredients ?? []} />
    </AppShell>
  );
}
