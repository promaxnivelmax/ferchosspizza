'use client';

// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Admin: Usuarios Client Component
// Archivo: src/app/admin/users/UsersAdmin.tsx
// ══════════════════════════════════════════════════════════════


import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast }        from 'sonner';
import { formatDateTime } from '@/lib/utils/format';

interface UserProfile {
  id: string; email: string; full_name: string; role: string;
  phone?: string; is_active: boolean; last_login?: string; created_at: string;
}
interface Props { initialUsers: UserProfile[]; currentUserId: string; }

const ROLE_CFG: Record<string, { label: string; icon: string; color: string }> = {
  admin:         { label: 'Administrador', icon: '👑', color: 'var(--brand)'  },
  cajero:        { label: 'Cajero',        icon: '💰', color: 'var(--green)'  },
  mesero:        { label: 'Mesero',        icon: '🍽️', color: 'var(--blue)'   },
  cocina:        { label: 'Cocina',        icon: '👨‍🍳', color: 'var(--yellow)' },
  domiciliario:  { label: 'Domiciliario',  icon: '🛵', color: 'var(--purple)' },
  cliente:       { label: 'Cliente',       icon: '👤', color: 'var(--text-muted)' },
};

const EMPTY_FORM = { full_name: '', email: '', role: 'mesero', phone: '', is_active: true };

export default function UsersAdmin({ initialUsers, currentUserId }: Props) {
  const supabase  = createClient();
  const [users, setUsers]     = useState<UserProfile[]>(initialUsers);
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('role').order('full_name');
    if (data) setUsers(data);
  }, [supabase]);

  function openEdit(u: UserProfile) {
    setEditing(u);
    setForm({ full_name: u.full_name, email: u.email, role: u.role, phone: u.phone ?? '', is_active: u.is_active });
    setModal(true);
  }

  async function saveUser() {
    if (!form.full_name.trim()) { toast.error('Nombre requerido'); return; }
    setLoading(true);
    if (editing) {
      const { error } = await supabase.from('user_profiles')
        .update({ full_name: form.full_name, role: form.role, phone: form.phone || null, is_active: form.is_active })
        .eq('id', editing.id);
      if (error) toast.error(error.message);
      else { toast.success('Usuario actualizado'); setModal(false); refresh(); }
    }
    setLoading(false);
  }

  async function toggleActive(u: UserProfile) {
    if (u.id === currentUserId) { toast.error('No puedes desactivarte a ti mismo'); return; }
    const { error } = await supabase.from('user_profiles')
      .update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) toast.error(error.message);
    else { toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado'); refresh(); }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Usuarios del sistema</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{users.length} usuarios registrados</p>
        </div>
        <div className="rounded-lg px-3 py-2 text-xs"
             style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }}>
          ℹ️ Crea usuarios en Supabase Dashboard → Authentication → Users
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-base">
            <thead>
              <tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Teléfono</th><th>Último acceso</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleCfg = ROLE_CFG[u.role] ?? ROLE_CFG.cliente;
                const isSelf  = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                             style={{ background: `linear-gradient(135deg,${roleCfg.color},var(--purple))` }}>
                          {u.full_name[0]}
                        </div>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {u.full_name} {isSelf && <span className="badge badge-brand text-[9px] ml-1">Tú</span>}
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Desde {new Date(u.created_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td>
                      <span className="text-xs font-semibold" style={{ color: roleCfg.color }}>
                        {roleCfg.icon} {roleCfg.label}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.phone ?? '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.last_login ? formatDateTime(u.last_login) : 'Nunca'}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={isSelf}
                        className="badge text-[10px] cursor-pointer"
                        style={{
                          background: u.is_active ? 'var(--green-dim)' : 'var(--red-dim)',
                          color:      u.is_active ? 'var(--green)'     : 'var(--red)',
                          opacity:    isSelf ? 0.5 : 1,
                        }}>
                        {u.is_active ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td>
                      <button className="btn-secondary text-xs px-2 py-1" onClick={() => openEdit(u)}>✏️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guía de contraseñas demo */}
      <div className="card p-4">
        <div className="font-display font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
          👥 Usuarios de demostración
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {[
            { role: 'admin',        email: 'admin@ferchos.com',     icon: '👑', label: 'Administrador',  access: 'Todo el sistema' },
            { role: 'cajero',       email: 'cajero@ferchos.com',    icon: '💰', label: 'Cajero',         access: 'POS, Mesas, Caja, Clientes, Domicilios' },
            { role: 'mesero',       email: 'mesero@ferchos.com',    icon: '🍽️', label: 'Mesero',         access: 'POS y Mesas' },
            { role: 'cocina',       email: 'cocina@ferchos.com',    icon: '👨‍🍳', label: 'Cocina',         access: 'Panel de cocina' },
            { role: 'domiciliario', email: 'domicilio@ferchos.com', icon: '🛵', label: 'Domiciliario',  access: 'Domicilios asignados' },
          ].map(u => (
            <div key={u.role} className="p-3 rounded-lg"
                 style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span>{u.icon}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{u.label}</span>
              </div>
              <div className="text-[11px] font-mono mb-1" style={{ color: 'var(--brand)' }}>{u.email}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{u.access}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs px-3 py-2 rounded"
             style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
          🔐 Contraseña de todos: <code className="font-mono font-bold">Ferchos2025!</code>
          &nbsp;· Crea estos usuarios en Supabase Auth → Add User
        </div>
      </div>

      {/* Modal editar */}
      {showModal && editing && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <span className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>Editar usuario</span>
              <button onClick={() => setModal(false)} className="w-7 h-7 rounded flex items-center justify-center"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nombre completo</label>
                <input className="input-base w-full text-sm py-2" value={form.full_name}
                       onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Rol</label>
                <select className="input-base w-full text-sm py-2" value={form.role}
                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {Object.entries(ROLE_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Teléfono</label>
                <input className="input-base w-full text-sm py-2" placeholder="3001234567"
                       value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span style={{ color: 'var(--text-secondary)' }}>Usuario activo</span>
              </label>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-brand flex-1 justify-center" onClick={saveUser} disabled={loading}>
                {loading ? 'Guardando…' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
