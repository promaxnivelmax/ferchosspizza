'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Admin: Productos Client Component
// Archivo: src/app/admin/products/ProductsAdmin.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { formatCOP, calcMargin, marginColor } from '@/lib/utils/format';

interface Product {
  id: string; name: string; description?: string; price: number; cost: number;
  business_unit: string; is_active: boolean; is_available: boolean;
  preparation_time: number; is_pizza: boolean; category_id?: string;
  category?: { name: string };
}
interface Category { id: string; name: string; business_unit: string; }
interface Props { initialProducts: Product[]; categories: Category[]; }

const UNIT_ICONS: Record<string, string> = {
  desayunos: '☀️', almuerzos: '🍽️', pizzeria: '🍕', all: '⭐',
};

const EMPTY_FORM = {
  name: '', description: '', price: 0, cost: 0,
  business_unit: 'almuerzos', category_id: '',
  preparation_time: 10, is_pizza: false, allow_halves: false,
  is_active: true, is_available: true, sort_order: 0,
};

export default function ProductsAdmin({ initialProducts, categories }: Props) {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search,   setSearch]   = useState('');
  const [unitFilter, setUnit]   = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEdit]  = useState<Product | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [loading, setLoading]   = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('products')
      .select('*, category:categories(name)').order('business_unit').order('sort_order');
    if (data) setProducts(data);
  }, [supabase]);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchUnit   = unitFilter === 'all' || p.business_unit === unitFilter;
    return matchSearch && matchUnit;
  });

  function openCreate() {
    setEdit(null); setForm(EMPTY_FORM); setShowModal(true);
  }
  function openEdit(p: Product) {
    setEdit(p);
    setForm({
      name: p.name, description: p.description ?? '', price: p.price, cost: p.cost,
      business_unit: p.business_unit, category_id: p.category_id ?? '',
      preparation_time: p.preparation_time, is_pizza: p.is_pizza,
      allow_halves: false, is_active: p.is_active, is_available: p.is_available, sort_order: 0,
    });
    setShowModal(true);
  }

  async function saveProduct() {
    if (!form.name.trim()) { toast.error('Nombre requerido'); return; }
    setLoading(true);
    const payload = { ...form, category_id: form.category_id || null };
    const { error } = editProduct
      ? await supabase.from('products').update(payload).eq('id', editProduct.id)
      : await supabase.from('products').insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editProduct ? 'Producto actualizado' : 'Producto creado'); setShowModal(false); refresh(); }
    setLoading(false);
  }

  async function toggleActive(p: Product) {
    const { error } = await supabase.from('products')
      .update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.is_active ? 'Producto desactivado' : 'Producto activado'); refresh(); }
  }

  async function toggleAvailable(p: Product) {
    const { error } = await supabase.from('products')
      .update({ is_available: !p.is_available }).eq('id', p.id);
    if (!error) { refresh(); }
  }

  const catsByUnit = categories.filter(c =>
    form.business_unit === 'all' || c.business_unit === form.business_unit || c.business_unit === 'all'
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Gestión de Productos</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{products.length} productos registrados</p>
        </div>
        <button className="btn-brand text-xs px-3 py-1.5" onClick={openCreate}>+ Nuevo producto</button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input className="input-base pl-8 py-2 text-sm w-full" placeholder="Buscar..."
                 value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all','desayunos','almuerzos','pizzeria'].map(u => (
          <button key={u} onClick={() => setUnit(u)}
                  className="px-2.5 py-2 rounded text-xs font-medium transition-all"
                  style={{
                    background: unitFilter === u ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    color:      unitFilter === u ? 'var(--brand)' : 'var(--text-secondary)',
                    border:     `1px solid ${unitFilter === u ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                  }}>
            {UNIT_ICONS[u]} {u === 'all' ? 'Todos' : u.charAt(0).toUpperCase()+u.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-base">
            <thead>
              <tr><th>Producto</th><th>Unidad</th><th>Precio</th><th>Costo</th><th>Margen</th><th>⏱</th><th>Estado</th><th>Disponible</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Sin productos</td></tr>
              ) : filtered.map(p => {
                const margin = calcMargin(p.price, p.cost);
                return (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.45 }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.is_pizza ? '🍕' : UNIT_ICONS[p.business_unit] ?? '⭐'}</span>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                          {p.category?.name && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.category.name}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-brand text-[10px] capitalize">{UNIT_ICONS[p.business_unit]} {p.business_unit}</span></td>
                    <td className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatCOP(p.price)}</td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCOP(p.cost)}</td>
                    <td><span className="text-xs font-bold" style={{ color: marginColor(margin) }}>{margin}%</span></td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.preparation_time}m</td>
                    <td>
                      <button onClick={() => toggleActive(p)}
                              className="badge text-[10px] cursor-pointer"
                              style={{ background: p.is_active ? 'var(--green-dim)' : 'var(--red-dim)', color: p.is_active ? 'var(--green)' : 'var(--red)' }}>
                        {p.is_active ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td>
                      <button onClick={() => toggleAvailable(p)}
                              className="badge text-[10px] cursor-pointer"
                              style={{ background: p.is_available ? 'var(--blue-dim)' : 'var(--yellow-dim)', color: p.is_available ? 'var(--blue)' : 'var(--yellow)' }}>
                        {p.is_available ? 'Disponible' : 'Agotado'}
                      </button>
                    </td>
                    <td>
                      <button className="btn-secondary text-xs px-2 py-1" onClick={() => openEdit(p)}>✏️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box overflow-y-auto" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 sticky top-0"
                 style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
              <span className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {editProduct ? 'Editar producto' : '+ Nuevo producto'}
              </span>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded flex items-center justify-center"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nombre *</label>
                <input className="input-base w-full text-sm py-2" placeholder="Ej: Almuerzo corriente"
                       value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Descripción</label>
                <textarea className="input-base w-full text-sm py-2" rows={2}
                          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Precio de venta *</label>
                  <input type="number" className="input-base w-full text-sm py-2"
                         value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value)||0 }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Costo</label>
                  <input type="number" className="input-base w-full text-sm py-2"
                         value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value)||0 }))} />
                </div>
              </div>
              {form.price > 0 && (
                <div className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--bg-elevated)', color: marginColor(calcMargin(form.price, form.cost)) }}>
                  Margen: {calcMargin(form.price, form.cost)}% · Ganancia: {formatCOP(form.price - form.cost)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Unidad de negocio</label>
                  <select className="input-base w-full text-sm py-2"
                          value={form.business_unit} onChange={e => setForm(f => ({ ...f, business_unit: e.target.value }))}>
                    <option value="desayunos">☀️ Desayunos</option>
                    <option value="almuerzos">🍽️ Almuerzos</option>
                    <option value="pizzeria">🍕 Pizzería</option>
                    <option value="all">⭐ Todas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Categoría</label>
                  <select className="input-base w-full text-sm py-2"
                          value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {catsByUnit.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tiempo preparación (min)</label>
                  <input type="number" className="input-base w-full text-sm py-2"
                         value={form.preparation_time} onChange={e => setForm(f => ({ ...f, preparation_time: parseInt(e.target.value)||5 }))} />
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.is_pizza} onChange={e => setForm(f => ({ ...f, is_pizza: e.target.checked }))} />
                    <span style={{ color: 'var(--text-secondary)' }}>🍕 Es pizza</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <span style={{ color: 'var(--text-secondary)' }}>✅ Activo</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
                    <span style={{ color: 'var(--text-secondary)' }}>📍 Disponible</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-brand flex-1 justify-center" onClick={saveProduct} disabled={loading}>
                {loading ? 'Guardando…' : editProduct ? 'Actualizar' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
