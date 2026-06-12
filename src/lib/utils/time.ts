// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Utilidades de tiempo (Colombia UTC-5)
// Archivo: src/lib/utils/time.ts
// ══════════════════════════════════════════════════════════════

export const TIMEZONE = 'America/Bogota';

/** Retorna la hora actual en Colombia formateada */
export function formatColombiaTime(): string {
  return new Date().toLocaleTimeString('es-CO', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Retorna la fecha actual en Colombia */
export function formatColombiaDate(date?: Date): string {
  return (date ?? new Date()).toLocaleDateString('es-CO', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Retorna la hora actual en Colombia (número 0–23) */
export function getColombiaHour(): number {
  const d = new Date();
  return parseInt(
    d.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false }),
    10
  );
}

/**
 * Retorna la unidad de negocio activa según el horario de Colombia.
 * 06:00–10:59 → Desayunos
 * 11:00–15:59 → Almuerzos
 * 16:00–23:00 → Pizzería
 * 23:01–05:59 → Cerrado
 */
export function getActiveBusinessUnit(): string {
  const h = getColombiaHour();
  if (h >= 6  && h < 11) return '☀️ Desayunos';
  if (h >= 11 && h < 16) return '🍽️ Almuerzos';
  if (h >= 16 && h <= 23) return '🍕 Pizzería';
  return '🌙 Cerrado';
}

/** Retorna si el negocio está abierto */
export function isBusinessOpen(): boolean {
  const h = getColombiaHour();
  return h >= 6 && h <= 23;
}

/** Formato corto de fecha/hora para tabla */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Formatea duración en minutos como "Xm" o "Xh Xm" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Calcula minutos transcurridos desde una fecha ISO */
export function minutesSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
}
