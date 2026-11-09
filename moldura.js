/* MOLDURA DE MEANDROS NAS CORES DO TEMA — o SVG é montado aqui, na hora, lendo as variáveis do tema (temas.css):
   contorno (--moldura-contorno), filete (--ocre) e meandro (--azul-egipcio-claro). border-image não lê variável de cor,
   então o SVG vira um endereço "data:" guardado em --moldura-img, que o CSS usa. Troca de tema = refaz sozinho.
   Sem este script o CSS cai na imagem moldura-redes.svg (cores de sempre). Mesma geometria de moldura-redes.svg: se uma mudar, mudar a outra. */
(function () {
  var M1 = 'M80 120 H88 V96 H120 V120 H104 V106 H112 V112 M128 120 H136 V96 H168 V120 H152 V106 H160 V112 M176 120 H184 V96 H216 V120 H200 V106 H208 V112 M224 120 H232 V96 H264 V120 H248 V106 H256 V112 M272 120 H280 V96 H312 V120 H296 V106 H304 V112 M320 120 H328 V96 H360 V120 H344 V106 H352 V112 M368 120 H376 V96 H408 V120 H392 V106 H400 V112';
  /* o meandro de baixo é o de cima 144 mais abaixo */
  var M2 = 'M80 264 H88 V240 H120 V264 H104 V250 H112 V256 M128 264 H136 V240 H168 V264 H152 V250 H160 V256 M176 264 H184 V240 H216 V264 H200 V250 H208 V256 M224 264 H232 V240 H264 V264 H248 V250 H256 V256 M272 264 H280 V240 H312 V264 H296 V250 H304 V256 M320 264 H328 V240 H360 V264 H344 V250 H352 V256 M368 264 H376 V240 H408 V264 H392 V250 H400 V256';
  function cor(cs, nome, reserva) { return (cs.getPropertyValue(nome) || '').trim() || reserva; }
  function montar() {
    var raiz = document.documentElement, cs = getComputedStyle(raiz);
    var contorno = cor(cs, '--moldura-contorno', '#2B1D12'), ocre = cor(cs, '--ocre', '#B5852F'), azul = cor(cs, '--azul-egipcio-claro', '#1F5FA3');
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='496' height='360' viewBox='0 0 496 360' fill='none'>" +
      "<rect x='60' y='60' width='376' height='240' stroke='" + contorno + "' stroke-width='1.5'/>" +
      "<rect x='67' y='67' width='362' height='226' stroke='" + ocre + "' stroke-width='4'/>" +
      "<rect x='74' y='74' width='348' height='212' stroke='" + contorno + "' stroke-width='1.5'/>" +
      "<path d='" + M1 + "' stroke='" + azul + "' stroke-width='3.4' stroke-linejoin='miter'/>" +
      "<path d='" + M2 + "' stroke='" + azul + "' stroke-width='3.4' stroke-linejoin='miter'/></svg>";
    var url = 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29') + '")';
    if (svg === ultimoSvg) return;
    ultimoSvg = svg;
    /* Enquanto o PNG não fica pronto, vale o SVG. O PNG é o que fica: border-image com SVG "data:" era redesenhado (vetor) em cada pedaço repetido da moldura a cada quadro do zoom,
       e no iPhone isso derrubava a página ao dar zoom. Imagem pronta (bitmap) é desenhada uma vez só. NUNCA voltar a usar o SVG direto no border-image. */
    if (!raiz.style.getPropertyValue('--moldura-img')) raiz.style.setProperty('--moldura-img', url);
    try {
      var img = new Image();
      img.onload = function () {
        try {
          if (svg !== ultimoSvg) return;
          var c = document.createElement('canvas'); c.width = 496; c.height = 360;
          c.getContext('2d').drawImage(img, 0, 0, 496, 360);
          raiz.style.setProperty('--moldura-img', 'url("' + c.toDataURL('image/png') + '")');
        } catch (e) { /* fica o SVG */ }
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    } catch (e) { /* fica o SVG */ }
  }
  var ultimoSvg = '';
  montar();
  if (window.MutationObserver) new MutationObserver(montar).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('DOMContentLoaded', montar);
  window.addEventListener('load', montar);
})();
