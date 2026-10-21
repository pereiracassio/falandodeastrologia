/* Páginas do blog: transforma uma postagem do Supabase numa página HTML pronta (uma por postagem) e monta o sitemap.
   Usado por api/blog-publicar.js. O "_" no começo do nome faz a Vercel NÃO tratar este arquivo como um endpoint. */

const SITE = 'https://falandodeastrologia.com.br';
const PAGINAS_FIXAS = ['', 'sobre.html', 'mentoria.html', 'retificacao.html', 'mapa-natal.html', 'revolucao-solar.html', 'previsoes-astrologicas.html', 'sinastria.html', 'blog.html'];

const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()] + ' de ' + d.getUTCFullYear(); };

/* mesmas regras do blog.js do navegador: parágrafos separados por linha em branco, "## " no começo da linha = subtítulo */
function corpoHtml(corpo) {
  const saida = [];
  String(corpo || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).forEach((bloco) => {
    bloco = bloco.trim();
    if (!bloco) return;
    let paragrafo = [];
    const fechar = () => { if (paragrafo.length) { saida.push('<p class="blog-p">' + paragrafo.map(esc).join('<br>') + '</p>'); paragrafo = []; } };
    bloco.split('\n').forEach((l) => {
      const m = /^##\s+(.+)$/.exec(l.trim());
      if (m) { fechar(); saida.push('<h2 class="blog-h2">' + esc(m[1]) + '</h2>'); }
      else if (l.trim()) paragrafo.push(l.trim());
    });
    fechar();
  });
  return saida.join('\n');
}

function resumoDe(p) {
  if (p.resumo) return p.resumo;
  const t = String(p.corpo || '').replace(/^##\s+/gm, '').replace(/\s+/g, ' ').trim();
  return t.length > 155 ? t.slice(0, 155).replace(/\s+\S*$/, '') + '…' : t;
}

/* id do vídeo a partir do link do YouTube (watch?v=, youtu.be/, shorts/, embed/); null se não for um link do YouTube */
function idYoutube(url) {
  try {
    const u = new URL(String(url || '').trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = /^\/(shorts|embed|live)\/([^/]+)/.exec(u.pathname); if (m) id = m[2]; }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch (e) { return null; }
}

function videoHtml(url) {
  const id = idYoutube(url);
  if (!id) return '';
  return '<div class="blog-video"><iframe src="https://www.youtube.com/embed/' + id + '" title="Vídeo no YouTube" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>\n' +
    '<p class="blog-p" style="text-align:center"><a class="blog-voltar" style="margin:0" href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener">Assistir no YouTube</a></p>';
}

/* fim de cada postagem: Instagram, TikTok e os caminhos para os serviços e a mentoria (mesmos ícones e endereços da home) */
const FIM_HTML = `  <div class="blog-fim">
    <div class="social-bar">
      <a href="https://www.instagram.com/cassiopereira___?igsh=MWU5YjVtNWpjYzduZQ%3D%3D&amp;utm_source=qr" target="_blank" rel="noopener" title="Instagram"><img alt="Instagram" src="/img/rede-instagram.svg" width="44" height="44"></a>
      <a href="https://www.tiktok.com/@cassiopereira__?_r=1&amp;_t=ZS-98YFBywW5Za" target="_blank" rel="noopener" title="TikTok"><img alt="TikTok" src="/img/rede-tiktok.svg" width="44" height="44"></a>
    </div>
    <div class="blog-botoes"><a class="blog-botao" href="/index.html#servicos">Serviços</a><a class="blog-botao" href="/mentoria.html">Mentoria</a></div>
  </div>`;

const enderecoPost = (slug) => SITE + '/blog/' + slug + '.html';
const enderecoAssunto = (slug) => SITE + '/assunto/' + slug + '.html';

/* endereço (slug) a partir de um texto: sem acento, minúsculo, hífens (a mesma regra do painel e do blog.js) */
const slugDe = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

/* junta as postagens por assunto (um assunto por postagem); nomes que dão o mesmo endereço viram um só */
function agruparAssuntos(posts) {
  const mapa = {};
  posts.forEach((p) => {
    const nome = String(p.assunto || '').trim(), slug = slugDe(nome);
    if (!slug) return;
    (mapa[slug] = mapa[slug] || { nome, slug, posts: [] }).posts.push(p);
  });
  return Object.keys(mapa).sort().map((k) => mapa[k]);
}

const CABECALHO_ANTIGO = `  <header style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:14px 10px; max-width:700px; margin:0 auto 20px auto; border-bottom:1px solid #B5852F; font-family:'Cinzel', serif;">
    <a href="/index.html" class="marca"><img src="/favicon.svg?v=2" alt="" width="40" height="40"><span>Falando de Astrologia</span></a>
    <nav style="display:flex; gap:14px; flex-wrap:wrap;">
      <a href="/index.html#servicos" style="color:#1F5FA3; text-decoration:none; font-weight:600; font-size:13px;">Serviços</a>
      <a href="/mentoria.html" style="color:#1F5FA3; text-decoration:none; font-weight:600; font-size:13px;">Mentoria</a>
      <a href="/sobre.html" style="color:#1F5FA3; text-decoration:none; font-weight:600; font-size:13px;">Sobre</a>
      <a href="/blog.html" style="color:#1F5FA3; text-decoration:none; font-weight:600; font-size:13px;">Blog</a>
    </nav>
  </header>
<div class="pagina pagina-servico"><div class="folha-pagina">`;
/* textos do blog: o papiro é a página inteira e o cabeçalho mora dentro dele (igual às páginas de serviço) */
const CABECALHO_POST = `<div class="pagina pagina-servico pagina-papiro"><div class="folha-pagina">
  <div class="cab-papiro">
    <a href="/index.html" class="cab-logo"><img src="/img/logo-menu.svg?v=3" alt="Falando de Astrologia Helenística" width="752" height="238"></a>
    <nav class="cab-nav"><a href="/aluno.html">Alunos</a><a href="/index.html#servicos">Serviços</a><a href="/blog.html" class="atual">Blog</a></nav>
    <hr class="cab-linha">
  </div>`;

/* assuntos: mesmo desenho da home do blog (céu, logo, barra de papiro, um papiro por texto) */
const CABECALHO_HOME = `<div class="barra-wrap">
  <div class="barra-topo papiro-moldura">
    <a href="/index.html" class="cab-logo"><img src="/img/logo-menu.svg?v=3" alt="Falando de Astrologia Helenística" width="752" height="238"></a>
    <hr class="cab-linha">
    <nav class="cab-nav"><a href="/aluno.html">Alunos</a><a href="/index.html#servicos">Serviços</a><a href="/blog.html" class="atual">Blog</a></nav>
    <div class="social-bar">
      <a href="https://wa.me/5511970404508?text=Oi%20Cássio!%20Estava%20no%20seu%20site%20e%20queria%20tirar%20uma%20dúvida%20sobre" target="_blank" rel="noopener" title="WhatsApp"><img alt="WhatsApp" src="/img/rede-whatsapp.svg" width="44" height="44"></a>
      <a href="https://youtube.com/@falandodeastrologia?si=YEtKppUWaDVqL7uA" target="_blank" rel="noopener" title="YouTube"><img alt="YouTube" src="/img/rede-youtube.svg" width="44" height="44"></a>
      <a href="https://www.instagram.com/cassiopereira___?igsh=MWU5YjVtNWpjYzduZQ%3D%3D&amp;utm_source=qr" target="_blank" rel="noopener" title="Instagram"><img alt="Instagram" src="/img/rede-instagram.svg" width="44" height="44"></a>
      <a href="https://www.tiktok.com/@cassiopereira__?_r=1&amp;_t=ZS-98YFBywW5Za" target="_blank" rel="noopener" title="TikTok"><img alt="TikTok" src="/img/rede-tiktok.svg" width="44" height="44"></a>
    </div>
    <hr class="cab-linha">
    <!--BARRA-->
  </div>
</div>`;

/* casca comum das páginas: cabeçalho do site, papiro, menu */
function casca({ titulo, descricao, url, tipo, extraHead, corpo, home, barra }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/favicon.png?v=2">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${tipo === 'article' ? '<meta name="theme-color" content="#e6d3a0">' : ''}
  <title>${esc(titulo)} - Falando de Astrologia</title>
  <meta name="description" content="${esc(descricao)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="${tipo}">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:url" content="${esc(url)}">${extraHead || ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/papiro.css?v=4">
  <link rel="stylesheet" href="/home.css?v=24">
  <link rel="stylesheet" href="/page.css?v=42">
  <link rel="stylesheet" href="/blog.css?v=13">
</head>
<body${home ? ' class="blog-home"' : ''}>
${home ? CABECALHO_HOME.replace('<!--BARRA-->', barra || '') + '\n' + corpo + '\n<footer class="footer">Falando de Astrologia Helenística</footer>\n' : (tipo === 'article' ? CABECALHO_POST : CABECALHO_ANTIGO) + '\n' + corpo + '\n</div></div>\n'}  <script src="/menu.js?v=22" defer></script>
</body>
</html>
`;
}

function paginaPost(p) {
  const url = enderecoPost(p.slug), resumo = resumoDe(p), id = idYoutube(p.video_url);
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.titulo, description: resumo,
    datePublished: p.publicado_em, dateModified: p.atualizado_em || p.publicado_em, mainEntityOfPage: url,
    author: { '@type': 'Person', name: 'Cássio Pereira' }
  };
  if (p.imagem_url) ld.image = p.imagem_url;
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c');
  const assunto = String(p.assunto || '').trim(), slugAssunto = slugDe(assunto);
  return casca({
    titulo: p.titulo, descricao: resumo, url, tipo: 'article',
    extraHead: (p.imagem_url ? '\n  <meta property="og:image" content="' + esc(p.imagem_url) + '">' : '') + '\n  <script type="application/ld+json">' + ldJson + '</script>',
    corpo: `  <article class="blog" id="post">
    ${slugAssunto ? '<p class="blog-data" style="text-align:center;margin-bottom:6px"><a class="blog-assunto" href="/assunto/' + slugAssunto + '.html">' + esc(assunto) + '</a></p>' : ''}
    <h1>${esc(p.titulo)}</h1>
    ${p.publicado_em ? '<p class="blog-data" style="text-align:center;margin-bottom:20px">' + esc(dataExtenso(p.publicado_em)) + '</p>' : ''}
    ${p.imagem_url ? '<img class="blog-capa" src="' + esc(p.imagem_url) + '" alt="' + esc(p.titulo) + '">' : ''}
${corpoHtml(p.corpo)}
${id ? videoHtml(p.video_url) : ''}
${FIM_HTML}
    <a class="blog-voltar" href="${slugAssunto ? '/assunto/' + slugAssunto + '.html' : '/blog.html'}">← ${slugAssunto ? 'Mais textos de ' + esc(assunto) : 'Ver todos os textos'}</a>
  </article>`
  });
}

/* página de um assunto: a lista das postagens dele */
function paginaAssunto(a) {
  const url = enderecoAssunto(a.slug);
  const cartoes = a.posts.map((p) => '    <a class="blog-card papiro-moldura" href="/blog/' + p.slug + '.html">' +
    (p.imagem_url ? '<img src="' + esc(p.imagem_url) + '" alt="" loading="lazy">' : '') +
    (p.publicado_em ? '<p class="blog-data">' + esc(dataExtenso(p.publicado_em)) + '</p>' : '') +
    '<h2>' + esc(p.titulo) + '</h2><p>' + esc(resumoDe(p)) + '</p></a>').join('\n');
  return casca({
    titulo: a.nome + ' - Blog', descricao: 'Textos sobre ' + a.nome + ' na Astrologia Helenística, por Cássio Pereira.', url, tipo: 'website', home: true, barra: '<h1 class="barra-assunto"><a class="voltar-seta" href="/blog.html" aria-label="Voltar para os assuntos"><svg viewBox="0 0 72 64" width="48" height="30" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="32" x2="64" y2="32"/><polyline points="22,19 10,32 22,45"/></svg></a><span>' + esc(a.nome) + '</span></h1>',
    corpo: `<main class="blog-home-conteudo">
  <div class="blog-grade">
${cartoes}
  </div>
</main>`
  });
}

function sitemap(posts, assuntos) {
  const itens = PAGINAS_FIXAS.map((c) => '  <url><loc>' + SITE + '/' + c + '</loc></url>')
    .concat(assuntos.map((a) => '  <url><loc>' + esc(enderecoAssunto(a.slug)) + '</loc></url>'))
    .concat(posts.map((p) => '  <url><loc>' + esc(enderecoPost(p.slug)) + '</loc><lastmod>' + esc(String(p.atualizado_em || p.publicado_em || '').slice(0, 10)) + '</lastmod></url>'));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + itens.join('\n') + '\n</urlset>\n';
}

module.exports = { paginaPost, paginaAssunto, agruparAssuntos, sitemap, idYoutube, slugDe, SITE };
