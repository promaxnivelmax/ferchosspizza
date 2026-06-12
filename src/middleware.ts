// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Middleware de autenticación y roles
// Archivo: src/middleware.ts
// ══════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { UserRole } from '@/lib/types';

// ── Rutas protegidas por rol ──────────────────────────────────
const ROLE_ROUTES: Record<string, UserRole[]> = {
  '/dashboard':  ['admin'],
  '/pos':        ['admin', 'cajero', 'mesero'],
  '/kitchen':    ['admin', 'cocina'],
  '/tables':     ['admin', 'cajero', 'mesero'],
  '/inventory':  ['admin'],
  '/clients':    ['admin', 'cajero'],
  '/cashbox':    ['admin', 'cajero'],
  '/delivery':   ['admin', 'cajero', 'domiciliario'],
  '/reports':    ['admin'],
  '/admin':      ['admin'],
};

// ── Ruta de inicio por rol ────────────────────────────────────
const ROLE_HOME: Record<UserRole, string> = {
  admin:         '/dashboard',
  cajero:        '/pos',
  mesero:        '/pos',
  cocina:        '/kitchen',
  domiciliario:  '/delivery',
  cliente:       '/menu',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Crear response mutable
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ── Crear cliente Supabase ────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Obtener sesión activa ─────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();

  // ── Si no hay sesión y va a ruta protegida → login ────────
  if (!user && pathname !== '/login' && !pathname.startsWith('/api')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ── Si hay sesión y va a /login → redirigir a su home ─────
  if (user && pathname === '/login') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as UserRole | undefined;
    const home = role ? ROLE_HOME[role] : '/dashboard';

    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // ── Verificar permisos por ruta ───────────────────────────
  if (user) {
    const matchedRoute = Object.keys(ROLE_ROUTES).find(route =>
      pathname.startsWith(route)
    );

    if (matchedRoute) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role as UserRole | undefined;
      const allowedRoles = ROLE_ROUTES[matchedRoute];

      if (role && !allowedRoles.includes(role)) {
        // No tiene permiso → redirigir a su home
        const url = request.nextUrl.clone();
        url.pathname = ROLE_HOME[role] ?? '/login';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

// ── Configurar en qué rutas corre el middleware ───────────────
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)',
  ],
};
