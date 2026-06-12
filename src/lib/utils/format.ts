// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Utilidades de formato (completo)
// Archivo: src/lib/utils/format.ts
// ══════════════════════════════════════════════════════════════

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatCompact(amount: number): string {
  return new Intl.NumberFormat('es-CO', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatOrderNumber(n: number): string {
  return `#${String(n).padStart(3, '0')}`;
}

export function truncate(text: string, maxLength = 30): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

export function calcMargin(price: number, cost: number): number {
  if (price === 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

export function marginColor(margin: number): string {
  if (margin >= 50) return 'var(--green)';
  if (margin >= 30) return 'var(--yellow)';
  return 'var(--red)';
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
