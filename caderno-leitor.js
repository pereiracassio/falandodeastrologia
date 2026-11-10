/* Livro de PDF do CADERNO (admin-caderno.html, marcador Leitor): duas páginas abertas, como um livro.
   A capa (página 1) fica sozinha na direita, com o livro fechado; ao virar, a 2 fica na esquerda e a 3 na direita, e assim por diante.
   Caneta, marca-texto e borracha: as mesmas marcações do Leitor de antes (tabela leitor_tracos: traços em fração da página), então valem nos dois.
   O dedo vira a página (quem faz o gesto é o caderno) e a caneta (Apple Pencil) ou o mouse escreve. Precisa do pdf.js (pdfjsLib) carregado. */
window.LeitorCaderno = function (P) {
  var el = P.el;

  function abrir(o) {
    /* o: { esq, dir (onde as duas páginas ficam), barra (onde ficam as ferramentas), livro: { nome, pagina, total }, obterPdf(progresso), carregarTracos(pg), salvarTracos(pg, tracos),
            salvarPagina(pg, total), voltar(), aviso(texto), aoMudar(esqNum, dirNum) } */
    var COR = '#A03E25', dpr = Math.max(1, window.devicePixelRatio || 1);
    var pdf = null, total = 0, s = 0, zoom = 1, ferr = 'mao', cores = { caneta: '#1A1410', marca: '#F2C230' }, rec = { x0: 0, y0: 0, x1: 1, y1: 1 }, fechado = false, esperaPagina = null;
    var PALETA = { caneta: ['#1A1410', '#1034A6', '#A03E25'], marca: ['#F2C230', '#7CC47C', '#F08FB0'] };
    var pilha = [], vistas = [];

    function esqNum(i) { return i === 0 ? null : (2 * i <= total ? 2 * i : null); }
    function dirNum(i) { return i === 0 ? (total >= 1 ? 1 : null) : (2 * i + 1 <= total ? 2 * i + 1 : null); }
    function sMax() { return Math.floor(total / 2); }

    /* ---------- uma página: o PDF, o marca-texto e a tinta, em três lonas ---------- */
    function criarPagina(host) {
      host.textContent = '';
      host.style.cssText += ';overflow:auto;-webkit-overflow-scrolling:touch;position:relative;min-height:0';
      var janela = el('div', { class: 'lp' }); janela.style.cssText = 'position:relative;overflow:hidden;margin:auto;flex:none;touch-action:pan-x pan-y;background:transparent';
      var holder = el('div'); holder.style.cssText = 'position:absolute;background:transparent';
      function lona(css) { var c = el('canvas'); c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;' + (css || ''); holder.appendChild(c); return c; }
      var cvPdf = lona(), cvMarca = lona('opacity:.55;mix-blend-mode:multiply'), cvTinta = lona();
      janela.appendChild(holder); host.appendChild(janela); janela.style.display = 'none';
      var P_ = { num: null, pag: null, pw: 1, ph: 1, cssW: 1, cssH: 1, tracos: [], pendente: false, espera: null, idRender: 0, tarefa: null, idCarga: 0, apagou: null, host: host };

      function medir() {
        var aw = host.clientWidth, ah = host.clientHeight, rw = rec.x1 - rec.x0, rh = rec.y1 - rec.y0;
        var fit = Math.min(aw / (P_.pw * rw), ah / (P_.ph * rh)); P_.cssW = P_.pw * fit * zoom; P_.cssH = P_.ph * fit * zoom;
        janela.style.width = (P_.cssW * rw) + 'px'; janela.style.height = (P_.cssH * rh) + 'px';
        holder.style.left = (-rec.x0 * P_.cssW) + 'px'; holder.style.top = (-rec.y0 * P_.cssH) + 'px'; holder.style.width = P_.cssW + 'px'; holder.style.height = P_.cssH + 'px';
      }
      function pintarTracos() { [cvMarca, cvTinta].forEach(function (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); }); P_.tracos.forEach(desenhar); }
      function ctxDe(t) { return t.t === 'm' ? cvMarca : cvTinta; }
      function desenhar(t) {
        var cv = ctxDe(t), g = cv.getContext('2d'); g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = t.c; g.fillStyle = t.c; g.lineWidth = t.w * cv.width; var p = t.p;
        if (p.length === 1) { g.beginPath(); g.arc(p[0][0] * cv.width, p[0][1] * cv.height, g.lineWidth / 2, 0, 7); g.fill(); }
        else { g.beginPath(); g.moveTo(p[0][0] * cv.width, p[0][1] * cv.height); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0] * cv.width, p[i][1] * cv.height); g.stroke(); }
        g.restore();
      }
      function trecho(t, a, b) { var cv = ctxDe(t), g = cv.getContext('2d'); g.save(); g.lineCap = 'round'; g.strokeStyle = t.c; g.lineWidth = t.w * cv.width; g.beginPath(); g.moveTo(a[0] * cv.width, a[1] * cv.height); g.lineTo(b[0] * cv.width, b[1] * cv.height); g.stroke(); g.restore(); }
      function lonasDoTamanho() {
        var r = Math.min(dpr, Math.sqrt(16e6 / Math.max(1, P_.cssW * P_.cssH)));
        [cvMarca, cvTinta].forEach(function (c) { c.width = Math.max(1, Math.round(P_.cssW * r)); c.height = Math.max(1, Math.round(P_.cssH * r)); });
        P_.tracos.forEach(desenhar); return r;
      }
      /* o branco do PDF vira transparente de verdade (o papiro aparece por baixo desde o primeiro instante, sem piscar durante a virada da página) */
      function tirarBranco(g, w, h) {
        var im = g.getImageData(0, 0, w, h), d = im.data;
        for (var i = 0; i < d.length; i += 4) {
          var mn = Math.min(d[i], d[i + 1], d[i + 2]), a = 255 - mn;
          if (a === 0) { d[i + 3] = 0; continue; }
          d[i] = Math.max(0, Math.min(255, 255 * (d[i] - mn) / a)); d[i + 1] = Math.max(0, Math.min(255, 255 * (d[i + 1] - mn) / a)); d[i + 2] = Math.max(0, Math.min(255, 255 * (d[i + 2] - mn) / a)); d[i + 3] = a;
        }
        g.putImageData(im, 0, 0);
      }
      function renderizar() {
        if (!P_.pag) return; var eu = ++P_.idRender; if (P_.tarefa) { try { P_.tarefa.cancel(); } catch (e) { /* ok */ } }
        medir(); var r = lonasDoTamanho(), vp = P_.pag.getViewport({ scale: (P_.cssW / P_.pw) * r }), tmp = document.createElement('canvas'); tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
        P_.tarefa = P_.pag.render({ canvasContext: tmp.getContext('2d'), viewport: vp });
        P_.tarefa.promise.then(function () { if (eu !== P_.idRender) return; cvPdf.width = tmp.width; cvPdf.height = tmp.height; var gp = cvPdf.getContext('2d'); gp.drawImage(tmp, 0, 0); tirarBranco(gp, cvPdf.width, cvPdf.height); }, function () { /* cancelado */ });
      }
      function gravar() {
        clearTimeout(P_.espera); if (!P_.pendente || !P_.num) return Promise.resolve(); P_.pendente = false; var pg = P_.num, copia = P_.tracos.slice();
        return Promise.resolve(o.salvarTracos(pg, copia)).catch(function (e) { P_.pendente = true; o.aviso('Não consegui salvar as marcações: ' + P.traduzErro((e && e.message) || '')); });
      }
      function salvar() { P_.pendente = true; clearTimeout(P_.espera); P_.espera = setTimeout(gravar, 700); }
      function mostrar(num) {
        var eu = ++P_.idCarga; P_.num = num; P_.tracos = []; P_.pendente = false;
        if (!num) { P_.pag = null; janela.style.display = 'none'; return Promise.resolve(); }
        return pdf.getPage(num).then(function (p) {
          if (eu !== P_.idCarga) return; var vp = p.getViewport({ scale: 1 }); P_.pw = vp.width; P_.ph = vp.height; P_.pag = p; janela.style.display = ''; renderizar();
          return Promise.resolve(o.carregarTracos(num)).then(function (t) { if (eu !== P_.idCarga || !t) return; P_.tracos = t; pintarTracos(); }).catch(function () { /* sem marcações */ });
        });
      }
      function ponto(e) { var r = holder.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 10000) / 10000, Math.round((e.clientY - r.top) / r.height * 10000) / 10000]; }
      function apagarEm(e) {
        var r = holder.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, raio = 16;
        var tira = P_.tracos.filter(function (t) {
          for (var i = 0; i < t.p.length; i++) {
            var ax = t.p[i][0] * P_.cssW, ay = t.p[i][1] * P_.cssH, bx = ax, by = ay; if (i + 1 < t.p.length) { bx = t.p[i + 1][0] * P_.cssW; by = t.p[i + 1][1] * P_.cssH; }
            var dx = bx - ax, dy = by - ay, k = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
            if (Math.hypot(x - (ax + k * dx), y - (ay + k * dy)) < raio + (t.t === 'm' ? t.w * P_.cssW / 2 : 0)) return true;
          } return false;
        });
        if (!tira.length) return; P_.tracos = P_.tracos.filter(function (t) { return tira.indexOf(t) < 0; }); P_.apagou = (P_.apagou || []).concat(tira); pintarTracos();
      }
      /* a caneta e o mouse escrevem; o dedo nunca (ele rola e vira a página) */
      var atual = null;
      janela.addEventListener('pointerdown', function (e) {
        if (ferr === 'mao' || !P_.num || (e.pointerType !== 'pen' && e.pointerType !== 'mouse') || e.button > 0) return;
        e.preventDefault(); try { janela.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
        if (ferr === 'borracha') { P_.apagou = []; atual = { apaga: true }; apagarEm(e); return; }
        var t = ferr === 'marca' ? { t: 'm', c: cores.marca, w: 0.022, p: [ponto(e)] } : { t: 'c', c: cores.caneta, w: 0.0035, p: [ponto(e)] };
        if (e.pointerType === 'pen' && e.pressure) t.w = t.t === 'c' ? 0.0022 + e.pressure * 0.003 : t.w;
        atual = t; desenhar(t);
      });
      janela.addEventListener('pointermove', function (e) {
        if (!atual) return; e.preventDefault();
        if (atual.apaga) { apagarEm(e); return; }
        var lista = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!lista.length) lista = [e];
        lista.forEach(function (ev) { var a = atual.p[atual.p.length - 1], b = ponto(ev); if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.0004) return; atual.p.push(b); trecho(atual, a, b); });
      });
      function soltar() {
        if (!atual) return; var t = atual; atual = null;
        if (t.apaga) { if (P_.apagou && P_.apagou.length) { pilha.push({ pv: P_, a: 'del', ss: P_.apagou }); P_.apagou = null; salvar(); } return; }
        P_.tracos.push(t); pilha.push({ pv: P_, a: 'add', s: t }); salvar();
      }
      janela.addEventListener('pointerup', soltar); janela.addEventListener('pointercancel', soltar);
      P_.mostrar = mostrar; P_.renderizar = renderizar; P_.gravar = gravar; P_.pintarTracos = pintarTracos;
      return P_;
    }

    /* ---------- as ferramentas ---------- */
    var barra = o.barra; barra.textContent = '';
    function btn(txt, fn, extra) { var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: txt }); b.style.cssText = 'padding:6px 8px;margin:0;font-size:13px;min-width:0;white-space:nowrap;flex:none;border:0' + (extra || ''); b.addEventListener('click', fn); return b; }
    function marcar(b, on) { b.style.setProperty('color', on ? COR : '', 'important'); b.style.textDecoration = on ? 'underline' : 'none'; }
    var bMao = btn('Mover', function () { ferr = 'mao'; pintarFerr(); }), bCaneta = btn('Caneta', function () { ferr = 'caneta'; pintarFerr(); }), bMarca = btn('Marca-texto', function () { ferr = 'marca'; pintarFerr(); }), bBorracha = btn('Borracha', function () { ferr = 'borracha'; pintarFerr(); });
    var bDesfazer = btn('Desfazer', function () {
      var op = pilha.pop(); if (!op) return; var pv = op.pv;
      if (op.a === 'add') pv.tracos = pv.tracos.filter(function (t) { return t !== op.s; }); else pv.tracos = pv.tracos.concat(op.ss);
      pv.pintarTracos(); pv.pendente = true; clearTimeout(pv.espera); pv.espera = setTimeout(pv.gravar, 400);
    });
    var corBtns = el('span'); corBtns.style.cssText = 'display:inline-flex;gap:6px;align-items:center;margin:0 4px';
    function pintarFerr() {
      [[bMao, 'mao'], [bCaneta, 'caneta'], [bMarca, 'marca'], [bBorracha, 'borracha']].forEach(function (x) { marcar(x[0], ferr === x[1]); });
      corBtns.textContent = ''; var lista = PALETA[ferr] || [];
      lista.forEach(function (c) { var b = el('button', { type: 'button', 'aria-label': 'Cor' }); b.style.cssText = 'width:22px;height:22px;padding:0;border-radius:50%;border:2px solid ' + (cores[ferr] === c ? '#A03E25' : 'transparent') + ';background:' + c; b.addEventListener('click', function () { cores[ferr] = c; pintarFerr(); }); corBtns.appendChild(b); });
    }
    var campo = el('input', { type: 'number', min: '1', value: '1' }); campo.style.cssText = 'width:52px;text-align:center;background:transparent;border:0;border-bottom:1px solid #1F5FA3;font:inherit;font-size:15px;padding:2px;flex:none;min-height:0';
    var totalTxt = el('span', { text: '' }); totalTxt.style.cssText = 'font-size:14px;margin-right:4px;white-space:nowrap;flex:none';
    campo.setAttribute('inputmode', 'numeric'); campo.setAttribute('enterkeyhint', 'go'); campo.addEventListener('focus', function () { setTimeout(function () { try { campo.select(); } catch (e) { /* ok */ } }, 0); }); /* toca no número, digita a página e confirma */
    campo.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') campo.blur(); });
    campo.addEventListener('change', function () { var p = Math.max(1, Math.min(total, parseInt(campo.value, 10) || 1)); virarPara(p <= 1 ? 0 : Math.floor(p / 2), 0); });
    var bAnt = btn('‹', function () { virar(-1); }, ';font-size:22px'), bProx = btn('›', function () { virar(1); }, ';font-size:22px'), bMenos = btn('−', function () { zoomar(0); }, ';font-size:22px'), bMais = btn('+', function () { zoomar(1); }, ';font-size:22px');
    var bVoltar = btn('← Voltar', function () { fechar(); o.voltar(); });
    /* ferramentas na página da esquerda, páginas e zoom na da direita: nada em cima da costura */
    /* UMA linha em cima (ferramentas, metade de cada lado da costura) e UMA linha embaixo (páginas e zoom, na página da direita) */
    var topo = o.barraTopo; topo.textContent = '';
    var t1 = el('div', { class: 'lb-g' }), t2 = el('div', { class: 'lb-g' }), b1 = el('div', { class: 'lb-g' }), b2 = el('div', { class: 'lb-g' });
    [bVoltar, bMao, bCaneta, bMarca].forEach(function (x) { t1.appendChild(x); });
    [bBorracha, corBtns, bDesfazer].forEach(function (x) { t2.appendChild(x); });
    [bAnt, campo, totalTxt, bProx, bMenos, bMais].forEach(function (x) { b2.appendChild(x); });
    topo.appendChild(t1); topo.appendChild(t2); barra.appendChild(b1); barra.appendChild(b2);
    pintarFerr();

    /* ---------- as duas páginas ---------- */
    var pvE = criarPagina(o.esq), pvD = criarPagina(o.dir);
    var status = el('div', { text: 'Abrindo...' }); status.style.cssText = 'position:absolute;left:0;right:0;top:42%;text-align:center;font-size:16px;padding:0 20px'; o.dir.appendChild(status);
    var ZOOMS = [1, 1.3, 1.7, 2.2, 3];
    function marcarZoom() { var c = o.barra.closest && o.barra.closest('.cad'); if (c) c.classList.toggle('leitor-zoom', zoom > 1); } /* sem zoom, o dedo desliza em qualquer lugar da página para virar */
    function zoomar(mais) { var i = ZOOMS.indexOf(zoom); i = Math.max(0, Math.min(ZOOMS.length - 1, i + (mais ? 1 : -1))); zoom = ZOOMS[i]; marcarZoom(); pvE.renderizar(); pvD.renderizar(); }
    function mostrarSpread() {
      var e = esqNum(s), d = dirNum(s); zoom = 1; marcarZoom(); status.style.display = 'none';
      campo.value = String(e || d || 1); marcar(bAnt, false);
      o.esq.style.visibility = e ? '' : 'visible';
      return Promise.all([pvE.mostrar(e), pvD.mostrar(d)]).then(function () { o.aoMudar && o.aoMudar(e, d); });
    }
    function virarPara(novo, sentido) {
      if (!pdf) return; novo = Math.max(0, Math.min(sMax(), novo)); if (novo === s && pvD.pag) return;
      Promise.all([pvE.gravar(), pvD.gravar()]).then(function () {
        s = novo; pilha = []; mostrarSpread();
        clearTimeout(esperaPagina); esperaPagina = setTimeout(function () { o.salvarPagina && o.salvarPagina(esqNum(s) || dirNum(s) || 1, total); }, 600);
      });
    }
    function virar(d) { var antes = s; virarPara(s + d, d); return s + d >= 0 && s + d <= sMax() && s + d !== antes; }
    function medirMargens() { /* parte da folha que tem texto: o resto é margem branca e não aparece (como no leitor de antes) */
      var qtd = Math.min(12, total), pags = [], u = null, i = 0;
      for (var k = 0; k < qtd; k++) pags.push(qtd === 1 ? 1 : 1 + Math.round(k * (total - 1) / (qtd - 1)));
      function passo() {
        if (fechado || i >= pags.length) return Promise.resolve();
        return pdf.getPage(pags[i++]).then(function (p) {
          var v0 = p.getViewport({ scale: 1 }), esc = 600 / Math.max(v0.width, v0.height), vp = p.getViewport({ scale: esc }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          return p.render({ canvasContext: g, viewport: vp }).promise.then(function () {
            var d = g.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
            for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) { var j = (y * c.width + x) * 4; if (d[j] < 235 || d[j + 1] < 235 || d[j + 2] < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
            if (x1 < 0) return; var b = { x0: x0 / c.width, y0: y0 / c.height, x1: (x1 + 1) / c.width, y1: (y1 + 1) / c.height };
            u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
          });
        }).then(passo, passo);
      }
      return passo().then(function () {
        if (!u || fechado) return; var f = 0.02, r = { x0: Math.max(0, u.x0 - f), y0: Math.max(0, u.y0 - f), x1: Math.min(1, u.x1 + f), y1: Math.min(1, u.y1 + f) };
        if (r.x1 - r.x0 < 0.3 || r.y1 - r.y0 < 0.3) return; rec = r; pvE.renderizar(); pvD.renderizar();
      });
    }
    function fechar() { if (fechado) return; fechado = true; clearTimeout(esperaPagina); pvE.gravar(); pvD.gravar(); try { if (pdf) pdf.destroy(); } catch (e) { /* ok */ } }

    if (!window.pdfjsLib) { status.textContent = 'Não consegui carregar o leitor de PDF. Verifique a internet.'; return { fechar: fechar, virar: function () {}, zoom: function () { return 1; } }; }
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    Promise.resolve(o.obterPdf(function (txt) { if (!fechado) status.textContent = 'Abrindo... ' + txt; })).then(function (dados) { if (fechado) return; return pdfjsLib.getDocument({ data: dados }).promise; }).then(function (doc) {
      if (!doc || fechado) return; pdf = doc; total = doc.numPages; campo.max = String(total); totalTxt.textContent = 'de ' + total;
      var pg = Math.max(1, Math.min(total, (o.livro && o.livro.pagina) || 1)); s = pg <= 1 ? 0 : Math.min(sMax(), Math.floor(pg / 2));
      o.salvarPagina && o.salvarPagina(esqNum(s) || dirNum(s) || 1, total);
      return mostrarSpread().then(function () { return medirMargens(); });
    }).catch(function (e) { var m = e && e.message; status.style.display = ''; status.textContent = m === 'desconectado' ? 'O Google Drive não está conectado. Conecte em Configurações.' : m === 'sumiu' ? 'Esse arquivo não está mais no Drive.' : 'Não consegui abrir o arquivo.'; });
    return { fechar: fechar, virar: virar, zoom: function () { return zoom; }, aoRedimensionar: function () { pvE.renderizar(); pvD.renderizar(); } };
  }
  return { abrir: abrir };
};
