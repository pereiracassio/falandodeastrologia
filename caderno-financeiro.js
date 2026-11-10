/* Gráficos e formulário de entrada do FINANCEIRO, para o CADERNO (admin-caderno.html). CÓPIA do que está em admin-financeiro.html
   (gráficos em SVG, formulário de entrada, serviços): mexeu lá, mexa aqui também. Sem tela própria: o caderno chama estas funções. */
window.FinCaderno = function (P, FdaTema, S) {
  var el = P.el, C = P.client, window_ = window;
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var FORMAS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência', 'Outro'];
  var areas = [], entradas = [], todas = [], servicosCad = [], clientes = [], alunos = [], mes = { ano: 2026, mes: 0 }, escopoGraf = 'ano', app = { clientWidth: 560 };
    function hojeISO() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function moeda(n) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function dataBR(iso) { var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); }
    /* "275", "275,50", "1.275,50", "R$ 275,00" -> número (ou null) */
    function lerValor(txt) {
      var s = String(txt || '').replace(/[R$\s]/g, '');
      if (!s) return null;
      if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
      var n = parseFloat(s);
      return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
    }
    function campo(rotulo, controle) { return [el('label', { text: rotulo }), controle]; }
    var PALETA_AREAS = [FdaTema.cor('azul-egipcio-claro'), FdaTema.cor('terracota'), FdaTema.cor('ocre'), FdaTema.cor('verde')], COR_CINZA = FdaTema.cor('cinza'), COR_TEXTO = FdaTema.cor('preto-tinta'), COR_LINHA = FdaTema.cor('azul-egipcio-claro');
    var MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var SVGNS = 'http://www.w3.org/2000/svg';

    function sv(tag, attrs, texto) {
      var n = document.createElementNS(SVGNS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (texto != null) n.textContent = texto;
      return n;
    }
    function corDaArea(id) {
      var i = areas.findIndex(function (a) { return a.id === id; });
      return i >= 0 && i < PALETA_AREAS.length ? PALETA_AREAS[i] : COR_CINZA;
    }
    function nomeDaArea(id) { var a = areas.filter(function (x) { return x.id === id; })[0]; return a ? a.nome : 'Sem área'; }
    function chaveArea(e) { return e.area_id && areas.some(function (a) { return a.id === e.area_id; }) ? e.area_id : '_sem'; }
    function compacto(n) {
      n = Number(n || 0);
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' mi';
      if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',').replace(',0', '') + ' mil';
      return String(Math.round(n));
    }
    /* escala "bonita": até onde vai o eixo e de quanto em quanto */
    function escalaEixo(max) {
      if (max <= 0) return { topo: 100, passo: 25 };
      var bruto = max / 4, pot = Math.pow(10, Math.floor(Math.log10(bruto))), f = bruto / pot;
      var passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pot;
      return { topo: Math.ceil(max / passo) * passo, passo: passo };
    }
    function larguraGraf() { return Math.max(280, Math.min(720, app.clientWidth - 48)); }
    function subtitulo(t) { return el('h3', { class: 'fin-graf-titulo', text: t }); }
    function leitura() { return el('p', { class: 'fin-leitura', text: ' ' }); }
    function legenda(itens) {
      return el('div', { class: 'fin-legenda' }, itens.map(function (i) {
        return el('span', { class: 'fin-legenda-item' }, [el('span', { class: 'fin-amostra', style: 'background:' + i.cor }), document.createTextNode(i.nome)]);
      }));
    }
    function vazio(t) { return el('p', { class: 'fin-graf-vazio', text: t }); }

    function entradasDoEscopo() {
      if (escopoGraf === 'mes') return todas.filter(function (e) { var d = String(e.data).slice(0, 7); return d === mes.ano + '-' + String(mes.mes + 1).padStart(2, '0'); });
      if (escopoGraf === 'ano') return todas.filter(function (e) { return String(e.data).slice(0, 4) === String(mes.ano); });
      return todas;
    }
    function rotuloEscopo() { return escopoGraf === 'mes' ? MESES[mes.mes] + ' de ' + mes.ano : escopoGraf === 'ano' ? 'ano de ' + mes.ano : 'todos os meses'; }

    /* 1) Barras por mês: os 12 meses até o mês aberto, cada barra dividida por área */
    function graficoMeses() {
      var caixa = el('div', {}, [subtitulo('Entradas por mês')]);
      var meses = [], a = mes.ano, m = mes.mes;
      for (var i = 0; i < 12; i++) { meses.unshift({ ano: a, mes: m, tot: {}, soma: 0 }); m--; if (m < 0) { m = 11; a--; } }
      var idx = {}; meses.forEach(function (x) { idx[x.ano + '-' + String(x.mes + 1).padStart(2, '0')] = x; });
      todas.forEach(function (e) {
        var x = idx[String(e.data).slice(0, 7)]; if (!x) return;
        var k = chaveArea(e); x.tot[k] = (x.tot[k] || 0) + Number(e.valor || 0); x.soma += Number(e.valor || 0);
      });
      var max = Math.max.apply(null, meses.map(function (x) { return x.soma; }));
      if (!(max > 0)) { caixa.appendChild(vazio('Ainda não há entradas nestes 12 meses.')); return caixa; }
      var usadas = areas.map(function (x) { return x.id; }).concat(['_sem']).filter(function (k) { return meses.some(function (x) { return x.tot[k]; }); });
      caixa.appendChild(legenda(usadas.map(function (k) { return { nome: nomeDaArea(k), cor: k === '_sem' ? COR_CINZA : corDaArea(k) }; })));
      var W = larguraGraf(), H = 230, mE = 40, mD = 6, mT = 18, mB = 26, esc = escalaEixo(max), lido = leitura();
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Entradas por mês, divididas por área' });
      for (var v = 0; v <= esc.topo + 0.001; v += esc.passo) {
        var y = mT + (H - mT - mB) * (1 - v / esc.topo);
        svg.appendChild(sv('line', { x1: mE, x2: W - mD, y1: y, y2: y, stroke: COR_LINHA, 'stroke-opacity': v === 0 ? 0.9 : 0.25, 'stroke-width': v === 0 ? 1.5 : 1 }));
        svg.appendChild(sv('text', { x: mE - 6, y: y + 4, 'text-anchor': 'end', class: 'fin-eixo' }, compacto(v)));
      }
      var passoX = (W - mE - mD) / 12, larg = Math.min(34, passoX * 0.7);
      meses.forEach(function (x, i) {
        var cx = mE + passoX * i + passoX / 2, yBase = H - mB;
        var g = sv('g', { class: 'fin-barra', tabindex: '0' });
        var topoY = yBase;
        usadas.forEach(function (k) {
          var vv = x.tot[k] || 0; if (!vv) return;
          var h = (H - mT - mB) * vv / esc.topo, hh = Math.max(1, h - 2);
          topoY -= h;
          g.appendChild(sv('rect', { x: cx - larg / 2, y: topoY + 1, width: larg, height: hh, fill: k === '_sem' ? COR_CINZA : corDaArea(k) }));
        });
        g.appendChild(sv('rect', { x: cx - passoX / 2, y: mT, width: passoX, height: H - mT - mB, fill: 'transparent' }));
        var ehAtual = x.ano === mes.ano && x.mes === mes.mes;
        svg.appendChild(g);
        svg.appendChild(sv('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'fin-eixo' + (ehAtual ? ' fin-eixo-forte' : '') }, MES_CURTO[x.mes]));
        if (x.soma > 0 && passoX >= 26) svg.appendChild(sv('text', { x: cx, y: topoY - 5, 'text-anchor': 'middle', class: 'fin-valor-graf' }, compacto(x.soma)));
        function mostrar() {
          lido.textContent = MESES[x.mes] + ' ' + x.ano + ': ' + moeda(x.soma) + (usadas.length > 1 ? ' (' + usadas.filter(function (k) { return x.tot[k]; }).map(function (k) { return nomeDaArea(k) + ' ' + moeda(x.tot[k]); }).join(' · ') + ')' : '');
        }
        g.addEventListener('mouseenter', mostrar); g.addEventListener('click', mostrar); g.addEventListener('focus', mostrar);
      });
      caixa.appendChild(svg); caixa.appendChild(lido);
      return caixa;
    }

    /* 2) Divisão por área no mês: pizza com a porcentagem de cada área (e a legenda com o valor) */
    function graficoDivisao() {
      var caixa = el('div', {}, [subtitulo('Divisão por área · ' + rotuloEscopo())]);
      var tot = {}, soma = 0;
      entradasDoEscopo().forEach(function (e) { var k = chaveArea(e); tot[k] = (tot[k] || 0) + Number(e.valor || 0); soma += Number(e.valor || 0); });
      if (!(soma > 0)) { caixa.appendChild(vazio('Nenhuma entrada neste período.')); return caixa; }
      var ks = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
      var W = larguraGraf(), R = Math.min(W / 2 - 4, 130), cx = W / 2, cy = R + 4, H = cy + R + 4;
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Divisão por área em pizza' });
      function ponto(ang, r) { return [cx + r * Math.sin(ang), cy - r * Math.cos(ang)]; }
      var ang0 = 0;
      ks.forEach(function (k) {
        var fr = tot[k] / soma, ang1 = ang0 + fr * 2 * Math.PI, cor = k === '_sem' ? COR_CINZA : corDaArea(k), fatia;
        if (fr >= 0.9999) fatia = sv('circle', { cx: cx, cy: cy, r: R, fill: cor });
        else {
          var p0 = ponto(ang0, R), p1 = ponto(ang1, R);
          fatia = sv('path', { d: 'M' + cx + ',' + cy + ' L' + p0[0] + ',' + p0[1] + ' A' + R + ',' + R + ' 0 ' + (fr > 0.5 ? 1 : 0) + ' 1 ' + p1[0] + ',' + p1[1] + ' Z', fill: cor, stroke: '#F3E3B8', 'stroke-width': 2, 'stroke-linejoin': 'miter' });
        }
        svg.appendChild(fatia);
        if (fr >= 0.07) {
          var pt = ponto((ang0 + ang1) / 2, R * 0.62);
          svg.appendChild(sv('text', { x: pt[0], y: pt[1] + 5, 'text-anchor': 'middle', class: 'fin-sobre-cor', fill: cor === FdaTema.cor('ocre') ? FdaTema.cor('preto-tinta') : '#F3E3B8' }, Math.round(fr * 100) + '%'));
        }
        ang0 = ang1;
      });
      caixa.appendChild(svg);
      caixa.appendChild(legenda(ks.map(function (k) { return { nome: nomeDaArea(k) + ' ' + Math.round(tot[k] / soma * 100) + '% · ' + moeda(tot[k]), cor: k === '_sem' ? COR_CINZA : corDaArea(k) }; })));
      return caixa;
    }

    /* Pizza dos clientes: cada fatia leva só o código (ou as iniciais do nome, para quem não tem código); o nome inteiro fica na legenda */
    function graficoPizzaClientes() {
      var caixa = el('div', {}, [subtitulo('Clientes que mais geraram entrada, em pizza · ' + rotuloEscopo())]);
      var tot = {}, soma = 0;
      entradasDoEscopo().forEach(function (e) { var k = String(e.cliente_nome || '').trim() || 'Sem cliente'; tot[k] = (tot[k] || 0) + Number(e.valor || 0); soma += Number(e.valor || 0); });
      var ks = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
      if (!(soma > 0)) { caixa.appendChild(vazio('Nenhuma entrada neste período.')); return caixa; }
      var CORES = [FdaTema.cor('azul-egipcio-claro'), FdaTema.cor('terracota'), FdaTema.cor('ocre'), FdaTema.cor('verde'), FdaTema.cor('azul-egipcio-escuro'), '#7D2F1A', '#8A6A22', '#2F5D46'];
      var fatias = ks.slice(0, 8).map(function (k, i) { return { nome: k, v: tot[k], cor: CORES[i % CORES.length] }; });
      if (ks.length > 8) fatias.push({ nome: 'Outros (' + (ks.length - 8) + ')', v: ks.slice(8).reduce(function (t, k) { return t + tot[k]; }, 0), cor: COR_CINZA, outros: true });
      function rotuloCurto(f) {
        if (f.outros) return '';
        var i = f.nome.indexOf(' - '), pre = i > 0 ? f.nome.slice(0, i) : '';
        if (pre && /\d/.test(pre)) return pre.split(/\s+/)[0];
        var ini = f.nome.split(/\s+/).filter(function (w) { return w && !/^(da|de|do|das|dos|e)$/i.test(w); }).slice(0, 3).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
        return ini;
      }
      var W = larguraGraf(), R = Math.min(W / 2 - 4, 130), cx = W / 2, cy = R + 4, H = cy + R + 4;
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Clientes em pizza' });
      function ponto(ang, r) { return [cx + r * Math.sin(ang), cy - r * Math.cos(ang)]; }
      var ang0 = 0;
      fatias.forEach(function (f) {
        var fr = f.v / soma, ang1 = ang0 + fr * 2 * Math.PI, fatia;
        if (fr >= 0.9999) fatia = sv('circle', { cx: cx, cy: cy, r: R, fill: f.cor });
        else {
          var p0 = ponto(ang0, R), p1 = ponto(ang1, R);
          fatia = sv('path', { d: 'M' + cx + ',' + cy + ' L' + p0[0] + ',' + p0[1] + ' A' + R + ',' + R + ' 0 ' + (fr > 0.5 ? 1 : 0) + ' 1 ' + p1[0] + ',' + p1[1] + ' Z', fill: f.cor, stroke: '#F3E3B8', 'stroke-width': 2, 'stroke-linejoin': 'miter' });
        }
        svg.appendChild(fatia);
        var rot = rotuloCurto(f);
        if (rot && fr >= 0.05) {
          var pt = ponto((ang0 + ang1) / 2, R * 0.66);
          svg.appendChild(sv('text', { x: pt[0], y: pt[1] + 5, 'text-anchor': 'middle', class: 'fin-sobre-cor', fill: f.cor === FdaTema.cor('ocre') ? FdaTema.cor('preto-tinta') : '#F3E3B8' }, rot));
        }
        ang0 = ang1;
      });
      caixa.appendChild(svg);
      caixa.appendChild(legenda(fatias.map(function (f) { return { nome: (f.outros ? '' : rotuloCurto(f) + ' · ') + f.nome + ' · ' + Math.round(f.v / soma * 100) + '% · ' + moeda(f.v), cor: f.cor }; })));
      return caixa;
    }

    /* 3, 4 e 5) Rankings em barras na horizontal (serviços, clientes, forma de pagamento) */
    function graficoRanking(titulo, campo, semNome, cor) {
      var caixa = el('div', {}, [subtitulo(titulo + ' · ' + rotuloEscopo())]);
      var tot = {}, soma = 0;
      /* serviços: o nome antigo (cadastrado no serviço, em Configurações) conta no nome atual; maiúscula e minúscula não diferenciam */
      var nomeAtual = {}, primeiroVisto = {}, porAreaDe = {};
      if (campo === 'produto') servicosCad.forEach(function (sv) {
        nomeAtual[String(sv.nome).trim().toLowerCase()] = sv.nome;
        String(sv.outros_nomes || '').split('\n').forEach(function (a) { a = a.trim().toLowerCase(); if (a) nomeAtual[a] = sv.nome; });
      });
      entradasDoEscopo().forEach(function (e) {
        var k = String(e[campo] || '').trim() || semNome;
        if (campo === 'produto' && k !== semNome) { var baixo = k.toLowerCase(); k = nomeAtual[baixo] || primeiroVisto[baixo] || (primeiroVisto[baixo] = k); }
        tot[k] = (tot[k] || 0) + Number(e.valor || 0); soma += Number(e.valor || 0);
        var ka = chaveArea(e); (porAreaDe[k] = porAreaDe[k] || {})[ka] = (porAreaDe[k][ka] || 0) + Number(e.valor || 0);
      });
      /* serviço: a barra leva a cor da área dele (a área onde ele mais rendeu), como no gráfico de áreas */
      function corDoServico(k) {
        var m = porAreaDe[k]; if (!m) return cor;
        var melhor = Object.keys(m).sort(function (a, b) { return m[b] - m[a]; })[0];
        return melhor === '_sem' ? COR_CINZA : corDaArea(melhor);
      }
      var ks = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
      if (!ks.length) { caixa.appendChild(vazio('Nenhuma entrada neste período.')); return caixa; }
      var linhas = ks.slice(0, 8).map(function (k) { return { nome: k, v: tot[k], cor: campo === 'produto' ? corDoServico(k) : cor }; });
      if (ks.length > 8) linhas.push({ nome: 'Outros (' + (ks.length - 8) + ')', v: ks.slice(8).reduce(function (s, k) { return s + tot[k]; }, 0) });
      var W = larguraGraf(), alt = 46, H = linhas.length * alt + 4, max = linhas[0].v;
      linhas.forEach(function (l) { if (l.v > max && l.nome.indexOf('Outros') !== 0) max = l.v; });
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': titulo });
      var areaBarra = W - 128;
      linhas.forEach(function (l, i) {
        var y = 2 + i * alt, w = Math.max(2, areaBarra * l.v / Math.max(max, l.v));
        svg.appendChild(sv('text', { x: 0, y: y + 14, class: 'fin-rotulo-graf' }, l.nome));
        svg.appendChild(sv('rect', { x: 0, y: y + 20, width: w, height: 16, fill: l.nome.indexOf('Outros') === 0 ? COR_CINZA : l.cor }));
        svg.appendChild(sv('text', { x: w + 6, y: y + 33, class: 'fin-valor-graf fin-valor-lado' }, moeda(l.v) + ' · ' + Math.round(l.v / soma * 100) + '%'));
      });
      caixa.appendChild(svg);
      if (campo === 'produto') { /* quais áreas as cores representam */
        var usadas = {}; linhas.forEach(function (l) { if (l.cor) usadas[l.cor] = true; });
        var chaves = areas.map(function (a) { return a.id; }).concat(['_sem']).filter(function (k) { return usadas[k === '_sem' ? COR_CINZA : corDaArea(k)]; });
        if (chaves.length) caixa.appendChild(legenda(chaves.map(function (k) { return { nome: nomeDaArea(k), cor: k === '_sem' ? COR_CINZA : corDaArea(k) }; })));
      }
      return caixa;
    }

    /* 6) Acumulado do ano: linha subindo mês a mês */
    function graficoAcumulado() {
      var caixa = el('div', {}, [subtitulo('Acumulado em ' + mes.ano)]);
      var porMes = []; for (var i = 0; i < 12; i++) porMes.push(0);
      todas.forEach(function (e) { if (String(e.data).slice(0, 4) === String(mes.ano)) porMes[Number(String(e.data).slice(5, 7)) - 1] += Number(e.valor || 0); });
      var hoje = new Date(), ultimo = mes.ano < hoje.getFullYear() ? 11 : mes.ano === hoje.getFullYear() ? hoje.getMonth() : -1;
      for (var j = porMes.length - 1; j >= 0; j--) if (porMes[j] > 0 && j > ultimo) ultimo = j;
      var acum = [], s = 0; for (var k = 0; k <= ultimo; k++) { s += porMes[k]; acum.push(s); }
      if (!(s > 0)) { caixa.appendChild(vazio('Ainda não há entradas neste ano.')); return caixa; }
      var W = larguraGraf(), H = 200, mE = 40, mD = 14, mT = 16, mB = 26, esc = escalaEixo(s), lido = leitura();
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Acumulado do ano' });
      for (var v = 0; v <= esc.topo + 0.001; v += esc.passo) {
        var y = mT + (H - mT - mB) * (1 - v / esc.topo);
        svg.appendChild(sv('line', { x1: mE, x2: W - mD, y1: y, y2: y, stroke: COR_LINHA, 'stroke-opacity': v === 0 ? 0.9 : 0.25, 'stroke-width': v === 0 ? 1.5 : 1 }));
        svg.appendChild(sv('text', { x: mE - 6, y: y + 4, 'text-anchor': 'end', class: 'fin-eixo' }, compacto(v)));
      }
      var passoX = (W - mE - mD) / 11, pts = acum.map(function (v2, i2) { return [mE + passoX * i2, mT + (H - mT - mB) * (1 - v2 / esc.topo)]; });
      for (var t = 0; t < 12; t++) svg.appendChild(sv('text', { x: mE + passoX * t, y: H - 8, 'text-anchor': 'middle', class: 'fin-eixo' + (t === mes.mes ? ' fin-eixo-forte' : '') }, MES_CURTO[t]));
      svg.appendChild(sv('polyline', { points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), fill: 'none', stroke: FdaTema.cor('azul-egipcio-escuro'), 'stroke-width': 2, 'stroke-linejoin': 'miter' }));
      pts.forEach(function (p, i2) {
        var q = sv('rect', { x: p[0] - 4, y: p[1] - 4, width: 8, height: 8, fill: FdaTema.cor('azul-egipcio-escuro'), class: 'fin-ponto', tabindex: '0' });
        function mostrar() { lido.textContent = MESES[i2] + ' ' + mes.ano + ': entrou ' + moeda(porMes[i2]) + ' · acumulado ' + moeda(acum[i2]); }
        q.addEventListener('mouseenter', mostrar); q.addEventListener('click', mostrar); q.addEventListener('focus', mostrar);
        svg.appendChild(q);
        svg.appendChild(sv('rect', { x: p[0] - 14, y: mT, width: 28, height: H - mT - mB, fill: 'transparent', class: 'fin-alvo' })).addEventListener('click', mostrar);
      });
      caixa.appendChild(svg); caixa.appendChild(lido);
      return caixa;
    }

    function montarGraficos() {
      var raiz = el('div', { class: 'fin-graficos' });
      function desenhar() {
        /* mudar o período não pode levar a tela para o topo: guarda a altura e a rolagem e devolve no mesmo lugar */
        var yRolagem = window.pageYOffset, alturaAntes = raiz.offsetHeight;
        if (alturaAntes) raiz.style.minHeight = alturaAntes + 'px';
        raiz.textContent = '';
        /* período dos gráficos (a pizza, os rankings...): o mês aberto, o ano dele ou tudo */
        var botoes = [['mes', 'Mês'], ['ano', 'Ano'], ['tudo', 'Tudo']].map(function (o) {
          var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec' + (escopoGraf === o[0] ? ' fin-escopo-atual' : ''), text: o[1], 'aria-pressed': escopoGraf === o[0] ? 'true' : 'false' });
          b.addEventListener('click', function () { escopoGraf = o[0]; desenhar(); });
          return b;
        });
        raiz.appendChild(el('p', { class: 'fin-escopo-rotulo fin-fixo', text: 'Período dos gráficos' }));
        raiz.appendChild(el('div', { class: 'portal-acoes' }, botoes));
        raiz.appendChild(graficoDivisao());
        raiz.appendChild(graficoMeses());
        raiz.appendChild(graficoRanking('Serviços que mais renderam', 'produto', 'Sem serviço', FdaTema.cor('azul-egipcio-claro')));
        raiz.appendChild(graficoRanking('Clientes que mais geraram entrada', 'cliente_nome', 'Sem cliente', FdaTema.cor('terracota')));
        raiz.appendChild(graficoPizzaClientes());
        raiz.appendChild(graficoRanking('Forma de pagamento', 'forma_pagamento', 'Não informada', FdaTema.cor('ocre')));
        raiz.appendChild(graficoAcumulado());
        if (alturaAntes) { window.scrollTo(0, yRolagem); requestAnimationFrame(function () { raiz.style.minHeight = ''; window.scrollTo(0, yRolagem); }); }
      }
      desenhar();
      return raiz;
    }

    function formEntrada(destino, e) {
      destino.textContent = '';
      var data = el('input', { type: 'date', value: e ? String(e.data).slice(0, 10) : hojeISO() });
      /* Cliente e Serviço (igual ao Financeiro do Astro Hellenic): campo comum onde se digita, apaga e escreve o que quiser; embaixo abre uma lista só de texto
         com o que combina. No Serviço a lista abre já ao tocar no campo; no Cliente, enquanto você digita o nome ou o código. Escrever algo que não está na lista vale. */
      var combo = P.combo; /* a peça comum do portal.js (a mesma da tela de Clientes) */
      var cliente = el('input', { type: 'text', autocomplete: 'off', placeholder: 'Nome ou código', value: e ? (e.cliente_nome || '') : '' });
      var escolhido = e ? e.cliente_id : null;
      cliente.addEventListener('input', function () { escolhido = null; });
      /* clientes e alunos juntos; o campo fica com "código - nome" (como nas entradas antigas). Quem é as duas coisas aparece uma vez só */
      function rotuloPessoa(p) { return p.codigo ? p.codigo + ' - ' + p.nome : p.nome; }
      function pessoas() {
        var lista = clientes.map(function (c) { return { id: c.id, nome: c.nome, codigo: c.codigo, tipo: 'cliente' }; });
        var porNome = {}; lista.forEach(function (p) { porNome[p.nome.toLowerCase()] = p; });
        alunos.forEach(function (a) {
          var igual = porNome[a.nome.toLowerCase()];
          if (igual) { if (!igual.codigo && a.codigo) igual.codigo = a.codigo; return; }
          lista.push({ id: null, nome: a.nome, codigo: a.codigo, tipo: 'aluno' });
        });
        /* quem já recebeu uma entrada sua, mesmo sem cadastro: o nome fica na lista (cliente recorrente não precisa ser digitado toda vez) */
        var conhecidos = lista.map(function (p) { return p.nome.toLowerCase(); });
        var vistos = {};
        todas.forEach(function (en) {
          var n = String(en.cliente_nome || '').trim(), k = n.toLowerCase();
          if (!n || vistos[k]) return;
          vistos[k] = true;
          if (conhecidos.some(function (c) { return k.indexOf(c) >= 0; })) return;
          lista.push({ id: null, nome: n, codigo: '', tipo: 'antigo' });
        });
        return lista.sort(function (x, y) { return x.nome.localeCompare(y.nome, 'pt-BR'); });
      }
      var blocoCliente = combo(cliente, function () {
        return pessoas().map(function (p) {
          return { valor: rotuloPessoa(p), rotulo: (p.codigo ? p.codigo + ' · ' : '') + p.nome + (p.tipo === 'aluno' ? ' (aluno)' : ''), busca: (p.codigo + ' ' + p.nome).toLowerCase(), id: p.id };
        });
      }, function (i) { cliente.value = i.valor; escolhido = i.id; }, false);
      var produto = el('input', { type: 'text', autocomplete: 'off', value: e ? (e.produto || '') : '' });
      var valor = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: e ? String(e.valor).replace('.', ',') : '' });
      var area = el('select');
      area.appendChild(el('option', { value: '', text: 'Sem área' }));
      areas.forEach(function (a) { var o = el('option', { value: a.id, text: a.nome }); if (e && e.area_id === a.id) o.selected = true; area.appendChild(o); });
      /* serviço cadastrado (botão Serviços) ou do site: puxa o valor e a área dele, escolhido na lista ou escrito por inteiro. Valor e área continuam
         editáveis: só são trocados se estiverem vazios ou ainda forem o que o serviço anterior colocou (se você já mexeu, ele não mexe) */
      var valorAuto = '', areaAuto = '';
      function aplicarServico(titulo) {
        var t = String(titulo || '').trim().toLowerCase();
        var sv = todosServicos().filter(function (x) { return x.nome.toLowerCase() === t; })[0];
        if (!sv) return;
        var novoV = sv.valor != null ? String(sv.valor).replace('.', ',') : '';
        if (novoV && (!valor.value.trim() || valor.value === valorAuto)) { valor.value = novoV; valorAuto = novoV; }
        if (sv.area_id && (!area.value || area.value === areaAuto)) { area.value = sv.area_id; areaAuto = sv.area_id; }
      }
      var blocoServico = combo(produto, function () {
        return todosServicos().map(function (x) { return { valor: x.nome, rotulo: x.nome + (x.valor != null ? ' · ' + moeda(x.valor) : ''), busca: x.nome.toLowerCase() }; });
      }, function (i) { produto.value = i.valor; aplicarServico(i.valor); }, true);
      produto.addEventListener('input', function () { aplicarServico(produto.value); });
      produto.addEventListener('change', function () { aplicarServico(produto.value); });
      var forma = el('select');
      forma.appendChild(el('option', { value: '', text: 'Não informada' }));
      FORMAS.forEach(function (f) { var o = el('option', { value: f, text: f }); if (e && e.forma_pagamento === f) o.selected = true; forma.appendChild(o); });
      var obs = el('textarea'); obs.value = e ? (e.observacao || '') : '';
      var msg = el('p', { class: 'portal-msg' });
      var salvar = el('button', { type: 'submit', class: 'portal-btn', text: 'Salvar' });
      var cancelar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Cancelar' });
      cancelar.addEventListener('click', function () { S.aoFechar(); });
      var acoes = [salvar, cancelar];
      if (e) {
        var apagar = P.botaoApagar('Apagar');
        apagar.addEventListener('click', function () {
          if (!window_.confirm('Apagar esta entrada?')) return;
          C.from('fin_entradas').delete().eq('id', e.id).then(function (r) {
            if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
            S.aoMudar();
          });
        });
        acoes.push(apagar);
      }
      var form = el('form', { style: 'margin-top:18px' }, [el('p', { class: 'portal-item-titulo', text: e ? 'Entrada' : 'Nova entrada' })]
        .concat(campo('Data do recebimento', data), [el('label', { text: 'Cliente' })].concat(blocoCliente, [el('label', { text: 'Serviço' })], blocoServico),
          campo('Valor (R$)', valor), campo('Área', area), campo('Forma de pagamento', forma), campo('Observação', obs),
          [msg, el('div', { class: 'portal-acoes' }, acoes)]));
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = lerValor(valor.value);
        if (v == null) { P.mensagem(msg, 'Digite o valor (por exemplo 335,00).', 'erro'); return; }
        if (!data.value) { P.mensagem(msg, 'Escolha a data.', 'erro'); return; }
        var nomeCli = cliente.value.trim();
        var achado = clientes.filter(function (c) { return escolhido ? c.id === escolhido : false; })[0];
        var reg = { data: data.value, cliente_nome: nomeCli || null, cliente_id: achado ? achado.id : null, produto: produto.value.trim() || null,
          valor: v, area_id: area.value || null, forma_pagamento: forma.value || null, observacao: obs.value.trim() || null };
        salvar.disabled = true;
        var req = e ? C.from('fin_entradas').update(reg).eq('id', e.id) : C.from('fin_entradas').insert(reg).select('id');
        req.then(function (r) {
          salvar.disabled = false;
          if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
          if (!e && r.data && r.data[0]) P.avisos.pagamento(r.data[0].id); /* quem pagou recebe o aviso (entrada nova; editar não avisa) */
          var d = reg.data.split('-'); mes = { ano: Number(d[0]), mes: Number(d[1]) - 1 };
          S.aoMudar();
        });
      });
      destino.appendChild(form);
    }

    /* serviços cadastrados por você + os do site que ainda não estão na sua lista (esses só trazem o valor) */
    function todosServicos() {
      var lista = servicosCad.map(function (x) { return { nome: x.nome, valor: x.valor, area_id: x.area_id }; });
      var tem = {}; lista.forEach(function (x) { tem[x.nome.toLowerCase()] = true; });
      var site = window.Carrinho.servicos;
      /* serviço do site que ainda não está na sua lista entra na área Astrologia */
      var astro = areas.filter(function (a) { return /astrolog/i.test(a.nome); })[0];
      Object.keys(site).filter(function (k) { return !/teste/i.test(k); }).forEach(function (k) {
        if (!tem[site[k].titulo.toLowerCase()]) lista.push({ nome: site[k].titulo, valor: site[k].centavos / 100, area_id: astro ? astro.id : null });
      });
      /* a mentoria é um serviço da área Astrologia; não passa pelo carrinho, mas é lançada sempre: nome e valor (R$ 335,00 por mês) sempre iguais, sem digitar */
      if (!tem['acompanhamento prático de astrologia']) { lista.push({ nome: 'Acompanhamento Prático de Astrologia', valor: 335, area_id: astro ? astro.id : null }); }
      return lista;
    }

  /* ---------- PDF do mês e de todos os meses (cópia da tela de antes) ---------- */
    /* ---------- PDF (texto de verdade, A4, fundo branco, no padrão do caderno do aluno) ---------- */
    var COR = { terracota: [160, 62, 37], azul: [31, 95, 163], texto: [22, 35, 63] };
    var A4 = { w: 595.28, h: 841.89 }, M = 56.7, LARGURA = A4.w - 2 * M, LIMITE = A4.h - 70;
    var FONTES = [['Cinzel-Regular.ttf', 'Cinzel', 'normal'], ['Cinzel-Bold.ttf', 'Cinzel', 'bold'], ['Carlito-Regular.ttf', 'Carlito', 'normal'], ['Carlito-Bold.ttf', 'Carlito', 'bold']];
    function carregarScript(url, pronto) {
      if (pronto()) return Promise.resolve();
      return new Promise(function (ok, erro) {
        var sc = document.createElement('script');
        sc.src = url; sc.onload = function () { pronto() ? ok() : erro(new Error('script')); }; sc.onerror = function () { erro(new Error('script')); };
        document.head.appendChild(sc);
      });
    }
    function paraBase64(buf) {
      var b = new Uint8Array(buf), t = '';
      for (var i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(t);
    }
    function baixarFontes() {
      return Promise.all(FONTES.map(function (f) {
        return fetch('fonts/' + f[0]).then(function (r) { if (!r.ok) throw new Error('fonte'); return r.arrayBuffer(); }).then(paraBase64);
      }));
    }

    /* a capa é desenho (papiro), então vira uma imagem; é a mesma folha das outras capas do site (capa.js) */
    function capaComoImagem(subtitulo, nome) {
      var F = window.capaFormato('a4');
      var palco = el('div'); palco.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + F.w + 'px;height:' + F.h + 'px';
      palco.appendChild(window.capaFolha({ titulo: 'Financeiro', subtitulo: subtitulo, nome: nome, tamanho: 'm', powered: false, formato: 'a4' }));
      document.body.appendChild(palco);
      var pronto = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      var imagens = Array.prototype.map.call(palco.querySelectorAll('img'), function (i) { return i.complete ? 1 : new Promise(function (ok) { i.onload = i.onerror = ok; }); });
      return Promise.all([pronto].concat(imagens)).then(function () {
        return document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 48px Cinzel'), document.fonts.load('700 26px Cinzel')]) : null;
      }).then(function () {
        return window.html2canvas(palco.firstChild, { scale: 2, useCORS: true, backgroundColor: null, width: F.w, height: F.h, windowWidth: F.w });
      }).then(function (c) { palco.remove(); return c.toDataURL('image/jpeg', 0.92); }, function (e) { palco.remove(); throw e; });
    }

    function montarPdf(doc, grupos, titulo, sub, totalGeral, capaImg) {
      var y = M, porArea = {}; areas.forEach(function (a) { porArea[a.id] = a; });
      function nova() { doc.addPage(); y = M; }
      function cabe(h) { if (y + h > LIMITE) nova(); }
      function cor(c) { doc.setTextColor(c[0], c[1], c[2]); }
      function soma(lista) { return lista.reduce(function (s, e) { return s + Number(e.valor || 0); }, 0); }
      function subtotais(lista) {
        var t = {}; lista.forEach(function (e) { var k = e.area_id && porArea[e.area_id] ? porArea[e.area_id].nome : 'Sem área'; t[k] = (t[k] || 0) + Number(e.valor || 0); });
        return t;
      }
      function linhaValor(rotulo, valor, o) {
        o = o || {};
        cabe(18); doc.setFont('Carlito', o.negrito ? 'bold' : 'normal'); doc.setFontSize(o.tam || 12); cor(o.cor || COR.texto);
        doc.text(rotulo, M, y + 12); doc.text(valor, M + LARGURA, y + 12, { align: 'right' }); y += 18;
      }
      /* capa (só no PDF de todos os meses): fica fora da contagem, a página 1 é a primeira depois dela */
      if (capaImg) { doc.addImage(capaImg, 'JPEG', 0, 0, A4.w, A4.h); nova(); }
      /* título do documento */
      doc.setFont('Cinzel', 'bold'); doc.setFontSize(22); cor(COR.terracota);
      doc.text(titulo.toUpperCase(), M, y + 18); y += 28;
      doc.setFont('Carlito', 'normal'); doc.setFontSize(13); cor(COR.texto);
      doc.text(sub, M, y + 12); y += 20;
      doc.setDrawColor(COR.azul[0], COR.azul[1], COR.azul[2]); doc.setLineWidth(1.4); doc.line(M, y, M + LARGURA, y); y += 18;

      grupos.forEach(function (g) {
        cabe(110);
        doc.setFont('Cinzel', 'bold'); doc.setFontSize(15); cor(COR.terracota);
        doc.text((MESES[g.mes] + ' ' + g.ano).toUpperCase(), M, y + 14); y += 24;
        linhaValor('Total do mês', moeda(soma(g.lista)), { negrito: true, tam: 13 });
        var st = subtotais(g.lista), total = soma(g.lista);
        Object.keys(st).forEach(function (k) {
          linhaValor(k + ' (' + (total > 0 ? Math.round(st[k] / total * 100) : 0) + '%)', moeda(st[k]), { tam: 11 });
        });
        y += 6;
        g.lista.forEach(function (e) {
          var area = e.area_id && porArea[e.area_id] ? porArea[e.area_id].nome : '';
          var det = [area, [e.produto, e.observacao].filter(Boolean).join(' — '), e.forma_pagamento].filter(Boolean).join(' · ');
          doc.setFont('Carlito', 'bold'); doc.setFontSize(12);
          var nomeL = doc.splitTextToSize(e.cliente_nome || 'Sem cliente', LARGURA - 130);
          doc.setFont('Carlito', 'normal'); doc.setFontSize(10.5);
          var detL = det ? doc.splitTextToSize(det, LARGURA - 130) : [];
          var alt = nomeL.length * 15 + detL.length * 13 + 8;
          cabe(alt);
          doc.setDrawColor(COR.azul[0], COR.azul[1], COR.azul[2]); doc.setLineWidth(0.4); doc.line(M, y, M + LARGURA, y);
          doc.setFont('Carlito', 'normal'); doc.setFontSize(11); cor(COR.texto); doc.text(dataBR(e.data), M, y + 14);
          doc.setFont('Carlito', 'bold'); doc.setFontSize(12);
          nomeL.forEach(function (l, i) { doc.text(l, M + 62, y + 14 + i * 15); });
          doc.setFont('Carlito', 'bold'); doc.text(moeda(e.valor), M + LARGURA, y + 14, { align: 'right' });
          doc.setFont('Carlito', 'normal'); doc.setFontSize(10.5);
          detL.forEach(function (l, i) { doc.text(l, M + 62, y + 14 + nomeL.length * 15 - 2 + i * 13); });
          y += alt;
        });
        y += 22;
      });

      if (totalGeral) {
        cabe(120);
        doc.setDrawColor(COR.azul[0], COR.azul[1], COR.azul[2]); doc.setLineWidth(1.4); doc.line(M, y, M + LARGURA, y); y += 16;
        doc.setFont('Cinzel', 'bold'); doc.setFontSize(15); cor(COR.terracota); doc.text('TOTAL GERAL', M, y + 14); y += 26;
        var todas = []; grupos.forEach(function (g) { todas = todas.concat(g.lista); });
        linhaValor('Todos os meses', moeda(soma(todas)), { negrito: true, tam: 14 });
        var sg = subtotais(todas), tg = soma(todas);
        Object.keys(sg).forEach(function (k) { linhaValor(k + ' (' + (tg > 0 ? Math.round(sg[k] / tg * 100) : 0) + '%)', moeda(sg[k]), { tam: 11 }); });
      }

      /* rodapé em todas as páginas: o nome do site + o número da página */
      var n = doc.getNumberOfPages(), primeira = capaImg ? 2 : 1;
      for (var i = primeira; i <= n; i++) {
        doc.setPage(i); doc.setFont('Carlito', 'normal'); doc.setFontSize(9.5); cor(COR.azul);
        doc.text('Falando de Astrologia Helenística', M, A4.h - 34);
        doc.text(String(i - primeira + 1), M + LARGURA, A4.h - 34, { align: 'right' });
      }
    }

    function gerarPdf(todos, aviso) {
      aviso('Montando o PDF...', 'ok');
      var busca = todos
        ? C.from('fin_entradas').select('*').order('data').order('criado_em').range(0, 9999)
        : Promise.resolve({ data: entradas });
      return busca.then(function (r) {
        if (r.error) throw new Error(r.error.message);
        var lista = r.data || [];
        if (!lista.length) { aviso(todos ? 'Ainda não há nenhuma entrada.' : 'Não há entradas em ' + MESES[mes.mes] + ' de ' + mes.ano + '.', 'erro'); return; }
        var porMes = {}, ordem = [];
        lista.forEach(function (e) {
          var k = String(e.data).slice(0, 7);
          if (!porMes[k]) { porMes[k] = { ano: Number(k.slice(0, 4)), mes: Number(k.slice(5, 7)) - 1, lista: [] }; ordem.push(k); }
          porMes[k].lista.push(e);
        });
        ordem.sort();
        var grupos = ordem.map(function (k) { return porMes[k]; });
        var t0 = grupos[0], t1 = grupos[grupos.length - 1];
        var periodo = grupos.length === 1 ? MESES[t0.mes] + ' de ' + t0.ano
          : t0.ano === t1.ano ? MESES[t0.mes] + ' a ' + MESES[t1.mes] + ' de ' + t0.ano
          : MESES[t0.mes] + ' de ' + t0.ano + ' a ' + MESES[t1.mes] + ' de ' + t1.ano;
        var comCapa = todos;
        return Promise.all([
          carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); }),
          baixarFontes(),
          comCapa ? carregarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function () { return !!window.html2canvas; }) : null,
          comCapa ? carregarScript('capa.js?v=7', function () { return !!window.capaFolha; }) : null
        ]).then(function (x) {
          return (comCapa ? capaComoImagem('Registro de entradas', periodo) : Promise.resolve(null)).then(function (capa) { return [x, capa]; });
        }).then(function (xc) {
          var x = xc[0], capa = xc[1];
          var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
          FONTES.forEach(function (f, i) { doc.addFileToVFS(f[0], x[1][i]); doc.addFont(f[0], f[1], f[2]); });
          var sub = todos ? (grupos.length === 1 ? MESES[t0.mes] + ' ' + t0.ano : MESES[t0.mes] + ' ' + t0.ano + ' a ' + MESES[t1.mes] + ' ' + t1.ano) : MESES[mes.mes] + ' ' + mes.ano;
          montarPdf(doc, grupos, 'Financeiro', sub, todos && grupos.length > 1, capa);
          doc.save(todos ? 'financeiro-todos-os-meses.pdf' : 'financeiro-' + mes.ano + '-' + String(mes.mes + 1).padStart(2, '0') + '.pdf');
          aviso('Pronto! O PDF foi baixado. Procure em Arquivos (Downloads).', 'ok');
        });
      }).catch(function (e) {
        console.error('financeiro pdf:', e);
        aviso('Não foi possível montar o PDF agora. Tente de novo em instantes.', 'erro');
      });
    }

  return {
    gerarPdf: gerarPdf,
    setDados: function (d) { areas = d.areas || []; entradas = d.entradas || []; todas = d.todas || []; servicosCad = d.servicosCad || []; clientes = d.clientes || []; alunos = d.alunos || []; mes = d.mes; if (d.largura) app.clientWidth = d.largura; },
    getMes: function () { return mes; }, montarGraficos: montarGraficos, formEntrada: formEntrada, moeda: moeda, dataBR: dataBR, hojeISO: hojeISO, MESES: MESES
  };
};
