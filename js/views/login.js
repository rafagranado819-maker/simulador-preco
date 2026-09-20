// Tela de login por link mágico.
import { enviarLinkMagico } from '../lib/auth.js';
import { mensagem, esc } from '../lib/ui.js';

export function render(container, { area = 'esta área' } = {}) {
  container.innerHTML = `
    <section class="tela">
      <h2>Entrar</h2>
      <p class="subtitulo">Para acessar ${esc(area)}, entre com seu e-mail. Só quem foi convidado consegue entrar.</p>

      <div class="cartao">
        <form id="form-login">
          <div class="campo">
            <label for="login-email">Seu e-mail</label>
            <input id="login-email" type="email" inputmode="email" autocomplete="email"
                   placeholder="voce@exemplo.com" required />
          </div>
          <button class="botao" type="submit" id="btn-entrar">Enviar link de acesso</button>
        </form>
        <div id="login-msg" style="margin-top:12px"></div>
      </div>

      <p class="aviso-etapa">Você vai receber um e-mail com um link. Clique nele e volta para cá já logado —
      sem senha para lembrar. No mesmo aparelho, você continua logado depois disso.</p>
    </section>
  `;

  const form = container.querySelector('#form-login');
  const msg = container.querySelector('#login-msg');
  const btn = container.querySelector('#btn-entrar');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#login-email').value.trim();
    if (!email) return;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    mensagem(msg, 'Enviando o link para o seu e-mail…', 'info');
    try {
      await enviarLinkMagico(email);
      mensagem(msg, `Pronto! Enviamos um link para ${email}. Abra seu e-mail e clique no link para entrar. Pode fechar esta aba.`, 'ok');
    } catch (err) {
      mensagem(msg, 'Não foi possível enviar o link. ' + (err.message || ''), 'erro');
      btn.disabled = false;
      btn.textContent = 'Enviar link de acesso';
    }
  });
}
