// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Mapa de Mesas
// Archivo: src/app/tables/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell         from '@/components/layout/AppShell';
import TablesMap        from '@/components/tables/TablesMap';

export const metadata = { title: 'Mesas' };

export default async function TablesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin','cajero','mesero'].includes(profile.role)) redirect('/kitchen');

  const [tablesRes, ordersRes] = await Promise.all([
    supabase.from('tables').select('*').order('number'),
    supabase.from('orders')
      .select('id, consecutive, table_id, status, total, created_at, type')
      .in('status', ['pendiente','confirmado','en_preparacion','listo','pendiente_pago'])
  ]);

  return (
    <AppShell profile={profile}>
      <TablesMap
        initialTables={tablesRes.data ?? []}
        initialOrders={ordersRes.data ?? []}
        profile={profile}
      />
    </AppShell>
  );
}
