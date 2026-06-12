'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Componente POS completo
// Archivo: src/components/pos/POSClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useMemo, useCallback } from 'react';
import { createClient }  from '@/lib/supabase/client';
import { toast }         from 'sonner';
import { formatCOP }     from '@/lib/utils/format';
import type { UserProfile } from '@/lib/types';

// ── Tipos locales ─────────────────────────────────────────────
interface Product {
  id: string; name: string; description?: string;
  price: number; cost: number; business_unit: string;
  preparation_time: number; is_pizza: boolean;
  allow_halves: boolean; category_id?: string; image_url?: string;
}
interface Table    { id: string; number: number; name: string; status: string; section: string; capacity: number; }
interface Extra    { id: string; name: string; price: number; cost: number; category: string; }
interface Client   { id: string; full_name: string; phone: string; address?: string; }
interface CartItem { product: Product; quantity: number; notes: string; extras: { extra: Extra; qty: number }[]; unitPrice: number; }

type OrderType = 'mesa' | 'domicilio' | 'llevar';
type PayMethod = 'efectivo' | 'nequi' | 'daviplata' | 'transferencia' | 'tarjeta' | 'mixto';

interface Props {
  products: Product[];
  tables:   Table[];
  extras:   Extra[];
  clients:  Client[];
  profile:  UserProfile;
}

// ── Categorías de la barra de tabs ────────────────────────────
const TABS = [
  { key: 'all',          label: 'Todos',       icon: '⭐' },
  { key: 'desayunos',    label: 'Desayunos',   icon: '☀️' },
  { key: 'almuerzos',    label: 'Almuerzos',   icon: '🍽️' },
  { key: 'pizzeria',     label: 'Pizzería',    icon: '🍕' },
  { key: 'all-bebidas',  label: 'Bebidas',     icon: '🥤' },
];

const PAYMENT_METHODS: { key: PayMethod; label: string; icon: string }[] = [
  { key: 'efectivo',      label: 'Efectivo',     icon: '💵' },
  { key: 'nequi',         label: 'Nequi',        icon: '📱' },
  { key: 'daviplata',     label: 'Daviplata',    icon: '📱' },
  { key: 'transferencia', label: 'Transferencia',icon: '🏦' },
  { key: 'tarjeta',       label: 'Tarjeta',      icon: '💳' },
  { key: 'mixto',         label: 'Mixto',        icon: '🎫' },
];

export default function POSClient({ products, tables, extras, clients, profile }: Props) {
  const supabase = createClient();

  // ── Estado del carrito ────────────────────────────────────
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('mesa');
  const [tableId, setTableId]     = useState('');
  const [clientId, setClientId]   = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [discount, setDiscount]   = useState(0);

  // ── Estado UI ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch]       = useState('');
  const [showPayModal, setPayModal] = useState(false);
  const [showPizzaModal, setPizzaModal] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('efectivo');
  const [amountReceived, setAmountReceived] = useState('');
  const [loading, setLoading]     = useState(false);

  // Pizza builder state
  const [pizzaSize, setPizzaSize]       = useState<'personal' | 'mediana' | 'grande'>('mediana');
  const [pizzaDivision, setPizzaDivision] = useState<'entera' | 'mitades' | '4sabores'>('entera');
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [pizzaExtras, setPizzaExtras]   = useState<string[]>([]);
  const [pizzaNotes, setPizzaNotes]     = useState('');

  const PIZZA_SIZES = { personal: 18000, mediana: 28000, grande: 38000 };
  const pizzaProducts = products.filter(p => p.is_pizza);

  // ── Filtrar productos ─────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeTab !== 'all') {
      if (activeTab === 'all-bebidas') {
        list = list.filter(p => p.name.toLowerCase().includes('jugo') ||
          p.name.toLowerCase().includes('agua') || p.name.toLowerCase().includes('gaseosa') ||
          p.name.toLowerCase().includes('limonada') || p.name.toLowerCase().includes('tinto') ||
          p.name.toLowerCase().includes('chocolate') || p.name.toLowerCase().includes('aromática'));
      } else {
        list = list.filter(p => p.business_unit === activeTab);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeTab, search]);

  // ── Totales del carrito ───────────────────────────────────
  const subtotal = useMemo(() =>
    cart.reduce((s, i) => {
      const extrasTotal = i.extras.reduce((e, ex) => e + ex.extra.price * ex.qty, 0);
      return s + (i.unitPrice + extrasTotal) * i.quantity;
    }, 0),
  [cart]);
  const total = Math.max(0, subtotal - discount);
  const change = Math.max(0, parseFloat(amountReceived || '0') - total);

  // ── Agregar producto al carrito ───────────────────────────
  function addToCart(product: Product) {
    if (product.is_pizza) {
      setPizzaModal(true);
      return;
    }
    setCart(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id && i.notes === '');
      if (existing >= 0) {
        return prev.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, notes: '', extras: [], unitPrice: product.price }];
    });
    toast.success(`${product.name} agregado`);
  }

  function changeQty(idx: number, delta: number) {
    setCart(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: Math.max(0, updated[idx].quantity + delta) };
      return updated.filter(i => i.quantity > 0);
    });
  }

  function clearCart() {
    setCart([]);
    setOrderNotes('');
    setDiscount(0);
    setTableId('');
    setClientId('');
  }

  // ── Agregar pizza personalizada ───────────────────────────
  function addPizzaToCart() {
    if (selectedFlavors.length === 0) { toast.error('Elige al menos un sabor'); return; }
    const basePrice = PIZZA_SIZES[pizzaSize];
    const extrasPrice = pizzaExtras.reduce((s, eid) => {
      const ex = extras.find(e => e.id === eid);
      return s + (ex?.price ?? 0);
    }, 0);
    const pizzaProduct = pizzaProducts[0] ?? products.find(p => p.is_pizza);
    if (!pizzaProduct) return;

    const flavorNames = selectedFlavors.map(id => {
      const p = products.find(x => x.id === id);
      return p?.name ?? id;
    });
    const divLabel = pizzaDivision === 'entera' ? '' : pizzaDivision === 'mitades' ? '½+½' : '4 sabores';
    const name = `Pizza ${pizzaSize} ${divLabel} — ${flavorNames.join(' / ')}`;
    const extrasForCart = pizzaExtras.map(eid => {
      const ex = extras.find(e => e.id === eid)!;
      return { extra: ex, qty: 1 };
    });

    const fakeProduct: Product = {
      ...pizzaProduct,
      id: 'pizza-' + Date.now(),
      name,
      price: basePrice,
    };

    setCart(prev => [...prev, {
      product: fakeProduct,
      quantity: 1,
      notes: pizzaNotes,
      extras: extrasForCart,
      unitPrice: basePrice,
    }]);

    setPizzaModal(false);
    setSelectedFlavors([]);
    setPizzaExtras([]);
    setPizzaNotes('');
    toast.success('🍕 Pizza agregada al carrito');
  }

  // ── Enviar pedido ─────────────────────────────────────────
  const submitOrder = useCallback(async () => {
    if (cart.length === 0) { toast.error('El carrito está vacío'); return; }
    if (orderType === 'mesa' && !tableId) { toast.error('Selecciona una mesa'); return; }

    setLoading(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          type:          orderType,
          status:        'pendiente',
          table_id:      orderType === 'mesa' ? tableId : null,
          client_id:     clientId || null,
          user_id:       profile.id,
          business_unit: cart[0]?.product.business_unit ?? 'almuerzos',
          subtotal,
          discount,
          delivery_fee:  0,
          total,
          payment_method: payMethod,
          notes:          orderNotes || null,
          paid_at:        new Date().toISOString(),
        })
        .select('id, consecutive')
        .single();

      if (orderErr) throw orderErr;

      // Insertar ítems
      const itemsToInsert = cart.map(i => ({
        order_id:   order.id,
        product_id: i.product.id.startsWith('pizza-') ? pizzaProducts[0]?.id : i.product.id,
        quantity:   i.quantity,
        unit_price: i.unitPrice,
        subtotal:   i.unitPrice * i.quantity,
        notes:      i.notes || null,
        status:     'pendiente',
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      // Cambiar estado mesa a pendiente_pago
      if (orderType === 'mesa' && tableId) {
        await supabase.from('tables')
          .update({ status: 'pendiente_pago', current_order_id: order.id })
          .eq('id', tableId);
      }

      clearCart();
      setPayModal(false);
      toast.success(`✅ Pedido #${String(order.consecutive).padStart(3,'0')} creado`, {
        description: 'Enviado a cocina automáticamente',
      });

    } catch (err: unknown) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }, [cart, orderType, tableId, clientId, subtotal, discount, total, payMethod, orderNotes, profile.id, supabase, pizzaProducts]);

  const availableTables = tables.filter(t => t.status === 'disponible' || t.status === 'ocupada');

  return (
    <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 60px)' }}>

      {/* ══════════════════════════════════════════════════
          PANEL IZQUIERDO — Catálogo de productos
      ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0"
           style={{ borderRight: '1px solid var(--bg-border)' }}>

        {/* Barra de búsqueda + botón pizza */}
        <div className="flex gap-2 p-3 flex-shrink-0"
             style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--text-muted)' }}>🔍</span>
            <input
              className="input-base pl-8 text-sm py-2"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-brand px-3 text-xs flex-shrink-0"
            onClick={() => setPizzaModal(true)}
          >
            🍕 Pizza
          </button>
        </div>

        {/* Tabs de categoría */}
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0"
             style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: activeTab === tab.key ? 'var(--brand-dim)' : 'transparent',
                color:      activeTab === tab.key ? 'var(--brand)' : 'var(--text-secondary)',
                border:     `1px solid ${activeTab === tab.key ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm">Sin productos</div>
            </div>
          ) : (
            <div className="grid gap-2.5"
                 style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left rounded-xl overflow-hidden transition-all duration-150 group"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)';
                    (e.currentTarget as HTMLElement).style.transform = 'none';
                  }}
                >
                  <div
                    className="w-full flex items-center justify-center text-3xl"
                    style={{ aspectRatio: '4/3', background: 'var(--bg-elevated)' }}
                  >
                    {p.is_pizza ? '🍕' : p.business_unit === 'desayunos' ? '☀️' : p.business_unit === 'almuerzos' ? '🍽️' : '🥤'}
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-semibold leading-tight mb-1"
                         style={{ color: 'var(--text-primary)' }}>
                      {p.name}
                    </div>
                    <div className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                      {formatCOP(p.price)}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      ⏱ {p.preparation_time}m
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          PANEL DERECHO — Carrito
      ══════════════════════════════════════════════════ */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: '340px', background: 'var(--bg-surface)' }}
      >
        {/* Cart header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0"
             style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Nueva orden
            </span>
            <span className="badge badge-green" style={{ fontSize: '10px' }}>
              ● Abierta
            </span>
          </div>

          {/* Tipo de orden */}
          <div className="grid grid-cols-3 gap-1 mb-3">
            {(['mesa','domicilio','llevar'] as OrderType[]).map(t => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className="py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: orderType === t ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                  color:      orderType === t ? 'var(--brand)' : 'var(--text-secondary)',
                  border:     `1px solid ${orderType === t ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                }}
              >
                {t === 'mesa' ? '🪑 Mesa' : t === 'domicilio' ? '🛵 Domicilio' : '👜 Llevar'}
              </button>
            ))}
          </div>

          {/* Selector mesa */}
          {orderType === 'mesa' && (
            <select
              className="input-base w-full text-xs py-1.5 mb-2"
              value={tableId}
              onChange={e => setTableId(e.target.value)}
            >
              <option value="">-- Seleccionar mesa --</option>
              {availableTables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.section}) — {t.capacity} puestos
                </option>
              ))}
            </select>
          )}

          {/* Selector cliente (domicilio) */}
          {orderType === 'domicilio' && (
            <select
              className="input-base w-full text-xs py-1.5 mb-2"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            >
              <option value="">-- Cliente (opcional) --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>
              ))}
            </select>
          )}
        </div>

        {/* Items del carrito */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {cart.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-2">🛒</div>
              <div className="text-xs">Carrito vacío</div>
              <div className="text-[10px] mt-1">Toca un producto para agregar</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 p-2.5 rounded-lg"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                  }}
                >
                  <div className="text-xl flex-shrink-0 w-7 text-center">
                    {item.product.is_pizza ? '🍕' : item.product.business_unit === 'desayunos' ? '☀️' : '🍽️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.product.name}
                    </div>
                    {item.extras.length > 0 && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--brand)' }}>
                        + {item.extras.map(e => e.extra.name).join(', ')}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px]" style={{ color: 'var(--yellow)' }}>
                        📝 {item.notes}
                      </div>
                    )}
                    {/* Qty controls */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => changeQty(idx, -1)}
                        className="w-5 h-5 rounded text-xs flex items-center justify-center"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                      >−</button>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => changeQty(idx, 1)}
                        className="w-5 h-5 rounded text-xs flex items-center justify-center"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                      >+</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatCOP(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                      className="text-[10px]" style={{ color: 'var(--red)' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart footer */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--bg-border)' }}>
          {/* Descuento */}
          {profile.role === 'admin' && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Descuento</span>
              <input
                type="number"
                className="input-base flex-1 text-xs py-1"
                placeholder="$0"
                value={discount || ''}
                onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          )}

          {/* Totales */}
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--green)' }}>
                <span>Descuento</span><span>-{formatCOP(discount)}</span>
              </div>
            )}
            <div
              className="flex justify-between font-display font-bold text-base pt-2"
              style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--bg-border)' }}
            >
              <span>TOTAL</span><span style={{ color: 'var(--brand)' }}>{formatCOP(total)}</span>
            </div>
          </div>

          {/* Acciones */}
          <button
            className="btn-brand w-full justify-center py-3 text-sm font-bold mb-2"
            onClick={() => setPayModal(true)}
            disabled={cart.length === 0}
            style={{ opacity: cart.length === 0 ? 0.5 : 1 }}
          >
            💳 Cobrar {formatCOP(total)}
          </button>
          <div className="flex gap-1.5">
            <button
              className="btn-secondary flex-1 text-xs py-1.5 justify-center"
              onClick={() => setOrderNotes(n => n ? n : 'Sin nota')}
            >📝</button>
            <button
              className="btn-secondary flex-1 text-xs py-1.5 justify-center"
              onClick={() => toast.info('Impresión próximamente')}
            >🖨️</button>
            <button
              className="text-xs px-3 py-1.5 rounded transition-colors"
              style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}
              onClick={clearCart}
            >🗑️</button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL — Pago
      ══════════════════════════════════════════════════ */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setPayModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="flex items-center justify-between px-5 py-4"
                 style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                💳 Cobrar pedido
              </span>
              <button onClick={() => setPayModal(false)}
                      className="w-7 h-7 rounded flex items-center justify-center text-sm"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Total */}
              <div className="text-center">
                <div className="text-3xl font-display font-bold" style={{ color: 'var(--brand)' }}>
                  {formatCOP(total)}
                </div>
              </div>

              {/* Métodos */}
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setPayMethod(m.key)}
                    className="py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1"
                    style={{
                      background: payMethod === m.key ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                      color:      payMethod === m.key ? 'var(--brand)' : 'var(--text-secondary)',
                      border:     `1px solid ${payMethod === m.key ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                    }}
                  >
                    <span className="text-lg">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Monto recibido */}
              {payMethod === 'efectivo' && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Monto recibido
                  </label>
                  <input
                    type="number"
                    className="input-base w-full text-sm py-2"
                    placeholder="0"
                    value={amountReceived}
                    onChange={e => setAmountReceived(e.target.value)}
                  />
                  {parseFloat(amountReceived) > 0 && (
                    <div
                      className="flex justify-between text-sm mt-2 px-2 py-1.5 rounded"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>Cambio</span>
                      <span className="font-bold" style={{ color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatCOP(change)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Nota */}
              <input
                className="input-base w-full text-xs py-1.5"
                placeholder="Notas del pedido (opcional)..."
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center text-sm" onClick={() => setPayModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-brand flex-1 justify-center text-sm py-2.5 font-bold"
                onClick={submitOrder}
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? '⏳ Procesando…' : '✓ Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL — Constructor de pizza
      ══════════════════════════════════════════════════ */}
      {showPizzaModal && (
        <div className="modal-overlay" onClick={() => setPizzaModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4 sticky top-0"
                 style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
              <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                🍕 Armador de Pizza
              </span>
              <button onClick={() => setPizzaModal(false)}
                      className="w-7 h-7 rounded flex items-center justify-center text-sm"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tamaño */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                     style={{ color: 'var(--text-muted)' }}>Tamaño</div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(PIZZA_SIZES) as [keyof typeof PIZZA_SIZES, number][]).map(([size, price]) => (
                    <button
                      key={size}
                      onClick={() => setPizzaSize(size)}
                      className="py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1"
                      style={{
                        background: pizzaSize === size ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                        color:      pizzaSize === size ? 'var(--brand)' : 'var(--text-secondary)',
                        border:     `1px solid ${pizzaSize === size ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                      }}
                    >
                      <span className="text-base capitalize">{size}</span>
                      <span style={{ color: pizzaSize === size ? 'var(--brand)' : 'var(--text-muted)' }}>
                        {formatCOP(price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* División */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                     style={{ color: 'var(--text-muted)' }}>División</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'entera', label: 'Entera', max: 1 },
                    { key: 'mitades', label: '½ + ½', max: 2 },
                    { key: '4sabores', label: '4 sabores', max: 4 },
                  ].map(d => (
                    <button
                      key={d.key}
                      onClick={() => { setPizzaDivision(d.key as typeof pizzaDivision); setSelectedFlavors([]); }}
                      className="py-1.5 rounded text-xs font-medium transition-all"
                      style={{
                        background: pizzaDivision === d.key ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                        color:      pizzaDivision === d.key ? 'var(--brand)' : 'var(--text-secondary)',
                        border:     `1px solid ${pizzaDivision === d.key ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sabores */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                     style={{ color: 'var(--text-muted)' }}>
                  Sabores ({selectedFlavors.length} / {pizzaDivision === 'entera' ? 1 : pizzaDivision === 'mitades' ? 2 : 4})
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {pizzaProducts.map(p => {
                    const selected = selectedFlavors.includes(p.id);
                    const maxFlavors = pizzaDivision === 'entera' ? 1 : pizzaDivision === 'mitades' ? 2 : 4;
                    const disabled = !selected && selectedFlavors.length >= maxFlavors;
                    return (
                      <button
                        key={p.id}
                        disabled={disabled}
                        onClick={() => {
                          if (selected) {
                            setSelectedFlavors(f => f.filter(id => id !== p.id));
                          } else if (!disabled) {
                            setSelectedFlavors(f => [...f, p.id]);
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all"
                        style={{
                          background: selected ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                          color:      selected ? 'var(--brand)' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                          border:     `1px solid ${selected ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                          opacity:    disabled ? 0.4 : 1,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: selected ? 'var(--brand)' : 'currentColor' }} />
                        {p.name.replace('Pizza ', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extras */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                     style={{ color: 'var(--text-muted)' }}>Adicionales</div>
                <div className="flex flex-wrap gap-1.5">
                  {extras.filter(e => e.category === 'pizza_extra').map(ex => {
                    const selected = pizzaExtras.includes(ex.id);
                    return (
                      <button
                        key={ex.id}
                        onClick={() => setPizzaExtras(prev =>
                          selected ? prev.filter(id => id !== ex.id) : [...prev, ex.id]
                        )}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                        style={{
                          background: selected ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                          color:      selected ? 'var(--brand)' : 'var(--text-secondary)',
                          border:     `1px solid ${selected ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                        }}
                      >
                        + {ex.name} {formatCOP(ex.price)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nota */}
              <input
                className="input-base w-full text-xs py-1.5"
                placeholder="Observaciones: sin cebolla, bien tostada..."
                value={pizzaNotes}
                onChange={e => setPizzaNotes(e.target.value)}
              />

              {/* Precio total */}
              <div
                className="flex justify-between items-center px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total pizza</span>
                <span className="font-display font-bold text-base" style={{ color: 'var(--brand)' }}>
                  {formatCOP(PIZZA_SIZES[pizzaSize] + pizzaExtras.reduce((s, id) => {
                    const ex = extras.find(e => e.id === id);
                    return s + (ex?.price ?? 0);
                  }, 0))}
                </span>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button className="btn-secondary flex-1 justify-center text-sm" onClick={() => setPizzaModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-brand flex-1 justify-center text-sm font-bold py-2.5"
                onClick={addPizzaToCart}
                disabled={selectedFlavors.length === 0}
                style={{ opacity: selectedFlavors.length === 0 ? 0.5 : 1 }}
              >
                🍕 Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
