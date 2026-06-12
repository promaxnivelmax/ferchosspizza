// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Domicilios
// Archivo: src/app/delivery/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }      from 'next/navigation';
import { createClient }  from '@/lib/supabase/server';
import AppShell          from '@/components/layout/AppShell';
import DeliveryClient    from './DeliveryClient';

export const metadata = { title: 'Domicilios' };

export default async function DeliveryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin','cajero','domiciliario'].includes(profile.role)) redirect('/kitchen');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, consecutive, status, total, delivery_address, notes, created_at, payment_method,
      client:clients(full_name, phone),
      delivery_user:user_profiles!delivery_user_id(full_name),
      items:order_items(quantity, product:products(name))
    `)
    .eq('type', 'domicilio')
    .gte('created_at', today + 'T00:00:00-05:00')
    .order('created_at', { ascending: false });

  const { data: riders } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('role', 'domiciliario')
    .eq('is_active', true);

  return (
    <AppShell profile={profile}>
      <DeliveryClient
        initialOrders={orders ?? []}
        riders={riders ?? []}
        profile={profile}
      />
    </AppShell>
  );
}
