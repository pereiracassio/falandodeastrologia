/* ==========================================
   PONTE DO SEU HELLENIC DAILY COM O ASTRO HELLENIC (11/11/2026) — GAMBIARRA PROVISÓRIA, só do caderno dele
   - Configurações → Conta → "Astro Hellenic": ele entra com e-mail e senha da conta de lá, escolhe QUAL mapa é o dele e a escolha
     (data, hora e lugar de nascimento) fica guardada em site_config.daily_hellenic_mapa. A senha nunca é guardada nem a sessão.
   - O caderno (página do Dia, à esquerda) chama hellenicPonte.ondeEstou(dia) e desenha a lista "onde estou hoje".
   - O cálculo mora SÓ no Astro Hellenic (onde-estou.js): este arquivo carrega os scripts do site dele, não copia conta nenhuma.
   ========================================== */
(function () {
  var P = window.portal, el = P.el, C = P.client;
  var AH_URL = 'https://ndgjenvddkmztmdixjhc.supabase.co', AH_KEY = 'sb_publishable_VTjldgs8Hv1RODaMg7T57Q_ISzbnm5C';
  var BASE = 'https://astrohellenic.com/', CHAVE = 'daily_hellenic_mapa';
  /* os scripts do Astro Hellenic são pedidos com este número: o aparelho nunca fica com uma cópia velha deles (subir o número quando eles mudarem) */
  var VERSAO_MODULO = '20261112a';
  var NOMES = ['Sol', 'Lua', 'Mercúrio', 'Vênus', 'Marte', 'Júpiter', 'Saturno', 'Fortuna', 'Espírito', 'Necessidade', 'Eros', 'Coragem', 'Vitória', 'Nêmesis', 'Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem', 'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes'];
  var PLANETA = { Sun: 'Sol', Moon: 'Lua', Mercury: 'Mercúrio', Venus: 'Vênus', Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno' };
  /* ícones dos aspectos: os mesmos desenhos da Circumambulação do Astro Hellenic (direcoes.js, getAspectSymbolSVGDir), nas cores dos aspectos do papiro */
  var ASPECTO_SVG = {
    conj: '<circle cx="8" cy="12" r="5" fill="none" stroke="#1A1410" stroke-width="2.2"/><line x1="12" y1="8" x2="18" y2="2" stroke="#1A1410" stroke-width="2.2" stroke-linecap="round"/>',
    sex: '<path d="M10 2v16M3 6l14 8M3 14L17 6" stroke="#1F5FA3" stroke-width="2.5" stroke-linecap="round"/>',
    squ: '<rect x="3" y="3" width="14" height="14" fill="none" stroke="#A03E25" stroke-width="2.5"/>',
    tri: '<polygon points="10,2 19,17 1,17" fill="none" stroke="#1034A6" stroke-width="2.5"/>',
    opp: '<circle cx="5" cy="10" r="4" fill="none" stroke="#D0610F" stroke-width="2.2"/><line x1="9" y1="10" x2="15" y2="10" stroke="#D0610F" stroke-width="2.2"/><circle cx="19" cy="10" r="4" fill="none" stroke="#D0610F" stroke-width="2.2"/>'
  };
  var ASPECTO = { conj: 'conjunção', sex: 'sextil', squ: 'quadratura', tri: 'trígono', opp: 'oposição' }; /* só como dica ao tocar */
  function aspectoIcone(t) {
    var e = el('span', { class: 'oe-as', title: ASPECTO[t] || '' });
    e.innerHTML = '<svg width="' + (t === 'opp' ? 28 : 22) + '" height="22" viewBox="' + (t === 'opp' ? '0 0 24 20' : '0 0 20 20') + '" style="vertical-align:-3px">' + (ASPECTO_SVG[t] || '') + '</svg>';
    return e;
  }
  var escolhido; /* undefined = ainda não leu; null = sem mapa escolhido */
  /* ordem das técnicas no diário (escolha dele, guardada em site_config.daily_diario_ordem, vale em qualquer aparelho) */
  var TECNICAS = [['circumambulacao', 'Circumambulação'], ['liberacao_fortune', 'Liberação da Fortuna'], ['liberacao_spirit', 'Liberação do Espírito'], ['liberacao_venus', 'Liberação de Eros'], ['decenios', 'Decênios'], ['profeccao', 'Profecção']];
  var ordemSalva; /* undefined = ainda não leu */
  function ordemValida(v) {
    var ids = TECNICAS.map(function (t) { return t[0]; });
    var legado = []; /* ordem salva antes de separar os lotes: 'liberacao' vira Fortuna, Espírito e Eros, no mesmo lugar */
    (Array.isArray(v) ? v : []).forEach(function (x) { if (x === 'liberacao') legado.push('liberacao_fortune', 'liberacao_spirit', 'liberacao_venus'); else legado.push(x); });
    var r = legado.filter(function (x, i, a) { return ids.indexOf(x) >= 0 && a.indexOf(x) === i; });
    ids.forEach(function (x) { if (r.indexOf(x) < 0) r.push(x); }); /* técnica nova entra no fim */
    return r;
  }
  function lerOrdem(frescor) { /* o diário (no caderno) e as Configurações (em outra janela) são páginas separadas: o diário lê a ordem de novo a cada vez, senão ficava com a antiga */
    if (ordemSalva !== undefined && !frescor) return Promise.resolve(ordemSalva);
    return C.from('site_config').select('valor').eq('chave', 'daily_diario_ordem').maybeSingle().then(function (r) {
      var v = null; try { v = r.data && r.data.valor ? JSON.parse(r.data.valor) : null; } catch (e) { v = null; }
      ordemSalva = ordemValida(v); return ordemSalva;
    }, function () { ordemSalva = ordemValida(null); return ordemSalva; });
  }

  function icone(nome) { var i = NOMES.indexOf(nome); return i < 0 ? '' : String.fromCharCode(0xE000 + i); }
  function signo(i) { return NOMES[14 + i]; }
  /* cor do signo = a do elemento, igual ao Astro Hellenic (paleta de época: fogo laranja, terra marrom, ar cinza, água azul), i % 4 */
  var COR_ELEMENTO = ['#D0610F', '#6B4A2B', '#6B7780', '#1F5FA3'];
  function sig(i) { var e = el('span', { class: 'oe-sg', style: 'color:' + COR_ELEMENTO[i % 4] }); e.appendChild(el('span', { class: 'oe-ic', style: 'color:inherit', text: icone(signo(i)) })); e.title = signo(i); return e; }
  function ler() {
    if (escolhido !== undefined) return Promise.resolve(escolhido);
    return C.from('site_config').select('valor').eq('chave', CHAVE).maybeSingle().then(function (r) {
      try { escolhido = r.data && r.data.valor ? JSON.parse(r.data.valor) : null; } catch (e) { escolhido = null; }
      return escolhido;
    });
  }

  /* os scripts do Astro Hellenic, um depois do outro (um precisa do anterior) */
  var carregados;
  function carregarScripts() {
    if (carregados) return carregados;
    /* os quatro de uma vez (não um depois do outro): nenhum precisa do outro para ser carregado, só na hora de calcular */
    carregados = Promise.all(['tz-lookup.js', 'camadas-tempo.js', 'retificacao-calculos.js', 'onde-estou.js'].map(function (arq) {
      return new Promise(function (ok, erro) {
        var s = document.createElement('script'); s.src = BASE + arq + '?v=' + VERSAO_MODULO; s.onload = ok;
        s.onerror = function () { erro(new Error('Não consegui carregar ' + arq + ' do Astro Hellenic.')); };
        document.head.appendChild(s);
      });
    }));
    carregados.catch(function () { carregados = null; });
    return carregados;
  }

  /* ---------- a lista para um dia ('AAAA-MM-DD') ---------- */
  function ondeEstou(diaIso) {
    return Promise.all([ler(), lerOrdem(true)]).then(function (x) {
      var m = x[0], ordem = x[1];
      if (!m) return { semMapa: true };
      return carregarScripts().then(function () {
        var hoje = new Date(), a = diaIso.split('-'), agora = new Date(+a[0], +a[1] - 1, +a[2], 12, 0);
        if (hoje.getFullYear() === agora.getFullYear() && hoje.getMonth() === agora.getMonth() && hoje.getDate() === agora.getDate()) agora = hoje;
        return window.ondeEstouHoje(m.nasc, agora).then(function (r) { r.nome = m.nome; r.agora = agora; r.ordem = ordem; r.dia = diaIso; return r; });
      });
    });
  }

  /* ícones das técnicas: os MESMOS da barra de cima do Astro Hellenic (index.html, botões das ferramentas), desenho em grade 64 */
  var ICONES_TEC = {"circumambulacao": {"sw": "3", "inner": "<path d=\"M 32 8 A 24 24 0 1 1 10 24\"/> <polyline points=\"18,16 10,24 6,14\"/> <circle cx=\"32\" cy=\"32\" r=\"3\" fill=\"currentColor\" stroke=\"none\"/>"}, "liberacao": {"sw": "4", "inner": "<rect x=\"14\" y=\"28\" width=\"36\" height=\"28\" rx=\"5\"/> <path d=\"M22,28 V18 A12,12 0 0 1 44,10\"/> <circle cx=\"32\" cy=\"40\" r=\"3\" fill=\"currentColor\" stroke=\"none\"/> <line x1=\"32\" y1=\"43\" x2=\"32\" y2=\"49\"/>"}, "decenios": {"sw": "3", "inner": "<path d=\"M14,6 H50 M14,58 H50\"/> <path d=\"M16,6 C16,24 48,24 48,6\"/> <path d=\"M16,58 C16,40 48,40 48,58\"/> <path d=\"M28,26 L36,26 L32,32 Z\" fill=\"currentColor\" stroke=\"none\"/>"}, "profeccao": {"sw": "3", "inner": "<circle cx=\"32\" cy=\"32\" r=\"26\"/> <line x1=\"32\" y1=\"6\" x2=\"32\" y2=\"58\"/> <line x1=\"6\" y1=\"32\" x2=\"58\" y2=\"32\"/> <line x1=\"14\" y1=\"14\" x2=\"50\" y2=\"50\"/> <line x1=\"50\" y1=\"14\" x2=\"14\" y2=\"50\"/> <path d=\"M32,32 L48,20\" stroke-width=\"3.5\"/> <polyline points=\"42,18 48,20 46,26\" stroke-width=\"3.5\"/>"}};
  var NOME_TEC = { circumambulacao: 'Circumambulação', liberacao_fortune: 'Liberação da Fortuna', liberacao_spirit: 'Liberação do Espírito', liberacao_venus: 'Liberação de Eros', decenios: 'Decênios', profeccao: 'Profecção' };
  var LOTE_TEC = { liberacao_fortune: 'Fortuna', liberacao_spirit: 'Espírito', liberacao_venus: 'Eros' };
  /* o ícone da técnica (e, na Liberação, o do lote logo depois) */
  function iconeTecnica(id, tam) {
    var base = id.indexOf('liberacao') === 0 ? 'liberacao' : id, d = ICONES_TEC[base], e = el('span', { class: 'oe-tec', title: NOME_TEC[id] || '' });
    if (d) { var sv = el('span'); sv.innerHTML = '<svg width="' + (tam || 22) + '" height="' + (tam || 22) + '" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="' + d.sw + '" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px">' + d.inner + '</svg>'; e.appendChild(sv); }
    if (LOTE_TEC[id]) e.appendChild(el('span', { class: 'oe-ic', style: 'margin-left:4px', text: icone(LOTE_TEC[id]) }));
    return e;
  }
  /* anotações do diário: tabela diario_notas (várias por dia e técnica, cada uma com a hora), no Supabase do Falando de Astrologia */
  function notasDoDia(iso) {
    return C.from('diario_notas').select('*').eq('dia', iso).order('hora').order('criado_em').then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  /* idNota vazio = anotação nova; texto vazio apaga a anotação que já existia (e não cria nada se era nova) */
  function salvarNota(iso, tecnica, texto, hora, idNota, posicao) {
    var t = String(texto || '').trim();
    if (!t) return idNota ? C.from('diario_notas').delete().eq('id', idNota).then(function (r) { if (r.error) throw r.error; }) : Promise.resolve();
    var dados = { texto: t, hora: hora || null, atualizado_em: new Date().toISOString() };
    if (posicao) dados.posicao = posicao; /* onde a técnica estava no dia e na hora da anotação */
    if (idNota) return C.from('diario_notas').update(dados).eq('id', idNota).then(function (r) { if (r.error) throw r.error; });
    dados.dia = iso; dados.tecnica = tecnica;
    return C.from('diario_notas').insert(dados).then(function (r) { if (r.error) throw r.error; });
  }
  function apagarNota(idNota) { return C.from('diario_notas').delete().eq('id', idNota).then(function (r) { if (r.error) throw r.error; }); }

  /* ---------- onde a técnica estava NO MOMENTO da anotação (guardado junto com ela) ---------- */
  function posicaoEm(iso, hhmm, tecId) {
    return ler().then(function (m) {
      if (!m) return null;
      return carregarScripts().then(function () {
        var a = iso.split('-'), h = String(hhmm || '12:00').split(':'), quando = new Date(+a[0], +a[1] - 1, +a[2], +h[0] || 0, +h[1] || 0);
        return window.ondeEstouHoje(m.nasc, quando).then(function (r) { return extrairPosicao(r, tecId); });
      });
    }, function () { return null; });
  }
  function extrairPosicao(r, tecId) {
    var ns = r.planetasNaSeita || {};
    if (tecId.indexOf('liberacao_') === 0) { var niv = r.liberacao[tecId.slice(10)]; return niv ? { k: 'lib', s: niv.filter(Boolean).map(function (n) { return n.signIdx; }) } : null; }
    if (tecId === 'decenios') return r.decenios ? { k: 'dec', p: r.decenios.map(function (n) { return n.planetId; }), ns: r.decenios.map(function (n) { return !!ns[n.planetId]; }) } : null;
    if (tecId === 'profeccao') { var pf = r.profeccao; return { k: 'prof', s: [pf.ano.signIdx, pf.mes ? pf.mes.signIdx : null, pf.passo ? pf.passo.signIdx : null] }; }
    if (tecId === 'circumambulacao') { var c = r.circumambulacao; return { k: 'circ', ts: c.termo ? c.termo.signIdx : null, tp: c.termo ? c.termo.planetId : null, tn: c.termo ? !!ns[c.termo.planetId] : false, at: c.aspecto ? c.aspecto.tipo : null, ap: c.aspecto ? c.aspecto.planetId : null, an: c.aspecto ? !!ns[c.aspecto.planetId] : false }; }
    return null;
  }
  function gpCor(id, naSeita) { var e = glifo(PLANETA[id]); e.style.color = naSeita ? '#A03E25' : '#1F5FA3'; return e; }
  /* a linha da posição: "N1 ♑ N2 ♒ N3 ♈ N4 ♉" (Liberação), "N1 ☽ N2 ♂ N3 ♄" (Decênios), "Ano ♒ Mês ♓ 60h ♈" (Profecção), "Termo ♓ ♃ Aspecto △ ♃" (Circumambulação) */
  function posicaoEl(p) {
    if (!p || !p.k) return null;
    var w = el('span', { class: 'nota-pos' });
    function par(rot, filho) { w.appendChild(el('span', { class: 'np-r', text: rot })); w.appendChild(filho); }
    if (p.k === 'lib') (p.s || []).forEach(function (s, i) { par('N' + (i + 1), sig(s)); });
    else if (p.k === 'dec') (p.p || []).forEach(function (id, i) { par('N' + (i + 1), gpCor(id, p.ns && p.ns[i])); });
    else if (p.k === 'prof') { par('Ano', sig(p.s[0])); if (p.s[1] != null) par('Mês', sig(p.s[1])); if (p.s[2] != null) par('60h', sig(p.s[2])); }
    else if (p.k === 'circ') {
      if (p.ts != null) { var t = el('span'); t.appendChild(sig(p.ts)); t.appendChild(document.createTextNode(' ')); t.appendChild(gpCor(p.tp, p.tn)); par('Termo', t); }
      if (p.at) { var a = el('span'); a.appendChild(aspectoIcone(p.at)); a.appendChild(document.createTextNode(' ')); a.appendChild(gpCor(p.ap, p.an)); par('Aspecto', a); }
    }
    return w;
  }

  /* ---------- desenho da lista (página da esquerda do Dia) ---------- */
  /* planeta: na seita do mapa = terracota, fora da seita = azul egípcio (como no Astro Hellenic) */
  var seitaAtual = null;
  function gp(id) {
    var e = glifo(PLANETA[id]);
    if (seitaAtual && seitaAtual[id] !== undefined) e.style.color = seitaAtual[id] ? '#A03E25' : '#1F5FA3';
    return e;
  }
  function glifo(nome) { return el('span', { class: 'oe-ic', text: icone(nome) }); }
  var agoraLista = new Date();
  function dd(n) { return String(n).padStart(2, '0'); }
  /* barra do período: a MESMA barra de tempo do resto do site (P.barraTempoDias: "62% [barra] 12/23 dias"); as datas de início e fim ficam embaixo.
     Período curto (60 horas, nível 4 da Liberação) leva só dia/mês e a hora, sem o ano. */
  function dm(d) { return dd(d.getDate()) + '/' + dd(d.getMonth() + 1); }
  function textoDatas(de, ate) {
    var curto = (ate - de) <= 7 * 86400000, hm = function (d) { return dd(d.getHours()) + ':' + dd(d.getMinutes()); };
    return curto ? dm(de) + ' ' + hm(de) + ' – ' + dm(ate) + ' ' + hm(ate) : dm(de) + '/' + de.getFullYear() + ' – ' + dm(ate) + '/' + ate.getFullYear();
  }
  function linha(rotulo, partes, periodo, unidade) {
    var v = el('span', { class: 'oe-v' });
    partes.forEach(function (p) { if (typeof p === 'string') v.appendChild(document.createTextNode(p)); else v.appendChild(p); });
    var tem = periodo && periodo.de && periodo.ate, topo = [el('span', { class: 'oe-r rotulo-fixo', text: rotulo }), v];
    var de = tem ? new Date(periodo.de) : null, ate = tem ? new Date(periodo.ate) : null;
    if (tem) topo.push(el('span', { class: 'oe-datas', text: textoDatas(de, ate) }));
    var l = el('div', { class: 'oe-l' + (tem ? ' oe-com-barra' : '') }, [el('div', { class: 'oe-topo' }, topo)]);
    /* a MESMA barra de tempo das ferramentas do Astro Hellenic (camadas-tempo.js: "62% [barra] 11/20 meses"), na unidade de cada nível */
    if (tem && typeof barraTempo === 'function') { var w = el('div'); w.innerHTML = barraTempo(de, ate, 'margin:3px 0 0;', 13, unidade, agoraLista); l.appendChild(w); }
    return l;
  }
  function grupo(titulo, linhas, iconeNome) {
    var t = el('div', { class: 'rotulo-fixo', text: titulo });
    if (iconeNome) { t.appendChild(document.createTextNode(' ')); t.appendChild(el('span', { class: 'oe-ic', text: icone(iconeNome) })); }
    var g = el('div', { class: 'oe-g' }, [t]);
    linhas.forEach(function (l) { g.appendChild(l); });
    return g;
  }
  function desenhar(alvo, r, aoTocar) {
    alvo.textContent = ''; seitaAtual = r.planetasNaSeita || null; agoraLista = r.agora || new Date();
    if (r.semMapa) { alvo.appendChild(el('p', { class: 'vazio', text: 'Escolha o seu mapa em Configurações → Conta.' })); return; }
    var blocos = {}, circ = r.circumambulacao, ls = [];
    if (circ.aspecto) ls.push(linha('Aspecto', [aspectoIcone(circ.aspecto.tipo), '  ', gp(circ.aspecto.planetId)], circ.aspecto, 'anosCivis'));
    if (circ.termo) ls.push(linha('Termo', [sig(circ.termo.signIdx), '  ', gp(circ.termo.planetId)], circ.termo, 'anosCivis'));
    blocos.circumambulacao = [grupo('Circumambulação', ls.length ? ls : [linha('', ['Fora dos 12 signos'])])];
    [['fortune', 'Fortuna'], ['spirit', 'Espírito'], ['venus', 'Eros']].forEach(function (x) {
      var niv = r.liberacao[x[0]];
      blocos['liberacao_' + x[0]] = [grupo('Liberação', niv ? niv.filter(Boolean).map(function (n) { return linha('Nível ' + n.nivel, [sig(n.signIdx)], n, ['anos', 'meses', 'dias', 'horas'][n.nivel - 1]); }) : [linha('', ['Fora do período'])], x[1])];
    });
    blocos.decenios = [grupo('Decênios', r.decenios ? r.decenios.map(function (n) { return linha('Nível ' + n.nivel, [gp(n.planetId)], n, ['meses', 'meses', 'dias'][n.nivel - 1]); }) : [linha('', ['Fora do período'])])];
    var pf = r.profeccao, pl = [linha('Ano', [sig(pf.ano.signIdx)], pf.ano, 'meses')];
    if (pf.mes) pl.push(linha('Mês', [sig(pf.mes.signIdx)], pf.mes, 'dias'));
    if (pf.passo) pl.push(linha('60 horas', [sig(pf.passo.signIdx)], pf.passo, 'horas'));
    blocos.profeccao = [grupo('Profecção', pl)];
    ordemValida(r.ordem).forEach(function (id) {
      blocos[id].forEach(function (g) {
        var tit = g.firstChild; /* o ícone da técnica ANTES do nome, na ordem em que se lê: [ícone] Profecção */
        tit.insertBefore(document.createTextNode(' '), tit.firstChild); tit.insertBefore(iconeTecnica(id.indexOf('liberacao') === 0 ? 'liberacao' : id, 20), tit.firstChild);
        if (aoTocar) { var t = g.firstChild; t.style.cursor = 'pointer'; t.setAttribute('role', 'button'); t.addEventListener('click', function () { aoTocar(id); }); } /* tocar no título da técnica abre a anotação dela */
        alvo.appendChild(g);
      });
    });
  }

  /* ---------- cartão em Configurações → Personalização: a ordem das técnicas no diário ---------- */
  function cartaoOrdem() {
    var cx = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Ordem do diário' })]), lista = el('div'), msg = el('p', { class: 'portal-msg' });
    cx.appendChild(lista); cx.appendChild(msg);
    function desenharLista() {
      lista.textContent = '';
      var ordem = ordemSalva || ordemValida(null);
      ordem.forEach(function (id, i) {
        var nome = TECNICAS.filter(function (t) { return t[0] === id; })[0][1];
        var sobe = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '↑', 'aria-label': 'Subir' }), desce = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '↓', 'aria-label': 'Descer' });
        sobe.disabled = i === 0; desce.disabled = i === ordem.length - 1;
        sobe.addEventListener('click', function () { mover(i, -1); }); desce.addEventListener('click', function () { mover(i, 1); });
        lista.appendChild(el('div', { style: 'display:flex;align-items:center;gap:14px;padding:6px 0' }, [el('span', { class: 'portal-item-titulo', style: 'flex:1', text: nome }), sobe, desce]));
      });
    }
    function mover(i, d) {
      var o = (ordemSalva || ordemValida(null)).slice(), j = i + d; if (j < 0 || j >= o.length) return;
      var t = o[i]; o[i] = o[j]; o[j] = t; ordemSalva = o; desenharLista();
      C.from('site_config').upsert({ chave: 'daily_diario_ordem', valor: JSON.stringify(o), atualizado_em: new Date().toISOString() }, { onConflict: 'chave' }).then(function (g) {
        if (g.error) P.mensagem(msg, 'Não guardou (' + P.traduzErro(g.error.message) + ').', 'erro'); else P.mensagem(msg, '');
      });
    }
    desenharLista(); lerOrdem().then(desenharLista);
    return cx;
  }

  /* ---------- cartão de Configurações → Conta: entrar no Astro Hellenic e escolher o mapa ---------- */
  function cartao() {
    var cx = el('div', { class: 'portal-cartao' }), corpo = el('div'), msg = el('p', { class: 'portal-msg' });
    cx.appendChild(el('h2', { text: 'Astro Hellenic' })); cx.appendChild(corpo); cx.appendChild(msg);

    function mostrarAtual() {
      corpo.textContent = '';
      ler().then(function (m) {
        if (m) corpo.appendChild(el('p', { class: 'oe-atual', text: m.nome + ' · ' + m.texto }));
        var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: m ? 'Trocar o mapa' : 'Conectar e escolher o meu mapa' });
        b.addEventListener('click', entrar);
        corpo.appendChild(b);
      });
    }
    function entrar() {
      corpo.textContent = ''; P.mensagem(msg, '');
      var email = el('input', { type: 'email', placeholder: 'E-mail do Astro Hellenic', autocomplete: 'off' });
      var senha = el('input', { type: 'password', placeholder: 'Senha do Astro Hellenic', autocomplete: 'off' });
      var ok = el('button', { type: 'button', class: 'portal-btn', text: 'Entrar' });
      var nao = el('button', { type: 'button', class: 'portal-apagar', text: 'Cancelar' });
      nao.addEventListener('click', mostrarAtual);
      ok.addEventListener('click', function () {
        if (!email.value.trim() || !senha.value) return; ok.disabled = true; P.mensagem(msg, 'Entrando...');
        var ah = window.supabase.createClient(AH_URL, AH_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'ah-ponte' } });
        ah.auth.signInWithPassword({ email: email.value.trim(), password: senha.value }).then(function (r) {
          if (r.error) { ok.disabled = false; P.mensagem(msg, 'E-mail ou senha do Astro Hellenic não conferem.', 'erro'); return; }
          senha.value = ''; escolherMapa(ah);
        }, function () { ok.disabled = false; P.mensagem(msg, 'Não consegui falar com o Astro Hellenic.', 'erro'); });
      });
      corpo.appendChild(email); corpo.appendChild(senha);
      corpo.appendChild(el('div', { style: 'display:flex;gap:16px;align-items:center;margin-top:12px' }, [ok, nao]));
    }
    function escolherMapa(ah) {
      corpo.textContent = ''; P.mensagem(msg, 'Buscando as suas pastas...');
      ah.from('mapas').select('id,nome,tipo,pasta,codigo,data_nascimento,hora_nascimento,latitude,longitude,cidade').limit(5000).then(function (r) {
        if (r.error) { P.mensagem(msg, 'Não consegui ler os mapas (' + P.traduzErro(r.error.message) + ').', 'erro'); return; }
        P.mensagem(msg, '');
        var porPasta = {};
        (r.data || []).forEach(function (m) { var p = m.pasta || 'Sem pasta'; (porPasta[p] = porPasta[p] || []).push(m); });
        var nomes = Object.keys(porPasta).sort(function (x, y) { return x.localeCompare(y, 'pt-BR', { numeric: true }); });
        function voltarBtn(aoClicar) { var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', style: 'color:var(--terracota)', text: '← Voltar' }); b.addEventListener('click', aoClicar); return b; }
        function linhaLista(texto, aoClicar) {
          var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', style: 'display:block;width:100%;text-align:left;margin:0;padding:12px 0;font-size:16px', text: texto });
          b.addEventListener('click', aoClicar); return b;
        }
        function mostrarPastas() {
          corpo.textContent = '';
          corpo.appendChild(el('p', { class: 'rotulo-fixo', text: 'Pastas' }));
          nomes.forEach(function (n) { corpo.appendChild(linhaLista(n + ' · ' + porPasta[n].length, function () { mostrarMapas(n); })); });
          if (!nomes.length) corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhuma pasta.' }));
        }
        function mostrarMapas(pasta) {
          corpo.textContent = '';
          corpo.appendChild(voltarBtn(mostrarPastas));
          corpo.appendChild(el('p', { class: 'rotulo-fixo', style: 'margin-top:10px', text: pasta }));
          porPasta[pasta].slice().sort(function (x, y) { return String(x.codigo || '').localeCompare(String(y.codigo || ''), 'pt-BR', { numeric: true }) || String(x.nome || '').localeCompare(String(y.nome || ''), 'pt-BR'); }).forEach(function (m) {
            corpo.appendChild(linhaLista((m.codigo ? m.codigo + ' - ' : '') + m.nome + ' · ' + (m.data_nascimento || ''), function () { guardar(ah, m); }));
          });
          corpo.appendChild(el('div', { style: 'margin-top:14px' }, [voltarBtn(mostrarPastas)]));
        }
        mostrarPastas();
      });
    }
    function guardar(ah, m) {
      var d = String(m.data_nascimento || '').split('/'), h = String(m.hora_nascimento || '12:00').split(':');
      if (d.length !== 3 || m.latitude == null || m.longitude == null) { P.mensagem(msg, 'Esse mapa não tem data ou lugar completos.', 'erro'); return; }
      var nasc = { ano: +d[2], mes: +d[1], dia: +d[0], hora: +h[0] || 0, min: +h[1] || 0, lat: +m.latitude, lon: +m.longitude };
      var valor = { nome: m.nome, texto: m.data_nascimento + (m.hora_nascimento ? ' às ' + m.hora_nascimento : '') + (m.cidade ? ' · ' + m.cidade : ''), nasc: nasc };
      P.mensagem(msg, 'Guardando...');
      C.from('site_config').upsert({ chave: CHAVE, valor: JSON.stringify(valor), atualizado_em: new Date().toISOString() }, { onConflict: 'chave' }).then(function (g) {
        if (g.error) { P.mensagem(msg, 'Não guardou (' + P.traduzErro(g.error.message) + ').', 'erro'); return; }
        escolhido = valor; ah.auth.signOut(); P.mensagem(msg, 'Mapa guardado.', 'ok'); mostrarAtual();
      });
    }
    mostrarAtual();
    return cx;
  }

  window.hellenicPonte = { cartao: cartao, cartaoOrdem: cartaoOrdem, ondeEstou: ondeEstou, desenhar: desenhar, notasDoDia: notasDoDia, salvarNota: salvarNota, apagarNota: apagarNota, iconeTecnica: iconeTecnica, posicaoEm: posicaoEm, posicaoEl: posicaoEl, nomeTecnica: function (id) { return NOME_TEC[id] || id; } };
})();
