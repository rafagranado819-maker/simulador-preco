// Roteador por hash (#/simulador, #/compras, ...) com controle de login.
import { render as renderSimulador } from './views/simulador.js';
import { render as renderTriagem } from './views/triagem.js';
import { render as renderCompras } from './views/compras.js';
import { render as renderVendas } from './views/vendas.js';
import { render as renderEstoque } from './views/estoque.js';
import { render as renderLogin } from './views/login.js';
import { sessaoAtual, aoMudarAuth, sair } from './lib/auth.js';
import { esc } from './lib/ui.js';

const rotas = {
  simulador: { titulo: 'Simulador', icone: '🧮', publico: true, render: renderSimulador },
  triagem:   { titulo: 'Triagem',   icone: '🔎', publico: true, render: renderTriagem },
  compras:   { titulo: 'Compras',   icone: '🛒', render: renderCompras },
  vendas:    { titulo: 'Vendas',    icone: '💰', render: renderVendas },
  estoque:   { titulo: 'Estoque',   icone: '📦', render: renderEstoque },
  painel:    { titulo: 'Painel',    icone: '📊', futuro: 'Etapa 3' },
};

const app = document.getElementById('app');
const navbar = document.getElementById('navbar');
const conta = document.getElementById('conta');

let sessao = null;

function rotaAtual() {
  const hash = location.hash.replace(/^#\/?/, '');
  return rotas[hash] ? hash : 'simulador';
}

function montarNav(ativa) {
  navbar.innerHTML = Object.entries(rotas)
    .map(([chave, r]) => {
      const atual = chave === ativa ? 'aria-current="page"' : '';
      const futuro = r.futuro ? 'futuro' : '';
      return `<a href="#/${chave}" class="${futuro}" ${atual}>
        <span class="icone" aria-hidden="true">${r.icone}</span>${r.titulo}</a>`;
    })
    .join('');
}

function atualizarConta() {
  if (sessao?.user) {
    conta.innerHTML = `
      <span class="conta-email">${esc(sessao.user.email)}</span>
      <button class="botao secundario" id="btn-sair" style="height:38px; padding:0 12px">Sair</button>`;
    conta.querySelector('#btn-sair').addEventListener('click', async () => {
      await sair();
      location.hash = '#/simulador';
    });
  } else {
    conta.innerHTML = `<a class="botao secundario" href="#/compras" style="height:38px; padding:0 14px">Entrar</a>`;
  }
}

async function renderizar() {
  const chave = rotaAtual();
  const r = rotas[chave];
  montarNav(chave);
  atualizarConta();
  window.scrollTo(0, 0);

  if (r.futuro) {
    app.innerHTML = `
      <section class="tela">
        <h2>${r.icone} ${r.titulo}</h2>
        <div class="cartao">
          <p class="frase">Esta área chega na <strong>${r.futuro}</strong>.</p>
        </div>
      </section>`;
    return;
  }

  // Rotas protegidas exigem login.
  if (!r.publico && !sessao) {
    renderLogin(app, { area: r.titulo });
    return;
  }

  try {
    await r.render(app);
  } catch (err) {
    app.innerHTML = `<section class="tela"><div class="resposta vermelho">
      <p class="frase">Algo deu errado ao abrir esta tela.</p>
      <p class="subtitulo" style="margin:0">${esc(err.message || '')}</p></div></section>`;
  }
}

window.addEventListener('hashchange', renderizar);

async function iniciar() {
  sessao = await sessaoAtual();
  aoMudarAuth((s) => {
    sessao = s;
    renderizar();
  });
  if (!location.hash) location.replace('#/simulador');
  renderizar();
}

iniciar();
