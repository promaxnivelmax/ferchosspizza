// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Admin: Gestión de usuarios
// Archivo: src/app/admin/users/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell         from '@/components/layout/AppShell';
import UsersAdmin       from './UsersAdmin';

export const metadata = { title: 'Usuarios' };

export default async function AdminUsersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  const { data: users } = await supabase
    .from('user_profiles').select('*').order('role').order('full_name');

  return (
    <AppShell profile={profile}>
      <UsersAdmin initialUsers={users ?? []} currentUserId={profile.id} />
    </AppShell>
  );
}
