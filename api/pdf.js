/* PDF do Drive do administrador para o aluno e o cliente lerem no leitor do site.

   O aluno/cliente não tem acesso ao Drive do administrador pelo site, então o servidor confere o login (token do Supabase), confere que o arquivo
   está numa lista que ELE enxerga (itens do aluno ou entregas do cliente; a regra de acesso do Supabase faz o filtro) e entrega o PDF usando a
   conexão permanente do Drive. Só entrega arquivo PDF.
   GET ?id=ARQUIVO            -> o PDF (em pedaços, sem limite de tamanho da resposta)
   GET ?acao=tipos&ids=a,b,c  -> { pdfs: [ids que são PDF e são dele] }
   Variáveis na Vercel: as mesmas do Drive. Sem dependências. */

const { Readable } = require('stream');
const { SUPABASE_URL, SUPABASE_ANON, lerConexao, tokenDeAcesso } = require('./_drive');
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const ID_OK = /^[\w-]{10,}$/;

const doSupabase = async (jwt, caminho) => {
  const resp = await fetch(SUPABASE_URL + caminho, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt } });
  return resp.ok ? resp.json() : [];
};
async function usuarioValido(jwt) {
  if (!jwt) return false;
  const resp = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt } });
  return resp.ok;
}
/* o arquivo está num item do aluno ou numa entrega do cliente que este login enxerga? */
async function ehDele(jwt, id) {
  const [a, b] = await Promise.all([
    doSupabase(jwt, '/rest/v1/itens?select=id&limit=1&link=like.' + encodeURIComponent('*' + id + '*')),
    doSupabase(jwt, '/rest/v1/entregas?select=id&limit=1&pdf_link=like.' + encodeURIComponent('*' + id + '*'))
  ]);
  return a.length > 0 || b.length > 0;
}
const ehPdfCache = new Map();
async function ehPdf(token, id) {
  if (ehPdfCache.has(id)) return ehPdfCache.get(id);
  const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=mimeType&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
  const pdf = resp.ok && (await resp.json()).mimeType === 'application/pdf';
  if (resp.ok) ehPdfCache.set(id, pdf);
  return pdf;
}

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await usuarioValido(jwt))) { res.status(401).json({ erro: 'sem login' }); return; }
    const q = new URL(req.url, 'http://x').searchParams;
    const conexao = await lerConexao();
    if (!conexao) { res.status(503).json({ erro: 'desconectado' }); return; }
    const token = (await tokenDeAcesso(conexao)).valor;

    if (q.get('acao') === 'tipos') {
      const ids = [...new Set(String(q.get('ids') || '').split(',').filter((x) => ID_OK.test(x)))].slice(0, 60);
      const ok = await Promise.all(ids.map(async (id) => (await ehDele(jwt, id)) && (await ehPdf(token, id))));
      res.status(200).json({ pdfs: ids.filter((_, i) => ok[i]) });
      return;
    }

    const id = q.get('id') || '';
    if (!ID_OK.test(id) || !(await ehDele(jwt, id))) { res.status(403).json({ erro: 'sem acesso' }); return; }
    if (!(await ehPdf(token, id))) { res.status(415).json({ erro: 'não é PDF' }); return; }
    const arq = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
    if (!arq.ok || !arq.body) { res.status(arq.status === 404 ? 404 : 502).json({ erro: 'drive' }); return; }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    const tam = arq.headers.get('content-length');
    if (tam) res.setHeader('Content-Length', tam);
    Readable.fromWeb(arq.body).pipe(res);
  } catch (e) {
    console.error('pdf:', e.message);
    if (!res.headersSent) res.status(500).json({ erro: 'falha' });
  }
};
