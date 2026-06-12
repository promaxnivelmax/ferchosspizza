export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import ClientsClient from './ClientsClient';
export const metadata = { title: 'Clientes' };
export default async function ClientsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin','cajero'].includes(profile.role)) redirect('/pos');
  const { data: clients } = await supabase.from('clients').select('*').order('full_name');
  return <AppShell profile={profile}><ClientsClient initialClients={clients ?? []} /></AppShell>;
}
