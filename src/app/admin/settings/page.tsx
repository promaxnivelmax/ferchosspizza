export const dynamic = 'force-dynamic';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Configuración
// Archivo: src/app/admin/settings/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell         from '@/components/layout/AppShell';

export const metadata = { title: 'Configuración' };

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  return (
    <AppShell profile={profile}>
      <div className="p-4 space-y-4 max-w-2xl">
        <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Configuración</h1>

        {/* Info del sistema */}
        <div className="card p-5 space-y-3">
          <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            ℹ️ Información del sistema
          </div>
          {[
            { label: 'Versión',          value: '1.0.0' },
            { label: 'Negocio',          value: "FERCHO'S Restaurante y Pizzería" },
            { label: 'Zona horaria',     value: 'America/Bogota (UTC-5)' },
            { label: 'Moneda',           value: 'COP — Peso colombiano' },
            { label: 'Base de datos',    value: 'Supabase PostgreSQL' },
            { label: 'Frontend',         value: 'Next.js 14 + Tailwind CSS' },
            { label: 'Proyecto Supabase',value: 'asywerfhslaqgdkkizyn' },
          ].map(i => (
            <div key={i.label} className="flex justify-between py-2"
                 style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.label}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{i.value}</span>
            </div>
          ))}
        </div>

        {/* Horarios de negocio */}
        <div className="card p-5 space-y-3">
          <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            ⏰ Horarios de atención
          </div>
          {[
            { unit: '☀️ Desayunos', hours: '6:00 AM — 10:59 AM', color: 'var(--yellow)' },
            { unit: '🍽️ Almuerzos', hours: '11:00 AM — 3:59 PM', color: 'var(--blue)' },
            { unit: '🍕 Pizzería',  hours: '4:00 PM — 11:00 PM',  color: 'var(--brand)' },
          ].map(h => (
            <div key={h.unit} className="flex justify-between items-center py-2"
                 style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="text-sm font-semibold" style={{ color: h.color }}>{h.unit}</span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{h.hours}</span>
            </div>
          ))}
        </div>

        {/* Accesos rápidos Supabase */}
        <div className="card p-5 space-y-3">
          <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            🔧 Herramientas de administración
          </div>
          {[
            { label: 'Supabase Dashboard',    url: 'https://app.supabase.com/project/asywerfhslaqgdkkizyn',                                   icon: '🗄️' },
            { label: 'Editor SQL',            url: 'https://app.supabase.com/project/asywerfhslaqgdkkizyn/editor',                             icon: '📝' },
            { label: 'Auth — Usuarios',       url: 'https://app.supabase.com/project/asywerfhslaqgdkkizyn/auth/users',                         icon: '👥' },
            { label: 'Table Editor',          url: 'https://app.supabase.com/project/asywerfhslaqgdkkizyn/database/tables',                    icon: '📊' },
            { label: 'Logs en tiempo real',   url: 'https://app.supabase.com/project/asywerfhslaqgdkkizyn/logs/realtime-logs',                 icon: '📡' },
          ].map(l => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-between py-2 group"
               style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <div className="flex items-center gap-2">
                <span>{l.icon}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--brand)' }}>Abrir →</span>
            </a>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
