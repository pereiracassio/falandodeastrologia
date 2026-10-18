/* Blog do site: peças usadas pela lista (blog.html) e pela página de cada postagem (postagem.html).
   As postagens ficam na tabela blog_posts do Supabase (leitura pública só das publicadas). */
(function () {
  var SUPABASE_URL = 'https://wqkgsotfwkzjwaowenrb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt';
  var SITE = 'https://falandodeastrologia.com.br';

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

  /* O texto da postagem é só isto: parágrafos separados por uma linha em branco e subtítulos marcados com "## " no começo da linha.
     Tudo entra como texto (textContent): nada digitado vira HTML. */
  function renderizarCorpo(corpo) {
    var saida = document.createDocumentFragment();
    String(corpo || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).forEach(function (bloco) {
      bloco = bloco.trim();
      if (!bloco) return;
      var linhas = bloco.split('\n'), paragrafo = [];
      function fecharParagrafo() {
        if (!paragrafo.length) return;
        var p = el('p', { class: 'blog-p' });
        paragrafo.forEach(function (l, i) { if (i) p.appendChild(document.createElement('br')); p.appendChild(document.createTextNode(l)); });
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

  /* resumo automático (para o Google) quando a postagem não tem um escrito: começo do texto, sem as marcas de subtítulo */
  function resumoDe(post) {
    if (post.resumo) return post.resumo;
    var t = String(post.corpo || '').replace(/^##\s+/gm, '').replace(/\s+/g, ' ').trim();
    return t.length > 155 ? t.slice(0, 155).replace(/\s+\S*$/, '') + '…' : t;
  }

  /* endereço de uma postagem */
  function enderecoDe(slug) { return 'postagem.html?p=' + encodeURIComponent(slug); }

  function definirMeta(seletor, atributo, valor) {
    var m = document.head.querySelector(seletor);
    if (!m) { m = document.createElement(seletor.indexOf('link') === 0 ? 'link' : 'meta'); document.head.appendChild(m); }
    var par = /\[(\w+)="([^"]+)"\]/.exec(seletor);
    if (par) m.setAttribute(par[1], par[2]);
    m.setAttribute(atributo, valor);
  }

  window.blog = {
    buscar: buscar, el: el, dataExtenso: dataExtenso, renderizarCorpo: renderizarCorpo, resumoDe: resumoDe,
    enderecoDe: enderecoDe, definirMeta: definirMeta, SITE: SITE
  };
})();
