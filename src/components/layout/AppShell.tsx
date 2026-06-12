'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Shell de la aplicación (Sidebar + Topbar)
// Archivo: src/components/layout/AppShell.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { UserProfile, UserRole, BusinessUnit } from '@/lib/types';
import { formatColombiaTime, getActiveBusinessUnit } from '@/lib/utils/time';

// ── Navegación por rol ────────────────────────────────────────
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
  badge?: string;
}[] = [
  { href: '/dashboard',  label: 'Dashboard',      icon: '📊', roles: ['admin'] },
  { href: '/pos',        label: 'Punto de Venta',  icon: '🛒', roles: ['admin','cajero','mesero'] },
  { href: '/tables',     label: 'Mesas',           icon: '🪑', roles: ['admin','cajero','mesero'] },
  { href: '/kitchen',    label: 'Cocina',          icon: '👨‍🍳', roles: ['admin','cocina'] },
  { href: '/inventory',  label: 'Inventario',      icon: '📦', roles: ['admin'] },
  { href: '/clients',    label: 'Clientes',        icon: '👥', roles: ['admin','cajero'] },
  { href: '/cashbox',    label: 'Caja',            icon: '💰', roles: ['admin','cajero'] },
  { href: '/delivery',   label: 'Domicilios',      icon: '🛵', roles: ['admin','cajero','domiciliario'] },
  { href: '/reports',    label: 'Reportes',        icon: '📈', roles: ['admin'] },
  { href: '/admin/products', label: 'Productos',   icon: '🍕', roles: ['admin'] },
  { href: '/admin/users',    label: 'Usuarios',    icon: '👤', roles: ['admin'] },
  { href: '/admin/settings', label: 'Configuración',icon: '⚙️',roles: ['admin'] },
];

// ── Labels de unidad ──────────────────────────────────────────
const BIZ_LABELS: Record<BusinessUnit, string> = {
  all:        'Todas',
  desayunos:  '☀️ Desayunos',
  almuerzos:  '🍽️ Almuerzos',
  pizzeria:   '🍕 Pizzería',
};

interface AppShellProps {
  children: React.ReactNode;
  profile: UserProfile;
}

export default function AppShell({ children, profile }: AppShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [collapsed, setCollapsed]         = useState(false);
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [biz, setBiz]                     = useState<BusinessUnit>('all');
  const [clock, setClock]                 = useState('');
  const [activeUnit, setActiveUnit]       = useState('');
  const [isDark, setIsDark]               = useState(true);
  const [pendingOrders, setPendingOrders] = useState(0);

  // ── Reloj Colombia (UTC-5) ────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setClock(formatColombiaTime());
      setActiveUnit(getActiveBusinessUnit());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Tema ──────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  // ── Suscripción a pedidos pendientes (Realtime) ───────────
  useEffect(() => {
    const channel = supabase
      .channel('pending-orders-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: "status=eq.pendiente",
      }, () => fetchPendingCount())
      .subscribe();

    fetchPendingCount();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendiente');
    setPendingOrders(count ?? 0);
  }, [supabase]);

  // ── Logout ────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    toast.success('Sesión cerrada');
  }

  // ── Filtrar nav por rol ───────────────────────────────────
  const visibleNav = NAV_ITEMS.filter(item =>
    item.roles.includes(profile.role)
  );

  // ── Grupos de nav ─────────────────────────────────────────
  const navGroups = [
    { label: 'Principal', items: visibleNav.filter(i => ['/','/dashboard','/pos','/kitchen','/tables'].includes(i.href)) },
    { label: 'Gestión',   items: visibleNav.filter(i => ['/inventory','/clients','/cashbox','/delivery'].includes(i.href)) },
    { label: 'Admin',     items: visibleNav.filter(i => ['/reports','/admin/products','/admin/users','/admin/settings'].includes(i.href)) },
  ].filter(g => g.items.length > 0);

  // ── Initiales avatar ──────────────────────────────────────
  const initials = profile.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Overlay móvil ──────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════ */}
      <aside
        className="flex flex-col z-50 transition-all duration-200 overflow-hidden flex-shrink-0"
        style={{
          width: collapsed ? '60px' : '240px',
          minWidth: collapsed ? '60px' : '240px',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--bg-border)',
          // Móvil: posición fija
          position: undefined,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 h-[60px] px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bg-border)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg,#f97316,#dc2626)',
              boxShadow: '0 0 12px rgba(249,115,22,0.3)',
            }}
          >
            F
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-display font-bold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--brand)' }}>FERCHO'S</span> POS
              </div>
              <div className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                Restaurante y Pizzería
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2">
          {navGroups.map(group => (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <div
                  className="text-[10px] font-semibold uppercase tracking-widest px-2 py-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const showBadge = item.href === '/kitchen' && pendingOrders > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`nav-item ${isActive ? 'active' : ''} relative`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
                    {!collapsed && (
                      <span className="flex-1 truncate text-[13px]">{item.label}</span>
                    )}
                    {showBadge && !collapsed && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                        style={{ background: 'var(--brand)' }}
                      >
                        {pendingOrders}
                      </span>
                    )}
                    {showBadge && collapsed && (
                      <span
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ background: 'var(--brand)' }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer usuario */}
        <div
          className="p-3 flex items-center gap-2.5 flex-shrink-0"
          style={{ borderTop: '1px solid var(--bg-border)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--brand),var(--purple))' }}
          >
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {profile.full_name}
                </div>
                <div className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>
                  {profile.role}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-sm flex-shrink-0"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}
                title="Cerrar sesión"
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ⬡
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          MAIN
      ════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOPBAR */}
        <header
          className="flex items-center gap-2 px-4 h-[60px] flex-shrink-0"
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--bg-border)',
          }}
        >
          {/* Toggle sidebar */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors hidden lg:flex"
            style={{
              border: '1px solid var(--bg-border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ☰
          </button>

          {/* Breadcrumb */}
          <div className="text-sm truncate hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
            {visibleNav.find(i => pathname.startsWith(i.href))?.label ?? 'Panel'}
          </div>

          {/* Filtro unidad de negocio (solo admin) */}
          {profile.role === 'admin' && (
            <div className="hidden md:flex gap-1 ml-4">
              {(['all','desayunos','almuerzos','pizzeria'] as BusinessUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setBiz(u)}
                  className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                  style={{
                    background: biz === u ? 'var(--brand-dim)' : 'transparent',
                    color: biz === u ? 'var(--brand)' : 'var(--text-muted)',
                    border: `1px solid ${biz === u ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                  }}
                >
                  {BIZ_LABELS[u]}
                </button>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Turno activo */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: 'var(--brand-dim)', color: 'var(--brand)', border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <span className="animate-[blink_1.4s_ease-in-out_infinite] w-1.5 h-1.5 rounded-full bg-current" />
            {activeUnit}
          </div>

          {/* Reloj */}
          <div
            className="font-display font-semibold text-xs px-2.5 py-1 rounded-lg"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)',
            }}
          >
            {clock}
          </div>

          {/* Tema */}
          <button
            onClick={() => setIsDark(d => !d)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{
              border: '1px solid var(--bg-border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-auto page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
