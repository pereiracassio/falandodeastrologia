/* Capa das aulas do curso, desenhada pelo site (sem PNG). Desenho aprovado em 24/11/2026, ver CLAUDE.md.
   window.capaAula({ romano, nomeModulo, numero, titulo }) -> <svg> 16:9. A fonte vem de .capa-aula text (tipografia.css).
   O título vai em no máximo 2 linhas equilibradas: a letra diminui até caber. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var ESTATICO = "<defs>\n<linearGradient id=\"ca-pb\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#e6d3a0\"/><stop offset=\".5\" stop-color=\"#dcc590\"/><stop offset=\"1\" stop-color=\"#d2b980\"/></linearGradient>\n<radialGradient id=\"ca-pl\" cx=\".15\" cy=\".2\" r=\".5\"><stop offset=\"0\" stop-color=\"#fff4d2\" stop-opacity=\".6\"/><stop offset=\"1\" stop-color=\"#fff4d2\" stop-opacity=\"0\"/></radialGradient>\n<radialGradient id=\"ca-ps\" cx=\".9\" cy=\".88\" r=\".5\"><stop offset=\"0\" stop-color=\"#6e461e\" stop-opacity=\".22\"/><stop offset=\"1\" stop-color=\"#6e461e\" stop-opacity=\"0\"/></radialGradient>\n<pattern id=\"ca-pf\" width=\"27\" height=\"6\" patternUnits=\"userSpaceOnUse\"><line x1=\"0\" y1=\".5\" x2=\"27\" y2=\".5\" stroke=\"#785528\" stroke-opacity=\".07\"/><line x1=\"13.5\" y1=\"0\" x2=\"13.5\" y2=\"6\" stroke=\"#966e3c\" stroke-opacity=\".05\" stroke-width=\"2\"/></pattern><pattern id=\"ca-meandro\" width=\"48\" height=\"32\" patternUnits=\"userSpaceOnUse\"><path d=\"M0 28 H 8 V 4 H 40 V 28 H 24 V 14 H 32 V 20\" fill=\"none\" stroke=\"#1F5FA3\" stroke-width=\"3.4\" stroke-linejoin=\"miter\"/></pattern></defs><rect width=\"1280\" height=\"720\" fill=\"url(#ca-pb)\"/><rect width=\"1280\" height=\"720\" fill=\"url(#ca-pl)\"/><rect width=\"1280\" height=\"720\" fill=\"url(#ca-ps)\"/><rect width=\"1280\" height=\"720\" fill=\"url(#ca-pf)\"/><rect x=\"26\" y=\"26\" width=\"1228\" height=\"668\" stroke=\"#2B1D12\" stroke-width=\"1.5\"/><rect x=\"33\" y=\"33\" width=\"1214\" height=\"654\" stroke=\"#B5852F\" stroke-width=\"4\"/><rect x=\"40\" y=\"40\" width=\"1200\" height=\"640\" stroke=\"#2B1D12\" stroke-width=\"1.5\"/><svg x=\"80\" y=\"64\" width=\"1120\" height=\"32\"><rect width=\"1120\" height=\"32\" fill=\"url(#ca-meandro)\"/></svg><svg x=\"80\" y=\"624\" width=\"1120\" height=\"32\"><rect width=\"1120\" height=\"32\" fill=\"url(#ca-meandro)\"/></svg><image href=\"img/logo-fundamentos.svg\" width=\"1555\" height=\"296\" transform=\"translate(897 557.0) scale(0.20121) translate(3 2)\"/><image href=\"img/logo-falando.svg\" width=\"912\" height=\"400\" transform=\"translate(85.7 529.2) scale(0.31) translate(-101 -45)\"/>";

  function romano(n) {
    var t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], r = '';
    n = Number(n) || 0;
    t.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }
  function texto(svg, cor, contorno) {
    var t = document.createElementNS(NS, 'text');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('x', '640'); t.setAttribute('fill', cor);
    if (contorno) { t.setAttribute('stroke', '#000'); t.setAttribute('stroke-width', '1.2'); t.setAttribute('stroke-linejoin', 'round'); t.setAttribute('paint-order', 'stroke'); }
    svg.appendChild(t); return t;
  }

  function capaAula(o) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720'); svg.setAttribute('fill', 'none'); svg.setAttribute('class', 'capa-aula');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', (o.numero ? o.numero + ' – ' : '') + (o.titulo || ''));
    svg.style.cssText = 'display:block;width:100%;height:auto';
    svg.innerHTML = ESTATICO;
    var linhaMod = o.romano ? texto(svg, '#1A1410') : null;
    var nomeMod = texto(svg, '#B5852F', true);
    var tit = texto(svg, '#A03E25');
    var medida = texto(svg, '#000'); medida.setAttribute('visibility', 'hidden');
    if (linhaMod) { linhaMod.setAttribute('font-size', '38'); linhaMod.setAttribute('y', '150'); linhaMod.textContent = 'módulo ' + o.romano; }
    nomeMod.setAttribute('font-size', '48'); nomeMod.setAttribute('y', '214'); nomeMod.textContent = String(o.nomeModulo || '').toLowerCase();
    var cheio = (o.numero ? o.numero + ' – ' : '') + String(o.titulo || '').toLowerCase();

    function largura(txt, size) { medida.setAttribute('font-size', size); medida.textContent = txt; return medida.getComputedTextLength(); }
    function quebra(palavras, size, max) {
      var out = [], cur = '';
      palavras.forEach(function (w) {
        var n = cur ? cur + ' ' + w : w;
        if (cur && largura(n, size) > max) { out.push(cur); cur = w; } else cur = n;
      });
      out.push(cur); return out;
    }
    function layout() {
      if (!svg.isConnected) return;
      var palavras = cheio.split(/\s+/).filter(Boolean), size = 84, ls;
      while (size > 30) { ls = quebra(palavras, size, 1040); if (ls.length <= 2) break; size -= 2; }
      if (ls.length > 1) {  // equilibra: menor largura que ainda dá o mesmo número de linhas
        var lo = 0, hi = 1040, n = ls.length;
        for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (quebra(palavras, size, mid).length <= n) hi = mid; else lo = mid; }
        ls = quebra(palavras, size, hi);
      }
      var lh = size * 1.45, top = 385 - (ls.length * lh) / 2 + lh * 0.75;
      tit.textContent = '';
      ls.forEach(function (l, i) {
        var ts = document.createElementNS(NS, 'tspan');
        ts.setAttribute('x', '640'); ts.setAttribute('y', (top + i * lh - lh * 0.2).toFixed(1)); ts.textContent = l; tit.appendChild(ts);
      });
      tit.setAttribute('font-size', size);
    }
    // desenha assim que entrar na página e de novo quando a fonte terminar de carregar
    setTimeout(layout, 0);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    return svg;
  }
  window.capaAula = capaAula; window.capaAula.romano = romano;
})();
