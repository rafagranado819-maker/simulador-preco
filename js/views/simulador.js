// Tela do Simulador de preço.
import { lucro, equilibrio, minimo, custoMaximo } from '../lib/calc.js';
import { criarGrafico } from '../lib/chart.js';
import { formatBRL, formatNumero, lerNumero } from '../lib/format.js';

// Valores iniciais (cenário Huggies do prompt — bom para demonstrar).
const estado = {
  modo: 'direto', // 'direto' | 'inverso'
  preco: 24.99,
  custo: 23.79,
  precoBuyBox: 24.99, // usado no modo inverso
  comissaoPct: 14,
  tarifaFixa: 6.75,
  entrega: 0,
  folgaPct: 20,
  impostoPct: 0,
};

let grafico = null;

/** Junta os parâmetros no formato que o módulo calc.js espera (frações). */
function params() {
  return {
    custo: estado.custo,
    comissao: estado.comissaoPct / 100,
    tarifaFixa: estado.tarifaFixa,
    entrega: estado.entrega,
    folga: estado.folgaPct / 100,
    imposto: estado.impostoPct / 100,
  };
}

export function render(container) {
  container.innerHTML = `
    <section class="tela">
      <h2>Simulador de preço</h2>
      <p class="subtitulo">Veja o lucro real depois das taxas do Mercado Livre. É só uma conta — nada é salvo.</p>

      <div class="abas" role="tablist">
        <button role="tab" data-modo="direto" aria-selected="true">Quanto vou lucrar?</button>
        <button role="tab" data-modo="inverso" aria-selected="false">Quanto posso pagar?</button>
      </div>

      <div class="cartao" id="controles"></div>

      <div class="cartao">
        <div id="resposta"></div>
        <div id="grafico" aria-hidden="false"></div>
      </div>

      <details class="recolhivel" id="taxas">
        <summary>Taxas do Mercado Livre</summary>
        <div class="conteudo">
          ${campo('comissaoPct', 'Comissão (%)', estado.comissaoPct, 'Percentual que o ML cobra sobre o preço.')}
          ${campo('tarifaFixa', 'Tarifa fixa (R$)', estado.tarifaFixa, 'Valor fixo por venda em anúncios baratos.')}
          ${campo('entrega', 'Entrega paga pelo vendedor (R$)', estado.entrega, 'Deixe 0 se o comprador paga o frete.')}
          ${campo('folgaPct', 'Folga desejada (%)', estado.folgaPct, 'Margem que você quer garantir sobre o custo.')}
          ${campo('impostoPct', 'Imposto (%) — opcional', estado.impostoPct, 'Deixe 0 se ainda não tem MEI/imposto.')}
        </div>
      </details>
    </section>
  `;

  grafico = criarGrafico(container.querySelector('#grafico'), (novoPreco) => {
    if (estado.modo === 'direto') {
      estado.preco = arred(novoPreco);
      const inp = container.querySelector('[data-campo="preco"]');
      if (inp) inp.value = formatNumero(estado.preco);
    } else {
      estado.precoBuyBox = arred(novoPreco);
      const inp = container.querySelector('[data-campo="precoBuyBox"]');
      if (inp) inp.value = formatNumero(estado.precoBuyBox);
    }
    recalcular(container);
  });

  // Abas de modo.
  container.querySelectorAll('.abas button').forEach((b) => {
    b.addEventListener('click', () => {
      estado.modo = b.dataset.modo;
      container.querySelectorAll('.abas button').forEach((x) =>
        x.setAttribute('aria-selected', String(x === b)));
      montarControles(container);
      recalcular(container);
    });
  });

  // Campos de taxas.
  container.querySelectorAll('#taxas [data-campo]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const v = lerNumero(inp.value);
      if (!Number.isNaN(v)) { estado[inp.dataset.campo] = v; recalcular(container); }
    });
  });

  montarControles(container);
  recalcular(container);
}

function campo(chave, rotulo, valor, dica) {
  return `
    <div class="campo">
      <label for="c-${chave}">${rotulo}</label>
      <input id="c-${chave}" data-campo="${chave}" inputmode="decimal"
             value="${formatNumero(valor)}" />
      ${dica ? `<div class="dica">${dica}</div>` : ''}
    </div>`;
}

function stepper(chave, rotulo, valor, passo) {
  return `
    <div class="controle">
      <label>${rotulo}</label>
      <div class="stepper">
        <button type="button" data-passo="${chave}" data-dir="-1" aria-label="Diminuir">−</button>
        <input data-campo="${chave}" inputmode="decimal" value="${formatNumero(valor)}"
               aria-label="${rotulo}" />
        <button type="button" data-passo="${chave}" data-dir="1" aria-label="Aumentar">+</button>
      </div>
    </div>`;
}

function montarControles(container) {
  const alvo = container.querySelector('#controles');
  if (estado.modo === 'direto') {
    alvo.innerHTML =
      stepper('preco', 'Preço de venda', estado.preco, 0.5) +
      stepper('custo', 'Custo do produto', estado.custo, 0.5);
  } else {
    alvo.innerHTML =
      stepper('precoBuyBox', 'Preço do Buy Box (concorrência)', estado.precoBuyBox, 0.5);
  }
  ligarSteppers(container, alvo);
}

function ligarSteppers(container, alvo) {
  const passoDe = (chave) => 0.5;
  alvo.querySelectorAll('input[data-campo]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const v = lerNumero(inp.value);
      if (!Number.isNaN(v)) { estado[inp.dataset.campo] = v; recalcular(container); }
    });
    inp.addEventListener('blur', () => {
      inp.value = formatNumero(estado[inp.dataset.campo]);
    });
  });
  alvo.querySelectorAll('button[data-passo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chave = btn.dataset.passo;
      const dir = Number(btn.dataset.dir);
      estado[chave] = arred(Math.max(0, estado[chave] + dir * passoDe(chave)));
      const inp = alvo.querySelector(`input[data-campo="${chave}"]`);
      if (inp) inp.value = formatNumero(estado[chave]);
      recalcular(container);
    });
  });
}

function arred(n) { return Math.round(n * 100) / 100; }

function recalcular(container) {
  const alvoResp = container.querySelector('#resposta');
  const p = params();

  // Proteções: comissão + imposto >= 100%.
  if ((p.comissao + p.imposto) >= 1) {
    alvoResp.className = '';
    alvoResp.innerHTML = `<div class="resposta vermelho"><p class="frase">
      Comissão + imposto não podem chegar a 100% do preço. Ajuste as taxas.</p></div>`;
    return;
  }

  if (estado.modo === 'inverso') {
    renderInverso(alvoResp, p);
  } else {
    renderDireto(alvoResp, p);
  }
}

function renderDireto(alvoResp, p) {
  const eq = equilibrio(p);
  const min = minimo(p);
  const l = lucro(estado.preco, p);

  let cor, frase;
  if (estado.preco < eq) {
    cor = 'vermelho';
    frase = `A ${formatBRL(estado.preco)} você tem prejuízo. Precisa vender por pelo menos ${formatBRL(eq)} só para empatar.`;
  } else if (estado.preco < min) {
    cor = 'amarelo';
    frase = `A ${formatBRL(estado.preco)} você lucra, mas abaixo da folga desejada. O ideal é a partir de ${formatBRL(min)}.`;
  } else {
    cor = 'verde';
    frase = `A ${formatBRL(estado.preco)} você garante a folga desejada. 👍`;
  }

  alvoResp.innerHTML = `
    <div class="resposta ${cor}">
      <p class="frase">${frase}</p>
      <div class="numeros mono">
        <span class="num"><span class="rotulo">Empata em</span><span class="valor">${formatBRL(eq)}</span></span>
        <span class="num"><span class="rotulo">Preço mínimo (com folga)</span><span class="valor">${formatBRL(min)}</span></span>
        <span class="num"><span class="rotulo">Lucro neste preço</span><span class="valor">${formatBRL(l)}</span></span>
      </div>
    </div>`;

  grafico.atualizar({
    preco: estado.preco,
    equilibrio: eq,
    minimo: min,
    fnLucro: (preco) => lucro(preco, p),
    passo: 0.5,
  });
}

function renderInverso(alvoResp, p) {
  const custoMax = custoMaximo(estado.precoBuyBox, p);
  const cor = custoMax > 0 ? 'verde' : 'vermelho';
  const frase = custoMax > 0
    ? `Vendendo a ${formatBRL(estado.precoBuyBox)}, você pode pagar no máximo <strong>${formatBRL(custoMax)}</strong> no produto e ainda garantir a folga de ${estado.folgaPct}%.`
    : `A ${formatBRL(estado.precoBuyBox)} não sobra nada: as taxas já consomem o preço. Não compensa comprar.`;

  alvoResp.innerHTML = `
    <div class="resposta ${cor}">
      <p class="frase">${frase}</p>
      <div class="numeros mono">
        <span class="num"><span class="rotulo">Buy Box</span><span class="valor">${formatBRL(estado.precoBuyBox)}</span></span>
        <span class="num"><span class="rotulo">Custo máximo</span><span class="valor">${formatBRL(Math.max(0, custoMax))}</span></span>
        <span class="num"><span class="rotulo">Folga</span><span class="valor">${estado.folgaPct}%</span></span>
      </div>
    </div>`;

  // No modo inverso o gráfico mostra o lucro variando o preço, com o custo máximo aplicado.
  const custoParaGrafico = Math.max(0, custoMax);
  const pg = { ...p, custo: custoParaGrafico };
  grafico.atualizar({
    preco: estado.precoBuyBox,
    equilibrio: equilibrio(pg),
    minimo: minimo(pg),
    fnLucro: (preco) => lucro(preco, pg),
    passo: 0.5,
  });
}
