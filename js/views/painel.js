// Tela do Painel: resumo do negócio, lucro por produto e alertas.
import { listarCompras, listarVendas, listarEstoque, lerConfiguracoes } from '../lib/db.js';
import { formatBRL, formatPct } from '../lib/format.js';
import { esc, mensagem } from '../lib/ui.js';
import { exportarTudo, exportarCompras, exportarVendas, exportarEstoque, exportarTriagens } from '../lib/export-csv.js';

export async function render(container) {
  container.innerHTML = `
    <section class="tela">
      <h2>Painel</h2>
      <p class="subtitulo">Resumo do negócio, calculado a partir das suas compras e vendas.</p>
      <div id="msg"></div>
      <div id="conteudo">Carregando…</div>
    </section>
  `;

  try {
    const [compras, vendas, estoque, config] = await Promise.all([
      listarCompras(), listarVendas(), listarEstoque(), lerConfiguracoes(),
    ]);
    montar(container, { compras, vendas, estoque, config });
  } catch (err) {
    mensagem(container.querySelector('#msg'), err.message, 'erro');
  }
}

function montar(container, { compras, vendas, estoque, config }) {
  const anoAtual = new Date().getFullYear();
  const tetoMei = Number(config?.teto_mei ?? 81000);
  const diasParado = config?.dias_estoque_parado ?? 30;

  const investido = compras.reduce((s, c) => s + c.qtd * c.custo_unit + (c.frete || 0), 0);
  const receitaLiquida = vendas.reduce((s, v) => s + Number(v.liquido_recebido), 0);
  const lucro = vendas.reduce((s, v) => s + Number(v.lucro), 0);
  const unidades = vendas.reduce((s, v) => s + v.qtd, 0);
  const roi = investido > 0 ? lucro / investido : null;
  const faturamentoAno = vendas
    .filter((v) => String(v.data).slice(0, 4) === String(anoAtual))
    .reduce((s, v) => s + Number(v.bruto), 0);
  const pctTeto = tetoMei > 0 ? faturamentoAno / tetoMei : 0;
  const valorParado = estoque.reduce((s, e) => s + Number(e.valor_estoque || 0), 0);

  // Lucro por produto.
  const porProduto = new Map();
  for (const v of vendas) {
    const nome = v.produto_nome ?? '—';
    const cur = porProduto.get(nome) || { lucro: 0, unidades: 0 };
    cur.lucro += Number(v.lucro);
    cur.unidades += v.qtd;
    porProduto.set(nome, cur);
  }
  const listaProdutos = [...porProduto.entries()].sort((a, b) => a[1].lucro - b[1].lucro);

  // Alertas.
  const alertas = [];
  for (const [nome, d] of porProduto) {
    if (d.lucro < 0) alertas.push({ tipo: 'vermelho', texto: `"${nome}" está no prejuízo (${formatBRL(d.lucro)}).` });
  }
  for (const e of estoque) {
    if (e.disponivel > 0 && e.dias_sem_vender !== null && e.dias_sem_vender > diasParado) {
      alertas.push({ tipo: 'amarelo', texto: `"${e.nome}" parado há ${e.dias_sem_vender} dias.` });
    }
  }
  if (pctTeto >= 0.8) {
    alertas.push({ tipo: 'amarelo', texto: `Faturamento do ano em ${formatPct(pctTeto)} do teto do MEI.` });
  }

  const corLucro = lucro < 0 ? 'var(--vermelho)' : 'var(--verde)';

  container.querySelector('#conteudo').innerHTML = `
    <div class="cartao">
      <div class="numeros mono">
        ${tile('Investido', formatBRL(investido))}
        ${tile('Receita líquida', formatBRL(receitaLiquida))}
        ${tile('Lucro', `<span style="color:${corLucro}">${formatBRL(lucro)}</span>`)}
        ${tile('ROI', formatPct(roi))}
        ${tile('Unidades vendidas', String(unidades))}
        ${tile('Valor parado em estoque', formatBRL(valorParado))}
      </div>
    </div>

    <div class="cartao">
      <strong>Teto do MEI (${anoAtual})</strong>
      <div class="numeros mono" style="margin-top:8px">
        ${tile('Faturamento bruto do ano', formatBRL(faturamentoAno))}
        ${tile('% do teto (R$ ' + formatBRL(tetoMei).replace('R$ ', '') + ')', formatPct(pctTeto))}
      </div>
      <div style="margin-top:10px; background:var(--borda); border-radius:8px; height:12px; overflow:hidden">
        <div style="width:${Math.min(100, pctTeto * 100).toFixed(1)}%; height:100%; background:${pctTeto >= 0.8 ? 'var(--amarelo)' : 'var(--verde)'}"></div>
      </div>
    </div>

    <h3 style="margin:20px 0 8px">Lucro por produto</h3>
    ${listaProdutos.length ? listaProdutos.map(([nome, d]) => `
      <div class="cartao">
        <div style="display:flex; justify-content:space-between; gap:12px">
          <strong>${esc(nome)}</strong>
          <span class="mono" style="color:${d.lucro < 0 ? 'var(--vermelho)' : 'var(--verde)'}; font-weight:700">${formatBRL(d.lucro)}</span>
        </div>
        <span class="subtitulo">${d.unidades} unidade(s) vendida(s)</span>
      </div>`).join('') : `<div class="cartao"><p class="subtitulo" style="margin:0">Nenhuma venda ainda.</p></div>`}

    <h3 style="margin:20px 0 8px">Alertas</h3>
    ${alertas.length ? alertas.map((a) => `
      <div class="resposta ${a.tipo}" style="margin-bottom:10px"><p class="frase" style="margin:0">${esc(a.texto)}</p></div>`).join('')
      : `<div class="cartao"><p class="subtitulo" style="margin:0">Nenhum alerta no momento. 👍</p></div>`}

    <h3 style="margin:20px 0 8px">Exportar (backup)</h3>
    <div class="cartao">
      <p class="subtitulo" style="margin-top:0">Baixe seus dados em CSV (abre no Excel). Bom para guardar uma cópia.</p>
      <div class="acoes">
        <button class="botao" data-exp="tudo">Exportar tudo</button>
        <button class="botao secundario" data-exp="compras">Compras</button>
        <button class="botao secundario" data-exp="vendas">Vendas</button>
        <button class="botao secundario" data-exp="estoque">Estoque</button>
        <button class="botao secundario" data-exp="triagens">Triagens</button>
      </div>
    </div>
  `;

  const exps = { tudo: exportarTudo, compras: exportarCompras, vendas: exportarVendas, estoque: exportarEstoque, triagens: exportarTriagens };
  container.querySelectorAll('[data-exp]').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await exps[b.dataset.exp](); }
      catch (err) { mensagem(container.querySelector('#msg'), err.message, 'erro'); }
      finally { b.disabled = false; }
    });
  });
}

function tile(rotulo, valorHtml) {
  return `<span class="num"><span class="rotulo">${esc(rotulo)}</span><span class="valor">${valorHtml}</span></span>`;
}
