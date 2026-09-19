// Gráfico de lucro × preço em SVG puro, com faixas vermelha/amarela/verde
// e um ponto arrastável (mouse, toque e teclado). Sem dependências.

const NS = 'http://www.w3.org/2000/svg';
const W = 360;
const H = 240;
const PAD = { top: 14, right: 12, bottom: 26, left: 12 };

function el(nome, attrs = {}) {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/**
 * Cria o gráfico dentro de `container`.
 * @param {HTMLElement} container
 * @param {(preco:number)=>void} onPrecoChange chamado quando o usuário arrasta.
 * @returns {{ atualizar: (params:object)=>void }}
 */
export function criarGrafico(container, onPrecoChange) {
  const svg = el('svg', {
    class: 'grafico',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': 'Gráfico de lucro por preço de venda',
  });

  const gBandas = el('g');
  const linhaZero = el('line', { stroke: 'var(--texto-fraco)', 'stroke-width': 1, 'stroke-dasharray': '4 4' });
  const curva = el('path', { fill: 'none', stroke: 'var(--texto)', 'stroke-width': 2.5 });
  const eixoX = el('g');

  // Ponto arrastável (com alça focável para teclado).
  const guia = el('line', { stroke: 'var(--azul)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
  const ponto = el('circle', {
    r: 9,
    fill: 'var(--azul)',
    stroke: '#fff',
    'stroke-width': 2,
    tabindex: '0',
    role: 'slider',
    'aria-label': 'Preço de venda (arraste ou use as setas)',
    style: 'cursor: grab;',
  });

  svg.append(gBandas, linhaZero, curva, eixoX, guia, ponto);
  container.innerHTML = '';
  container.appendChild(svg);

  // Legenda
  const legenda = document.createElement('div');
  legenda.className = 'grafico-legenda';
  legenda.innerHTML = `
    <span class="item"><span class="cor" style="background:var(--vermelho)"></span> Prejuízo</span>
    <span class="item"><span class="cor" style="background:var(--amarelo)"></span> Lucra, mas abaixo da folga</span>
    <span class="item"><span class="cor" style="background:var(--verde)"></span> Folga garantida</span>`;
  container.appendChild(legenda);

  // Estado atual do gráfico (guardado para o arrasto).
  let estado = null;

  const px = { min: PAD.left, max: W - PAD.right };
  const py = { min: H - PAD.bottom, max: PAD.top };

  function xParaPreco(clientX) {
    const rect = svg.getBoundingClientRect();
    const xv = ((clientX - rect.left) / rect.width) * W; // coord viewBox
    const t = (xv - px.min) / (px.max - px.min);
    return estado.xMin + t * (estado.xMax - estado.xMin);
  }

  function precoParaX(p) {
    const t = (p - estado.xMin) / (estado.xMax - estado.xMin);
    return px.min + t * (px.max - px.min);
  }
  function lucroParaY(l) {
    const t = (l - estado.yMin) / (estado.yMax - estado.yMin);
    return py.min + t * (py.max - py.min);
  }

  function bandaRect(p0, p1, cor) {
    const x0 = Math.max(px.min, precoParaX(p0));
    const x1 = Math.min(px.max, precoParaX(p1));
    if (x1 <= x0) return null;
    return el('rect', {
      x: x0, y: py.max, width: x1 - x0, height: py.min - py.max, fill: cor, opacity: '0.16',
    });
  }

  /**
   * @param {object} p
   * @param {number} p.preco       preço atual (posição do ponto)
   * @param {number} p.equilibrio
   * @param {number} p.minimo
   * @param {number} p.lucroAtual
   * @param {(preco:number)=>number} p.fnLucro função lucro(preco)
   * @param {number} p.passo        passo do teclado (setas)
   */
  function atualizar(p) {
    const { equilibrio, minimo, fnLucro } = p;

    // Faixa de preços do eixo X.
    const ref = Number.isFinite(minimo) && minimo > 0 ? minimo : (p.preco || 1);
    let xMin = 0;
    let xMax = ref * 1.6;
    if (p.preco > xMax) xMax = p.preco * 1.1;
    if (xMax <= xMin) xMax = xMin + 1;

    // Amostra o lucro para achar a escala vertical.
    const N = 60;
    const pts = [];
    let yMin = 0;
    let yMax = 0;
    for (let i = 0; i <= N; i++) {
      const preco = xMin + (i / N) * (xMax - xMin);
      let l;
      try { l = fnLucro(preco); } catch { l = 0; }
      pts.push([preco, l]);
      if (l < yMin) yMin = l;
      if (l > yMax) yMax = l;
    }
    if (yMax === yMin) { yMax = yMin + 1; }
    // Folga visual.
    const folgaY = (yMax - yMin) * 0.1;
    yMin -= folgaY; yMax += folgaY;

    estado = { xMin, xMax, yMin, yMax, fnLucro, minimo, equilibrio, passo: p.passo || 0.5 };

    // Faixas coloridas (por preço).
    gBandas.innerHTML = '';
    const rVerm = bandaRect(xMin, Math.max(xMin, equilibrio), 'var(--vermelho)');
    const rAmar = bandaRect(Math.max(xMin, equilibrio), Math.max(xMin, minimo), 'var(--amarelo)');
    const rVerd = bandaRect(Math.max(xMin, minimo), xMax, 'var(--verde)');
    for (const r of [rVerm, rAmar, rVerd]) if (r) gBandas.appendChild(r);

    // Linha de lucro zero.
    const yZero = lucroParaY(0);
    linhaZero.setAttribute('x1', px.min);
    linhaZero.setAttribute('x2', px.max);
    linhaZero.setAttribute('y1', yZero);
    linhaZero.setAttribute('y2', yZero);

    // Curva de lucro.
    const d = pts.map(([preco, l], i) =>
      `${i === 0 ? 'M' : 'L'} ${precoParaX(preco).toFixed(1)} ${lucroParaY(l).toFixed(1)}`
    ).join(' ');
    curva.setAttribute('d', d);

    // Rótulos do eixo X (equilíbrio e mínimo), em duas alturas para não colidir.
    eixoX.innerHTML = '';
    const marca = (preco, texto, linha) => {
      if (!Number.isFinite(preco) || preco < xMin || preco > xMax) return;
      const x = precoParaX(preco);
      const tick = el('line', {
        x1: x, x2: x, y1: py.min, y2: py.min + 4,
        stroke: 'var(--texto-fraco)', 'stroke-width': 1,
      });
      const t = el('text', {
        x, y: linha === 0 ? H - 14 : H - 3,
        'text-anchor': 'middle', 'font-size': 10, fill: 'var(--texto-fraco)',
      });
      t.textContent = texto;
      eixoX.append(tick, t);
    };
    marca(equilibrio, 'equilíbrio', 0);
    marca(minimo, 'mínimo', 1);

    // Ponto.
    posicionarPonto(p.preco);
  }

  function posicionarPonto(preco) {
    const precoClamp = Math.min(estado.xMax, Math.max(estado.xMin, preco));
    let l;
    try { l = estado.fnLucro(precoClamp); } catch { l = 0; }
    const x = precoParaX(precoClamp);
    const y = lucroParaY(l);
    ponto.setAttribute('cx', x);
    ponto.setAttribute('cy', y);
    ponto.setAttribute('aria-valuenow', precoClamp.toFixed(2));
    ponto.setAttribute('aria-valuemin', estado.xMin.toFixed(2));
    ponto.setAttribute('aria-valuemax', estado.xMax.toFixed(2));
    guia.setAttribute('x1', x); guia.setAttribute('x2', x);
    guia.setAttribute('y1', py.max); guia.setAttribute('y2', py.min);
  }

  // --- Arrasto (mouse + toque via Pointer Events) ---
  let arrastando = false;
  function iniciar(e) {
    arrastando = true;
    ponto.style.cursor = 'grabbing';
    if (svg.setPointerCapture && e.pointerId !== undefined) {
      try { svg.setPointerCapture(e.pointerId); } catch {}
    }
    mover(e);
  }
  function mover(e) {
    if (!arrastando || !estado) return;
    const preco = xParaPreco(e.clientX);
    const clamp = Math.min(estado.xMax, Math.max(estado.xMin, preco));
    onPrecoChange(clamp);
  }
  function terminar() { arrastando = false; ponto.style.cursor = 'grab'; }

  svg.addEventListener('pointerdown', iniciar);
  svg.addEventListener('pointermove', mover);
  svg.addEventListener('pointerup', terminar);
  svg.addEventListener('pointercancel', terminar);

  // --- Teclado ---
  ponto.addEventListener('keydown', (e) => {
    if (!estado) return;
    const atual = parseFloat(ponto.getAttribute('aria-valuenow'));
    let novo = atual;
    const passo = estado.passo;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') novo = atual - passo;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') novo = atual + passo;
    else if (e.key === 'PageDown') novo = atual - passo * 10;
    else if (e.key === 'PageUp') novo = atual + passo * 10;
    else if (e.key === 'Home') novo = estado.xMin;
    else if (e.key === 'End') novo = estado.xMax;
    else return;
    e.preventDefault();
    novo = Math.min(estado.xMax, Math.max(estado.xMin, novo));
    onPrecoChange(novo);
  });

  return { atualizar };
}
