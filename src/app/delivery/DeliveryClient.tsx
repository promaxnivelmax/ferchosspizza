'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Domicilios Client Component
// Archivo: src/app/delivery/DeliveryClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { formatCOP }    from '@/lib/utils/format';
import { minutesSince } from '@/lib/utils/time';
import type { UserProfile } from '@/lib/types';

interface DeliveryOrder {
  id: string; consecutive: number; status: string; total: number;
  delivery_address?: string; notes?: string; created_at: string; payment_method?: string;
  client?: { full_name: string; phone: string } | null;
  delivery_user?: { full_name: string } | null;
  items?: { quantity: number; product: { name: string } }[];
}
interface Rider  { id: string; full_name: string; }
interface Props  { initialOrders: DeliveryOrder[]; riders: Rider[]; profile: UserProfile; }

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pendiente:       { label: 'Pendiente',    color: 'var(--yellow)', bg: 'var(--yellow-dim)', icon: '🕐' },
  confirmado:      { label: 'Confirmado',   color: 'var(--blue)',   bg: 'var(--blue-dim)',   icon: '✅' },
  en_preparacion:  { label: 'En cocina',    color: 'var(--brand)',  bg: 'var(--brand-dim)',  icon: '👨‍🍳' },
  listo:           { label: 'Listo',        color: 'var(--green)',  bg: 'var(--green-dim)',  icon: '📦' },
  entregado:       { label: 'Entregado',    color: 'var(--green)',  bg: 'var(--green-dim)',  icon: '🛵' },
  cancelado:       { label: 'Cancelado',    color: 'var(--red)',    bg: 'var(--red-dim)',    icon: '✕'  },
};

export default function DeliveryClient({ initialOrders, riders, profile }: Props) {
  const supabase  = createClient();
  const [orders, setOrders]   = useState<DeliveryOrder[]>(initialOrders);
  const [filter, setFilter]   = useState('active');

  const refresh = useCallback(async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { data } = await supabase.from('orders')
      .select(`id,consecutive,status,total,delivery_address,notes,created_at,payment_method,
               client:clients(full_name,phone),delivery_user:user_profiles!delivery_user_id(full_name),
               items:order_items(quantity,product:products(name))`)
      .eq('type', 'domicilio')
      .gte('created_at', today + 'T00:00:00-05:00')
      .order('created_at', { ascending: false });
    if (data) setOrders(data as DeliveryOrder[]);
  }, [supabase]);

  useEffect(() => {
    const ch = supabase.channel('delivery-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
          filter: "type=eq.domicilio" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, refresh]);

  async function assignRider(orderId: string, riderId: string) {
    const { error } = await supabase.from('orders')
      .update({ delivery_user_id: riderId, status: 'listo' })
      .eq('id', orderId);
    if (error) toast.error(error.message);
    else { toast.success('Domiciliario asignado'); refresh(); }
  }

  async function markDelivered(orderId: string) {
    const { error } = await supabase.from('orders')
      .update({ status: 'entregado', delivered_at: new Date().toISOString(), paid_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) toast.error(error.message);
    else { toast.success('✅ Pedido entregado'); refresh(); }
  }

  const activeOrders    = orders.filter(o => !['entregado','cancelado'].includes(o.status));
  const deliveredOrders = orders.filter(o => o.status === 'entregado');
  const displayed       = filter === 'active' ? activeOrders : deliveredOrders;

  const totalDelivered  = deliveredOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Domicilios</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {activeOrders.length} activos · {deliveredOrders.length} entregados hoy ({formatCOP(totalDelivered)})
          </p>
        </div>
        <div className="flex gap-2">
          {(['active','delivered'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                    style={{
                      background: filter === f ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                      color:      filter === f ? 'var(--brand)' : 'var(--text-secondary)',
                      border:     `1px solid ${filter === f ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                    }}>
              {f === 'active' ? `🚀 Activos (${activeOrders.length})` : `✅ Entregados (${deliveredOrders.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de domicilio */}
      {displayed.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-2">🛵</div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {filter === 'active' ? 'Sin domicilios activos' : 'Sin entregados hoy'}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {displayed.map(order => {
            const cfg  = STATUS_CFG[order.status] ?? STATUS_CFG.pendiente;
            const mins = minutesSince(order.created_at);
            const urgent = mins > 30 && order.status !== 'entregado';
            return (
              <div key={order.id}
                   className="card p-4 flex flex-col gap-3"
                   style={{ borderLeft: `3px solid ${cfg.color}`, borderColor: urgent ? 'var(--red)' : undefined }}>
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-display font-bold text-base" style={{ color: 'var(--brand)' }}>
                      #{String(order.consecutive).padStart(3,'0')}
                    </span>
                    <span className="badge ml-2" style={{ background: cfg.bg, color: cfg.color, fontSize:'10px' }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: urgent ? 'var(--red)' : 'var(--text-muted)' }}>
                    ⏱ {mins}m
                  </span>
                </div>

                {/* Cliente */}
                {order.client && (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                         style={{ background: 'linear-gradient(135deg,var(--brand),var(--purple))' }}>
                      {order.client.full_name[0]}
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{order.client.full_name}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{order.client.phone}</div>
                    </div>
                  </div>
                )}

                {/* Dirección */}
                {order.delivery_address && (
                  <div className="text-xs rounded-lg px-2.5 py-1.5"
                       style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    📍 {order.delivery_address}
                  </div>
                )}

                {/* Ítems */}
                <div className="text-xs space-y-0.5">
                  {order.items?.slice(0, 3).map((item, i) => (
                    <div key={i} style={{ color: 'var(--text-secondary)' }}>
                      {item.quantity}× {item.product.name}
                    </div>
                  ))}
                  {(order.items?.length ?? 0) > 3 && (
                    <div style={{ color: 'var(--text-muted)' }}>+{(order.items?.length ?? 0) - 3} más</div>
                  )}
                </div>

                {/* Total + pago */}
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-base" style={{ color: 'var(--brand)' }}>
                    {formatCOP(order.total)}
                  </span>
                  <span className="badge badge-blue text-[10px]">{order.payment_method ?? '—'}</span>
                </div>

                {/* Domiciliario asignado */}
                {order.delivery_user && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    🛵 {order.delivery_user.full_name}
                  </div>
                )}

                {/* Acciones */}
                {order.status !== 'entregado' && order.status !== 'cancelado' && (
                  <div className="flex gap-2 flex-wrap">
                    {/* Asignar domiciliario */}
                    {(profile.role === 'admin' || profile.role === 'cajero') && riders.length > 0 && !order.delivery_user && (
                      <select
                        className="input-base flex-1 text-xs py-1"
                        defaultValue=""
                        onChange={e => e.target.value && assignRider(order.id, e.target.value)}
                      >
                        <option value="">Asignar domiciliario…</option>
                        {riders.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                      </select>
                    )}
                    {/* Marcar entregado */}
                    {order.status === 'listo' && (
                      <button className="btn-brand flex-1 text-xs py-1.5 justify-center"
                              onClick={() => markDelivered(order.id)}>
                        ✅ Entregado
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
