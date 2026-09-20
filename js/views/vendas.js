// Tela de Vendas: registrar (com cálculo em tempo real), listar e excluir.
import { produtosComEstoque, listarVendas, criarVenda, excluirVenda } from '../lib/db.js';
import { lerNumero, formatBRL, formatPct } from '../lib/format.js';
import { esc, dataBR, hojeISO, mensagem, confirmar } from '../lib/ui.js';

let comEstoque = []; // [{produto_id, nome, disponivel, custo_medio}]

export async function render(container) {
  container.innerHTML = `
    <section class="tela">
      <h2>Vendas</h2>
      <p class="subtitulo">Registre a venda e veja na hora o lucro real, depois das taxas do ML.</p>
      <div class="cartao" id="form-card">Carregando…</div>
      <div id="msg"></div>
      <h3 style="margin:20px 0 8px">Vendas registradas</h3>
      <div id="lista">Carregando…</div>
    </section>
  `;

  try {
    comEstoque = await produtosComEstoque();
    montarFormulario(container);
    await recarregarLista(container);
  } catch (err) {
    mensagem(container.querySelector('#msg'), err.message, 'erro');
  }
}

function montarFormulario(container) {
  const card = container.querySelector('#form-card');

  if (!comEstoque.length) {
    card.innerHTML = `<p class="subtitulo" style="margin:0">Nenhum produto com estoque disponível.
      Registre uma compra antes de vender.</p>`;
    return;
  }

  const opcoes = comEstoque.map((e) =>
    `<option value="${esc(e.produto_id)}">${esc(e.nome)} (restam ${e.disponivel})</option>`).join('');

  card.innerHTML = `
    <form id="form-venda">
      <div class="campo">
        <label for="vd-produto">Produto (só os que têm estoque)</label>
        <select id="vd-produto" required>
          <option value="">Escolha…</option>
          ${opcoes}
        </select>
      </div>
      <div class="linha">
        <div class="campo"><label for="vd-data">Data</label>
          <input id="vd-data" type="date" value="${hojeISO()}" required /></div>
        <div class="campo"><label for="vd-qtd">Quantidade</label>
          <input id="vd-qtd" inputmode="numeric" placeholder="1" required /></div>
      </div>
      <div class="linha">
        <div class="campo"><label for="vd-preco">Preço de venda por unidade (R$)</label>
          <input id="vd-preco" inputmode="decimal" placeholder="24,99" required /></div>
        <div class="campo"><label for="vd-liquido">Quanto caiu para mim — líquido total (R$)</label>
          <input id="vd-liquido" inputmode="decimal" placeholder="73,71" required /></div>
      </div>
      <div class="campo"><label for="vd-obs">Observação</label>
        <input id="vd-obs" type="text" /></div>

      <div id="vd-preview" style="margin:8px 0 14px"></div>

      <button class="botao" type="submit" id="vd-salvar">Registrar venda</button>
    </form>
  `;

  const g = (id) => card.querySelector(id);
  ['#vd-produto', '#vd-qtd', '#vd-preco', '#vd-liquido'].forEach((id) =>
    g(id).addEventListener('input', () => atualizarPreview(container)));

  card.querySelector('#form-venda').addEventListener('submit', async (e) => {
    e.preventDefault();
    await salvar(container);
  });
}

function dadosSelecionados(container) {
  const id = container.querySelector('#vd-produto')?.value;
  const prod = comEstoque.find((e) => e.produto_id === id) || null;
  const qtd = Math.round(lerNumero(container.querySelector('#vd-qtd')?.value));
  const preco = lerNumero(container.querySelector('#vd-preco')?.value);
  const liquido = lerNumero(container.querySelector('#vd-liquido')?.value);
  return { prod, qtd, preco, liquido };
}

function atualizarPreview(container) {
  const alvo = container.querySelector('#vd-preview');
  const { prod, qtd, preco, liquido } = dadosSelecionados(container);
  if (!prod || !Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(preco) || !Number.isFinite(liquido)) {
    alvo.innerHTML = '';
    return;
  }

  const bruto = qtd * preco;
  const taxas = bruto - liquido;
  const taxaEfetiva = bruto > 0 ? taxas / bruto : 0;
  const custoProduto = qtd * prod.custo_medio;
  const lucro = liquido - custoProduto;
  const margem = custoProduto > 0 ? liquido / custoProduto - 1 : null;

  const cor = lucro < 0 ? 'vermelho' : (margem !== null && margem < 0.2 ? 'amarelo' : 'verde');
  const excedeEstoque = qtd > prod.disponivel;

  alvo.innerHTML = `
    <div class="resposta ${excedeEstoque ? 'vermelho' : cor}">
      ${excedeEstoque ? `<p class="frase">Só restam ${prod.disponivel} em estoque — não dá para vender ${qtd}.</p>` : ''}
      ${lucro < 0 && !excedeEstoque ? `<p class="frase">Essa venda deu prejuízo.</p>` : ''}
      <div class="numeros mono">
        <span class="num"><span class="rotulo">Taxas do ML</span><span class="valor">${formatBRL(taxas)} (${formatPct(taxaEfetiva)})</span></span>
        <span class="num"><span class="rotulo">Custo do produto</span><span class="valor">${formatBRL(custoProduto)}</span></span>
        <span class="num"><span class="rotulo">Lucro</span><span class="valor">${formatBRL(lucro)}</span></span>
        <span class="num"><span class="rotulo">Margem</span><span class="valor">${formatPct(margem)}</span></span>
      </div>
    </div>`;
}

async function salvar(container) {
  const msg = container.querySelector('#msg');
  const btn = container.querySelector('#vd-salvar');
  const { prod, qtd, preco, liquido } = dadosSelecionados(container);

  if (!prod) return mensagem(msg, 'Escolha um produto.', 'erro');
  if (!Number.isFinite(qtd) || qtd <= 0) return mensagem(msg, 'Informe uma quantidade válida.', 'erro');
  if (qtd > prod.disponivel) return mensagem(msg, `Só restam ${prod.disponivel} em estoque.`, 'erro');
  if (!Number.isFinite(preco) || preco < 0) return mensagem(msg, 'Informe o preço de venda.', 'erro');
  if (!Number.isFinite(liquido) || liquido < 0) return mensagem(msg, 'Informe o líquido que caiu para você.', 'erro');

  btn.disabled = true;
  try {
    await criarVenda({
      data: container.querySelector('#vd-data').value,
      produto_id: prod.produto_id,
      qtd,
      preco_unit: preco,
      liquido_recebido: liquido,
      obs: container.querySelector('#vd-obs').value,
    });
    mensagem(msg, 'Venda registrada!', 'ok');
    await render(container);
  } catch (err) {
    mensagem(msg, err.message, 'erro');
    btn.disabled = false;
  }
}

async function recarregarLista(container) {
  const alvo = container.querySelector('#lista');
  const vendas = await listarVendas();
  if (!vendas.length) {
    alvo.innerHTML = `<div class="cartao"><p class="subtitulo" style="margin:0">Nenhuma venda registrada ainda.</p></div>`;
    return;
  }
  alvo.innerHTML = vendas.map((v) => {
    const cor = v.lucro < 0 ? 'vermelho' : 'verde';
    return `
    <div class="cartao">
      <div style="display:flex; justify-content:space-between; gap:12px">
        <div>
          <strong>${esc(v.produto_nome ?? '—')}</strong><br>
          <span class="subtitulo">${dataBR(v.data)} · ${v.qtd} un. a ${formatBRL(v.preco_unit)}</span>
        </div>
        <button class="botao secundario" data-excluir="${esc(v.id)}" style="height:40px; padding:0 12px">Excluir</button>
      </div>
      <div class="numeros mono" style="margin-top:10px">
        <span class="num"><span class="rotulo">Líquido</span><span class="valor">${formatBRL(v.liquido_recebido)}</span></span>
        <span class="num"><span class="rotulo">Taxas ML</span><span class="valor">${formatBRL(v.taxas_ml)}</span></span>
        <span class="num"><span class="rotulo">Lucro</span><span class="valor" style="color:var(--${cor})">${formatBRL(v.lucro)}</span></span>
        <span class="num"><span class="rotulo">Margem</span><span class="valor">${formatPct(v.margem)}</span></span>
      </div>
    </div>`;
  }).join('');

  alvo.querySelectorAll('[data-excluir]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirmar('Excluir esta venda? Isso devolve as unidades ao estoque.')) return;
      try {
        await excluirVenda(b.dataset.excluir);
        await render(container);
      } catch (err) {
        mensagem(container.querySelector('#msg'), err.message, 'erro');
      }
    });
  });
}
