'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Caja Client Component
// Archivo: src/app/cashbox/CashboxClient.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { formatCOP, formatDateTime } from '@/lib/utils/format';
import type { UserProfile } from '@/lib/types';

interface CashboxSession {
  id: string; opened_by: string; opening_balance: number;
  total_sales: number; total_expenses: number; is_open: boolean; opened_at: string;
}
interface Movement {
  id: string; type: string; description: string; amount: number;
  balance_after: number; payment_method?: string; created_at: string;
  user?: { full_name: string };
}
interface Props {
  initialSession:   CashboxSession | null;
  initialMovements: Movement[];
  profile:          UserProfile;
}

const MOV_TYPE_CFG: Record<string, { label: string; color: string }> = {
  apertura:  { label: 'Apertura',  color: 'var(--blue)'   },
  venta:     { label: 'Venta',     color: 'var(--green)'  },
  gasto:     { label: 'Gasto',     color: 'var(--red)'    },
  retiro:    { label: 'Retiro',    color: 'var(--red)'    },
  ingreso:   { label: 'Ingreso',   color: 'var(--green)'  },
  ajuste:    { label: 'Ajuste',    color: 'var(--yellow)' },
  cierre:    { label: 'Cierre',    color: 'var(--purple)' },
};

export default function CashboxClient({ initialSession, initialMovements, profile }: Props) {
  const supabase = createClient();
  const [session, setSession]     = useState<CashboxSession | null>(initialSession);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [loading, setLoading]     = useState(false);

  // Modal apertura
  const [showOpen, setShowOpen]     = useState(false);
  const [openBal, setOpenBal]       = useState('50000');

  // Modal movimiento manual
  const [showMov, setShowMov]       = useState(false);
  const [movForm, setMovForm]       = useState({ type: 'gasto', description: '', amount: '' });

  // Modal cierre
  const [showClose, setShowClose]   = useState(false);
  const [closeBal, setCloseBal]     = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const refresh = useCallback(async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [s, m] = await Promise.all([
      supabase.from('cashbox_sessions').select('*').eq('is_open', true)
               .order('opened_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('cashbox_movements')
               .select('*, user:user_profiles(full_name)')
               .gte('created_at', today + 'T00:00:00-05:00')
               .order('created_at', { ascending: false }).limit(50),
    ]);
    setSession(s.data);
    setMovements(m.data ?? []);
  }, [supabase]);

  // ── Abrir caja ────────────────────────────────────────────
  async function openCashbox() {
    const bal = parseFloat(openBal) || 0;
    setLoading(true);
    const { data: sess, error: sessErr } = await supabase
      .from('cashbox_sessions')
      .insert({ opened_by: profile.id, opening_balance: bal, total_sales: 0, total_expenses: 0 })
      .select().single();
    if (sessErr) { toast.error(sessErr.message); setLoading(false); return; }

    // Movimiento de apertura
    await supabase.from('cashbox_movements').insert({
      cashbox_session_id: sess.id,
      type: 'apertura', description: 'Apertura de caja',
      amount: bal, balance_after: bal,
      user_id: profile.id,
    });

    toast.success(`Caja abierta con ${formatCOP(bal)}`);
    setShowOpen(false);
    refresh();
    setLoading(false);
  }

  // ── Registrar movimiento manual ───────────────────────────
  async function addMovement() {
    if (!session) return;
    if (!movForm.description.trim()) { toast.error('Descripción requerida'); return; }
    const amt = parseFloat(movForm.amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Monto inválido'); return; }

    const isIngreso = ['ingreso', 'ajuste'].includes(movForm.type);
    const finalAmt  = isIngreso ? amt : -amt;
    const lastBal   = movements[0]?.balance_after ?? session.opening_balance;
    const newBal    = lastBal + finalAmt;

    setLoading(true);
    const { error } = await supabase.from('cashbox_movements').insert({
      cashbox_session_id: session.id,
      type:         movForm.type,
      description:  movForm.description,
      amount:       finalAmt,
      balance_after: newBal,
      user_id:      profile.id,
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Movimiento registrado');
      setShowMov(false);
      setMovForm({ type: 'gasto', description: '', amount: '' });
      refresh();
    }
    setLoading(false);
  }

  // ── Cerrar caja ───────────────────────────────────────────
  async function closeCashbox() {
    if (!session) return;
    const bal = parseFloat(closeBal);
    if (isNaN(bal)) { toast.error('Ingresa el saldo físico de cierre'); return; }

    const lastBal  = movements[0]?.balance_after ?? session.opening_balance;
    const diff     = bal - lastBal;

    setLoading(true);
    const { error } = await supabase
      .from('cashbox_sessions')
      .update({
        is_open: false, closed_by: profile.id,
        closing_balance: bal, expected_balance: lastBal,
        difference: diff, closed_at: new Date().toISOString(),
        notes: closeNotes || null,
      })
      .eq('id', session.id);

    if (error) { toast.error(error.message); }
    else {
      // Movimiento de cierre
      await supabase.from('cashbox_movements').insert({
        cashbox_session_id: session.id,
        type: 'cierre', description: `Cierre de caja${diff !== 0 ? ` (diferencia: ${formatCOP(Math.abs(diff))})` : ''}`,
        amount: 0, balance_after: bal, user_id: profile.id,
      });
      toast.success('Caja cerrada correctamente');
      setShowClose(false);
      refresh();
    }
    setLoading(false);
  }

  // ── Cálculos ──────────────────────────────────────────────
  const currentBalance = movements[0]?.balance_after ?? session?.opening_balance ?? 0;
  const totalSales     = movements.filter(m => m.type === 'venta').reduce((s, m) => s + m.amount, 0);
  const totalExpenses  = movements.filter(m => ['gasto','retiro'].includes(m.type)).reduce((s, m) => s + Math.abs(m.amount), 0);
  const totalTransfer  = movements.filter(m => m.type === 'venta' && m.payment_method !== 'efectivo').reduce((s, m) => s + m.amount, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Caja</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${session ? 'badge-green' : 'badge-red'}`}>
              {session ? '● Abierta' : '○ Cerrada'}
            </span>
            {session && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Desde {formatDateTime(session.opened_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!session ? (
            <button className="btn-brand text-xs px-3 py-1.5" onClick={() => setShowOpen(true)}>
              🔓 Abrir caja
            </button>
          ) : (
            <>
              <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setShowMov(true)}>
                + Movimiento
              </button>
              {profile.role === 'admin' && (
                <button
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}
                  onClick={() => setShowClose(true)}
                >
                  🔒 Cerrar caja
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {session && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Saldo actual',    value: formatCOP(currentBalance), color: 'var(--brand)' },
            { label: 'Ventas del día',  value: formatCOP(totalSales),     color: 'var(--green)' },
            { label: 'Gastos / retiros',value: formatCOP(totalExpenses),  color: 'var(--red)'   },
            { label: 'En transferencia',value: formatCOP(totalTransfer),  color: 'var(--blue)'  },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              <div className="font-display font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sin caja */}
      {!session && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">💰</div>
          <div className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
            No hay caja abierta
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Abre la caja para registrar ventas y movimientos del día
          </p>
          <button className="btn-brand mx-auto" onClick={() => setShowOpen(true)}>
            🔓 Abrir caja ahora
          </button>
        </div>
      )}

      {/* Movimientos */}
      {session && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"
               style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Movimientos del día
            </span>
            <span className="badge badge-brand">{movements.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-base">
              <thead>
                <tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Monto</th><th>Saldo</th><th>Usuario</th></tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin movimientos</td></tr>
                ) : movements.map(m => {
                  const cfg = MOV_TYPE_CFG[m.type] ?? { label: m.type, color: 'var(--text-secondary)' };
                  const isPositive = m.amount >= 0;
                  return (
                    <tr key={m.id}>
                      <td className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {new Date(m.created_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td><span className="badge text-[10px]" style={{ background: cfg.color + '20', color: cfg.color }}>{cfg.label}</span></td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.description}</td>
                      <td>
                        <span className="text-sm font-bold" style={{ color: isPositive ? 'var(--green)' : 'var(--red)' }}>
                          {isPositive ? '+' : ''}{formatCOP(m.amount)}
                        </span>
                      </td>
                      <td className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatCOP(m.balance_after)}
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {m.user?.full_name ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Abrir caja */}
      {showOpen && (
        <div className="modal-overlay" onClick={() => setShowOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>🔓 Abrir caja</span>
              <button onClick={() => setShowOpen(false)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo inicial en efectivo</label>
                <input type="number" className="input-base w-full text-lg py-3 font-bold text-center"
                       value={openBal} onChange={e => setOpenBal(e.target.value)} />
                <div className="text-center text-sm mt-1" style={{ color: 'var(--brand)' }}>
                  {formatCOP(parseFloat(openBal) || 0)}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowOpen(false)}>Cancelar</button>
              <button className="btn-brand flex-1 justify-center" onClick={openCashbox} disabled={loading}>
                {loading ? 'Abriendo…' : '✓ Confirmar apertura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Movimiento manual */}
      {showMov && (
        <div className="modal-overlay" onClick={() => setShowMov(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>+ Movimiento manual</span>
              <button onClick={() => setShowMov(false)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['gasto','retiro','ingreso','ajuste'] as const).map(t => (
                  <button key={t} onClick={() => setMovForm(f => ({ ...f, type: t }))}
                          className="py-2 rounded text-xs font-medium capitalize transition-all"
                          style={{
                            background: movForm.type === t ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                            color:      movForm.type === t ? 'var(--brand)' : 'var(--text-secondary)',
                            border:     `1px solid ${movForm.type === t ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                          }}>
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Descripción *</label>
                <input className="input-base w-full text-sm py-2" placeholder="Ej: Compra de servilletas"
                       value={movForm.description} onChange={e => setMovForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Monto (COP) *</label>
                <input type="number" className="input-base w-full text-lg py-2 font-bold text-center"
                       value={movForm.amount} onChange={e => setMovForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowMov(false)}>Cancelar</button>
              <button className="btn-brand flex-1 justify-center" onClick={addMovement} disabled={loading}>
                {loading ? 'Guardando…' : '✓ Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cerrar caja */}
      {showClose && (
        <div className="modal-overlay" onClick={() => setShowClose(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>🔒 Cerrar caja</span>
              <button onClick={() => setShowClose(false)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo esperado en sistema</div>
                <div className="font-display font-bold text-xl" style={{ color: 'var(--brand)' }}>
                  {formatCOP(currentBalance)}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo físico contado *</label>
                <input type="number" className="input-base w-full text-lg py-2 font-bold text-center"
                       value={closeBal} onChange={e => setCloseBal(e.target.value)} />
                {closeBal && (
                  <div className="text-center text-xs mt-1"
                       style={{ color: parseFloat(closeBal) >= currentBalance ? 'var(--green)' : 'var(--red)' }}>
                    Diferencia: {formatCOP(parseFloat(closeBal) - currentBalance)}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notas de cierre</label>
                <textarea className="input-base w-full text-sm py-2" rows={2} placeholder="Observaciones..."
                          value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowClose(false)}>Cancelar</button>
              <button
                className="flex-1 justify-center text-sm py-2 rounded-lg font-semibold transition-all"
                style={{ background: 'var(--red)', color: 'white' }}
                onClick={closeCashbox} disabled={loading}>
                {loading ? 'Cerrando…' : '🔒 Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
