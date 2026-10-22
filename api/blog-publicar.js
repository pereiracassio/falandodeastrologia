/* Gera as páginas do blog: uma página própria por postagem publicada (blog/<endereço>.html), mais o sitemap.xml,
   e grava tudo no GitHub (um único commit na main) — o GitHub Pages publica sozinho em seguida.

   Quem chama: o painel (admin-blog.html) depois de salvar uma postagem, com o login do administrador.
   Variável na Vercel: GITHUB_TOKEN (token do GitHub só com permissão "Contents: Read and write" neste repositório),
   além da SUPABASE_SERVICE_ROLE_KEY que o resto do servidor já usa. Sem dependências (só fetch). */

const { SUPABASE_URL, SUPABASE_ANON, env, supa } = require('./_drive');
const { paginaPost, paginaAssunto, agruparAssuntos, sitemap, SITE } = require('./_blog');

const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const REPO = 'pereiracassio/falandodeastrologia';
const RAMO = 'main';

async function souAdmin(jwt) {
  if (!jwt) return false;
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', {
    method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: '{}'
  });
  return resp.ok && (await resp.json()) === true;
}

async function gh(caminho, opcoes = {}) {
  const resp = await fetch('https://api.github.com/repos/' + REPO + caminho, {
    ...opcoes,
    headers: { Authorization: 'Bearer ' + env('GITHUB_TOKEN'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'falandodeastrologia-blog', 'Content-Type': 'application/json' }
  });
  const texto = await resp.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new Error('GitHub: ' + ((dados && dados.message) || resp.status));
  return dados;
}

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'use POST' }); return; }
  try {
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await souAdmin(jwt))) { res.status(401).json({ erro: 'só o administrador' }); return; }

    const posts = (await supa('/rest/v1/blog_posts?publicado=eq.true&select=*&order=publicado_em.desc'))
      .filter((p) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug));
    const assuntos = agruparAssuntos(posts);
    const arquivos = { 'sitemap.xml': sitemap(posts, assuntos) };
    posts.forEach((p) => { arquivos['blog/' + p.slug + '.html'] = paginaPost(p, posts); });
    assuntos.forEach((a) => { arquivos['assunto/' + a.slug + '.html'] = paginaAssunto(a); });

    const ref = await gh('/git/ref/heads/' + RAMO);
    const commitBase = await gh('/git/commits/' + ref.object.sha);
    const arvoreBase = await gh('/git/trees/' + commitBase.tree.sha + '?recursive=1');
    const existentes = arvoreBase.tree.filter((i) => i.type === 'blob');
    const entradas = Object.keys(arquivos).map((c) => ({ path: c, mode: '100644', type: 'blob', content: arquivos[c] }));
    if (!existentes.some((i) => i.path === 'robots.txt')) entradas.push({ path: 'robots.txt', mode: '100644', type: 'blob', content: 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n' });
    // postagem despublicada/excluída ou assunto sem postagens: a página própria sai
    existentes.filter((i) => /^(blog|assunto)\/[^/]+\.html$/.test(i.path) && !arquivos[i.path]).forEach((i) => entradas.push({ path: i.path, mode: '100644', type: 'blob', sha: null }));

    const arvore = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: entradas }) });
    if (arvore.sha === commitBase.tree.sha) { res.status(200).json({ ok: true, mudou: false, paginas: posts.length }); return; }
    const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'Blog: atualiza as páginas das postagens', tree: arvore.sha, parents: [ref.object.sha] }) });
    await gh('/git/refs/heads/' + RAMO, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    res.status(200).json({ ok: true, mudou: true, paginas: posts.length });
  } catch (e) {
    res.status(500).json({ erro: 'não foi possível gerar as páginas', detalhe: String(e.message || e) });
  }
};
