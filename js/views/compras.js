// Tela de Compras: registrar, listar e excluir.
import { listarProdutos, criarProduto, listarCompras, criarCompra, excluirCompra } from '../lib/db.js';
import { lerNumero, formatBRL, formatNumero } from '../lib/format.js';
import { esc, dataBR, hojeISO, mensagem, confirmar } from '../lib/ui.js';

export async function render(container) {
  container.innerHTML = `
    <section class="tela">
      <h2>Compras</h2>
      <p class="subtitulo">Registre cada compra. O estoque é atualizado sozinho.</p>
      <div class="cartao" id="form-card">Carregando…</div>
      <div id="msg"></div>
      <h3 style="margin:20px 0 8px">Compras registradas</h3>
      <div id="lista">Carregando…</div>
    </section>
  `;

  try {
    const produtos = await listarProdutos();
    montarFormulario(container, produtos);
    await recarregarLista(container);
  } catch (err) {
    mensagem(container.querySelector('#msg'), err.message, 'erro');
  }
}

function montarFormulario(container, produtos) {
  const card = container.querySelector('#form-card');
  const opcoes = produtos.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
  card.innerHTML = `
    <form id="form-compra">
      <div class="campo">
        <label for="cp-produto">Produto</label>
        <select id="cp-produto" required>
          <option value="">Escolha…</option>
          ${opcoes}
          <option value="__novo__">➕ Novo produto</option>
        </select>
      </div>
      <div id="novo-produto" style="display:none">
        <div class="campo">
          <label for="cp-novo-nome">Nome do novo produto</label>
          <input id="cp-novo-nome" type="text" />
        </div>
        <div class="campo">
          <label><input type="checkbox" id="cp-novo-catalogo" checked /> É anúncio de catálogo</label>
        </div>
      </div>
      <div class="linha">
        <div class="campo"><label for="cp-data">Data</label>
          <input id="cp-data" type="date" value="${hojeISO()}" required /></div>
        <div class="campo"><label for="cp-marketplace">Onde comprou</label>
          <input id="cp-marketplace" type="text" placeholder="Ex.: Amazon" /></div>
      </div>
      <div class="linha">
        <div class="campo"><label for="cp-qtd">Quantidade</label>
          <input id="cp-qtd" inputmode="numeric" placeholder="10" required /></div>
        <div class="campo"><label for="cp-custo">Custo por unidade (R$)</label>
          <input id="cp-custo" inputmode="decimal" placeholder="23,79" required /></div>
      </div>
      <div class="linha">
        <div class="campo"><label for="cp-frete">Frete total (R$)</label>
          <input id="cp-frete" inputmode="decimal" placeholder="0" /></div>
        <div class="campo"><label for="cp-pretendido">Preço pretendido (R$)</label>
          <input id="cp-pretendido" inputmode="decimal" placeholder="49,90" /></div>
      </div>
      <div class="campo"><label for="cp-obs">Observação</label>
        <input id="cp-obs" type="text" /></div>
      <button class="botao" type="submit" id="cp-salvar">Registrar compra</button>
    </form>
  `;

  const sel = card.querySelector('#cp-produto');
  const novo = card.querySelector('#novo-produto');
  sel.addEventListener('change', () => {
    novo.style.display = sel.value === '__novo__' ? 'block' : 'none';
  });

  card.querySelector('#form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    await salvar(container);
  });

  aplicarPrefill(card, sel, novo, produtos);
}

/** Se veio da Triagem pelo botão "Comprar", já preenche o formulário. */
function aplicarPrefill(card, sel, novo, produtos) {
  let dados;
  try {
    const bruto = sessionStorage.getItem('prefill-compra');
    if (!bruto) return;
    sessionStorage.removeItem('prefill-compra');
    dados = JSON.parse(bruto);
  } catch { return; }
  if (!dados) return;

  const nome = (dados.produto_nome || '').trim();
  const existente = nome && produtos.find((p) => p.nome.toLowerCase() === nome.toLowerCase());

  if (existente) {
    sel.value = existente.id; // usa o produto que já existe
  } else {
    sel.value = '__novo__';
    novo.style.display = 'block';
    if (nome) card.querySelector('#cp-novo-nome').value = nome;
    card.querySelector('#cp-novo-catalogo').checked = dados.catalogo !== false;
  }

  if (Number.isFinite(dados.custo_unit)) {
    card.querySelector('#cp-custo').value = String(dados.custo_unit).replace('.', ',');
  }
}

async function salvar(container) {
  const msg = container.querySelector('#msg');
  const btn = container.querySelector('#cp-salvar');
  const g = (id) => container.querySelector(id);

  const qtd = Math.round(lerNumero(g('#cp-qtd').value));
  const custo = lerNumero(g('#cp-custo').value);
  if (!Number.isFinite(qtd) || qtd <= 0) return mensagem(msg, 'Informe uma quantidade válida.', 'erro');
  if (!Number.isFinite(custo) || custo < 0) return mensagem(msg, 'Informe um custo válido.', 'erro');

  btn.disabled = true;
  try {
    let produtoId = g('#cp-produto').value;
    if (produtoId === '__novo__') {
      const nome = g('#cp-novo-nome').value.trim();
      if (!nome) throw new Error('Digite o nome do novo produto.');
      const p = await criarProduto({ nome, catalogo: g('#cp-novo-catalogo').checked });
      produtoId = p.id;
    }
    if (!produtoId) throw new Error('Escolha um produto.');

    await criarCompra({
      data: g('#cp-data').value,
      produto_id: produtoId,
      marketplace_compra: g('#cp-marketplace').value,
      qtd,
      custo_unit: custo,
      frete: lerNumero(g('#cp-frete').value) || 0,
      preco_pretendido: g('#cp-pretendido').value ? lerNumero(g('#cp-pretendido').value) : null,
      obs: g('#cp-obs').value,
    });

    mensagem(msg, 'Compra registrada!', 'ok');
    await render(container); // recarrega tudo (form + lista + produtos)
  } catch (err) {
    mensagem(msg, err.message, 'erro');
    btn.disabled = false;
  }
}

async function recarregarLista(container) {
  const alvo = container.querySelector('#lista');
  const compras = await listarCompras();
  if (!compras.length) {
    alvo.innerHTML = `<div class="cartao"><p class="subtitulo" style="margin:0">Nenhuma compra registrada ainda.</p></div>`;
    return;
  }
  alvo.innerHTML = compras.map((c) => {
    const total = c.qtd * c.custo_unit + (c.frete || 0);
    return `
    <div class="cartao">
      <div style="display:flex; justify-content:space-between; gap:12px">
        <div>
          <strong>${esc(c.produtos?.nome ?? '—')}</strong><br>
          <span class="subtitulo">${dataBR(c.data)} · ${esc(c.marketplace_compra || '—')}</span>
        </div>
        <button class="botao secundario" data-excluir="${esc(c.id)}" style="height:40px; padding:0 12px">Excluir</button>
      </div>
      <div class="numeros mono" style="margin-top:10px">
        <span class="num"><span class="rotulo">Qtd</span><span class="valor">${c.qtd}</span></span>
        <span class="num"><span class="rotulo">Custo un.</span><span class="valor">${formatBRL(c.custo_unit)}</span></span>
        <span class="num"><span class="rotulo">Frete</span><span class="valor">${formatBRL(c.frete || 0)}</span></span>
        <span class="num"><span class="rotulo">Total</span><span class="valor">${formatBRL(total)}</span></span>
      </div>
    </div>`;
  }).join('');

  alvo.querySelectorAll('[data-excluir]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirmar('Excluir esta compra? Isso muda o estoque.')) return;
      try {
        await excluirCompra(b.dataset.excluir);
        await render(container);
      } catch (err) {
        mensagem(container.querySelector('#msg'), err.message, 'erro');
      }
    });
  });
}
