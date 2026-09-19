// Formatação e leitura de números no padrão pt-BR.
// Sem dependências.

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const num2 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "R$ 1.234,56" */
export function formatBRL(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return brl.format(valor);
}

/** "1.234,56" (sem símbolo) */
export function formatNumero(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return num2.format(valor);
}

/** Percentual a partir de uma fração: 0.201 -> "20,1%" */
export function formatPct(fracao, casas = 1) {
  if (fracao === null || fracao === undefined || Number.isNaN(fracao)) return '—';
  const s = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(fracao * 100);
  return `${s}%`;
}

/**
 * Lê um número digitado pelo usuário aceitando vírgula OU ponto.
 * Aceita "24,99", "24.99", "1.234,56", "R$ 24,99", "  50 ".
 * Devolve NaN se não der para interpretar.
 */
export function lerNumero(texto) {
  if (typeof texto === 'number') return texto;
  if (texto === null || texto === undefined) return NaN;

  let s = String(texto).trim();
  if (s === '') return NaN;

  // Remove símbolos de moeda e espaços.
  s = s.replace(/r\$/gi, '').replace(/\s/g, '');

  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');

  if (temVirgula && temPonto) {
    // Formato pt-BR: ponto = milhar, vírgula = decimal. Ex: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    // Só vírgula: decimal. Ex: 24,99
    s = s.replace(',', '.');
  }
  // Só ponto (ou nenhum): já está no formato do JS.

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
