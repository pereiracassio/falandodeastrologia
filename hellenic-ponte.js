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
  var ASPECTO = { conj: 'conjunção', sex: 'sextil', squ: 'quadratura', tri: 'trígono', opp: 'oposição' };
  var escolhido; /* undefined = ainda não leu; null = sem mapa escolhido */

  function icone(nome) { var i = NOMES.indexOf(nome); return i < 0 ? '' : String.fromCharCode(0xE000 + i); }
  function signo(i) { return NOMES[14 + i]; }
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
    carregados = ['tz-lookup.js', 'retificacao-calculos.js', 'onde-estou.js'].reduce(function (p, arq) {
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
    return ler().then(function (m) {
      if (!m) return { semMapa: true };
      return carregarScripts().then(function () {
        var hoje = new Date(), a = diaIso.split('-'), agora = new Date(+a[0], +a[1] - 1, +a[2], 12, 0);
        if (hoje.getFullYear() === agora.getFullYear() && hoje.getMonth() === agora.getMonth() && hoje.getDate() === agora.getDate()) agora = hoje;
        return window.ondeEstouHoje(m.nasc, agora).then(function (r) { r.nome = m.nome; return r; });
      });
    });
  }

  /* ---------- desenho da lista (página da esquerda do Dia) ---------- */
  function glifo(nome) { return el('span', { class: 'oe-ic', text: icone(nome) }); }
  function linha(rotulo, partes) {
    var v = el('span', { class: 'oe-v' });
    partes.forEach(function (p) { if (typeof p === 'string') v.appendChild(document.createTextNode(p)); else v.appendChild(p); });
    return el('div', { class: 'oe-l' }, [el('span', { class: 'oe-r', text: rotulo }), v]);
  }
  function grupo(titulo, linhas) {
    var g = el('div', { class: 'oe-g' }, [el('div', { class: 'rotulo-fixo', text: titulo })]);
    linhas.forEach(function (l) { g.appendChild(l); });
    return g;
  }
  function desenhar(alvo, r) {
    alvo.textContent = '';
    if (r.semMapa) { alvo.appendChild(el('p', { class: 'vazio', text: 'Escolha o seu mapa em Configurações → Conta.' })); return; }
    var circ = r.circumambulacao, ls = [];
    if (circ.termo) ls.push(linha('Termo', [glifo(PLANETA[circ.termo.planetId]), ' ' + PLANETA[circ.termo.planetId] + ' em ', glifo(signo(circ.termo.signIdx)), ' ' + signo(circ.termo.signIdx)]));
    if (circ.aspecto) ls.push(linha('Aspecto', [ASPECTO[circ.aspecto.tipo] + ' com ', glifo(PLANETA[circ.aspecto.planetId]), ' ' + PLANETA[circ.aspecto.planetId]]));
    alvo.appendChild(grupo('Circumambulação', ls.length ? ls : [linha('', ['Fora dos 12 signos'])]));
    [['fortune', 'Fortuna'], ['spirit', 'Espírito'], ['venus', 'Eros']].forEach(function (x) {
      var niv = r.liberacao[x[0]];
      alvo.appendChild(grupo('Liberação · ' + x[1], niv ? niv.filter(Boolean).map(function (n) { return linha('Nível ' + n.nivel, [glifo(signo(n.signIdx)), ' ' + signo(n.signIdx)]); }) : [linha('', ['Fora do período'])]));
    });
    alvo.appendChild(grupo('Decênios', r.decenios ? r.decenios.map(function (n) { return linha('Nível ' + n.nivel, [glifo(PLANETA[n.planetId]), ' ' + PLANETA[n.planetId]]); }) : [linha('', ['Fora do período'])]));
    var pf = r.profeccao, pl = [linha('Ano', [glifo(signo(pf.ano.signIdx)), ' ' + signo(pf.ano.signIdx)])];
    if (pf.mes) pl.push(linha('Mês', [glifo(signo(pf.mes.signIdx)), ' ' + signo(pf.mes.signIdx)]));
    if (pf.passo) pl.push(linha('60 horas', [glifo(signo(pf.passo.signIdx)), ' ' + signo(pf.passo.signIdx)]));
    alvo.appendChild(grupo('Profecção', pl));
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

  window.hellenicPonte = { cartao: cartao, ondeEstou: ondeEstou, desenhar: desenhar };
})();
