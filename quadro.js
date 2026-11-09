/* Quadro: folha de papiro em tela cheia para usar em lives e atendimentos (compartilhando a tela).
   Imagens (escolher ou colar com ⌘V), textos, caneta, marca-texto, borracha e laser (risco que some sozinho).
   Tudo fica guardado até ele apagar: tabela quadros (docs/quadro.sql), linha "principal"; as imagens vão para o bucket site (quadro-...).
   Medidas guardadas em fração da folha (0 a 1), para sair igual em qualquer tela.
   Quadro.abrir({ voltar }) */
(function () {
  var P = window.portal, el = P.el, C = P.client;
  var PROPORCAO = 1.5, ID = 'principal';

  function abrir(o) {
    o = o || {};
    var COR = '#A03E25', AZUL = 'var(--azul-egipcio-claro,#1F5FA3)';
    var dados = { itens: [], tracos: [] }, pilha = [], esperaSalvar = null, pendente = false, carregado = false, fechado = false;
    var tela = el('div');
    tela.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;height:100dvh;z-index:99990;background:#e6d3a0;display:flex;flex-direction:column;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none';
    var overflowAntes = document.body.style.overflow; document.body.style.overflow = 'hidden';
    document.body.appendChild(tela);

    function semContorno(b) { b.style.setProperty('border', '0', 'important'); b.style.setProperty('box-shadow', 'none', 'important'); b.style.setProperty('border-radius', '0', 'important'); b.style.setProperty('background', 'transparent', 'important'); }
    function btn(txt, fn) {
      var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: txt });
      semContorno(b); b.style.cssText += ';padding:8px 9px;margin:0;font-size:13px;min-width:0;white-space:nowrap;flex:none;text-decoration:none';
      b.addEventListener('click', fn); return b;
    }
    function discreto(txt, fn) { var b = P.botaoApagar(txt); b.style.cssText += ';flex:none;white-space:nowrap;margin:0 6px'; b.addEventListener('click', fn); return b; }
    function marcar(b, on) { b.style.setProperty('color', on ? COR : '', 'important'); b.style.textDecoration = on ? 'underline' : 'none'; }
    function barra(topo) {
      var d = el('div');
      d.style.cssText = 'display:flex;flex-wrap:nowrap;align-items:center;gap:0 4px;padding:2px 6px;background:#e6d3a0;flex:none;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-x;'
        + (topo ? 'border-bottom:1px solid ' + AZUL + ';' : 'padding-bottom:calc(2px + env(safe-area-inset-bottom));border-top:1px solid ' + AZUL + ';');
      return d;
    }

    /* ---------- ferramentas ---------- */
    var ferr = 'mao', cores = { caneta: '#1A1410', marca: '#F2C230', texto: '#16233F' };
    var PALETA = { caneta: ['#1A1410', '#1034A6', '#A03E25', '#2E7D4F'], marca: ['#F2C230', '#7CC47C', '#F08FB0'], texto: ['#16233F', '#1034A6', '#A03E25'] };
    var NOMES = [['mao', 'Mover'], ['caneta', 'Caneta'], ['marca', 'Marca-texto'], ['laser', 'Laser'], ['borracha', 'Borracha'], ['texto', 'Texto']];
    var botoes = {};
    var bolas = el('span'); bolas.style.cssText = 'display:inline-flex;gap:6px;align-items:center;margin:0 4px;flex:none';
    function escolher(f) { if (ferr === 'texto' || f !== ferr) pararEdicao(); ferr = f; if (f !== 'mao') selecionar(null); pintarFerr(); }
    function pintarFerr() {
      NOMES.forEach(function (n) { marcar(botoes[n[0]], ferr === n[0]); });
      camada.style.pointerEvents = (ferr === 'mao' || ferr === 'texto') ? 'auto' : 'none';
      area.style.cursor = ferr === 'mao' ? 'default' : ferr === 'texto' ? 'text' : 'crosshair';
      bolas.textContent = '';
      if (!PALETA[ferr]) return;
      PALETA[ferr].forEach(function (c) {
        var b = el('button', { type: 'button', 'aria-label': 'Cor' });
        b.style.cssText = 'width:22px;height:22px;padding:0;margin:0;border:0;border-radius:0;background:' + c + ';cursor:pointer;box-sizing:content-box;border-bottom:3px solid ' + (cores[ferr] === c ? COR : 'transparent') + ';flex:none';
        b.addEventListener('click', function () { cores[ferr] = c; pintarFerr(); });
        bolas.appendChild(b);
      });
    }
    /* a marca em cima, centralizada: é o que aparece para quem assiste a live */
    var marca = el('div'); marca.style.cssText = 'flex:none;display:flex;justify-content:center;background:#e6d3a0;padding:calc(6px + env(safe-area-inset-top)) 0 2px';
    var logo = el('img', { src: '/img/logo-menu.svg?v=3', alt: 'Falando de Astrologia Helenística' }); logo.style.cssText = 'height:54px;width:auto;display:block';
    marca.appendChild(logo); tela.appendChild(marca);
    var barraTopo = barra(true);
    barraTopo.appendChild(voltar());
    NOMES.forEach(function (n) { botoes[n[0]] = btn(n[1], function () { escolher(n[0]); }); barraTopo.appendChild(botoes[n[0]]); });
    var arquivo = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple' }); arquivo.style.display = 'none';
    arquivo.addEventListener('change', function () { [].forEach.call(arquivo.files, function (f) { novaImagem(f); }); arquivo.value = ''; });
    barraTopo.appendChild(btn('Imagem', function () { arquivo.click(); }));
    barraTopo.appendChild(arquivo); barraTopo.appendChild(bolas);
    barraTopo.appendChild(btn('Desfazer', desfazer));
    tela.appendChild(barraTopo);

    var area = el('div'); area.style.cssText = 'flex:1;position:relative;overflow:hidden;touch-action:none;-webkit-tap-highlight-color:transparent;min-height:0;background:#d9c78f';
    var folha = el('div'); folha.style.cssText = 'position:absolute;background:var(--papiro-fundo,#e6d3a0);overflow:hidden';
    var camada = el('div'); camada.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    function lona(css) { var c = el('canvas'); c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;' + (css || ''); return c; }
    var cvMarca = lona('opacity:.55;mix-blend-mode:multiply'), cvTinta = lona(), cvLaser = lona();
    [camada, cvMarca, cvTinta, cvLaser].forEach(function (x) { folha.appendChild(x); });
    var status = el('div', { text: 'Abrindo...' }); status.style.cssText = 'position:absolute;left:0;right:0;top:8px;text-align:center;color:var(--preto-tinta,#16233F);font-size:15px;padding:0 20px;pointer-events:none;z-index:3';
    area.appendChild(folha); area.appendChild(status); tela.appendChild(area);

    var barraBaixo = barra(false), contexto = el('span'); contexto.style.cssText = 'display:inline-flex;align-items:center;gap:0 4px;flex:none';
    var folga = el('span'); folga.style.cssText = 'flex:1 1 auto;min-width:12px';
    barraBaixo.appendChild(voltar()); barraBaixo.appendChild(contexto); barraBaixo.appendChild(folga);
    barraBaixo.appendChild(discreto('Apagar os riscos', function () {
      if (!dados.tracos.length) return;
      if (!confirm('Apagar todos os riscos do quadro? Não dá para desfazer.')) return;
      dados.tracos = []; pilha = []; repintar(); salvar();
    }));
    barraBaixo.appendChild(discreto('Apagar tudo', function () {
      if (!dados.tracos.length && !dados.itens.length) return;
      if (!confirm('Apagar tudo do quadro (riscos, textos e imagens)? Não dá para desfazer.')) return;
      var arquivos = dados.itens.filter(function (i) { return i.tipo === 'img' && i.arq; }).map(function (i) { return i.arq; });
      dados = { itens: [], tracos: [] }; pilha = []; selecionar(null); montarItens(); repintar(); salvar();
      if (arquivos.length) C.storage.from('site').remove(arquivos);
    }));
    tela.appendChild(barraBaixo);

    function voltar() { var v = P.botaoVoltar(fechar); semContorno(v); v.style.setProperty('padding', '8px 9px'); v.style.flex = 'none'; v.style.whiteSpace = 'nowrap'; return v; }
    function avisar(t, fica) { status.textContent = t || ''; if (t && !fica) setTimeout(function () { if (status.textContent === t) status.textContent = ''; }, 5000); }

    /* ---------- medidas ---------- */
    var dpr = Math.max(1, window.devicePixelRatio || 1), W = 1, H = 1;
    function medir() {
      var aw = area.clientWidth, ah = area.clientHeight;
      W = Math.min(aw, ah * PROPORCAO); H = W / PROPORCAO;
      folha.style.left = (aw - W) / 2 + 'px'; folha.style.top = (ah - H) / 2 + 'px'; folha.style.width = W + 'px'; folha.style.height = H + 'px';
      [cvMarca, cvTinta, cvLaser].forEach(function (c) { c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr)); });
      repintar(); dados.itens.forEach(posicionarItem);
    }
    var aoRedimensionar = function () { medir(); };
    window.addEventListener('resize', aoRedimensionar);

    /* ---------- riscos ---------- */
    function lonaDe(s) { return s.t === 'm' ? cvMarca : cvTinta; }
    function desenhar(s) {
      var cv = lonaDe(s), g = cv.getContext('2d'), p = s.p;
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.w * cv.width;
      g.beginPath();
      if (p.length === 1) { g.arc(p[0][0] * cv.width, p[0][1] * cv.height, g.lineWidth / 2, 0, 7); g.fill(); }
      else { g.moveTo(p[0][0] * cv.width, p[0][1] * cv.height); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0] * cv.width, p[i][1] * cv.height); g.stroke(); }
      g.restore();
    }
    function trecho(s, a, b) {
      var cv = lonaDe(s), g = cv.getContext('2d');
      g.save(); g.lineCap = 'round'; g.strokeStyle = s.c; g.lineWidth = s.w * cv.width;
      g.beginPath(); g.moveTo(a[0] * cv.width, a[1] * cv.height); g.lineTo(b[0] * cv.width, b[1] * cv.height); g.stroke(); g.restore();
    }
    function repintar() {
      [cvMarca, cvTinta].forEach(function (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); });
      dados.tracos.forEach(desenhar);
    }
    function desfazer() {
      var op = pilha.pop(); if (!op) return;
      if (op.a === 'add') dados.tracos = dados.tracos.filter(function (s) { return s !== op.s; });
      else dados.tracos = dados.tracos.concat(op.ss);
      repintar(); salvar();
    }

    /* laser: risco vermelho que some sozinho; não é guardado */
    var lasers = [], laserRodando = false, DURA = 6000, SOME = 1200;
    function quadroLaser() {
      var g = cvLaser.getContext('2d'), agora = Date.now();
      lasers = lasers.filter(function (r) { return !r.fim || agora - r.fim < DURA + SOME; });
      g.clearRect(0, 0, cvLaser.width, cvLaser.height); g.lineCap = 'round'; g.lineJoin = 'round';
      lasers.forEach(function (r) {
        var idade = r.fim ? agora - r.fim : 0;
        g.globalAlpha = idade <= DURA ? 1 : Math.max(0, 1 - (idade - DURA) / SOME);
        [[5, '#E2231A', 10], [1.6, '#FFB3A6', 0]].forEach(function (q) {
          g.lineWidth = q[0] * dpr; g.strokeStyle = q[1]; g.fillStyle = q[1]; g.shadowColor = '#E2231A'; g.shadowBlur = q[2] * dpr;
          g.beginPath();
          if (r.p.length === 1) { g.arc(r.p[0][0] * cvLaser.width, r.p[0][1] * cvLaser.height, g.lineWidth / 2, 0, 7); g.fill(); return; }
          g.moveTo(r.p[0][0] * cvLaser.width, r.p[0][1] * cvLaser.height);
          for (var i = 1; i < r.p.length; i++) g.lineTo(r.p[i][0] * cvLaser.width, r.p[i][1] * cvLaser.height);
          g.stroke();
        });
      });
      g.globalAlpha = 1; g.shadowBlur = 0;
      if (lasers.length && !fechado) requestAnimationFrame(quadroLaser); else laserRodando = false;
    }
    function animarLaser() { if (!laserRodando) { laserRodando = true; requestAnimationFrame(quadroLaser); } }

    /* ---------- imagens e textos ---------- */
    var selecionado = null, editando = null;
    function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function noDe(it) { return camada.querySelector('[data-item="' + it.id + '"]'); }
    function posicionarItem(it) {
      var n = noDe(it); if (!n) return;
      n.style.left = it.x * 100 + '%'; n.style.top = it.y * 100 + '%';
      if (it.tipo === 'img') { n.style.width = it.w * 100 + '%'; n.style.height = it.h * 100 + '%'; }
      else { n.style.fontSize = Math.max(8, it.tam * H) + 'px'; n.style.color = it.cor; }
    }
    function criarNo(it) {
      var n;
      if (it.tipo === 'img') {
        n = el('div'); var im = el('img', { src: it.url, alt: '', draggable: 'false' });
        im.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none';
        n.appendChild(im);
      } else {
        n = el('div', { text: it.texto || '' });
        n.style.cssText = 'white-space:pre;line-height:1.3;padding:2px 6px;min-width:12px;min-height:1em;outline:0';
      }
      n.setAttribute('data-item', it.id);
      n.style.position = 'absolute'; n.style.boxSizing = 'border-box'; n.style.touchAction = 'none';
      camada.appendChild(n); posicionarItem(it);
      return n;
    }
    function montarItens() { camada.textContent = ''; dados.itens.forEach(criarNo); pintarSelecao(); }
    function pintarSelecao() {
      [].forEach.call(camada.children, function (n) {
        var eh = selecionado && n.getAttribute('data-item') === selecionado.id;
        n.style.outline = eh && n !== editando ? '3px solid #1F5FA3' : (n === editando ? '1px solid #1F5FA3' : '0');
        var alca = n.querySelector('[data-alca]');
        if (eh && selecionado.tipo === 'img' && !alca) {
          alca = el('span', { 'data-alca': '1' });
          alca.style.cssText = 'position:absolute;right:-12px;bottom:-12px;width:24px;height:24px;border:3px solid #1F5FA3;background:transparent;box-sizing:border-box;cursor:nwse-resize;touch-action:none';
          n.appendChild(alca);
        } else if (alca && !(eh && selecionado.tipo === 'img')) alca.remove();
      });
      contexto.textContent = '';
      if (!selecionado) return;
      contexto.appendChild(btn('Menor', function () { escalar(1 / 1.15); }));
      contexto.appendChild(btn('Maior', function () { escalar(1.15); }));
      contexto.appendChild(btn('Para trás', function () { ordem(false); }));
      contexto.appendChild(btn('Para a frente', function () { ordem(true); }));
      contexto.appendChild(discreto('Apagar', function () { apagarItem(selecionado); }));
    }
    function selecionar(it) { selecionado = it; pintarSelecao(); }
    function escalar(k) {
      var it = selecionado; if (!it) return;
      if (it.tipo === 'img') {
        var cx = it.x + it.w / 2, cy = it.y + it.h / 2, w = Math.max(0.04, Math.min(3, it.w * k)), h = it.h * (w / it.w);
        it.w = w; it.h = h; it.x = cx - w / 2; it.y = cy - h / 2;
      } else it.tam = Math.max(0.015, Math.min(0.4, it.tam * k));
      posicionarItem(it); salvar();
    }
    function ordem(frente) {
      var it = selecionado; if (!it) return;
      dados.itens = dados.itens.filter(function (x) { return x !== it; });
      if (frente) dados.itens.push(it); else dados.itens.unshift(it);
      var n = noDe(it); if (frente) camada.appendChild(n); else camada.insertBefore(n, camada.firstChild);
      salvar();
    }
    function apagarItem(it) {
      if (!it) return;
      dados.itens = dados.itens.filter(function (x) { return x !== it; });
      var n = noDe(it); if (n) { if (n === editando) editando = null; n.remove(); }
      if (it.tipo === 'img' && it.arq) C.storage.from('site').remove([it.arq]);
      if (selecionado === it) selecionar(null);
      salvar();
    }

    function novaImagem(arq) {
      if (!arq || !/^image\//.test(arq.type)) return;
      avisar('Colocando a imagem...', true);
      var endereco = URL.createObjectURL(arq), im = new Image();
      im.onerror = function () { URL.revokeObjectURL(endereco); avisar('Não consegui abrir essa imagem.'); };
      im.onload = function () {
        var k = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(endereco);
        var png = arq.type === 'image/png', tipo = png ? 'image/png' : 'image/jpeg';
        c.toBlob(function (blob) {
          if (!blob) { avisar('Não consegui preparar a imagem.'); return; }
          var caminho = 'quadro-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + (png ? '.png' : '.jpg');
          C.storage.from('site').upload(caminho, blob, { contentType: tipo, upsert: false }).then(function (r) {
            if (r.error) { avisar('Não consegui guardar a imagem: ' + P.traduzErro(r.error.message)); return; }
            var w = 0.45, h = w * (c.height / c.width) * PROPORCAO;
            if (h > 0.8) { w *= 0.8 / h; h = 0.8; }
            var it = { id: novoId(), tipo: 'img', arq: caminho, url: C.storage.from('site').getPublicUrl(caminho).data.publicUrl, x: (1 - w) / 2, y: (1 - h) / 2, w: w, h: h };
            dados.itens.push(it); criarNo(it); avisar('');
            ferr = 'mao'; pintarFerr(); selecionar(it); salvar();
          });
        }, tipo, 0.88);
      };
      im.src = endereco;
    }
    var aoColar = function (e) {
      if (editando) return;
      var its = (e.clipboardData && e.clipboardData.items) || [], achou = false;
      for (var i = 0; i < its.length; i++) if (its[i].kind === 'file' && /^image\//.test(its[i].type)) { novaImagem(its[i].getAsFile()); achou = true; }
      if (achou) e.preventDefault();
    };
    document.addEventListener('paste', aoColar);

    function editar(it) {
      pararEdicao();
      var n = noDe(it); if (!n) return;
      editando = n; selecionado = it;
      n.setAttribute('contenteditable', 'true'); n.style.webkitUserSelect = 'text'; n.style.userSelect = 'text'; n.style.cursor = 'text';
      pintarSelecao();
      n.focus({ preventScroll: true });
      var faixa = document.createRange(); faixa.selectNodeContents(n); faixa.collapse(false);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(faixa);
      n.oninput = function () { it.texto = n.innerText.replace(/\n$/, ''); salvar(); };
    }
    function pararEdicao() {
      var n = editando; if (!n) return;
      editando = null;
      n.removeAttribute('contenteditable'); n.style.webkitUserSelect = ''; n.style.userSelect = ''; n.style.cursor = ''; n.oninput = null; n.blur();
      var it = dados.itens.filter(function (x) { return x.id === n.getAttribute('data-item'); })[0];
      if (it) { it.texto = n.innerText.replace(/\n$/, ''); if (!it.texto.trim()) { apagarItem(it); return; } n.textContent = it.texto; }
      pintarSelecao(); salvar();
    }
    function novoTexto(p) {
      var it = { id: novoId(), tipo: 'txt', texto: '', x: p[0], y: p[1], tam: 0.045, cor: cores.texto };
      dados.itens.push(it); criarNo(it); editar(it);
    }

    /* ---------- toque ---------- */
    var atual = null, apagou = null, arrasto = null, viuCaneta = false;
    function pontoDe(e) { var r = folha.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 10000) / 10000, Math.round((e.clientY - r.top) / r.height * 10000) / 10000]; }
    function itemDe(alvo) {
      var n = alvo && alvo.closest ? alvo.closest('[data-item]') : null; if (!n) return null;
      return dados.itens.filter(function (x) { return x.id === n.getAttribute('data-item'); })[0] || null;
    }
    function apagarEm(e) {
      var r = folha.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, raio = 14;
      var tira = dados.tracos.filter(function (s) {
        for (var i = 0; i < s.p.length; i++) {
          var ax = s.p[i][0] * W, ay = s.p[i][1] * H, bx = ax, by = ay;
          if (i + 1 < s.p.length) { bx = s.p[i + 1][0] * W; by = s.p[i + 1][1] * H; }
          var dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
          if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < raio + (s.t === 'm' ? s.w * W / 2 : 0)) return true;
        }
        return false;
      });
      if (!tira.length) return;
      dados.tracos = dados.tracos.filter(function (s) { return tira.indexOf(s) < 0; });
      apagou = (apagou || []).concat(tira); repintar();
    }
    area.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    area.addEventListener('pointerdown', function (e) {
      if (!carregado) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen') viuCaneta = true;
      if (editando && editando.contains(e.target)) return; /* dentro do texto que está sendo escrito: o toque é do texto */
      e.preventDefault();
      var it = itemDe(e.target);
      if (ferr === 'texto') {
        if (it && it.tipo === 'txt') editar(it); else if (editando) pararEdicao(); else novoTexto(pontoDe(e));
        return;
      }
      if (ferr === 'mao') {
        pararEdicao();
        if (!it) { selecionar(null); return; }
        selecionar(it);
        arrasto = { id: e.pointerId, it: it, x: e.clientX, y: e.clientY, alca: !!(e.target.getAttribute && e.target.getAttribute('data-alca')), mexeu: false };
        try { area.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
        return;
      }
      if (e.pointerType === 'touch' && viuCaneta) return; /* com a caneta em uso, a mão apoiada na tela não risca */
      try { area.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
      var p = pontoDe(e);
      if (ferr === 'borracha') { apagou = []; atual = { borracha: true, id: e.pointerId }; apagarEm(e); return; }
      if (ferr === 'laser') { atual = { laser: true, id: e.pointerId, p: [p], fim: 0 }; lasers.push(atual); animarLaser(); return; }
      atual = { t: ferr === 'marca' ? 'm' : 'c', c: cores[ferr], w: ferr === 'marca' ? 0.022 : 0.0028, p: [p], id: e.pointerId };
      desenhar(atual);
    });
    area.addEventListener('pointermove', function (e) {
      if (arrasto && arrasto.id === e.pointerId) {
        var it = arrasto.it, dx = (e.clientX - arrasto.x) / W, dy = (e.clientY - arrasto.y) / H;
        if (!arrasto.mexeu && Math.abs(e.clientX - arrasto.x) + Math.abs(e.clientY - arrasto.y) < 3) return;
        arrasto.mexeu = true; arrasto.x = e.clientX; arrasto.y = e.clientY;
        if (arrasto.alca) { var w = Math.max(0.04, it.w + dx); it.h = it.h * (w / it.w); it.w = w; }
        else { it.x += dx; it.y += dy; }
        posicionarItem(it); return;
      }
      if (!atual || atual.id !== e.pointerId) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
      evs.forEach(function (ev) {
        if (atual.borracha) { apagarEm(ev); return; }
        var p = pontoDe(ev), ult = atual.p[atual.p.length - 1];
        if (Math.abs(p[0] - ult[0]) < 0.0004 && Math.abs(p[1] - ult[1]) < 0.0004) return;
        atual.p.push(p); if (!atual.laser) trecho(atual, ult, p);
      });
    });
    function soltar(e) {
      if (arrasto && arrasto.id === e.pointerId) { if (arrasto.mexeu) salvar(); arrasto = null; return; }
      if (!atual || atual.id !== e.pointerId) return;
      if (atual.laser) atual.fim = Date.now();
      else if (atual.borracha) { if (apagou && apagou.length) { pilha.push({ a: 'del', ss: apagou }); salvar(); } apagou = null; }
      else { delete atual.id; dados.tracos.push(atual); pilha.push({ a: 'add', s: atual }); if (pilha.length > 100) pilha.shift(); salvar(); }
      atual = null;
    }
    area.addEventListener('pointerup', soltar);
    area.addEventListener('pointercancel', soltar);
    var aoTeclar = function (e) {
      if (editando) { if (e.key === 'Escape') pararEdicao(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selecionado) { e.preventDefault(); apagarItem(selecionado); }
      else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); desfazer(); }
    };
    document.addEventListener('keydown', aoTeclar);

    /* ---------- guardar ---------- */
    function salvar() { if (!carregado) return; pendente = true; clearTimeout(esperaSalvar); esperaSalvar = setTimeout(gravarAgora, 900); }
    function gravarAgora() {
      clearTimeout(esperaSalvar);
      if (!pendente) return Promise.resolve();
      pendente = false;
      return C.from('quadros').upsert({ id: ID, dados: dados, atualizado_em: new Date().toISOString() }).then(function (r) {
        if (r.error) { pendente = true; avisar('Não consegui guardar o quadro: ' + P.traduzErro(r.error.message)); }
      });
    }
    function fechar() {
      pararEdicao(); gravarAgora(); fechado = true;
      window.removeEventListener('resize', aoRedimensionar); document.removeEventListener('paste', aoColar); document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAntes; tela.remove();
      if (o.voltar) o.voltar();
    }
    window.addEventListener('pagehide', function () { if (!fechado) gravarAgora(); });

    pintarFerr(); medir();
    C.from('quadros').select('dados').eq('id', ID).maybeSingle().then(function (r) {
      carregado = true;
      if (r.error) { avisar('Não consegui abrir o quadro guardado: ' + P.traduzErro(r.error.message), true); return; }
      avisar('');
      var d = r.data && r.data.dados;
      if (d) dados = { itens: Array.isArray(d.itens) ? d.itens : [], tracos: Array.isArray(d.tracos) ? d.tracos : [] };
      montarItens(); repintar();
    });
  }

  window.Quadro = { abrir: abrir };
})();
