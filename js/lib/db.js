// Acesso ao banco (Supabase). Todas as leituras/escritas passam por aqui.
import { supabase } from './supabase-client.js';

function checar(error) {
  if (error) throw new Error(traduzErro(error));
}

/** Deixa a mensagem de erro mais amigável em português. */
function traduzErro(error) {
  const msg = error.message || String(error);
  if (/Estoque insuficiente/i.test(msg)) return msg; // já vem em pt-BR do trigger
  if (/duplicate key|already exists|unique/i.test(msg)) return 'Esse registro já existe.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (/JWT|not authenticated|permission denied|row-level security/i.test(msg)) return 'Sua sessão expirou. Entre novamente.';
  return 'Não foi possível concluir. ' + msg;
}

// --- Produtos ---------------------------------------------------------------

export async function listarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, link, catalogo')
    .order('nome');
  checar(error);
  return data;
}

export async function criarProduto({ nome, link = null, catalogo = true }) {
  const { data, error } = await supabase
    .from('produtos')
    .insert({ nome: nome.trim(), link, catalogo })
    .select()
    .single();
  checar(error);
  return data;
}

// --- Compras ----------------------------------------------------------------

export async function listarCompras() {
  const { data, error } = await supabase
    .from('compras')
    .select('id, data, qtd, custo_unit, frete, preco_pretendido, marketplace_compra, obs, produtos(nome)')
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false });
  checar(error);
  return data;
}

export async function criarCompra(c) {
  const { error } = await supabase.from('compras').insert({
    data: c.data,
    produto_id: c.produto_id,
    marketplace_compra: c.marketplace_compra || null,
    qtd: c.qtd,
    custo_unit: c.custo_unit,
    frete: c.frete || 0,
    preco_pretendido: c.preco_pretendido ?? null,
    obs: c.obs || null,
  });
  checar(error);
}

export async function excluirCompra(id) {
  const { error } = await supabase.from('compras').delete().eq('id', id);
  checar(error);
}

// --- Vendas -----------------------------------------------------------------

/** Lista de vendas já com taxas do ML, custo, lucro e margem (view). */
export async function listarVendas() {
  const { data, error } = await supabase
    .from('vendas_detalhe')
    .select('*')
    .order('data', { ascending: false });
  checar(error);
  return data;
}

export async function criarVenda(v) {
  const { error } = await supabase.from('vendas').insert({
    data: v.data,
    produto_id: v.produto_id,
    qtd: v.qtd,
    preco_unit: v.preco_unit,
    liquido_recebido: v.liquido_recebido,
    obs: v.obs || null,
  });
  checar(error);
}

export async function excluirVenda(id) {
  const { error } = await supabase.from('vendas').delete().eq('id', id);
  checar(error);
}

// --- Estoque (view, somente leitura) ---------------------------------------

export async function listarEstoque() {
  const { data, error } = await supabase
    .from('estoque')
    .select('*')
    .order('nome');
  checar(error);
  return data;
}

/** Só os produtos com saldo disponível (para a tela de vendas). */
export async function produtosComEstoque() {
  const est = await listarEstoque();
  return est.filter((e) => e.disponivel > 0);
}

// --- Configurações ----------------------------------------------------------

export async function lerConfiguracoes() {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('id', 1)
    .single();
  checar(error);
  return data;
}

// --- Triagens ---------------------------------------------------------------

export async function salvarTriagem(t) {
  const { error } = await supabase.from('triagens').insert({
    produto_id: t.produto_id ?? null,
    produto_nome: t.produto_nome ?? null,
    catalogo: t.catalogo ?? null,
    n_vendas: t.n_vendas ?? null,
    preco_buybox: t.preco_buybox ?? null,
    custo: t.custo ?? null,
    comissao_pct: t.comissao_pct ?? null,
    tarifa_fixa: t.tarifa_fixa ?? null,
    entrega: t.entrega ?? null,
    margem_min: t.margem_min ?? null,
    veredito: t.veredito ?? null,
  });
  checar(error);
}

export async function listarTriagens() {
  const { data, error } = await supabase
    .from('triagens')
    .select('*')
    .order('data', { ascending: false });
  checar(error);
  return data;
}
