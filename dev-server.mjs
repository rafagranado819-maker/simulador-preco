// Servidor estático mínimo, só para desenvolvimento local.
// Não faz parte do site publicado (GitHub Pages serve os arquivos direto).
//   node dev-server.mjs   ->  http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORTA = process.argv[2] || process.env.PORT || 4321;
const RAIZ = process.cwd();

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho === '/' || caminho === '') caminho = '/index.html';
    const arquivo = normalize(join(RAIZ, caminho));
    if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end('403'); return; }
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1>');
  }
}).listen(PORTA, () => console.log(`Dev server em http://localhost:${PORTA}`));
