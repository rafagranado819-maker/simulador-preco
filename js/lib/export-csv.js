// Exportação em CSV que abre bem no Excel em pt-BR (separador ";", vírgula
// decimal e BOM UTF-8 para os acentos aparecerem certos).
import { listarCompras, listarVendas, listarEstoque, listarTriagens } from './db.js';
import { dataBR } from './ui.js';

const SEP = ';';

function numeroBR(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return Number(n).toFixed(2).replace('.', ',');
}

function celula(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor);
  if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

/** Gera o texto CSV a partir de cabeçalhos e linhas (array de arrays). */
function montarCSV(cabecalhos, linhas) {
  const corpo = [cabecalhos, ...linhas]
    .map((linha) => linha.map(celula).join(SEP))
    .join('\r\n');
  return '﻿' + corpo; // BOM
}

/** Dispara o download de um arquivo CSV. */
function baixar(nome, texto) {
  const blob = new Blob([texto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportarCompras() {
  const dados = await listarCompras();
  const linhas = dados.map((c) => [
    dataBR(c.data), c.produtos?.nome ?? '', c.marketplace_compra ?? '',
    c.qtd, numeroBR(c.custo_unit), numeroBR(c.frete),
    numeroBR(c.qtd * c.custo_unit + (c.frete || 0)),
    numeroBR(c.preco_pretendido), c.obs ?? '',
  ]);
  baixar('compras.csv', montarCSV(
    ['Data', 'Produto', 'Onde comprou', 'Qtd', 'Custo un.', 'Frete', 'Custo total', 'Preço pretendido', 'Obs'],
    linhas));
}

export async function exportarVendas() {
  const dados = await listarVendas();
  const linhas = dados.map((v) => [
    dataBR(v.data), v.produto_nome ?? '', v.qtd, numeroBR(v.preco_unit),
    numeroBR(v.bruto), numeroBR(v.liquido_recebido), numeroBR(v.taxas_ml),
    numeroBR(v.custo_produto), numeroBR(v.lucro),
    v.margem === null ? '' : numeroBR(v.margem * 100), v.obs ?? '',
  ]);
  baixar('vendas.csv', montarCSV(
    ['Data', 'Produto', 'Qtd', 'Preço un.', 'Bruto', 'Líquido', 'Taxas ML', 'Custo produto', 'Lucro', 'Margem %', 'Obs'],
    linhas));
}

export async function exportarEstoque() {
  const dados = await listarEstoque();
  const linhas = dados.map((e) => [
    e.nome, e.comprado, e.vendido, e.disponivel,
    numeroBR(e.custo_medio), numeroBR(e.valor_estoque),
    dataBR(e.ultima_venda), e.dias_sem_vender ?? '',
  ]);
  baixar('estoque.csv', montarCSV(
    ['Produto', 'Comprado', 'Vendido', 'Disponível', 'Custo médio', 'Valor parado', 'Última venda', 'Dias sem vender'],
    linhas));
}

export async function exportarTriagens() {
  const dados = await listarTriagens();
  const linhas = dados.map((t) => [
    dataBR(t.data), t.produto_nome ?? '', t.catalogo === null ? '' : (t.catalogo ? 'Sim' : 'Não'),
    t.n_vendas ?? '', numeroBR(t.preco_buybox), numeroBR(t.custo),
    numeroBR(t.comissao_pct), numeroBR(t.tarifa_fixa), numeroBR(t.entrega),
    numeroBR(t.margem_min), t.veredito ?? '',
  ]);
  baixar('triagens.csv', montarCSV(
    ['Data', 'Produto', 'Catálogo', 'Nº vendas', 'Buy Box', 'Custo', 'Comissão %', 'Tarifa fixa', 'Entrega', 'Margem mín', 'Veredito'],
    linhas));
}

/** Exporta tudo (uma planilha por área). */
export async function exportarTudo() {
  await exportarCompras();
  await exportarVendas();
  await exportarEstoque();
  await exportarTriagens();
}
