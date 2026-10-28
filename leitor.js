/* Leitor de PDF com caneta, marca-texto e borracha. Serve ao painel (admin-leitor.html) e ao cliente/aluno.
   Quem usa entrega de onde vem o PDF e onde ficam as marcações:
   Leitor.abrir({ nome, pagina, voltar, obterPdf(progresso) -> Promise<ArrayBuffer>,
                  carregarTracos(pg) -> Promise<array|null>, salvarTracos(pg, tracos) -> Promise,
                  salvarPagina(pg, total), baixar (endereço do Drive: põe o botão Baixar na barra) })
   Sem carregarTracos/salvarTracos, as marcações valem só enquanto o leitor está aberto (só uso interno; aluno e cliente guardam no Supabase).
   Leitor.abrirDoServidor({ nome, id, baixar, voltar }): PDF do Drive do administrador entregue por api/pdf.js (aluno e cliente). */
(function () {
  var P = window.portal, el = P.el;

  function abrir(o) {
    var memoria = {};
    if (!o.carregarTracos) o.carregarTracos = function (pg) { return Promise.resolve(memoria[pg] || null); };
    if (!o.salvarTracos) o.salvarTracos = function (pg, t) { memoria[pg] = t; return Promise.resolve(); };
    var COR = '#A03E25';
    var tela = el('div');
    tela.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;height:100dvh;z-index:99990;background:#d9c78f;display:flex;flex-direction:column;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none';
    var overflowAntes = document.body.style.overflow; document.body.style.overflow = 'hidden';
    document.body.appendChild(tela);

    function semContorno(b) { ['border', 'box-shadow', 'border-radius'].forEach(function (k) { b.style.setProperty(k, k === 'border' ? '0' : k === 'box-shadow' ? 'none' : '0', 'important'); }); b.style.setProperty('background', 'transparent', 'important'); }
    function btn(txt, fn) {
      var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: txt });
      semContorno(b); b.style.cssText += ';padding:8px 9px;margin:0;font-size:13px;min-width:0;white-space:nowrap;flex:none';
      b.addEventListener('click', fn); return b;
    }
    function marcar(b, on) { b.style.setProperty('color', on ? COR : '', 'important'); b.style.textDecoration = on ? 'underline' : 'none'; }
    function barra(topo) {
      var d = el('div');
      d.style.cssText = 'display:flex;flex-wrap:nowrap;align-items:center;gap:0 4px;padding:2px 6px;background:#e6d3a0;flex:none;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-x;-webkit-user-select:none;user-select:none;'
        + (topo ? 'padding-top:calc(2px + env(safe-area-inset-top));' : 'padding-bottom:calc(2px + env(safe-area-inset-bottom));');
      return d;
    }
    var voltarTopo = P.botaoVoltar(fechar), voltarBaixo = P.botaoVoltar(fechar);
    [voltarTopo, voltarBaixo].forEach(function (v) { semContorno(v); v.style.setProperty('padding', '8px 9px'); v.style.flex = 'none'; v.style.whiteSpace = 'nowrap'; });

    /* ferramentas */
    var ferr = 'mao', cores = { caneta: '#1A1410', marca: '#F2C230' };
    var PALETA = { caneta: ['#1A1410', '#1034A6', '#A03E25'], marca: ['#F2C230', '#7CC47C', '#F08FB0'] };
    var bMao = btn('Mover', function () { ferr = 'mao'; pintarFerr(); });
    var bCaneta = btn('Caneta', function () { ferr = 'caneta'; pintarFerr(); });
    var bMarca = btn('Marca-texto', function () { ferr = 'marca'; pintarFerr(); });
    var bBorracha = btn('Borracha', function () { ferr = 'borracha'; pintarFerr(); });
    var bDesfazer = btn('Desfazer', desfazer);
    var bolas = el('span'); bolas.style.cssText = 'display:inline-flex;gap:6px;align-items:center;margin:0 4px;flex:none';
    function pintarFerr() {
      marcar(bMao, ferr === 'mao'); marcar(bCaneta, ferr === 'caneta'); marcar(bMarca, ferr === 'marca'); marcar(bBorracha, ferr === 'borracha');
      bolas.textContent = '';
      if (ferr === 'borracha' || ferr === 'mao') return;
      PALETA[ferr].forEach(function (c) {
        var b = el('button', { type: 'button', 'aria-label': 'Cor' });
        b.style.cssText = 'width:22px;height:22px;padding:0;margin:0;border:0;border-radius:0;background:' + c + ';cursor:pointer;box-sizing:content-box;border-bottom:3px solid ' + (cores[ferr] === c ? COR : 'transparent') + ';flex:none';
        b.addEventListener('click', function () { cores[ferr] = c; pintarFerr(); });
        bolas.appendChild(b);
      });
    }
    var barraTopo = barra(true);
    [voltarTopo, bMao, bCaneta, bMarca, bBorracha, bolas, bDesfazer].forEach(function (x) { barraTopo.appendChild(x); });
    if (o.baixar) { /* discreto, como o Apagar: texto pequeno, apagado e sublinhado */
      var bBaixar = btn('Baixar', function () { window.open(o.baixar, '_blank', 'noopener'); });
      bBaixar.style.cssText += ';font-size:12px;opacity:.6;text-decoration:underline';
      barraTopo.appendChild(bBaixar);
    }
    tela.appendChild(barraTopo);

    var area = el('div'); area.style.cssText = 'flex:1;background:#a8a28f;position:relative;overflow:hidden;touch-action:none;-webkit-tap-highlight-color:transparent;min-height:0';
    var holder = el('div'); holder.style.cssText = 'position:absolute;left:0;top:0;background:#fff';
    function lona(css) { var c = el('canvas'); c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;' + (css || ''); holder.appendChild(c); return c; }
    var cvPdf = lona(), cvMarca = lona('opacity:.55;mix-blend-mode:multiply'), cvTinta = lona();
    var status = el('div', { text: 'Abrindo...' }); status.style.cssText = 'position:absolute;left:0;right:0;top:40%;text-align:center;color:#16233F;font-size:16px;padding:0 20px';
    area.appendChild(holder); area.appendChild(status); tela.appendChild(area);
    holder.style.display = 'none';

    var barraBaixo = barra(false);
    var bAnt = btn('‹', function () { ir(n - 1); }), bProx = btn('›', function () { ir(n + 1); });
    bAnt.style.fontSize = bProx.style.fontSize = '22px';
    var campo = el('input', { type: 'number', min: '1', value: String(o.pagina || 1) });
    campo.style.cssText = 'width:56px;text-align:center;background:transparent;border:0;border-bottom:1px solid #1F5FA3;font:inherit;font-size:15px;color:#16233F;border-radius:0;padding:4px;flex:none';
    var totalTxt = el('span', { text: '' }); totalTxt.style.cssText = 'font-size:14px;color:#16233F;margin-right:4px;white-space:nowrap;flex:none';
    campo.addEventListener('change', function () { ir(parseInt(campo.value, 10) || n); });
    campo.addEventListener('keydown', function (e) { e.stopPropagation(); });
    var bMenos = btn('−', function () { zoomPor(1 / 1.3); }), bMais = btn('+', function () { zoomPor(1.3); });
    bMenos.style.fontSize = bMais.style.fontSize = '22px';
    [voltarBaixo, bAnt, campo, totalTxt, bProx, bMenos, bMais].forEach(function (x) { barraBaixo.appendChild(x); });
    tela.appendChild(barraBaixo);
    pintarFerr();

    /* estado do leitor */
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var pdf = null, pagObj = null, n = o.pagina || 1, zoom = 1, pw = 1, ph = 1, cssW = 1, cssH = 1, left = 0, top = 0;
    var tracos = [], pilha = [], paginaDosTracos = 0, pendente = false, esperaSalvar = null, esperaPagina = null, esperaRender = null;
    var rec = { x0: 0, y0: 0, x1: 1, y1: 1 }; /* parte da folha que tem texto: o resto é margem branca e não aparece */
    var idRender = 0, tarefa = null, idCarga = 0, fechado = false;

    function medir() {
      var aw = area.clientWidth, ah = area.clientHeight, fit = Math.min(aw / (pw * (rec.x1 - rec.x0)), ah / (ph * (rec.y1 - rec.y0)));
      cssW = pw * fit * zoom; cssH = ph * fit * zoom;
    }
    function posicionar() {
      var aw = area.clientWidth, ah = area.clientHeight;
      var rw = cssW * (rec.x1 - rec.x0), rh = cssH * (rec.y1 - rec.y0);
      left = rw <= aw ? (aw - rw) / 2 - rec.x0 * cssW : Math.min(-rec.x0 * cssW, Math.max(aw - rec.x1 * cssW, left));
      top = rh <= ah ? (ah - rh) / 2 - rec.y0 * cssH : Math.min(-rec.y0 * cssH, Math.max(ah - rec.y1 * cssH, top));
      holder.style.left = left + 'px'; holder.style.top = top + 'px'; holder.style.width = cssW + 'px'; holder.style.height = cssH + 'px';
    }
    function pintarTudo() {
      var r = Math.min(dpr, Math.sqrt(16e6 / Math.max(1, cssW * cssH)));
      [cvMarca, cvTinta].forEach(function (c) { c.width = Math.max(1, Math.round(cssW * r)); c.height = Math.max(1, Math.round(cssH * r)); });
      tracos.forEach(function (s) { desenhar(s); });
      return r;
    }
    function renderizar() {
      if (!pagObj) return;
      var eu = ++idRender; if (tarefa) { try { tarefa.cancel(); } catch (e) { /* ok */ } }
      medir(); posicionar();
      var r = pintarTudo();
      var vp = pagObj.getViewport({ scale: (cssW / pw) * r });
      var tmp = document.createElement('canvas'); tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
      tarefa = pagObj.render({ canvasContext: tmp.getContext('2d'), viewport: vp });
      tarefa.promise.then(function () {
        if (eu !== idRender) return;
        cvPdf.width = tmp.width; cvPdf.height = tmp.height; cvPdf.getContext('2d').drawImage(tmp, 0, 0);
      }, function () { /* cancelado */ });
    }
    function renderizarDepois() { clearTimeout(esperaRender); esperaRender = setTimeout(renderizar, 160); }

    /* ---- traços ---- */
    function ctxDe(s) { return (s.t === 'm' ? cvMarca : cvTinta); }
    function desenhar(s) {
      var cv = ctxDe(s), g = cv.getContext('2d');
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.w * cv.width;
      var p = s.p;
      if (p.length === 1) { g.beginPath(); g.arc(p[0][0] * cv.width, p[0][1] * cv.height, g.lineWidth / 2, 0, 7); g.fill(); }
      else { g.beginPath(); g.moveTo(p[0][0] * cv.width, p[0][1] * cv.height); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0] * cv.width, p[i][1] * cv.height); g.stroke(); }
      g.restore();
    }
    function repintarTracos() {
      [cvMarca, cvTinta].forEach(function (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); });
      tracos.forEach(desenhar);
    }
    function trecho(s, a, b) { /* só o último pedaço, enquanto escreve */
      var cv = ctxDe(s), g = cv.getContext('2d');
      g.save(); g.lineCap = 'round'; g.strokeStyle = s.c; g.lineWidth = s.w * cv.width;
      g.beginPath(); g.moveTo(a[0] * cv.width, a[1] * cv.height); g.lineTo(b[0] * cv.width, b[1] * cv.height); g.stroke(); g.restore();
    }
    function avisoTopo(t) { status.textContent = t; status.style.top = '8px'; status.style.display = ''; setTimeout(function () { status.style.display = 'none'; }, 4000); }
    function salvar() { pendente = true; clearTimeout(esperaSalvar); esperaSalvar = setTimeout(gravarAgora, 700); }
    function gravarAgora() {
      clearTimeout(esperaSalvar);
      if (!pendente || !paginaDosTracos) return Promise.resolve();
      pendente = false;
      var pg = paginaDosTracos, copia = tracos.slice();
      return Promise.resolve(o.salvarTracos(pg, copia)).catch(function (e) { pendente = true; avisoTopo('Não consegui salvar as marcações: ' + P.traduzErro((e && e.message) || '')); });
    }
    function desfazer() {
      var op = pilha.pop(); if (!op) return;
      if (op.a === 'add') tracos = tracos.filter(function (s) { return s !== op.s; });
      else tracos = tracos.concat(op.ss);
      repintarTracos(); salvar();
    }

    /* ---- páginas ---- */
    function ir(novo) {
      if (!pdf) return;
      novo = Math.max(1, Math.min(pdf.numPages, novo));
      campo.value = String(novo);
      if (novo === n && pagObj) return;
      gravarAgora(); n = novo; carregarPagina(true);
      clearTimeout(esperaPagina);
      esperaPagina = setTimeout(function () { if (o.salvarPagina) o.salvarPagina(n, pdf.numPages); }, 600);
    }
    function carregarPagina(aoTopo) {
      var eu = ++idCarga;
      pdf.getPage(n).then(function (p) {
        if (eu !== idCarga) return;
        var vp = p.getViewport({ scale: 1 }); pw = vp.width; ph = vp.height; pagObj = p;
        if (aoTopo) { top = -rec.y0 * cssH; zoom = 1; }
        tracos = []; pilha = []; paginaDosTracos = n; pendente = false;
        renderizar();
        Promise.resolve(o.carregarTracos(n)).then(function (t) {
          if (eu !== idCarga || !t) return;
          tracos = t; repintarTracos();
        }).catch(function () { /* sem marcações */ });
      });
    }
    function zoomPor(k, cx, cy) {
      if (!pdf) return;
      var aw = area.clientWidth, ah = area.clientHeight; cx = cx == null ? aw / 2 : cx; cy = cy == null ? ah / 2 : cy;
      var u = (cx - left) / cssW, v = (cy - top) / cssH;
      zoom = Math.max(1, Math.min(6, zoom * k)); medir(); left = cx - u * cssW; top = cy - v * cssH; posicionar(); renderizarDepois();
    }

    /* ---- toque: caneta/mouse escrevem; dedos viram a página, arrastam e dão zoom.
       Sem caneta no aparelho (celular), com uma ferramenta escolhida o dedo também escreve; dois dedos sempre movem e dão zoom ---- */
    var atual = null, apagou = null, toques = {}, pinca = null, gestoPinca = false, canetaNaTela = false, penAte = 0, viuCaneta = false;
    var ultimoToque = null, arrasto = null;
    function pontoDe(e) { var r = holder.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 10000) / 10000, Math.round((e.clientY - r.top) / r.height * 10000) / 10000]; }
    function apagarEm(e) {
      var r = holder.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, raio = 16;
      var tira = tracos.filter(function (s) {
        for (var i = 0; i < s.p.length; i++) {
          var ax = s.p[i][0] * cssW, ay = s.p[i][1] * cssH, bx = ax, by = ay;
          if (i + 1 < s.p.length) { bx = s.p[i + 1][0] * cssW; by = s.p[i + 1][1] * cssH; }
          var dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
          if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < raio + (s.t === 'm' ? s.w * cssW / 2 : 0)) return true;
        }
        return false;
      });
      if (!tira.length) return;
      tracos = tracos.filter(function (s) { return tira.indexOf(s) < 0; });
      apagou = (apagou || []).concat(tira); repintarTracos();
    }
    function comecarTraco(e) {
      if (ferr === 'borracha') { apagou = []; atual = { borracha: true, id: e.pointerId }; apagarEm(e); return; }
      var p = pontoDe(e);
      atual = { t: ferr === 'marca' ? 'm' : 'c', c: cores[ferr], w: ferr === 'marca' ? 0.026 : 0.0022, p: [p], id: e.pointerId };
      desenhar(atual);
    }
    function estenderTraco(e) {
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
      evs.forEach(function (ev) {
        if (atual.borracha) { apagarEm(ev); return; }
        var p = pontoDe(ev), ult = atual.p[atual.p.length - 1];
        if (Math.abs(p[0] - ult[0]) < 0.0004 && Math.abs(p[1] - ult[1]) < 0.0004) return;
        atual.p.push(p); trecho(atual, ult, p);
      });
    }
    function terminarTraco() {
      if (!atual) return;
      if (atual.borracha) { if (apagou && apagou.length) { pilha.push({ a: 'del', ss: apagou }); salvar(); } apagou = null; }
      else { delete atual.id; tracos.push(atual); pilha.push({ a: 'add', s: atual }); if (pilha.length > 100) pilha.shift(); salvar(); }
      atual = null;
    }
    function descartarTraco() { /* o segundo dedo desceu: era zoom, não escrita */
      if (!atual) return;
      if (atual.borracha) { tracos = tracos.concat(apagou || []); apagou = null; }
      atual = null; repintarTracos();
    }
    function dedoEscreve() { return ferr !== 'mao' && !viuCaneta; }
    function comecarPinca() {
      var ids = Object.keys(toques), a = toques[ids[0]], b = toques[ids[1]], ar = area.getBoundingClientRect();
      var cx = (a.x + b.x) / 2 - ar.left, cy = (a.y + b.y) / 2 - ar.top;
      pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoom, u: (cx - left) / cssW, v: (cy - top) / cssH }; gestoPinca = true;
    }
    area.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    area.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!pagObj) return;
      if (e.pointerType === 'touch') {
        if (canetaNaTela || Date.now() < penAte) return;
        toques[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: Date.now() };
        var ids = Object.keys(toques);
        if (ids.length >= 2) { descartarTraco(); comecarPinca(); return; }
        if (dedoEscreve() && !gestoPinca) { try { area.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } comecarTraco(e); }
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen') { canetaNaTela = true; viuCaneta = true; if (ferr === 'mao') { ferr = 'caneta'; pintarFerr(); } }
      if (ferr === 'mao') { arrasto = { x: e.clientX, y: e.clientY }; try { area.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } return; }
      try { area.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
      comecarTraco(e);
    });
    area.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') {
        var t = toques[e.pointerId]; if (!t) return;
        var ids = Object.keys(toques);
        if (ids.length >= 2 && pinca) {
          t.x = e.clientX; t.y = e.clientY;
          var a = toques[ids[0]], b = toques[ids[1]], ar = area.getBoundingClientRect();
          var cx = (a.x + b.x) / 2 - ar.left, cy = (a.y + b.y) / 2 - ar.top;
          zoom = Math.max(1, Math.min(6, pinca.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinca.d0));
          medir(); left = cx - pinca.u * cssW; top = cy - pinca.v * cssH; posicionar(); renderizarDepois();
        } else if (atual && atual.id === e.pointerId) {
          t.x = e.clientX; t.y = e.clientY; estenderTraco(e);
        } else if (ids.length === 1 && zoom > 1 && !gestoPinca) {
          left += e.clientX - t.x; top += e.clientY - t.y; t.x = e.clientX; t.y = e.clientY; posicionar(); renderizarDepois();
        } else { t.x = e.clientX; t.y = e.clientY; }
        return;
      }
      if (arrasto) { left += e.clientX - arrasto.x; top += e.clientY - arrasto.y; arrasto.x = e.clientX; arrasto.y = e.clientY; posicionar(); renderizarDepois(); return; }
      if (!atual) return;
      estenderTraco(e);
    });
    function soltar(e) {
      if (e.pointerType === 'touch') {
        var t = toques[e.pointerId]; if (!t) return;
        var dx = e.clientX - t.x0, dy = e.clientY - t.y0, sozinho = Object.keys(toques).length === 1, escrevia = atual && atual.id === e.pointerId;
        delete toques[e.pointerId];
        if (Object.keys(toques).length < 2) pinca = null;
        if (escrevia) terminarTraco();
        if (!Object.keys(toques).length) {
          var solto = sozinho && !gestoPinca && !escrevia && e.type === 'pointerup';
          if (solto && zoom === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) ir(n + (dx < 0 ? 1 : -1));
          else if (solto && ferr === 'mao' && Math.hypot(dx, dy) < 12 && Date.now() - t.t0 < 300) { /* dois toques seguidos: aproxima ou volta */
            var agora = Date.now(), ar = area.getBoundingClientRect();
            if (ultimoToque && agora - ultimoToque.em < 350 && Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 40) {
              if (zoom > 1.05) zoomPor(1 / zoom); else zoomPor(2.5, e.clientX - ar.left, e.clientY - ar.top);
              ultimoToque = null;
            } else ultimoToque = { em: agora, x: e.clientX, y: e.clientY };
          }
          gestoPinca = false;
        }
        return;
      }
      if (e.pointerType === 'pen') { canetaNaTela = false; penAte = Date.now() + 400; }
      if (arrasto) { arrasto = null; return; }
      terminarTraco();
    }
    area.addEventListener('pointerup', soltar); area.addEventListener('pointercancel', soltar);
    area.addEventListener('wheel', function (e) {
      if (!pagObj) return; e.preventDefault();
      if (e.ctrlKey || e.metaKey) { var ar = area.getBoundingClientRect(); zoomPor(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - ar.left, e.clientY - ar.top); }
      else if (zoom > 1) { left -= e.deltaX; top -= e.deltaY; posicionar(); renderizarDepois(); }
      else ir(n + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
    function teclado(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(n + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(n - 1);
      else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) desfazer();
    }
    document.addEventListener('keydown', teclado);
    function aoRedimensionar() { if (pagObj) { medir(); posicionar(); renderizarDepois(); } }
    window.addEventListener('resize', aoRedimensionar);
    window.addEventListener('orientationchange', aoRedimensionar);
    function aoEsconder() { if (document.visibilityState === 'hidden') gravarAgora(); }
    document.addEventListener('visibilitychange', aoEsconder);

    function fechar() {
      fechado = true; clearTimeout(esperaRender);
      gravarAgora().then(function () {}, function () {});
      document.removeEventListener('keydown', teclado); window.removeEventListener('resize', aoRedimensionar); window.removeEventListener('orientationchange', aoRedimensionar); document.removeEventListener('visibilitychange', aoEsconder);
      document.body.style.overflow = overflowAntes; tela.remove();
      try { if (pdf) pdf.destroy(); } catch (e) { /* ok */ }
      if (o.voltar) o.voltar();
    }

    /* ---- acha onde há texto: olha até 12 páginas espalhadas e junta tudo, assim o tamanho não muda de página para página ---- */
    function medirMargens(doc) {
      var total = doc.numPages, qtd = Math.min(12, total), pags = [], u = null, i = 0;
      for (var k = 0; k < qtd; k++) pags.push(qtd === 1 ? 1 : 1 + Math.round(k * (total - 1) / (qtd - 1)));
      function passo() {
        if (fechado || i >= pags.length) return Promise.resolve();
        return doc.getPage(pags[i++]).then(function (p) {
          var v0 = p.getViewport({ scale: 1 }), esc = 600 / Math.max(v0.width, v0.height), vp = p.getViewport({ scale: esc });
          var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          return p.render({ canvasContext: g, viewport: vp }).promise.then(function () {
            var d = g.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
            for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
              var j = (y * c.width + x) * 4;
              if (d[j] < 235 || d[j + 1] < 235 || d[j + 2] < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            }
            if (x1 < 0) return;
            var b = { x0: x0 / c.width, y0: y0 / c.height, x1: (x1 + 1) / c.width, y1: (y1 + 1) / c.height };
            u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
          });
        }).then(passo, passo);
      }
      return passo().then(function () {
        if (!u || fechado) return;
        var f = 0.02; /* respiro em volta do texto */
        var r = { x0: Math.max(0, u.x0 - f), y0: Math.max(0, u.y0 - f), x1: Math.min(1, u.x1 + f), y1: Math.min(1, u.y1 + f) };
        if (r.x1 - r.x0 < 0.3 || r.y1 - r.y0 < 0.3) return; /* quase vazio: não mexe */
        rec = r; zoom = 1; top = -rec.y0 * cssH; left = 0; renderizar();
      });
    }

    /* ---- abrir o PDF ---- */
    function erro(t) { status.textContent = t; }
    if (!window.pdfjsLib) { erro('Não consegui carregar o leitor de PDF. Verifique a internet.'); return; }
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    Promise.resolve(o.obterPdf(function (txt) { if (!fechado) status.textContent = 'Abrindo... ' + txt; })).then(function (dados) {
      if (fechado) return;
      return pdfjsLib.getDocument({ data: dados }).promise;
    }).then(function (doc) {
      if (!doc || fechado) return;
      pdf = doc; n = Math.max(1, Math.min(doc.numPages, n)); campo.value = String(n); campo.max = String(doc.numPages); totalTxt.textContent = 'de ' + doc.numPages;
      status.style.display = 'none'; holder.style.display = '';
      if (o.salvarPagina) o.salvarPagina(n, doc.numPages);
      carregarPagina(true);
      medirMargens(doc).catch(function () { /* fica a folha inteira */ });
    }).catch(function (e) {
      var m = e && e.message;
      erro(m === 'desconectado' ? 'O Google Drive não está conectado. Conecte em Configurações.' : m === 'sumiu' ? 'Esse arquivo não está mais no Drive.' : 'Não consegui abrir o arquivo.');
    });
    return { fechar: fechar };
  }

  var API_PDF = 'https://falandodeastrologia.vercel.app/api/pdf';
  function baixarComProgresso(r, progresso) {
    var total = Number(r.headers.get('Content-Length')) || 0;
    if (!r.body || !r.body.getReader) return r.arrayBuffer();
    var leitor = r.body.getReader(), partes = [], lido = 0;
    return (function passo() {
      return leitor.read().then(function (x) {
        if (x.done) { var tudo = new Uint8Array(lido), o = 0; partes.forEach(function (p) { tudo.set(p, o); o += p.length; }); return tudo.buffer; }
        partes.push(x.value); lido += x.value.length;
        progresso(total ? Math.round(lido / total * 100) + '%' : Math.round(lido / 1048576) + ' MB');
        return passo();
      });
    })();
  }
  /* aluno e cliente: as marcações e a página onde parou ficam guardadas no Supabase, por pessoa e por arquivo (tabelas leitor_marcacoes e leitor_posicao) */
  function abrirDoServidor(o) {
    var C = P.client, uid = null;
    return C.auth.getSession().then(function (r) {
      uid = r.data && r.data.session && r.data.session.user.id;
      if (!uid) return null;
      return C.from('leitor_posicao').select('pagina').eq('drive_id', o.id).eq('user_id', uid).maybeSingle().then(function (x) { return x.data ? x.data.pagina : null; }, function () { return null; });
    }).then(function (pagina) {
      return abrir({
        nome: o.nome, voltar: o.voltar, baixar: o.baixar, pagina: pagina || 1,
        obterPdf: function (progresso) {
          return C.auth.getSession().then(function (r) {
            var sessao = r.data && r.data.session;
            if (!sessao) throw new Error('sem login');
            return fetch(API_PDF + '?id=' + encodeURIComponent(o.id), { headers: { Authorization: 'Bearer ' + sessao.access_token } });
          }).then(function (r) {
            if (!r.ok) throw new Error(r.status === 404 ? 'sumiu' : 'servidor');
            return baixarComProgresso(r, progresso);
          });
        },
        carregarTracos: function (pg) {
          return C.from('leitor_marcacoes').select('tracos').eq('user_id', uid).eq('drive_id', o.id).eq('pagina', pg).maybeSingle().then(function (x) { return x.data ? (x.data.tracos || []) : null; });
        },
        salvarTracos: function (pg, tracos) {
          var q = tracos.length
            ? C.from('leitor_marcacoes').upsert({ user_id: uid, drive_id: o.id, pagina: pg, tracos: tracos, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id,drive_id,pagina' })
            : C.from('leitor_marcacoes').delete().eq('user_id', uid).eq('drive_id', o.id).eq('pagina', pg);
          return q.then(function (x) { if (x.error) throw x.error; });
        },
        salvarPagina: function (pg) {
          C.from('leitor_posicao').upsert({ user_id: uid, drive_id: o.id, pagina: pg, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id,drive_id' }).then(function () {});
        }
      });
    });
  }

  window.Leitor = { abrir: abrir, abrirDoServidor: abrirDoServidor };
})();
