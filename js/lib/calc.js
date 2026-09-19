// Lógica pura do simulador e da triagem.
// Sem DOM, sem dependências — testável com `node --test`.
//
// Convenções:
// - Percentuais entram como FRAÇÃO (14% => 0.14; folga 20% => 0.20).
// - Valores monetários em reais (número, não string).
//
// Fórmulas (ver prompt §6):
//   lucro(p)  = p*(1 - comissao - imposto) - tarifaFixa - entrega - custo
//   equilibrio = (custo + tarifaFixa + entrega) / (1 - comissao - imposto)
//   minimo     = (custo*(1+folga) + tarifaFixa + entrega) / (1 - comissao - imposto)
//   custoMax   = (p*(1 - comissao - imposto) - tarifaFixa - entrega) / (1 + folga)
//
// O `imposto` é opcional (padrão 0). Com imposto = 0 as fórmulas coincidem
// exatamente com as do prompt e com os casos de teste do §11.

/** Fração líquida do preço que sobra após comissão e imposto. */
function taxaLiquida(comissao, imposto = 0) {
  return 1 - comissao - imposto;
}

/** Lança se a comissão (+ imposto) engolir 100% ou mais do preço. */
function checarTaxas(comissao, imposto = 0) {
  const r = taxaLiquida(comissao, imposto);
  if (r <= 0) {
    throw new RangeError(
      'Comissão + imposto não podem chegar a 100% do preço.'
    );
  }
  return r;
}

/**
 * Lucro para um preço de venda p.
 * @returns {number} reais (pode ser negativo)
 */
export function lucro(p, { custo, comissao, tarifaFixa = 0, entrega = 0, imposto = 0 }) {
  const r = checarTaxas(comissao, imposto);
  return p * r - tarifaFixa - entrega - custo;
}

/**
 * Preço de equilíbrio (lucro = 0).
 */
export function equilibrio({ custo, comissao, tarifaFixa = 0, entrega = 0, imposto = 0 }) {
  const r = checarTaxas(comissao, imposto);
  return (custo + tarifaFixa + entrega) / r;
}

/**
 * Preço mínimo para garantir a folga desejada sobre o custo.
 */
export function minimo({ custo, comissao, tarifaFixa = 0, entrega = 0, imposto = 0, folga = 0 }) {
  const r = checarTaxas(comissao, imposto);
  return (custo * (1 + folga) + tarifaFixa + entrega) / r;
}

/**
 * Modo inverso: dado o preço do Buy Box, quanto posso pagar no máximo no produto
 * para ainda garantir a folga desejada.
 * @returns {number} custo máximo em reais (pode ser <= 0 => não compensa)
 */
export function custoMaximo(p, { comissao, tarifaFixa = 0, entrega = 0, imposto = 0, folga = 0 }) {
  const r = checarTaxas(comissao, imposto);
  return (p * r - tarifaFixa - entrega) / (1 + folga);
}

/**
 * Margem sobre o custo a um dado preço de venda.
 *   margem = liquido / custo - 1
 * onde liquido = p*(1 - comissao - imposto) - tarifaFixa - entrega.
 * @returns {number} fração (0.2 = 20%). Lança se custo <= 0.
 */
export function margem(p, { custo, comissao, tarifaFixa = 0, entrega = 0, imposto = 0 }) {
  if (!(custo > 0)) {
    throw new RangeError('Custo precisa ser maior que zero para calcular a margem.');
  }
  const liquido = p * taxaLiquida(comissao, imposto) - tarifaFixa - entrega;
  return liquido / custo - 1;
}

/**
 * Limites padrão da triagem (parâmetros editáveis — prompt §2).
 */
export const LIMITES_PADRAO = Object.freeze({
  evitarAbaixoDe: 500,
  faixa1: 1000,
  faixa5: 5000,
  faixa10: 10000,
  margemMin: 0.2, // 20%
});

/**
 * Aplica a triagem de compra e devolve o veredito (prompt §2 e §37).
 *
 * Ordem de avaliação:
 *   1. não é catálogo               -> reprovado
 *   2. sem nº de vendas             -> falta_dado
 *   3. abaixo de `evitarAbaixoDe`   -> reprovado (baixa demanda)
 *   4. margem abaixo do mínimo      -> reprovado (margem)
 *   5. >= faixa10                   -> alta_vazao
 *   6. >= faixa5                    -> ate_5
 *   7. >= faixa1                    -> ok_1_2
 *   8. senão (faixa de teste)       -> teste_1
 *
 * @param {object} dados
 * @param {boolean} dados.catalogo
 * @param {number|null} dados.vendas    número de vendas do anúncio (null = desconhecido)
 * @param {number} dados.precoBuyBox
 * @param {number} dados.custo
 * @param {number} dados.comissao       fração
 * @param {number} [dados.tarifaFixa]
 * @param {number} [dados.entrega]
 * @param {number} [dados.imposto]
 * @param {object} [limites]            sobrescreve LIMITES_PADRAO
 */
export function triagem(dados, limites = LIMITES_PADRAO) {
  const L = { ...LIMITES_PADRAO, ...limites };
  const {
    catalogo,
    vendas,
    precoBuyBox,
    custo,
    comissao,
    tarifaFixa = 0,
    entrega = 0,
    imposto = 0,
  } = dados;

  // Margem no preço real do Buy Box (calculada sempre que der).
  let margemAtual = null;
  if (custo > 0 && precoBuyBox > 0 && taxaLiquida(comissao, imposto) > 0) {
    margemAtual = margem(precoBuyBox, { custo, comissao, tarifaFixa, entrega, imposto });
  }

  const base = { margem: margemAtual, margemMin: L.margemMin };

  // 1. Catálogo é obrigatório.
  if (!catalogo) {
    return { ...base, codigo: 'reprovado', icone: '❌', motivo: 'nao_catalogo',
      texto: 'Não é anúncio de catálogo. Evitar.' };
  }

  // 2. Falta o número de vendas.
  if (vendas === null || vendas === undefined || Number.isNaN(vendas)) {
    return { ...base, codigo: 'falta_dado', icone: '⏳', motivo: 'sem_vendas',
      texto: 'Falta o número de vendas do anúncio.' };
  }

  // 3. Demanda baixa demais.
  if (vendas < L.evitarAbaixoDe) {
    return { ...base, codigo: 'reprovado', icone: '❌', motivo: 'baixa_demanda',
      texto: `Menos de ${L.evitarAbaixoDe} vendas: demanda baixa. Evitar.` };
  }

  // 4. Margem abaixo do mínimo (no Buy Box do dia).
  if (margemAtual !== null && margemAtual < L.margemMin) {
    return { ...base, codigo: 'reprovado', icone: '❌', motivo: 'margem',
      texto: `Margem no Buy Box abaixo do mínimo de ${Math.round(L.margemMin * 100)}%.` };
  }

  // 5–8. Faixas de volume.
  if (vendas >= L.faixa10) {
    return { ...base, codigo: 'alta_vazao', icone: '🚀', motivo: 'faixa_10k',
      texto: 'Alta vazão (10.000+). Prioridade.' };
  }
  if (vendas >= L.faixa5) {
    return { ...base, codigo: 'ate_5', icone: '✅', motivo: 'faixa_5k',
      texto: '5.000+ vendas. Pode comprar até 5 unidades.' };
  }
  if (vendas >= L.faixa1) {
    return { ...base, codigo: 'ok_1_2', icone: '⚠️', motivo: 'faixa_1k',
      texto: '1.000+ vendas. Comprar 1 a 2 unidades.' };
  }
  // Faixa 500–999: não definida -> tratar como teste (prompt §2 / §13).
  return { ...base, codigo: 'teste_1', icone: '⚠️', motivo: 'faixa_teste',
    texto: 'Entre 500 e 999 vendas. Só 1 unidade para teste.' };
}
