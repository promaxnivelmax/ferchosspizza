export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import POSClient from '@/components/pos/POSClient';

export const metadata = { title: 'Punto de Venta' };

export default async function POSPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin','cajero','mesero'].includes(profile.role)) redirect('/kitchen');

  const [productsRes, tablesRes, extrasRes, clientsRes] = await Promise.all([
    supabase.from('products')
      .select('id,name,description,price,cost,business_unit,preparation_time,is_pizza,allow_halves,category_id,image_url')
      .eq('is_active', true).order('sort_order'),
    supabase.from('tables')
      .select('id,number,name,status,section,capacity').order('number'),
    supabase.from('extras')
      .select('id,name,price,cost,category').eq('is_active', true),
    supabase.from('clients')
      .select('id,full_name,phone,address').eq('is_active', true).order('full_name').limit(200),
  ]);

  return (
    <AppShell profile={profile}>
      <POSClient
        products={productsRes.data ?? []}
        tables={tablesRes.data ?? []}
        extras={extrasRes.data ?? []}
        clients={clientsRes.data ?? []}
        profile={profile}
      />
    </AppShell>
  );
}
