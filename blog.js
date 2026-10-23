/* Blog do site: peças usadas pela lista (blog.html) e pela página de cada postagem (postagem.html).
   As postagens ficam na tabela blog_posts do Supabase (leitura pública só das publicadas). */
(function () {
  var SUPABASE_URL = 'https://wqkgsotfwkzjwaowenrb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt';
  var SITE = 'https://falandodeastrologia.com.br';
  /* true quando cada postagem já tem a sua página própria (blog/<endereço>.html, gerada por api/blog-publicar.js) */
  var PAGINAS_PROPRIAS = true;

  function buscar(filtro) {
    return fetch(SUPABASE_URL + '/rest/v1/blog_posts?' + filtro, { headers: { apikey: SUPABASE_KEY } })
      .then(function (r) { if (!r.ok) throw new Error('blog'); return r.json(); });
  }

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(f); });
    return e;
  }

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataExtenso(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  /* ligações automáticas: as palavras cadastradas em cada postagem ("Palavras que levam a este texto") viram link, TODA vez que aparecem nas outras postagens */
  function chaveFrase(t) { return String(t || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function montarLigacoes(posts, atual) {
    var mapa = {};
    (posts || []).forEach(function (q) {
      if (!q.slug || q.slug === atual) return;
      String(q.palavras_link || '').split(/[,;\n]/).forEach(function (f) { var k = chaveFrase(f); if (k && !mapa[k]) mapa[k] = q.slug; });
    });
    var chaves = Object.keys(mapa).sort(function (a, b) { return b.length - a.length; });
    if (!chaves.length) return null;
    var alt = chaves.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'); }).join('|');
    return { mapa: mapa, re: new RegExp('(^|[^\\p{L}\\p{N}])(' + alt + ')(?![\\p{L}\\p{N}])', 'giu') };
  }
  function textoComLinks(pai, linha, lig) {
    if (!lig) { pai.appendChild(document.createTextNode(linha)); return; }
    var ult = 0;
    linha.replace(lig.re, function (m, pre, fr, off) {
      var ini = off + pre.length;
      pai.appendChild(document.createTextNode(linha.slice(ult, ini)));
      pai.appendChild(el('a', { class: 'blog-link-interno', href: enderecoDe(lig.mapa[chaveFrase(fr)]), text: fr }));
      ult = ini + fr.length; return m;
    });
    pai.appendChild(document.createTextNode(linha.slice(ult)));
  }

  /* O texto da postagem é só isto: parágrafos separados por uma linha em branco e subtítulos marcados com "## " no começo da linha.
     Tudo entra como texto (textContent): nada digitado vira HTML. */
  function renderizarCorpo(corpo, lig) {
    var saida = document.createDocumentFragment();
    String(corpo || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).forEach(function (bloco) {
      bloco = bloco.trim();
      if (!bloco) return;
      var linhas = bloco.split('\n'), paragrafo = [];
      function fecharParagrafo() {
        if (!paragrafo.length) return;
        var p = el('p', { class: 'blog-p' });
        paragrafo.forEach(function (l, i) { if (i) p.appendChild(document.createElement('br')); textoComLinks(p, l, lig); });
        saida.appendChild(p); paragrafo = [];
      }
      linhas.forEach(function (l) {
        var m = /^##\s+(.+)$/.exec(l.trim());
        if (m) { fecharParagrafo(); saida.appendChild(el('h2', { class: 'blog-h2', text: m[1] })); }
        else if (l.trim()) paragrafo.push(l.trim());
      });
      fecharParagrafo();
    });
    return saida;
  }

  /* ícones astrológicos (U+E000 a U+E020): nos resumos e no Google viram o NOME, não um quadradinho */
  var NOMES_ICONES = ["Sol", "Lua", "Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno", "Fortuna", "Espírito", "Necessidade", "Eros", "Coragem", "Vitória", "Nêmesis", "Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes", "Lunação pré-natal", "Nodo Norte", "Nodo Sul", "Ascendente", "Descendente", "Meio do Céu", "Fundo do Céu"];
  function semIcones(t) { return String(t || '').replace(/[\uE000-\uE020]/g, function (c) { return NOMES_ICONES[c.charCodeAt(0) - 0xE000] + ' '; }); }

  /* resumo automático (para o Google) quando a postagem não tem um escrito: começo do texto, sem as marcas de subtítulo */
  function resumoDe(post) {
    if (post.resumo) return post.resumo;
    var t = semIcones(post.corpo).replace(/^##\s+/gm, '').replace(/\s+/g, ' ').trim();
    return t.length > 155 ? t.slice(0, 155).replace(/\s+\S*$/, '') + '…' : t;
  }

  /* endereço (slug) a partir de um texto: sem acento, minúsculo, hífens (a mesma regra do painel e do servidor) */
  function slugDe(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, ''); }

  /* endereço de uma postagem */
  function enderecoDe(slug) { return PAGINAS_PROPRIAS ? 'blog/' + slug + '.html' : 'postagem.html?p=' + encodeURIComponent(slug); }

  /* id do vídeo a partir do link do YouTube; null se não for um link do YouTube */
  function idYoutube(url) {
    try {
      var u = new URL(String(url || '').trim()), host = u.hostname.replace(/^www\.|^m\./, ''), id = null, m;
      if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
      else if (host === 'youtube.com') {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else if ((m = /^\/(shorts|embed|live)\/([^/]+)/.exec(u.pathname))) id = m[2];
      }
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch (e) { return null; }
  }
  /* o vídeo no fim da postagem: toca ali mesmo e tem o link pro YouTube */
  function renderizarVideo(url) {
    var id = idYoutube(url), saida = document.createDocumentFragment();
    if (!id) return saida;
    var moldura = el('div', { class: 'blog-video' });
    moldura.appendChild(el('iframe', { src: 'https://www.youtube.com/embed/' + id, title: 'Vídeo no YouTube', loading: 'lazy', allowfullscreen: '', allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen' }));
    saida.appendChild(moldura);
    saida.appendChild(el('p', { class: 'blog-p', style: 'text-align:center' }, [el('a', { class: 'blog-voltar', style: 'margin:0', href: 'https://www.youtube.com/watch?v=' + id, target: '_blank', rel: 'noopener', text: 'Assistir no YouTube' })]));
    return saida;
  }

  function definirMeta(seletor, atributo, valor) {
    var m = document.head.querySelector(seletor);
    if (!m) { m = document.createElement(seletor.indexOf('link') === 0 ? 'link' : 'meta'); document.head.appendChild(m); }
    var par = /\[(\w+)="([^"]+)"\]/.exec(seletor);
    if (par) m.setAttribute(par[1], par[2]);
    m.setAttribute(atributo, valor);
  }

  window.blog = {
    buscar: buscar, el: el, dataExtenso: dataExtenso, renderizarCorpo: renderizarCorpo, montarLigacoes: montarLigacoes, resumoDe: resumoDe,
    enderecoDe: enderecoDe, slugDe: slugDe, idYoutube: idYoutube, renderizarVideo: renderizarVideo, definirMeta: definirMeta, SITE: SITE
  };
})();
