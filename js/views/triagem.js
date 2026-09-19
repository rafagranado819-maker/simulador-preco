// Tela de Triagem de compra.
import { triagem, minimo, lucro, LIMITES_PADRAO } from '../lib/calc.js';
import { criarGrafico } from '../lib/chart.js';
import { formatBRL, formatPct, lerNumero } from '../lib/format.js';

const estado = {
  produto: '',
  catalogo: 'sim', // 'sim' | 'nao'
  vendasTexto: '', // vazio = desconhecido
  precoBuyBox: '',
  custo: '',
  comissaoPct: 14,
  tarifaFixa: 6.75,
  entrega: 0,
  folgaPct: 20,
  margemMinPct: 20,
};

let grafico = null;

const CORES = {
  reprovado: 'vermelho',
  falta_dado: 'amarelo',
  teste_1: 'amarelo',
  ok_1_2: 'amarelo',
  ate_5: 'verde',
  alta_vazao: 'verde',
};

export function render(container) {
  container.innerHTML = `
    <section class="tela">
      <h2>Triagem de compra</h2>
      <p class="subtitulo">Antes de comprar, confira os critérios. O veredito usa o preço real do Buy Box do dia.</p>

      <div class="cartao">
        ${campoTexto('produto', 'Produto', estado.produto, 'text', 'Nome ou link do anúncio.')}
        <div class="campo">
          <label for="t-catalogo">É anúncio de catálogo?</label>
          <select id="t-catalogo" data-campo="catalogo">
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <div class="dica">Catálogo é obrigatório. Evite anúncio tradicional.</div>
        </div>
        ${campoTexto('vendasTexto', 'Número de vendas do anúncio', estado.vendasTexto, 'text', 'Deixe em branco se não souber.')}
        <div class="linha">
          ${campoTexto('precoBuyBox', 'Preço do Buy Box (R$)', estado.precoBuyBox)}
          ${campoTexto('custo', 'Seu custo (R$)', estado.custo)}
        </div>
      </div>

      <div class="cartao">
        <div id="veredito"></div>
        <div id="grafico"></div>
      </div>

      <details class="recolhivel" id="taxas">
        <summary>Taxas e critérios</summary>
        <div class="conteudo">
          ${campoTexto('comissaoPct', 'Comissão (%)', estado.comissaoPct)}
          ${campoTexto('tarifaFixa', 'Tarifa fixa (R$)', estado.tarifaFixa)}
          ${campoTexto('entrega', 'Entrega paga pelo vendedor (R$)', estado.entrega)}
          ${campoTexto('folgaPct', 'Folga desejada (%)', estado.folgaPct)}
          ${campoTexto('margemMinPct', 'Margem mínima (%)', estado.margemMinPct)}
        </div>
      </details>

      <div class="acoes">
        <button class="botao" id="btn-salvar" disabled>Salvar triagem</button>
        <button class="botao secundario" id="btn-comprar" disabled>Comprar</button>
      </div>
      <p class="aviso-etapa">Salvar a triagem e abrir a compra ficam disponíveis na Etapa 2 (com login e banco de dados).</p>
    </section>
  `;

  grafico = criarGrafico(container.querySelector('#grafico'), () => {});

  container.querySelector('#t-catalogo').value = estado.catalogo;

  container.querySelectorAll('[data-campo]').forEach((inp) => {
    inp.addEventListener('input', () => {
      estado[inp.dataset.campo] = inp.value;
      recalcular(container);
    });
  });

  recalcular(container);
}

function campoTexto(chave, rotulo, valor, tipo = 'text', dica = '') {
  const inputmode = tipo === 'text' && !['produto', 'vendasTexto'].includes(chave) ? 'decimal' : '';
  return `
    <div class="campo">
      <label for="t-${chave}">${rotulo}</label>
      <input id="t-${chave}" data-campo="${chave}" type="${tipo}"
             ${inputmode ? `inputmode="${inputmode}"` : ''}
             value="${valor}" />
      ${dica ? `<div class="dica">${dica}</div>` : ''}
    </div>`;
}

function recalcular(container) {
  const alvo = container.querySelector('#veredito');

  const custo = lerNumero(estado.custo);
  const precoBuyBox = lerNumero(estado.precoBuyBox);
  const comissao = lerNumero(estado.comissaoPct) / 100;
  const tarifaFixa = lerNumero(estado.tarifaFixa) || 0;
  const entrega = lerNumero(estado.entrega) || 0;
  const folga = lerNumero(estado.folgaPct) / 100;
  const margemMin = lerNumero(estado.margemMinPct) / 100;

  const vendasTxt = String(estado.vendasTexto).replace(/\D/g, '');
  const vendas = vendasTxt === '' ? null : Number(vendasTxt);

  // Precisa do básico para dar veredito.
  const faltaBasico = Number.isNaN(custo) || Number.isNaN(precoBuyBox) || Number.isNaN(comissao);
  if (faltaBasico) {
    alvo.innerHTML = `<div class="resposta amarelo"><p class="frase">
      Preencha custo, preço do Buy Box e comissão para ver o veredito.</p></div>`;
    return;
  }

  const dados = {
    catalogo: estado.catalogo === 'sim',
    vendas,
    precoBuyBox,
    custo,
    comissao,
    tarifaFixa,
    entrega,
  };
  const limites = { ...LIMITES_PADRAO, margemMin };
  const r = triagem(dados, limites);
  const cor = CORES[r.codigo] || 'amarelo';

  const min = (custo > 0 && (comissao) < 1)
    ? minimo({ custo, comissao, tarifaFixa, entrega, folga })
    : NaN;

  alvo.innerHTML = `
    <div class="resposta ${cor}">
      <p class="frase">${r.icone} ${r.texto}</p>
      <div class="numeros mono">
        <span class="num"><span class="rotulo">Margem no Buy Box</span><span class="valor">${formatPct(r.margem)}</span></span>
        <span class="num"><span class="rotulo">Margem mínima</span><span class="valor">${formatPct(r.margemMin)}</span></span>
        <span class="num"><span class="rotulo">Preço mínimo (com folga)</span><span class="valor">${formatBRL(min)}</span></span>
      </div>
    </div>`;

  if (custo > 0 && comissao < 1) {
    const p = { custo, comissao, tarifaFixa, entrega, folga };
    grafico.atualizar({
      preco: precoBuyBox,
      equilibrio: minimo({ ...p, folga: 0 }), // equilíbrio = mínimo com folga 0
      minimo: min,
      fnLucro: (preco) => lucro(preco, p),
      passo: 0.5,
    });
  }
}
