'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Página de Login
// Archivo: src/app/login/page.tsx
// ══════════════════════════════════════════════════════════════


import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { UserRole } from '@/lib/types';

// Mapa de redirección por rol
const ROLE_HOME: Record<UserRole, string> = {
  admin:         '/dashboard',
  cajero:        '/pos',
  mesero:        '/pos',
  cocina:        '/kitchen',
  domiciliario:  '/delivery',
  cliente:       '/menu',
};

// ── Usuarios de demostración visibles en pantalla ─────────────
const DEMO_USERS = [
  { role: 'admin',        email: 'admin@ferchos.com',        icon: '👑', label: 'Administrador' },
  { role: 'cajero',       email: 'cajero@ferchos.com',       icon: '💰', label: 'Cajero' },
  { role: 'mesero',       email: 'mesero@ferchos.com',       icon: '🍽️', label: 'Mesero' },
  { role: 'cocina',       email: 'cocina@ferchos.com',       icon: '👨‍🍳', label: 'Cocina' },
  { role: 'domiciliario', email: 'domicilio@ferchos.com',    icon: '🛵', label: 'Domiciliario' },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  // ── Iniciar sesión ────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Completa todos los campos');
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Obtener perfil y redirigir según rol
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, full_name, is_active')
        .eq('id', data.user.id)
        .single();

      if (!profile?.is_active) {
        await supabase.auth.signOut();
        toast.error('Usuario desactivado. Contacta al administrador.');
        return;
      }

      const role = profile.role as UserRole;
      toast.success(`Bienvenido, ${profile.full_name} 👋`);
      router.push(ROLE_HOME[role] ?? '/dashboard');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación';
      if (msg.includes('Invalid login credentials')) {
        toast.error('Email o contraseña incorrectos');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Autocompletar usuario demo ────────────────────────────
  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('Ferchos2025!');
    toast.info('Credenciales cargadas');
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>

      {/* ── Panel izquierdo: marca ────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--bg-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg,#f97316,#dc2626)', boxShadow: '0 0 20px rgba(249,115,22,0.3)' }}
          >
            F
          </div>
          <div>
            <div className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--brand)' }}>FERCHO'S</span> POS
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Restaurante y Pizzería</div>
          </div>
        </div>

        {/* Hero text */}
        <div>
          <div
            className="text-5xl font-display font-bold leading-tight mb-4"
            style={{
              background: 'linear-gradient(135deg,#ffffff 40%,#f97316)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            El sistema que<br />mueve tu negocio
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Control completo de desayunos, almuerzos y pizzería desde una sola plataforma. Tiempo real, rápido y siempre disponible.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {[
              { icon: '⚡', text: 'Pedidos en tiempo real con Supabase Realtime' },
              { icon: '🍕', text: 'Constructor de pizzas mitad y mitad, 4 y 6 sabores' },
              { icon: '📊', text: 'Dashboard ejecutivo por unidad de negocio' },
              { icon: '🔐', text: 'Roles granulares: Admin, Cajero, Mesero, Cocina, Domicilio' },
              { icon: '⏰', text: 'Menú automático según horario Colombia (UTC-5)' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{f.icon}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          © 2025 FERCHO'S — Bucaramanga, Colombia
        </div>
      </div>

      {/* ── Panel derecho: formulario ──────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo móvil */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg,#f97316,#dc2626)' }}
          >F</div>
          <span className="font-display font-bold text-xl">
            <span style={{ color: 'var(--brand)' }}>FERCHO'S</span> POS
          </span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text-primary)' }}>
            Iniciar sesión
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Ingresa con las credenciales de tu rol
          </p>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@ferchos.com"
                className="input-base w-full text-sm px-3 py-2.5"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base w-full text-sm px-3 py-2.5"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full justify-center py-3 text-base font-semibold"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Ingresando...
                </span>
              ) : 'Ingresar al sistema →'}
            </button>
          </form>

          {/* Demo usuarios */}
          <div className="mt-8">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Acceso rápido por rol (demo)
            </div>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_USERS.map(u => (
                <button
                  key={u.role}
                  onClick={() => fillDemo(u.email)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                >
                  <span className="text-base">{u.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{u.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                </button>
              ))}
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
              Contraseña demo: <code style={{ color: 'var(--brand)' }}>Ferchos2025!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
