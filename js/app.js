// Roteador simples por hash (#/simulador, #/triagem, ...).
import { render as renderSimulador } from './views/simulador.js';
import { render as renderTriagem } from './views/triagem.js';

const rotas = {
  simulador: { titulo: 'Simulador', icone: '🧮', render: renderSimulador },
  triagem: { titulo: 'Triagem', icone: '🔎', render: renderTriagem },
  // Próximas etapas (ainda não disponíveis):
  compras: { titulo: 'Compras', icone: '🛒', futuro: 'Etapa 2' },
  vendas: { titulo: 'Vendas', icone: '💰', futuro: 'Etapa 2' },
  estoque: { titulo: 'Estoque', icone: '📦', futuro: 'Etapa 2' },
  painel: { titulo: 'Painel', icone: '📊', futuro: 'Etapa 3' },
};

const app = document.getElementById('app');
const navbar = document.getElementById('navbar');

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

function renderizar() {
  const chave = rotaAtual();
  const r = rotas[chave];
  montarNav(chave);

  if (r.futuro) {
    app.innerHTML = `
      <section class="tela">
        <h2>${r.icone} ${r.titulo}</h2>
        <div class="cartao">
          <p class="frase">Esta área chega na <strong>${r.futuro}</strong>.</p>
          <p class="subtitulo" style="margin:0">Por enquanto, use o Simulador e a Triagem.</p>
        </div>
      </section>`;
    window.scrollTo(0, 0);
    return;
  }

  r.render(app);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderizar);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) location.replace('#/simulador');
  renderizar();
});
