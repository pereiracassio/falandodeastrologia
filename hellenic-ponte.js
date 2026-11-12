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
  var TECNICAS = [['circumambulacao', 'Circumambulação'], ['liberacao', 'Liberação'], ['decenios', 'Decênios'], ['profeccao', 'Profecção']];
  var ordemSalva; /* undefined = ainda não leu */
  function ordemValida(v) {
    var ids = TECNICAS.map(function (t) { return t[0]; });
    var r = (Array.isArray(v) ? v : []).filter(function (x, i, a) { return ids.indexOf(x) >= 0 && a.indexOf(x) === i; });
    ids.forEach(function (x) { if (r.indexOf(x) < 0) r.push(x); }); /* técnica nova entra no fim */
    return r;
  }
  function lerOrdem() {
    if (ordemSalva !== undefined) return Promise.resolve(ordemSalva);
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
    carregados = ['tz-lookup.js', 'camadas-tempo.js', 'retificacao-calculos.js', 'onde-estou.js'].reduce(function (p, arq) {
      return p.then(function () {
        return new Promise(function (ok, erro) {
          var s = document.createElement('script'); s.src = BASE + arq; s.onload = ok;
          s.onerror = function () { erro(new Error('Não consegui carregar ' + arq + ' do Astro Hellenic.')); };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    carregados.catch(function () { carregados = null; });
    return carregados;
  }

  /* ---------- a lista para um dia ('AAAA-MM-DD') ---------- */
  function ondeEstou(diaIso) {
    return Promise.all([ler(), lerOrdem()]).then(function (x) {
      var m = x[0], ordem = x[1];
      if (!m) return { semMapa: true };
      return carregarScripts().then(function () {
        var hoje = new Date(), a = diaIso.split('-'), agora = new Date(+a[0], +a[1] - 1, +a[2], 12, 0);
        if (hoje.getFullYear() === agora.getFullYear() && hoje.getMonth() === agora.getMonth() && hoje.getDate() === agora.getDate()) agora = hoje;
        return window.ondeEstouHoje(m.nasc, agora).then(function (r) { r.nome = m.nome; r.agora = agora; r.ordem = ordem; return r; });
      });
    });
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
    var tem = periodo && periodo.de && periodo.ate, topo = [el('span', { class: 'oe-r', text: rotulo }), v];
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
  function desenhar(alvo, r) {
    alvo.textContent = ''; seitaAtual = r.planetasNaSeita || null; agoraLista = r.agora || new Date();
    if (r.semMapa) { alvo.appendChild(el('p', { class: 'vazio', text: 'Escolha o seu mapa em Configurações → Conta.' })); return; }
    var blocos = {}, circ = r.circumambulacao, ls = [];
    if (circ.aspecto) ls.push(linha('Aspecto', [aspectoIcone(circ.aspecto.tipo), '  ', gp(circ.aspecto.planetId)], circ.aspecto, 'anosCivis'));
    if (circ.termo) ls.push(linha('Termo', [sig(circ.termo.signIdx), '  ', gp(circ.termo.planetId)], circ.termo, 'anosCivis'));
    blocos.circumambulacao = [grupo('Circumambulação', ls.length ? ls : [linha('', ['Fora dos 12 signos'])])];
    blocos.liberacao = [['fortune', 'Fortuna'], ['spirit', 'Espírito'], ['venus', 'Eros']].map(function (x) {
      var niv = r.liberacao[x[0]];
      return grupo('Liberação', niv ? niv.filter(Boolean).map(function (n) { return linha('Nível ' + n.nivel, [sig(n.signIdx)], n, ['anos', 'meses', 'dias', 'horas'][n.nivel - 1]); }) : [linha('', ['Fora do período'])], x[1]);
    });
    blocos.decenios = [grupo('Decênios', r.decenios ? r.decenios.map(function (n) { return linha('Nível ' + n.nivel, [gp(n.planetId)], n, ['meses', 'meses', 'dias'][n.nivel - 1]); }) : [linha('', ['Fora do período'])])];
    var pf = r.profeccao, pl = [linha('Ano', [sig(pf.ano.signIdx)], pf.ano, 'meses')];
    if (pf.mes) pl.push(linha('Mês', [sig(pf.mes.signIdx)], pf.mes, 'dias'));
    if (pf.passo) pl.push(linha('60 horas', [sig(pf.passo.signIdx)], pf.passo, 'horas'));
    blocos.profeccao = [grupo('Profecção', pl)];
    ordemValida(r.ordem).forEach(function (id) { blocos[id].forEach(function (g) { alvo.appendChild(g); }); });
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

  window.hellenicPonte = { cartao: cartao, cartaoOrdem: cartaoOrdem, ondeEstou: ondeEstou, desenhar: desenhar };
})();
