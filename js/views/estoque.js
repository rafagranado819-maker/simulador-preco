// Tela de Estoque: somente leitura, calculada automaticamente.
import { listarEstoque, lerConfiguracoes } from '../lib/db.js';
import { formatBRL } from '../lib/format.js';
import { esc, dataBR, mensagem } from '../lib/ui.js';

export async function render(container) {
  container.innerHTML = `
    <section class="tela">
      <h2>Estoque</h2>
      <p class="subtitulo">Calculado sozinho: comprado − vendido. Nada é digitado aqui.</p>
      <div id="msg"></div>
      <div id="lista">Carregando…</div>
    </section>
  `;

  try {
    const [itens, config] = await Promise.all([listarEstoque(), lerConfiguracoes()]);
    const diasParado = config?.dias_estoque_parado ?? 30;
    montar(container, itens, diasParado);
  } catch (err) {
    mensagem(container.querySelector('#msg'), err.message, 'erro');
  }
}

function montar(container, itens, diasParado) {
  const alvo = container.querySelector('#lista');
  if (!itens.length) {
    alvo.innerHTML = `<div class="cartao"><p class="subtitulo" style="margin:0">Nenhum produto cadastrado ainda.</p></div>`;
    return;
  }

  alvo.innerHTML = itens.map((e) => {
    let alerta = '';
    if (e.disponivel <= 0) {
      alerta = `<div class="resposta amarelo" style="margin:10px 0 0"><p class="frase" style="margin:0">Esgotado.</p></div>`;
    } else if (e.dias_sem_vender !== null && e.dias_sem_vender > diasParado) {
      alerta = `<div class="resposta amarelo" style="margin:10px 0 0"><p class="frase" style="margin:0">Parado há ${e.dias_sem_vender} dias (mais de ${diasParado}).</p></div>`;
    }
    return `
    <div class="cartao">
      <strong>${esc(e.nome)}</strong>
      <div class="numeros mono" style="margin-top:10px">
        <span class="num"><span class="rotulo">Comprado</span><span class="valor">${e.comprado}</span></span>
        <span class="num"><span class="rotulo">Vendido</span><span class="valor">${e.vendido}</span></span>
        <span class="num"><span class="rotulo">Disponível</span><span class="valor">${e.disponivel}</span></span>
      </div>
      <div class="numeros mono" style="margin-top:8px">
        <span class="num"><span class="rotulo">Custo médio</span><span class="valor">${formatBRL(e.custo_medio)}</span></span>
        <span class="num"><span class="rotulo">Valor parado</span><span class="valor">${formatBRL(e.valor_estoque)}</span></span>
        <span class="num"><span class="rotulo">Última venda</span><span class="valor">${dataBR(e.ultima_venda)}</span></span>
      </div>
      ${alerta}
    </div>`;
  }).join('');
}
