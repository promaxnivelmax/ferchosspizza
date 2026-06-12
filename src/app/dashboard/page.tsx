export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import DashboardClient from '@/components/dashboard/DashboardClient';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin') redirect('/pos');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const [ordersRes, tablesRes] = await Promise.all([
    supabase.from('orders')
      .select('id,consecutive,status,total,business_unit,payment_method,type,created_at')
      .gte('created_at', today + 'T00:00:00-05:00')
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tables').select('id,number,name,status'),
  ]);

  return (
    <AppShell profile={profile}>
      <DashboardClient
        initialOrders={ordersRes.data ?? []}
        initialProducts={[]}
        initialTables={tablesRes.data ?? []}
        profile={profile}
      />
    </AppShell>
  );
}
