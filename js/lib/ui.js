// Pequenos utilitários de interface compartilhados.

/** Escapa texto vindo do banco antes de exibir (evita XSS). */
export function esc(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Data ISO (yyyy-mm-dd) -> dd/mm/aaaa. */
export function dataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Data de hoje em yyyy-mm-dd (fuso local do aparelho). */
export function hojeISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

/** Mostra uma mensagem simples (sucesso ou erro) dentro de um elemento. */
export function mensagem(el, texto, tipo = 'info') {
  const cor = tipo === 'erro' ? 'vermelho' : tipo === 'ok' ? 'verde' : 'amarelo';
  el.innerHTML = `<div class="resposta ${cor}" role="status"><p class="frase" style="margin:0">${esc(texto)}</p></div>`;
}

/** Confirmação simples (usa o diálogo do navegador — direto e sem dependências). */
export function confirmar(texto) {
  return window.confirm(texto);
}
