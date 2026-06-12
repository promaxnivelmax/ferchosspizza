'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Reportes Client Component
// Archivo: src/app/reports/ReportsClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCOP, formatPercent } from '@/lib/utils/format';
import type { UserProfile } from '@/lib/types';

interface Props { profile: UserProfile; }

interface ReportData {
  totalSales:    number;
  totalOrders:   number;
  avgTicket:     number;
  salesByUnit:   { unit: string; total: number; count: number }[];
  salesByMethod: { method: string; total: number; count: number }[];
  topProducts:   { name: string; quantity: number; total: number }[];
  dailySales:    { date: string; total: number; count: number }[];
}

const UNIT_LABELS: Record<string, string> = {
  desayunos: '☀️ Desayunos',
  almuerzos: '🍽️ Almuerzos',
  pizzeria:  '🍕 Pizzería',
};
const METHOD_ICONS: Record<string, string> = {
  efectivo: '💵', nequi: '📱', daviplata: '📱', transferencia: '🏦', tarjeta: '💳', mixto: '🎫',
};

export default function ReportsClient({ profile: _profile }: Props) {
  const supabase = createClient();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo,   setDateTo]   = useState(today);
  const [unit,     setUnit]     = useState('all');
  const [data,     setData]     = useState<ReportData | null>(null);
  const [loading,  setLoading]  = useState(false);

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('orders')
        .select(`id, total, business_unit, payment_method, created_at,
                 items:order_items(quantity, unit_price, product:products(name))`)
        .neq('status', 'cancelado')
        .gte('created_at', dateFrom + 'T00:00:00-05:00')
        .lte('created_at', dateTo   + 'T23:59:59-05:00');

      if (unit !== 'all') query = query.eq('business_unit', unit);

      const { data: orders, error } = await query;
      if (error || !orders) throw error;

      const totalSales  = orders.reduce((s, o) => s + (o.total ?? 0), 0);
      const totalOrders = orders.length;
      const avgTicket   = totalOrders > 0 ? totalSales / totalOrders : 0;

      const salesByUnit = ['desayunos','almuerzos','pizzeria'].map(u => ({
        unit: u,
        total: orders.filter(o => o.business_unit === u).reduce((s, o) => s + (o.total ?? 0), 0),
        count: orders.filter(o => o.business_unit === u).length,
      }));

      const methods = ['efectivo','nequi','daviplata','transferencia','tarjeta','mixto'];
      const salesByMethod = methods.map(m => ({
        method: m,
        total: orders.filter(o => o.payment_method === m).reduce((s, o) => s + (o.total ?? 0), 0),
        count: orders.filter(o => o.payment_method === m).length,
      })).filter(m => m.count > 0);

      // Top productos
      const productMap: Record<string, { name: string; quantity: number; total: number }> = {};
      orders.forEach(o => {
        (o.items ?? []).forEach((item: { quantity: number; unit_price: number; product: { name: string } }) => {
          const name = item.product?.name ?? 'Desconocido';
          if (!productMap[name]) productMap[name] = { name, quantity: 0, total: 0 };
          productMap[name].quantity += item.quantity;
          productMap[name].total    += item.unit_price * item.quantity;
        });
      });
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.total - a.total).slice(0, 8);

      // Ventas por día
      const dayMap: Record<string, { date: string; total: number; count: number }> = {};
      orders.forEach(o => {
        const d = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        if (!dayMap[d]) dayMap[d] = { date: d, total: 0, count: 0 };
        dayMap[d].total += o.total ?? 0;
        dayMap[d].count += 1;
      });
      const dailySales = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

      setData({ totalSales, totalOrders, avgTicket, salesByUnit, salesByMethod, topProducts, dailySales });
    } finally { setLoading(false); }
  }, [supabase, dateFrom, dateTo, unit]);

  const maxDay = data ? Math.max(...data.dailySales.map(d => d.total), 1) : 1;

  return (
    <div className="p-4 space-y-5">
      <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Reportes</h1>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Desde</label>
            <input type="date" className="input-base text-sm py-2" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Hasta</label>
            <input type="date" className="input-base text-sm py-2" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Unidad</label>
            <select className="input-base text-sm py-2" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="all">Todas</option>
              <option value="desayunos">☀️ Desayunos</option>
              <option value="almuerzos">🍽️ Almuerzos</option>
              <option value="pizzeria">🍕 Pizzería</option>
            </select>
          </div>
          {/* Accesos rápidos */}
          <div className="flex gap-1.5">
            {[
              { label: 'Hoy',     from: today,    to: today },
              { label: '7 días',  from: weekAgo,  to: today },
              { label: 'Mes',     from: today.slice(0,7)+'-01', to: today },
            ].map(q => (
              <button key={q.label} onClick={() => { setDateFrom(q.from); setDateTo(q.to); }}
                      className="px-2.5 py-2 rounded text-xs font-medium"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
                {q.label}
              </button>
            ))}
          </div>
          <button className="btn-brand px-4 py-2 text-sm" onClick={runReport} disabled={loading}>
            {loading ? '⏳ Calculando…' : '📊 Generar reporte'}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-2">📊</div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Selecciona el rango y genera el reporte
          </div>
        </div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Ventas totales', value: formatCOP(data.totalSales),  color: 'var(--brand)' },
              { label: 'Pedidos',        value: data.totalOrders,             color: 'var(--green)' },
              { label: 'Ticket promedio',value: formatCOP(data.avgTicket),   color: 'var(--blue)'  },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Ventas por día */}
          <div className="card p-4">
            <div className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              Ventas por día
            </div>
            <div className="flex items-end gap-1.5 h-32">
              {data.dailySales.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    {formatCOP(d.total).replace('$','').trim()}
                  </div>
                  <div className="w-full rounded-t transition-all duration-500"
                       style={{
                         height: `${Math.max(6, Math.round((d.total / maxDay) * 96))}px`,
                         background: 'linear-gradient(to top,rgba(249,115,22,0.3),rgba(249,115,22,0.9))',
                       }} title={`${d.date}: ${formatCOP(d.total)}`} />
                  <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    {d.date.slice(5)} {/* MM-DD */}
                  </div>
                </div>
              ))}
              {data.dailySales.length === 0 && (
                <div className="flex-1 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Por unidad */}
            <div className="card p-4">
              <div className="font-display font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                Por unidad de negocio
              </div>
              <div className="space-y-3">
                {data.salesByUnit.map(u => {
                  const pct = data.totalSales > 0 ? (u.total / data.totalSales) * 100 : 0;
                  return (
                    <div key={u.unit}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-secondary)' }}>{UNIT_LABELS[u.unit] ?? u.unit}</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {formatCOP(u.total)} · {u.count} ped
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand)' }} />
                      </div>
                      <div className="text-[10px] mt-0.5 text-right" style={{ color: 'var(--text-muted)' }}>
                        {formatPercent(pct)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Métodos de pago */}
            <div className="card p-4">
              <div className="font-display font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                Métodos de pago
              </div>
              <div className="space-y-2">
                {data.salesByMethod.map(m => (
                  <div key={m.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span>{METHOD_ICONS[m.method] ?? '💳'}</span>
                      <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{m.method}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatCOP(m.total)}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.count} veces</div>
                    </div>
                  </div>
                ))}
                {data.salesByMethod.length === 0 && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos</div>
                )}
              </div>
            </div>
          </div>

          {/* Top productos */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 font-display font-semibold text-sm" style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}>
              🏆 Productos más vendidos
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-base">
                <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Total ventas</th></tr></thead>
                <tbody>
                  {data.topProducts.map((p, i) => (
                    <tr key={p.name}>
                      <td>
                        <span className="font-display font-bold text-sm"
                              style={{ color: i === 0 ? 'var(--yellow)' : i === 1 ? 'var(--text-muted)' : i === 2 ? 'var(--brand)' : 'var(--text-muted)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                        </span>
                      </td>
                      <td className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                      <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{p.quantity}</td>
                      <td className="text-sm font-bold" style={{ color: 'var(--brand)' }}>{formatCOP(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
