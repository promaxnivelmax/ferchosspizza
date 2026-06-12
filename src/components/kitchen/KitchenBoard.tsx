'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Tablero de cocina (Kanban tiempo real)
// Archivo: src/components/kitchen/KitchenBoard.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { minutesSince } from '@/lib/utils/time';
import type { UserProfile } from '@/lib/types';

interface KitchenOrder {
  id: string;
  consecutive: number;
  type: string;
  status: string;
  business_unit: string;
  notes?: string;
  created_at: string;
  estimated_time?: number;
  table?: { number: number; name: string } | null;
  items: {
    id: string;
    quantity: number;
    notes?: string;
    status: string;
    product: { id: string; name: string; preparation_time: number; is_pizza: boolean };
  }[];
}

interface Props {
  initialOrders: KitchenOrder[];
  profile:       UserProfile;
}

// ── Columnas del tablero Kanban ───────────────────────────────
const COLUMNS = [
  { key: 'pendiente',      label: 'Pendiente',     color: 'var(--text-muted)' },
  { key: 'confirmado',     label: 'Confirmado',    color: 'var(--blue)' },
  { key: 'en_preparacion', label: 'En preparación',color: 'var(--brand)' },
  { key: 'listo',          label: 'Listo',         color: 'var(--green)' },
] as const;

// ── Siguiente estado en el flujo ──────────────────────────────
const NEXT_STATUS: Record<string, string> = {
  pendiente:       'confirmado',
  confirmado:      'en_preparacion',
  en_preparacion:  'listo',
  listo:           'entregado',
};

const NEXT_BTN: Record<string, string> = {
  pendiente:       '✓ Confirmar',
  confirmado:      '🔥 Iniciar',
  en_preparacion:  '✅ Listo',
  listo:           '🚀 Entregar',
};

export default function KitchenBoard({ initialOrders, profile }: Props) {
  const supabase = createClient();
  const [orders, setOrders]     = useState<KitchenOrder[]>(initialOrders);
  const [ticks, setTicks]       = useState(0);          // fuerza re-render para timers
  const [tvMode, setTvMode]     = useState(false);

  // ── Refrescar datos ───────────────────────────────────────
  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, consecutive, type, status, business_unit, notes, created_at, estimated_time,
        table:tables(number, name),
        items:order_items(
          id, quantity, notes, status,
          product:products(id, name, preparation_time, is_pizza)
        )
      `)
      .in('status', ['pendiente', 'confirmado', 'en_preparacion', 'listo'])
      .order('created_at', { ascending: true });
    if (data) setOrders(data as KitchenOrder[]);
  }, [supabase]);

  // ── Realtime ──────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('kitchen-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, refresh]);

  // ── Tick cada 30 segundos para actualizar timers ──────────
  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Avanzar estado de un pedido ───────────────────────────
  async function advance(order: KitchenOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    const update: Record<string, unknown> = { status: next };
    if (next === 'entregado') update.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', order.id);

    if (error) {
      toast.error('Error al actualizar: ' + error.message);
    } else {
      toast.success(`Pedido #${String(order.consecutive).padStart(3,'0')} → ${next}`);
      refresh();
    }
  }

  // ── Cancelar pedido ───────────────────────────────────────
  async function cancelOrder(order: KitchenOrder) {
    if (!confirm('¿Cancelar este pedido?')) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelado', cancelled_at: new Date().toISOString() })
      .eq('id', order.id);
    if (!error) {
      toast.warning('Pedido cancelado');
      refresh();
    }
  }

  // ── Color del timer según urgencia ────────────────────────
  function timerColor(minutes: number, estimated?: number): string {
    const limit = estimated ?? 20;
    if (minutes >= limit)      return 'var(--red)';
    if (minutes >= limit * 0.7) return 'var(--yellow)';
    return 'var(--green)';
  }

  const totalPending = orders.filter(o => o.status === 'pendiente').length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ padding: tvMode ? '0' : '16px', background: tvMode ? '#000' : 'var(--bg-base)' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      {!tvMode && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
              Panel de Cocina
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {orders.length} pedidos activos
              {totalPending > 0 && (
                <span className="ml-2 badge badge-red animate-pulse">
                  {totalPending} sin confirmar
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} className="btn-secondary text-xs px-3 py-1.5">↻</button>
            <button
              onClick={() => setTvMode(true)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              📺 Modo TV
            </button>
          </div>
        </div>
      )}

      {/* ── Modo TV: salir ──────────────────────────────────── */}
      {tvMode && (
        <button
          onClick={() => setTvMode(false)}
          className="absolute top-4 right-4 z-50 bg-white/10 text-white text-xs px-3 py-1.5 rounded"
        >
          ✕ Salir TV
        </button>
      )}

      {/* ── Tablero Kanban ─────────────────────────────────── */}
      <div className={`flex-1 overflow-hidden grid gap-3 ${tvMode ? 'p-4 h-screen' : ''}`}
           style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)` }}>
        {COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.status === col.key);
          return (
            <div key={col.key} className="flex flex-col min-h-0 overflow-hidden">
              {/* Columna header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg mb-2 flex-shrink-0"
                style={{
                  background: 'var(--bg-surface)',
                  borderBottom: `2px solid ${col.color}`,
                }}
              >
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: col.color }}
                >
                  {col.label}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${col.color}20`, color: col.color }}
                >
                  {colOrders.length}
                </span>
              </div>

              {/* Tickets */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {colOrders.length === 0 ? (
                  <div
                    className="rounded-lg p-4 text-center text-xs"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px dashed var(--bg-border)' }}
                  >
                    Sin pedidos
                  </div>
                ) : colOrders.map(order => {
                  const mins    = minutesSince(order.created_at);
                  const urgent  = mins >= (order.estimated_time ?? 20);
                  const tColor  = timerColor(mins, order.estimated_time);

                  return (
                    <div
                      key={order.id}
                      className={`rounded-xl p-3 transition-all ${urgent ? 'animate-pulse' : ''}`}
                      style={{
                        background: 'var(--bg-surface)',
                        border: `1px solid ${urgent ? 'var(--red)' : 'var(--bg-border)'}`,
                        borderLeft: `3px solid ${col.color}`,
                      }}
                    >
                      {/* Ticket header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                          #{String(order.consecutive).padStart(3,'0')}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${tColor}15`, color: tColor }}
                        >
                          ⏱ {mins}m
                        </span>
                      </div>

                      {/* Tipo / mesa */}
                      <div className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                        {order.type === 'mesa' && order.table
                          ? `🪑 ${order.table.name}`
                          : order.type === 'domicilio' ? '🛵 Domicilio'
                          : '👜 Para llevar'}
                        {' · '}
                        {order.business_unit === 'desayunos' ? '☀️' : order.business_unit === 'almuerzos' ? '🍽️' : '🍕'}
                      </div>

                      {/* Ítems */}
                      <div className="space-y-1 mb-2">
                        {order.items.map(item => (
                          <div
                            key={item.id}
                            className="text-xs py-1"
                            style={{ borderBottom: '1px solid var(--bg-border)' }}
                          >
                            <span className="font-bold" style={{ color: 'var(--brand)' }}>
                              {item.quantity}×
                            </span>{' '}
                            <span style={{ color: 'var(--text-primary)' }}>{item.product.name}</span>
                            {item.notes && (
                              <div className="text-[10px] mt-0.5" style={{ color: 'var(--yellow)' }}>
                                ⚠️ {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Nota del pedido */}
                      {order.notes && (
                        <div
                          className="text-[10px] px-2 py-1 rounded mb-2"
                          style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}
                        >
                          📝 {order.notes}
                        </div>
                      )}

                      {/* Acciones */}
                      {order.status !== 'listo' && (
                        <button
                          onClick={() => advance(order)}
                          className="btn-brand w-full justify-center text-xs py-1.5"
                        >
                          {NEXT_BTN[order.status] ?? '→'}
                        </button>
                      )}

                      {order.status === 'listo' && (
                        <div
                          className="w-full text-center text-xs font-bold py-1.5 rounded-lg"
                          style={{ background: 'var(--green-dim)', color: 'var(--green)' }}
                        >
                          ✅ Esperando entrega
                        </div>
                      )}

                      {/* Cancelar (solo admin y si no está listo) */}
                      {profile.role === 'admin' && order.status !== 'listo' && (
                        <button
                          onClick={() => cancelOrder(order)}
                          className="w-full text-center text-[10px] mt-1 py-1 rounded"
                          style={{ color: 'var(--red)', background: 'transparent' }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
