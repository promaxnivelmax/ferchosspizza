export const dynamic = 'force-dynamic';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Caja
// Archivo: src/app/cashbox/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell         from '@/components/layout/AppShell';
import CashboxClient    from './CashboxClient';

export const metadata = { title: 'Caja' };

export default async function CashboxPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin', 'cajero'].includes(profile.role)) redirect('/pos');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const [sessionRes, movementsRes] = await Promise.all([
    supabase
      .from('cashbox_sessions')
      .select('*')
      .eq('is_open', true)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cashbox_movements')
      .select('*, user:user_profiles(full_name)')
      .gte('created_at', today + 'T00:00:00-05:00')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <AppShell profile={profile}>
      <CashboxClient
        initialSession={sessionRes.data}
        initialMovements={movementsRes.data ?? []}
        profile={profile}
      />
    </AppShell>
  );
}
