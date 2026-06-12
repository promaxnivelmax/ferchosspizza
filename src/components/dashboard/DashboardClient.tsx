'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Dashboard Cliente (tiempo real)
// Archivo: src/components/dashboard/DashboardClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCOP, formatPercent } from '@/lib/utils/format';
import { formatColombiaDate } from '@/lib/utils/time';
import type { UserProfile } from '@/lib/types';

interface Props {
  initialOrders:   Record<string, unknown>[];
  initialProducts: Record<string, unknown>[];
  initialTables:   Record<string, unknown>[];
  profile:         UserProfile;
}

// ── Colores por unidad de negocio ─────────────────────────────
const UNIT_CONFIG = {
  desayunos: { label: '☀️ Desayunos', color: '#eab308' },
  almuerzos: { label: '🍽️ Almuerzos', color: '#3b82f6' },
  pizzeria:  { label: '🍕 Pizzería',  color: '#f97316' },
};

export default function DashboardClient({ initialOrders, initialTables, profile }: Props) {
  const supabase = createClient();
  const [orders, setOrders]   = useState<Record<string,unknown>[]>(initialOrders);
  const [tables, setTables]   = useState<Record<string,unknown>[]>(initialTables);
  const [loading, setLoading] = useState(false);

  // ── Refrescar datos ───────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { data } = await supabase
      .from('orders')
      .select('id,consecutive,status,total,business_unit,payment_method,type,created_at')
      .gte('created_at', today + 'T00:00:00-05:00')
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setOrders(data);
    setLoading(false);
  }, [supabase]);

  // ── Suscripción Realtime a pedidos ────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, refresh]);

  // ── Suscripción Realtime a mesas ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, async () => {
        const { data } = await supabase.from('tables').select('id,number,name,status');
        if (data) setTables(data);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // ── Métricas calculadas ───────────────────────────────────
  const totalSales   = orders.reduce((s, o) => s + ((o.total as number) ?? 0), 0);
  const totalOrders  = orders.length;
  const avgTicket    = totalOrders > 0 ? totalSales / totalOrders : 0;
  const activeTables = tables.filter(t => t.status === 'ocupada').length;
  const pending      = orders.filter(o => o.status === 'pendiente').length;

  // Ventas por unidad
  const salesByUnit = ['desayunos', 'almuerzos', 'pizzeria'].map(unit => ({
    unit,
    total: orders.filter(o => o.business_unit === unit)
                 .reduce((s, o) => s + ((o.total as number) ?? 0), 0),
    count: orders.filter(o => o.business_unit === unit).length,
  }));

  // Ventas por hora (gráfico de barras)
  const salesByHour = Array.from({ length: 18 }, (_, i) => {
    const hour = i + 6; // 6am a 11pm
    const total = orders
      .filter(o => {
        const h = new Date(o.created_at as string)
          .toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false });
        return parseInt(h, 10) === hour;
      })
      .reduce((s, o) => s + ((o.total as number) ?? 0), 0);
    return { hour, label: hour > 12 ? `${hour - 12}pm` : `${hour}am`, total };
  });

  const maxHourSales = Math.max(...salesByHour.map(h => h.total), 1);

  // Métodos de pago
  const paymentMethods = [
    { method: 'efectivo',      label: '💵 Efectivo',     icon: '💵' },
    { method: 'nequi',         label: '📱 Nequi',        icon: '📱' },
    { method: 'daviplata',     label: '📱 Daviplata',    icon: '📱' },
    { method: 'transferencia', label: '🏦 Transferencia',icon: '🏦' },
    { method: 'tarjeta',       label: '💳 Tarjeta',      icon: '💳' },
  ].map(p => ({
    ...p,
    count: orders.filter(o => o.payment_method === p.method).length,
    total: orders.filter(o => o.payment_method === p.method)
                 .reduce((s, o) => s + ((o.total as number) ?? 0), 0),
  })).filter(p => p.count > 0);

  // Últimas órdenes
  const recentOrders = orders.slice(0, 8);

  const statusLabel: Record<string, string> = {
    pendiente:       'Pendiente',
    confirmado:      'Confirmado',
    en_preparacion:  'En cocina',
    listo:           'Listo',
    entregado:       'Entregado',
    cancelado:       'Cancelado',
  };
  const statusClass: Record<string, string> = {
    pendiente:       'badge-yellow',
    confirmado:      'badge-blue',
    en_preparacion:  'badge-brand',
    listo:           'badge-green',
    entregado:       'badge-green',
    cancelado:       'badge-red',
  };

  return (
    <div className="p-5 space-y-5">

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
            Dashboard Ejecutivo
          </h1>
          <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-secondary)' }}>
            {formatColombiaDate()} · {profile.full_name}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          {loading ? '↻ Actualizando…' : '↻ Refrescar'}
        </button>
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ventas del día', value: formatCOP(totalSales), icon: '💵', accent: 'var(--brand)', delta: '+12%' },
          { label: 'Pedidos',        value: totalOrders,            icon: '🛒', accent: 'var(--green)', delta: pending + ' pendientes' },
          { label: 'Ticket promedio',value: formatCOP(avgTicket),   icon: '🎫', accent: 'var(--blue)', delta: '' },
          { label: 'Mesas activas',  value: `${activeTables} / ${tables.length}`, icon: '🪑', accent: 'var(--purple)', delta: '' },
        ].map(stat => (
          <div key={stat.label} className="stat-card">
            {/* Línea de color superior */}
            <div
              className="absolute top-0 left-0 right-0 h-0.5 opacity-70"
              style={{ background: `linear-gradient(90deg,transparent,${stat.accent},transparent)` }}
            />
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                 style={{ color: 'var(--text-muted)' }}>
              {stat.label}
            </div>
            <div className="font-display font-bold text-xl leading-none mb-1.5"
                 style={{ color: 'var(--text-primary)' }}>
              {stat.value}
            </div>
            {stat.delta && (
              <div className="text-[10px]" style={{ color: stat.accent }}>
                {stat.delta}
              </div>
            )}
            <div className="absolute top-4 right-4 text-xl opacity-10">{stat.icon}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── Ventas por hora ────────────────────────────── */}
        <div className="xl:col-span-2 card p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Ventas por hora — hoy
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Zona horaria Colombia
            </span>
          </div>
          <div className="flex items-end gap-1 h-36">
            {salesByHour.map(h => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t transition-all duration-500"
                  style={{
                    height: `${Math.max(4, Math.round((h.total / maxHourSales) * 120))}px`,
                    background: h.total > 0
                      ? 'linear-gradient(to top,rgba(249,115,22,0.3),rgba(249,115,22,0.8))'
                      : 'var(--bg-elevated)',
                  }}
                  title={`${h.label}: ${formatCOP(h.total)}`}
                />
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{h.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ventas por unidad ──────────────────────────── */}
        <div className="card p-4">
          <div className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Por unidad de negocio
          </div>
          <div className="space-y-4">
            {salesByUnit.map(u => {
              const cfg = UNIT_CONFIG[u.unit as keyof typeof UNIT_CONFIG];
              const pct = totalSales > 0 ? (u.total / totalSales) * 100 : 0;
              return (
                <div key={u.unit}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-bold" style={{ color: cfg.color }}>
                      {formatCOP(u.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: cfg.color }}
                    />
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {u.count} pedidos · {formatPercent(pct)} del total
                  </div>
                </div>
              );
            })}
          </div>

          {/* Métodos de pago */}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--bg-border)' }}>
            <div className="font-display font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
              Métodos de pago
            </div>
            <div className="space-y-2">
              {paymentMethods.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin ventas aún</p>
              ) : paymentMethods.map(p => (
                <div key={p.method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.icon}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatCOP(p.total)}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {p.count} pagos
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Últimas órdenes ────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3"
             style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Últimas órdenes
          </span>
          <span className="badge badge-brand">{totalOrders} hoy</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-base">
            <thead>
              <tr>
                <th>#</th><th>Tipo</th><th>Unidad</th><th>Total</th>
                <th>Método</th><th>Estado</th><th>Hora</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8"
                      style={{ color: 'var(--text-muted)' }}>
                    Sin órdenes hoy
                  </td>
                </tr>
              ) : recentOrders.map((o) => (
                <tr key={o.id as string}>
                  <td>
                    <span className="font-display font-bold text-xs" style={{ color: 'var(--brand)' }}>
                      #{String(o.consecutive).padStart(3,'0')}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {o.type === 'mesa' ? '🪑 Mesa' : o.type === 'domicilio' ? '🛵 Domicilio' : '👜 Llevar'}
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {UNIT_CONFIG[o.business_unit as keyof typeof UNIT_CONFIG]?.label ?? o.business_unit as string}
                  </td>
                  <td>
                    <span className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                      {formatCOP(o.total as number)}
                    </span>
                  </td>
                  <td className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {o.payment_method as string ?? '—'}
                  </td>
                  <td>
                    <span className={`badge ${statusClass[o.status as string] ?? 'badge-blue'}`}>
                      {statusLabel[o.status as string] ?? o.status as string}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(o.created_at as string).toLocaleTimeString('es-CO', {
                      timeZone: 'America/Bogota',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
