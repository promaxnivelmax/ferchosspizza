export const dynamic = 'force-dynamic';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Dashboard ejecutivo (solo admin)
// Archivo: src/app/dashboard/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }       from 'next/navigation';
import { createClient }   from '@/lib/supabase/server';
import AppShell           from '@/components/layout/AppShell';
import DashboardClient    from '@/components/dashboard/DashboardClient';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = createClient();

  // Verificar sesión
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Cargar perfil
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') redirect('/pos');

  // Cargar datos iniciales del dashboard (SSR para velocidad)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const [ordersRes, productsRes, tablesRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, consecutive, status, total, business_unit, payment_method, type, created_at')
      .gte('created_at', today + 'T00:00:00-05:00')
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('products')
      .select('id, name, price, cost, business_unit, is_active')
      .eq('is_active', true),
    supabase
      .from('tables')
      .select('id, number, name, status'),
  ]);

  return (
    <AppShell profile={profile}>
      <DashboardClient
        initialOrders={ordersRes.data ?? []}
        initialProducts={productsRes.data ?? []}
        initialTables={tablesRes.data ?? []}
        profile={profile}
      />
    </AppShell>
  );
}
