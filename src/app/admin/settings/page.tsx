export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
export const metadata = { title: 'Configuración' };
export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');
  return (
    <AppShell profile={profile}>
      <div style={{ padding: '2rem', maxWidth: '600px' }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Configuración</h1>
        {[
          { label: 'Versión', value: '1.0.0' },
          { label: 'Negocio', value: "FERCHO'S Restaurante y Pizzería" },
          { label: 'Zona horaria', value: 'America/Bogota (UTC-5)' },
          { label: 'Moneda', value: 'COP — Peso colombiano' },
          { label: 'Base de datos', value: 'Supabase PostgreSQL' },
          { label: 'Proyecto', value: 'asywerfhslaqgdkkizyn' },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'0.75rem', borderBottom:'1px solid var(--bg-border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{item.label}</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>{item.value}</span>
          </div>
        ))}
        <div style={{ marginTop: '1.5rem' }}>
          <a href="https://supabase.com/dashboard/project/asywerfhslaqgdkkizyn/auth/users" target="_blank"
             style={{ display:'inline-block', padding:'0.5rem 1rem', background:'var(--brand)', color:'white', borderRadius:'8px', textDecoration:'none', fontSize:'0.875rem' }}>
            Abrir Supabase Dashboard →
          </a>
        </div>
      </div>
    </AppShell>
  );
}
