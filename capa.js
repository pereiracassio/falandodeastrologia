/* Capa em papiro (A4, 794x1123 px): o mesmo desenho da capa do Astro Hellenic — folha de papiro, três filetes (tinta, ocre grosso, tinta),
   faixas de meandros gregos no alto e no pé, título em Cinzel terracota entre dois filetes duplos azuis e o logo no rodapé.
   window.capaFolha({ titulo, subtitulo, nome, aluno, tamanho: 'p'|'m'|'g', powered: true }) devolve o elemento (tamanho A4 real; quem mostra
   na tela reduz com transform, e quem exporta usa em tamanho real). Fundo: img/papiro-folha.jpg (gerado do --papiro-fundo do papiro.css). */
(function () {
  var TAMANHOS = { p: 36, m: 48, g: 60 };
  function el(tag, estilo, texto) {
    var e = document.createElement(tag);
    if (estilo) e.style.cssText = estilo;
    if (texto != null) e.textContent = texto;
    return e;
  }
  /* tamanhos da folha em px (96 por polegada): A4 = 210x297 mm, Carta (Letter) = 8,5x11 pol */
  var FORMATOS = { a4: { w: 794, h: 1123, mmW: 210, mmH: 297 }, carta: { w: 816, h: 1056, mmW: 215.9, mmH: 279.4 } };
  window.capaFormato = function (nome) { return FORMATOS[nome] || FORMATOS.a4; };
  window.capaFolha = function (op) {
    op = op || {};
    var F = window.capaFormato(op.formato), W = F.w, H = F.h;
    var folha = el('div', 'position:relative;width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:#dcc590 url(img/papiro-folha.jpg) 0 0/100% 100% no-repeat;font-family:Arial,sans-serif;color:#16233F');
    folha.className = 'capa-folha';
    var moldura = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="position:absolute;left:0;top:0">' +
      '<defs><pattern id="capaMeandro" width="48" height="32" patternUnits="userSpaceOnUse"><path d="M0 28 H 8 V 4 H 40 V 28 H 24 V 14 H 32 V 20" fill="none" stroke="#1F5FA3" stroke-width="3.4" stroke-linejoin="miter"/></pattern></defs>' +
      '<rect x="28" y="28" width="' + (W - 56) + '" height="' + (H - 56) + '" fill="none" stroke="#2B1D12" stroke-width="1.5"/>' +
      '<rect x="35" y="35" width="' + (W - 70) + '" height="' + (H - 70) + '" fill="none" stroke="#B5852F" stroke-width="4"/>' +
      '<rect x="42" y="42" width="' + (W - 84) + '" height="' + (H - 84) + '" fill="none" stroke="#2B1D12" stroke-width="1.5"/>' +
      '<svg x="64" y="58" width="' + (W - 128) + '" height="32"><rect width="' + (W - 128) + '" height="32" fill="url(#capaMeandro)"/></svg>' +
      '<svg x="64" y="' + (H - 90) + '" width="' + (W - 128) + '" height="32"><rect width="' + (W - 128) + '" height="32" fill="url(#capaMeandro)"/></svg></svg>';
    folha.insertAdjacentHTML('beforeend', moldura);

    var conteudo = el('div', 'position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box;padding:98px ' + (91 + (W - 794) / 2) + 'px;display:flex;flex-direction:column;align-items:center;text-align:center');
    var titulo = el('h1', 'align-self:stretch;margin:53px 0 0;padding:10px 0;border-top:4px double #1F5FA3;border-bottom:4px double #1F5FA3;font-family:Cinzel,serif;font-weight:800;color:#a03e25;text-transform:uppercase;letter-spacing:.03em;line-height:1.25;font-size:' + (TAMANHOS[op.tamanho] || TAMANHOS.m) + 'px;white-space:pre-line;overflow-wrap:anywhere', op.titulo || '');
    conteudo.appendChild(titulo);
    var centro = el('div', 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;align-self:stretch');
    if (op.subtitulo) centro.appendChild(el('div', 'font-family:Cinzel,serif;font-weight:700;color:#a03e25;font-size:34px;line-height:1.25;letter-spacing:.04em;text-transform:uppercase;white-space:pre-line', op.subtitulo));
    if (op.nome) centro.appendChild(el('div', 'font-family:Cinzel,serif;font-weight:700;color:#16233F;font-size:24px;letter-spacing:.04em;white-space:pre-line', op.nome));
    conteudo.appendChild(centro);
    var rodape = el('div', 'display:flex;flex-direction:column;align-items:center;gap:8px');
    if (op.aluno) rodape.appendChild(el('div', 'font-family:Cinzel,serif;font-weight:700;color:#1F5FA3;font-size:26px;letter-spacing:.04em;line-height:1.25;margin-bottom:10px;white-space:pre-line;overflow-wrap:anywhere', op.aluno)); /* nome do aluno (caderno), acima do logo */
    var logo = document.createElement('img');
    logo.src = 'img/logo-completa-sem-fundo.png'; logo.alt = 'Falando de Astrologia Helenística'; logo.style.cssText = 'width:260px;height:auto;display:block'; /* sem fundo: o papiro da folha aparece por trás */
    rodape.appendChild(logo);
    if (op.powered === true) rodape.appendChild(el('div', 'font-size:11px;font-weight:600;color:#1a1410;text-transform:uppercase;letter-spacing:.1em', 'powered by Falando de Astrologia'));
    conteudo.appendChild(rodape);
    folha.appendChild(conteudo);
    return folha;
  };
})();
