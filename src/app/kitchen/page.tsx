export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import KitchenBoard from '@/components/kitchen/KitchenBoard';

export const metadata = { title: 'Cocina' };

export default async function KitchenPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin','cocina'].includes(profile.role)) redirect('/pos');

  const { data: orders } = await supabase
    .from('orders')
    .select('id,consecutive,type,status,business_unit,notes,created_at,estimated_time,table:tables(number,name),items:order_items(id,quantity,notes,status,product:products(id,name,preparation_time,is_pizza))')
    .in('status', ['pendiente','confirmado','en_preparacion','listo'])
    .order('created_at', { ascending: true });

  return (
    <AppShell profile={profile}>
      <KitchenBoard initialOrders={orders ?? []} profile={profile} />
    </AppShell>
  );
}
