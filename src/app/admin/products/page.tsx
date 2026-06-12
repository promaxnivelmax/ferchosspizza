// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Admin: Gestión de productos
// Archivo: src/app/admin/products/page.tsx
// ══════════════════════════════════════════════════════════════

import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell         from '@/components/layout/AppShell';
import ProductsAdmin    from './ProductsAdmin';

export const metadata = { title: 'Gestión de Productos' };

export default async function AdminProductsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('*, category:categories(name)').order('business_unit').order('sort_order'),
    supabase.from('categories').select('id, name, business_unit').order('sort_order'),
  ]);

  return (
    <AppShell profile={profile}>
      <ProductsAdmin
        initialProducts={productsRes.data ?? []}
        categories={categoriesRes.data ?? []}
      />
    </AppShell>
  );
}
