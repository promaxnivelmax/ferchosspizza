'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Inventario Cliente
// Archivo: src/app/inventory/InventoryClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { formatCOP }    from '@/lib/utils/format';

interface Ingredient {
  id: string; name: string; unit: string;
  stock_current: number; stock_minimum: number;
  cost_per_unit: number; supplier?: string; is_active: boolean;
}

interface Props { initialIngredients: Ingredient[]; }

export default function InventoryClient({ initialIngredients }: Props) {
  const supabase = createClient();
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<'all'|'ok'|'warning'|'critical'>('all');
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editQty, setEditQty]         = useState('');
  const [movType, setMovType]         = useState<'entrada'|'ajuste'>('entrada');
  const [movNote, setMovNote]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIngr, setNewIngr]         = useState({ name: '', unit: 'kg', stock_current: 0, stock_minimum: 0, cost_per_unit: 0 });

  function getStatus(current: number, minimum: number): 'critical' | 'warning' | 'ok' {
    if (current <= 0 || current <= minimum * 0.5) return 'critical';
    if (current <= minimum) return 'warning';
    return 'ok';
  }

  const STATUS_CFG = {
    ok:       { label: 'OK',       color: 'var(--green)',  bg: 'var(--green-dim)' },
    warning:  { label: 'Bajo',     color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
    critical: { label: 'Crítico',  color: 'var(--red)',    bg: 'var(--red-dim)' },
  };

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('ingredients').select('*').order('name');
    if (data) setIngredients(data);
  }, [supabase]);

  const filtered = ingredients.filter(i => {
    const st = getStatus(i.stock_current, i.stock_minimum);
    const matchSearch = search === '' || i.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || st === filter;
    return matchSearch && matchFilter && i.is_active;
  });

  async function saveMovement(ingredient: Ingredient) {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) { toast.error('Cantidad inválida'); return; }
    setLoading(true);

    // Obtener user_id del perfil actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sin sesión'); return; }

    const { error } = await supabase.from('inventory_movements').insert({
      ingredient_id: ingredient.id,
      type:          movType,
      quantity:      qty,
      notes:         movNote || null,
      user_id:       user.id,
    });

    if (error) { toast.error(error.message); }
    else {
      toast.success(`${movType === 'entrada' ? 'Entrada' : 'Ajuste'} de ${qty} ${ingredient.unit} registrado`);
      setEditingId(null);
      setEditQty('');
      setMovNote('');
      refresh();
    }
    setLoading(false);
  }

  async function addIngredient() {
    if (!newIngr.name.trim()) { toast.error('Nombre requerido'); return; }
    setLoading(true);
    const { error } = await supabase.from('ingredients').insert(newIngr);
    if (error) toast.error(error.message);
    else { toast.success('Ingrediente agregado'); setShowAddModal(false); refresh(); }
    setLoading(false);
  }

  const criticalCount = ingredients.filter(i => getStatus(i.stock_current, i.stock_minimum) === 'critical').length;
  const warningCount  = ingredients.filter(i => getStatus(i.stock_current, i.stock_minimum) === 'warning').length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
            Inventario
          </h1>
          <div className="flex gap-3 mt-1">
            {criticalCount > 0 && <span className="badge badge-red">⚠️ {criticalCount} críticos</span>}
            {warningCount  > 0 && <span className="badge badge-yellow">🔸 {warningCount} bajos</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="btn-secondary text-xs px-3 py-1.5">↻</button>
          <button onClick={() => setShowAddModal(true)} className="btn-brand text-xs px-3 py-1.5">
            + Agregar ingrediente
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input className="input-base pl-8 py-2 text-sm w-full" placeholder="Buscar..."
                 value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(['all','ok','warning','critical'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
                  className="px-2.5 py-2 rounded text-xs font-medium transition-all"
                  style={{
                    background: filter === f ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    color:      filter === f ? 'var(--brand)' : 'var(--text-secondary)',
                    border:     `1px solid ${filter === f ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                  }}>
            {f === 'all' ? 'Todos' : f === 'ok' ? '✅ OK' : f === 'warning' ? '⚠️ Bajo' : '🚨 Crítico'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-base">
            <thead>
              <tr>
                <th>Ingrediente</th><th>Stock actual</th><th>Mínimo</th>
                <th>Estado</th><th>Costo/u</th><th>Proveedor</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                  Sin ingredientes
                </td></tr>
              ) : filtered.map(ingr => {
                const st  = getStatus(ingr.stock_current, ingr.stock_minimum);
                const cfg = STATUS_CFG[st];
                const isEditing = editingId === ingr.id;
                return (
                  <tr key={ingr.id}>
                    <td>
                      <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{ingr.name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ingr.unit}</div>
                    </td>
                    <td>
                      <span className="font-display font-bold text-sm"
                            style={{ color: cfg.color }}>
                        {ingr.stock_current} {ingr.unit}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {ingr.stock_minimum} {ingr.unit}
                    </td>
                    <td>
                      <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatCOP(ingr.cost_per_unit)}/{ingr.unit}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ingr.supplier ?? '—'}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="flex flex-col gap-1 min-w-[160px]">
                          <div className="flex gap-1">
                            <button onClick={() => setMovType('entrada')}
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: movType==='entrada'?'var(--brand-dim)':'var(--bg-elevated)', color: movType==='entrada'?'var(--brand)':'var(--text-muted)', border:'1px solid var(--bg-border)' }}>
                              Entrada
                            </button>
                            <button onClick={() => setMovType('ajuste')}
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: movType==='ajuste'?'var(--brand-dim)':'var(--bg-elevated)', color: movType==='ajuste'?'var(--brand)':'var(--text-muted)', border:'1px solid var(--bg-border)' }}>
                              Ajuste
                            </button>
                          </div>
                          <input type="number" className="input-base text-xs py-1" placeholder={`Cantidad (${ingr.unit})`}
                                 value={editQty} onChange={e => setEditQty(e.target.value)} />
                          <input className="input-base text-xs py-1" placeholder="Nota (opcional)"
                                 value={movNote} onChange={e => setMovNote(e.target.value)} />
                          <div className="flex gap-1">
                            <button className="btn-brand flex-1 text-xs py-1 justify-center"
                                    onClick={() => saveMovement(ingr)} disabled={loading}>
                              ✓
                            </button>
                            <button className="btn-secondary flex-1 text-xs py-1 justify-center"
                                    onClick={() => { setEditingId(null); setEditQty(''); }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn-secondary text-xs px-2 py-1"
                                onClick={() => { setEditingId(ingr.id); setEditQty(''); }}>
                          + Registrar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Agregar ingrediente */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="flex items-center justify-between px-5 py-4"
                 style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                + Nuevo ingrediente
              </span>
              <button onClick={() => setShowAddModal(false)}
                      className="w-7 h-7 rounded flex items-center justify-center text-sm"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nombre</label>
                <input className="input-base w-full text-sm py-2" placeholder="Ej: Mozzarella"
                       value={newIngr.name} onChange={e => setNewIngr(n => ({ ...n, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Unidad</label>
                  <select className="input-base w-full text-sm py-2"
                          value={newIngr.unit} onChange={e => setNewIngr(n => ({ ...n, unit: e.target.value }))}>
                    {['kg','g','L','ml','unidad','docena','paquete'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Costo/unidad</label>
                  <input type="number" className="input-base w-full text-sm py-2" placeholder="0"
                         value={newIngr.cost_per_unit}
                         onChange={e => setNewIngr(n => ({ ...n, cost_per_unit: parseFloat(e.target.value)||0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Stock inicial</label>
                  <input type="number" className="input-base w-full text-sm py-2" placeholder="0"
                         value={newIngr.stock_current}
                         onChange={e => setNewIngr(n => ({ ...n, stock_current: parseFloat(e.target.value)||0 }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Stock mínimo</label>
                  <input type="number" className="input-base w-full text-sm py-2" placeholder="0"
                         value={newIngr.stock_minimum}
                         onChange={e => setNewIngr(n => ({ ...n, stock_minimum: parseFloat(e.target.value)||0 }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn-brand flex-1 justify-center" onClick={addIngredient} disabled={loading}>
                {loading ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
