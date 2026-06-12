'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Mapa interactivo de mesas
// Archivo: src/components/tables/TablesMap.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useEffect, useCallback } from 'react';
import { useRouter }     from 'next/navigation';
import { createClient }  from '@/lib/supabase/client';
import { toast }         from 'sonner';
import { formatCOP }     from '@/lib/utils/format';
import { minutesSince }  from '@/lib/utils/time';
import type { UserProfile } from '@/lib/types';

interface TableRow {
  id: string; number: number; name: string;
  capacity: number; status: string; section: string;
  current_order_id?: string; opened_at?: string;
}
interface OrderRow {
  id: string; consecutive: number; table_id: string;
  status: string; total: number; created_at: string; type: string;
}
interface Props {
  initialTables: TableRow[];
  initialOrders: OrderRow[];
  profile: UserProfile;
}

const STATUS_CONFIG = {
  disponible:     { label: 'Disponible',     color: 'var(--green)',  bg: 'var(--green-dim)',  icon: '✅' },
  ocupada:        { label: 'Ocupada',        color: 'var(--brand)',  bg: 'var(--brand-dim)',  icon: '🔴' },
  pendiente_pago: { label: 'Pago pendiente', color: 'var(--yellow)', bg: 'var(--yellow-dim)', icon: '💳' },
  reservada:      { label: 'Reservada',      color: 'var(--blue)',   bg: 'var(--blue-dim)',   icon: '📅' },
};

export default function TablesMap({ initialTables, initialOrders, profile }: Props) {
  const supabase = createClient();
  const router   = useRouter();
  const [tables, setTables]     = useState<TableRow[]>(initialTables);
  const [orders, setOrders]     = useState<OrderRow[]>(initialOrders);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [filterSection, setSection] = useState('all');

  const refresh = useCallback(async () => {
    const [t, o] = await Promise.all([
      supabase.from('tables').select('*').order('number'),
      supabase.from('orders')
        .select('id,consecutive,table_id,status,total,created_at,type')
        .in('status', ['pendiente','confirmado','en_preparacion','listo','pendiente_pago']),
    ]);
    if (t.data) setTables(t.data);
    if (o.data) setOrders(o.data);
  }, [supabase]);

  useEffect(() => {
    const ch = supabase.channel('tables-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, refresh]);

  async function changeTableStatus(tableId: string, status: string) {
    const { error } = await supabase.from('tables')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tableId);
    if (error) toast.error(error.message);
    else { toast.success('Mesa actualizada'); refresh(); setSelected(null); }
  }

  const sections = ['all', ...Array.from(new Set(tables.map(t => t.section)))];
  const filtered = filterSection === 'all' ? tables : tables.filter(t => t.section === filterSection);

  const stats = {
    disponible:     tables.filter(t => t.status === 'disponible').length,
    ocupada:        tables.filter(t => t.status === 'ocupada').length,
    pendiente_pago: tables.filter(t => t.status === 'pendiente_pago').length,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
            Mapa de Mesas
          </h1>
          <div className="flex gap-3 mt-1">
            {Object.entries(stats).map(([k, v]) => {
              const cfg = STATUS_CONFIG[k as keyof typeof STATUS_CONFIG];
              return (
                <span key={k} className="text-xs" style={{ color: cfg?.color }}>
                  {cfg?.icon} {v} {cfg?.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className="px-2.5 py-1.5 rounded text-xs font-medium transition-all capitalize"
              style={{
                background: filterSection === s ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                color:      filterSection === s ? 'var(--brand)' : 'var(--text-secondary)',
                border:     `1px solid ${filterSection === s ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
              }}
            >{s === 'all' ? 'Todas' : s}</button>
          ))}
        </div>
      </div>

      {/* Grid de mesas */}
      <div className="grid gap-3"
           style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}>
        {filtered.map(table => {
          const cfg = STATUS_CONFIG[table.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disponible;
          const order = orders.find(o => o.table_id === table.id);
          const mins  = order ? minutesSince(order.created_at) : 0;

          return (
            <button
              key={table.id}
              onClick={() => setSelected(table)}
              className="relative rounded-xl p-4 text-left transition-all duration-150"
              style={{
                background:  cfg.bg,
                border:      `2px solid ${cfg.color}`,
                boxShadow:   selected?.id === table.id ? `0 0 0 3px ${cfg.color}40` : 'none',
              }}
            >
              {/* Badge estado */}
              <div
                className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: cfg.color, color: '#fff' }}
              >
                {cfg.icon}
              </div>

              <div className="font-display font-bold text-lg leading-none mb-1"
                   style={{ color: cfg.color }}>
                {table.number}
              </div>
              <div className="text-xs font-semibold mb-1"
                   style={{ color: 'var(--text-primary)' }}>
                {table.name}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {table.section} · {table.capacity} puestos
              </div>

              {order && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${cfg.color}30` }}>
                  <div className="text-[10px] font-bold" style={{ color: cfg.color }}>
                    #{String(order.consecutive).padStart(3,'0')} · ⏱ {mins}m
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {formatCOP(order.total)}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal detalle de mesa */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <div className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {selected.name}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {selected.section} · {selected.capacity} personas
              </div>
            </div>
            <div className="p-5 space-y-2">
              {/* Info orden activa */}
              {orders.find(o => o.table_id === selected.id) && (
                <div className="rounded-lg p-3 mb-3"
                     style={{ background: 'var(--brand-dim)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  {(() => {
                    const o = orders.find(x => x.table_id === selected.id)!;
                    return (
                      <>
                        <div className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                          Pedido #{String(o.consecutive).padStart(3,'0')}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Total: {formatCOP(o.total)} · {minutesSince(o.created_at)} min
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Acciones según rol */}
              {(profile.role === 'admin' || profile.role === 'cajero' || profile.role === 'mesero') && (
                <div className="space-y-2">
                  {selected.status === 'disponible' && (
                    <button
                      className="btn-brand w-full justify-center text-sm"
                      onClick={() => router.push(`/pos?table=${selected.id}`)}
                    >
                      🛒 Nuevo pedido en esta mesa
                    </button>
                  )}
                  {selected.status === 'ocupada' && (
                    <button
                      className="btn-secondary w-full justify-center text-sm"
                      onClick={() => changeTableStatus(selected.id, 'pendiente_pago')}
                    >
                      💳 Marcar pendiente de pago
                    </button>
                  )}
                  {selected.status === 'pendiente_pago' && (
                    <button
                      className="btn-brand w-full justify-center text-sm"
                      onClick={() => changeTableStatus(selected.id, 'disponible')}
                    >
                      ✅ Liberar mesa
                    </button>
                  )}
                  {profile.role === 'admin' && (
                    <>
                      <button
                        className="btn-secondary w-full justify-center text-sm"
                        onClick={() => changeTableStatus(selected.id, 'reservada')}
                      >
                        📅 Marcar como reservada
                      </button>
                      <button
                        className="w-full text-sm py-2 rounded-lg transition-colors"
                        style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
                        onClick={() => changeTableStatus(selected.id, 'disponible')}
                      >
                        🔓 Forzar disponible
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
