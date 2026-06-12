'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Clientes Client Component
// Archivo: src/app/clients/ClientsClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { formatCOP, formatDateTime } from '@/lib/utils/format';

interface Client {
  id: string; full_name: string; phone: string; email?: string;
  address?: string; city?: string; notes?: string;
  total_spent: number; total_orders: number; tier: string;
  last_order_at?: string; is_active: boolean;
}

interface Props { initialClients: Client[]; }

const TIER_CFG = {
  nuevo:     { label: '🆕 Nuevo',      color: 'var(--text-muted)' },
  regular:   { label: '⭐ Regular',    color: 'var(--blue)' },
  frecuente: { label: '🔥 Frecuente',  color: 'var(--brand)' },
  vip:       { label: '👑 VIP',        color: 'var(--yellow)' },
};

export default function ClientsClient({ initialClients }: Props) {
  const supabase = createClient();
  const [clients, setClients]     = useState<Client[]>(initialClients);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Client | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({
    full_name: '', phone: '', email: '', address: '', city: 'Bucaramanga', notes: '',
  });

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('full_name');
    if (data) setClients(data);
  }, [supabase]);

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  async function saveClient() {
    if (!form.full_name.trim() || !form.phone.trim()) { toast.error('Nombre y teléfono requeridos'); return; }
    setLoading(true);
    const { error } = selected
      ? await supabase.from('clients').update(form).eq('id', selected.id)
      : await supabase.from('clients').insert(form);
    if (error) toast.error(error.message);
    else { toast.success(selected ? 'Cliente actualizado' : 'Cliente creado'); setShowAdd(false); setSelected(null); setForm({ full_name:'',phone:'',email:'',address:'',city:'Bucaramanga',notes:'' }); refresh(); }
    setLoading(false);
  }

  function openEdit(c: Client) {
    setSelected(c);
    setForm({ full_name: c.full_name, phone: c.phone, email: c.email??'', address: c.address??'', city: c.city??'Bucaramanga', notes: c.notes??'' });
    setShowAdd(true);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Clientes</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{clients.length} registrados</p>
        </div>
        <button className="btn-brand text-xs px-3 py-1.5" onClick={() => { setSelected(null); setForm({ full_name:'',phone:'',email:'',address:'',city:'Bucaramanga',notes:'' }); setShowAdd(true); }}>
          + Nuevo cliente
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>🔍</span>
        <input className="input-base pl-8 py-2 text-sm w-full max-w-sm"
               placeholder="Buscar por nombre o teléfono..."
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-base">
            <thead>
              <tr><th>Cliente</th><th>Teléfono</th><th>Tier</th><th>Pedidos</th><th>Total gastado</th><th>Último pedido</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const tier = TIER_CFG[c.tier as keyof typeof TIER_CFG] ?? TIER_CFG.nuevo;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.full_name}</div>
                      {c.email && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.email}</div>}
                    </td>
                    <td className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{c.phone}</td>
                    <td><span className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</span></td>
                    <td className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>{c.total_orders}</td>
                    <td className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCOP(c.total_spent)}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.last_order_at ? formatDateTime(c.last_order_at) : '—'}
                    </td>
                    <td>
                      <button className="btn-secondary text-xs px-2 py-1" onClick={() => openEdit(c)}>✏️</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Sin clientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                {selected ? 'Editar cliente' : 'Nuevo cliente'}
              </span>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded flex items-center justify-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: 'full_name', label: 'Nombre completo *', placeholder: 'Ana García' },
                { key: 'phone',     label: 'Teléfono *',       placeholder: '3001234567' },
                { key: 'email',     label: 'Email',            placeholder: 'ana@email.com' },
                { key: 'address',   label: 'Dirección',        placeholder: 'Calle 10 #20-30' },
                { key: 'city',      label: 'Ciudad',           placeholder: 'Bucaramanga' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                  <input className="input-base w-full text-sm py-2" placeholder={f.placeholder}
                         value={form[f.key as keyof typeof form]}
                         onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notas</label>
                <textarea className="input-base w-full text-sm py-2" rows={2} placeholder="Alérgico a..."
                          value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn-brand flex-1 justify-center" onClick={saveClient} disabled={loading}>
                {loading ? 'Guardando…' : selected ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
