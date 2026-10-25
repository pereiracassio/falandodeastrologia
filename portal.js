/* Portal do Aluno — peças comuns à página do aluno (aluno.html) e ao painel da administrador (admin-alunos.html).
   Projeto Supabase PRÓPRIO do Falando de Astrologia (separado do Astro Hellenic). A chave "publishable" é pública
   por natureza: quem protege os dados são as regras de acesso (RLS) de docs/portal-aluno.sql. */
(function () {
  var SUPABASE_URL = 'https://wqkgsotfwkzjwaowenrb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt';

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* Calendário e listas de escolha (data, avaliação, múltipla escolha...) NÃO reabrem sozinhos quando você volta de outra aba ou aplicativo:
     a lista perde o foco assim que a escolha é feita e qualquer campo de data/lista perde o foco quando a página sai da tela (o navegador do iPad/celular reabria o seletor do campo que ficou focado). */
  (function () {
    var ehSeletor = function (e) {
      return !!e && (e.tagName === 'SELECT' || (e.tagName === 'INPUT' && /^(date|time|datetime-local|month|week)$/.test(e.type)));
    };
    var soltar = function () { var a = document.activeElement; if (ehSeletor(a)) a.blur(); };
    /* só nas listas de escolha: no calendário o iPad avisa a cada giro (ano, mês, dia), e soltar o campo ali fecharia o calendário no meio da escolha */
    document.addEventListener('change', function (ev) { if (ev.target && ev.target.tagName === 'SELECT') setTimeout(function () { ev.target.blur(); }, 0); }, true);
    document.addEventListener('visibilitychange', function () { soltar(); if (!document.hidden) setTimeout(soltar, 50); });
    window.addEventListener('pagehide', soltar);
    window.addEventListener('pageshow', function () { setTimeout(soltar, 50); });
    window.addEventListener('blur', soltar);
  })();

  /* cria um elemento: el('p', {class:'x', text:'oi'}, [filhos]) — sempre textContent, nunca innerHTML */
  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(f); });
    return e;
  }

  /* só aceita endereço https (nada de javascript: etc.) */
  function linkSeguro(url) {
    try {
      var u = new URL(String(url || '').trim());
      return u.protocol === 'https:' ? u.href : null;
    } catch (e) { return null; }
  }

  /* Escolher do Drive: lista de pastas e arquivos do Drive feita aqui no site (a janela do Google travava no iPad).
     Devolve o link do que foi escolhido (arquivo ou pasta). */
  var DRIVE_CLIENT_ID = '311357254380-sjbaui6hlfa9s7f10s1ip7699blk0rkb.apps.googleusercontent.com';
  var DRIVE_ESCOPO = 'https://www.googleapis.com/auth/drive';
  /* endereço do servidor (Vercel) que guarda a conexão permanente com o Drive: api/drive.js. Vazio = ainda sem servidor,
     e o site usa só a autorização do navegador (vale 1 hora). */
  var DRIVE_API_URL = 'https://falandodeastrologia.vercel.app/api/drive';
  var driveCarregado = null, driveToken = null, driveTokenAte = 0, driveDica = '';

  function carregarScript(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = ok; s.onerror = function () { erro(new Error('script')); };
      document.head.appendChild(s);
    });
  }
  function carregarDrive() {
    if (!driveCarregado) {
      driveCarregado = carregarScript('https://accounts.google.com/gsi/client').catch(function (e) { driveCarregado = null; throw e; });
      // guarda o e-mail do login pra o Google já sugerir a conta (precisa estar pronto antes do clique, senão o navegador bloqueia a janela)
      client.auth.getSession().then(function (r) { driveDica = (r.data && r.data.session && r.data.session.user.email) || ''; });
    }
    return driveCarregado;
  }
  /* chama o servidor da conexão permanente, sempre com o login do administrador */
  function driveApi(acao, extra) {
    return client.auth.getSession().then(function (r) {
      var jwt = r.data && r.data.session ? r.data.session.access_token : '';
      return fetch(DRIVE_API_URL + '?acao=' + acao + (extra || ''), { headers: { 'Authorization': 'Bearer ' + jwt } });
    });
  }
  function guardarToken(token, expiraEmSeg) {
    driveToken = token; driveTokenAte = Date.now() + (Number(expiraEmSeg || 3000) - 60) * 1000;
    try { sessionStorage.setItem('fda_drive_token', JSON.stringify({ token: driveToken, ate: driveTokenAte })); } catch (e) { /* sem armazenamento */ }
  }
  /* devolve a chave do Drive: a que já está na memória, senão pede ao servidor (sem janela do Google); só cai na janela
     do Google se o servidor não existir ou estiver fora do ar. Rejeita com 'desconectado' se o administrador ainda não conectou. */
  function tokenDoDrive() {
    return tokenEmCache().then(function (t) {
      if (t) return t;
      if (!DRIVE_API_URL) return tokenPelaJanela();
      return driveApi('token').then(function (r) {
        if (r.status === 401) throw new Error('desconectado');
        if (!r.ok) throw new Error('servidor');
        return r.json();
      }).then(function (d) { guardarToken(d.access_token, d.expires_in); return driveToken; }, function (e) {
        if (e.message === 'desconectado') throw e;
        return tokenPelaJanela(); // servidor fora do ar: usa a janela do Google (vale 1 hora)
      });
    });
  }
  function tokenEmCache() {
    if (!driveToken) {
      try {
        var g = JSON.parse(sessionStorage.getItem('fda_drive_token') || 'null');
        if (g && g.ate > Date.now()) { driveToken = g.token; driveTokenAte = g.ate; }
      } catch (e) { /* sem armazenamento */ }
    }
    return Promise.resolve(driveToken && Date.now() < driveTokenAte ? driveToken : null);
  }
  function tokenPelaJanela() {
    return carregarDrive().then(function () { return tokenPelaJanelaPronta(); });
  }
  function tokenPelaJanelaPronta() {
    return new Promise(function (ok, erro) {
      var tc = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CLIENT_ID,
        scope: DRIVE_ESCOPO,
        login_hint: driveDica || undefined,
        callback: function (r) {
          if (r.error || !r.access_token) { erro(new Error(r.error || 'sem token')); return; }
          driveToken = r.access_token; driveTokenAte = Date.now() + (Number(r.expires_in || 3000) - 60) * 1000;
          try { sessionStorage.setItem('fda_drive_token', JSON.stringify({ token: driveToken, ate: driveTokenAte })); } catch (e) { /* sem armazenamento */ }
          ok(driveToken);
        },
        error_callback: function (e) { erro(new Error((e && e.type) || 'cancelado')); }
      });
      tc.requestAccessToken();
    });
  }
  function driveGet(token, consulta, pagina) {
    var url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(consulta) +
      '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,webViewLink)') +
      '&orderBy=' + encodeURIComponent('folder,name') + '&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true' +
      (pagina ? '&pageToken=' + encodeURIComponent(pagina) : '');
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) {
      if (r.status === 401) { driveToken = null; try { sessionStorage.removeItem('fda_drive_token'); } catch (e) { /* sem armazenamento */ } }
      if (!r.ok) throw new Error('lista');
      return r.json();
    });
  }
  var PASTA_MIME = 'application/vnd.google-apps.folder';

  /* abre a lista; soPastas: só deixa escolher pasta */
  function abrirListaDoDrive(token, soPastas, aoEscolher, inicial) {
    var fundo = el('div');
    fundo.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:100000;background:rgba(10,19,48,.7);display:flex;align-items:center;justify-content:center;padding:12px';
    var painel = el('div');
    painel.style.cssText = 'background:var(--papiro-fundo);border:1px solid #1F5FA3;border-radius:12px;width:100%;max-width:620px;max-height:92vh;display:flex;flex-direction:column;color:#16233F;font-family:system-ui,-apple-system,sans-serif';
    var topo = el('div'); topo.style.cssText = 'padding:14px 16px 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    var titulo = el('strong', { text: soPastas ? 'Escolha a pasta' : 'Escolha o arquivo ou a pasta' }); titulo.style.cssText = 'flex:1;min-width:150px';
    var fechar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Cancelar' });
    topo.appendChild(titulo); topo.appendChild(fechar);
    var caminho = el('div'); caminho.style.cssText = 'padding:0 16px 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    var busca = el('input', { type: 'search', placeholder: 'Buscar pelo nome' }); busca.style.cssText = 'margin:0 16px 8px;width:calc(100% - 32px);background:transparent;border:1px solid #1F5FA3;border-radius:8px;padding:10px 12px;font:inherit;color:#16233F;-webkit-appearance:none;appearance:none';
    var lista = el('div'); lista.style.cssText = 'overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 16px 14px;flex:1;min-height:120px';
    painel.appendChild(topo); painel.appendChild(caminho); painel.appendChild(busca); painel.appendChild(lista);
    fundo.appendChild(painel); document.body.appendChild(fundo);
    var travado = document.body.style.overflow; document.body.style.overflow = 'hidden';
    function sair() { document.body.style.overflow = travado; if (fundo.parentNode) fundo.parentNode.removeChild(fundo); }
    fechar.addEventListener('click', sair);

    var pilha = [{ id: 'root', nome: 'Meu Drive' }]; // por onde a pessoa entrou
    if (inicial) pilha.push(inicial); // já abre dentro da pasta do aluno/cliente
    var carregouAlguma = false;
    var aspas = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };
    function linha(texto, extras) {
      var l = el('div'); l.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(31,95,163,.7)';
      l.appendChild(texto); if (extras) l.appendChild(extras);
      return l;
    }
    function escolher(item) {
      sair();
      aoEscolher(item.webViewLink || (item.mimeType === PASTA_MIME ? 'https://drive.google.com/drive/folders/' + item.id : 'https://drive.google.com/file/d/' + item.id + '/view'), item.id, token);
    }
    function desenhaCaminho() {
      caminho.textContent = '';
      var atual = pilha[pilha.length - 1];
      if (pilha.length > 1) {
        var voltar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '← Voltar' });
        voltar.addEventListener('click', function () { pilha.pop(); busca.value = ''; carregar(); });
        caminho.appendChild(voltar);
      }
      var nome = el('span', { text: atual.nome }); nome.style.fontWeight = '700'; caminho.appendChild(nome);
      if (soPastas && atual.id !== 'root' && atual.id !== 'compartilhados') {
        var esta = el('button', { type: 'button', class: 'portal-btn', text: 'Escolher esta pasta' });
        esta.addEventListener('click', function () { escolher({ id: atual.id, mimeType: PASTA_MIME }); });
        caminho.appendChild(esta);
      }
    }
    function itemDaLista(f) {
      var ePasta = f.mimeType === PASTA_MIME;
      var nome = el('button', { type: 'button', text: (ePasta ? '📁 ' : '📄 ') + f.name });
      nome.style.cssText = 'background:none;border:0;padding:6px 0;font:inherit;text-align:left;cursor:pointer;color:#16233F;flex:1;word-break:break-word';
      var botao = null;
      if (ePasta) {
        nome.addEventListener('click', function () { pilha.push({ id: f.id, nome: f.name }); busca.value = ''; carregar(); });
        botao = el('button', { type: 'button', class: 'portal-btn', text: 'Escolher' });
        botao.addEventListener('click', function () { escolher(f); });
      } else if (!soPastas) {
        nome.addEventListener('click', function () { escolher(f); });
        botao = el('button', { type: 'button', class: 'portal-btn', text: 'Escolher' });
        botao.addEventListener('click', function () { escolher(f); });
      }
      return linha(nome, botao);
    }
    var pedido = 0;
    function carregar(pagina, anexar) {
      var meu = ++pedido, atual = pilha[pilha.length - 1], termo = busca.value.trim();
      desenhaCaminho();
      if (!anexar) { lista.textContent = ''; lista.appendChild(el('p', { text: 'Carregando...' })); }
      var consulta;
      if (termo) consulta = "name contains '" + aspas(termo) + "' and trashed=false";
      else if (atual.id === 'compartilhados') consulta = 'sharedWithMe=true and trashed=false';
      else consulta = "'" + aspas(atual.id) + "' in parents and trashed=false";
      if (soPastas) consulta += " and mimeType='" + PASTA_MIME + "'";
      driveGet(token, consulta, pagina).then(function (r) {
        if (meu !== pedido) return;
        carregouAlguma = true;
        if (!anexar) lista.textContent = '';
        else { var mais = lista.querySelector('[data-mais]'); if (mais) lista.removeChild(mais); }
        if (!anexar && !termo && atual.id === 'root') {
          var comp = el('button', { type: 'button', text: '👥 Compartilhados comigo' });
          comp.style.cssText = 'background:none;border:0;padding:6px 0;font:inherit;text-align:left;cursor:pointer;color:#16233F';
          comp.addEventListener('click', function () { pilha.push({ id: 'compartilhados', nome: 'Compartilhados comigo' }); carregar(); });
          lista.appendChild(linha(comp));
        }
        if (!r.files.length && !anexar) lista.appendChild(el('p', { text: termo ? 'Nada encontrado.' : (soPastas ? 'Nenhuma pasta aqui.' : 'Nada aqui.') }));
        r.files.forEach(function (f) { lista.appendChild(itemDaLista(f)); });
        if (r.nextPageToken) {
          var mais = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Mostrar mais' });
          mais.setAttribute('data-mais', '1'); mais.style.marginTop = '10px';
          mais.addEventListener('click', function () { carregar(r.nextPageToken, true); });
          lista.appendChild(mais);
        }
      }).catch(function () {
        if (meu !== pedido) return;
        if (!carregouAlguma && pilha.length > 1) { pilha.length = 1; carregar(); return; } // a pasta ligada sumiu: começa do Meu Drive
        lista.textContent = '';
        lista.appendChild(el('p', { text: 'Não foi possível carregar o Drive. Feche e tente de novo.' }));
      });
    }
    var espera = null;
    busca.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(function () { carregar(); }, 400); });
    carregar();
  }

  /* escolherDoDrive(function (url, id, token) { ... }, function (textoDeErro) { ... }, soPastas) */
  function escolherDoDrive(aoEscolher, aoErrar, soPastas, chavePasta) {
    tokenDoDrive().then(function (token) {
      // se a pessoa (aluno/cliente) já tem pasta ligada, abre a lista direto dentro dela
      var inicial = chavePasta ? client.from('drive_pastas').select('pasta_id').eq('chave', chavePasta).maybeSingle().then(function (r) {
        var id = r.data && r.data.pasta_id;
        if (!id) return null;
        return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=name&supportsAllDrives=true', { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (x) { return x.ok ? x.json() : { name: 'Pasta' }; }).then(function (f) { return { id: id, nome: f.name || 'Pasta' }; });
      }).catch(function () { return null; }) : Promise.resolve(null);
      return inicial.then(function (ini) { abrirListaDoDrive(token, soPastas, aoEscolher, ini); });
    }).catch(function (e) {
      if (aoErrar && e.message === 'desconectado') aoErrar('O Google Drive ainda não está conectado. Toque em "Conectar o Google Drive", no cartão "Google Drive" da lista.');
      else if (aoErrar && !/popup_closed|access_denied|cancel/i.test(String(e.message))) aoErrar('Não foi possível entrar no Google Drive. Tente de novo.');
    });
  }
  /* dá acesso de leitura ao e-mail da pessoa (o Drive não manda aviso; o aviso é do site) */
  function compartilharNoDrive(arquivoId, token, email) {
    return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(arquivoId) + '/permissions?sendNotificationEmail=false', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email })
    }).then(function (r) { if (!r.ok) throw new Error('permissao'); });
  }
  /* botão "Escolher do Drive": preenche o campo de link e, se vier o e-mail, já compartilha o arquivo com a pessoa.
     aviso(texto, 'ok' | 'erro') mostra a mensagem na tela */
  function botaoDrive(campo, aviso, email, chavePasta) {
    var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Escolher do Drive' });
    b.addEventListener('click', function () {
      escolherDoDrive(function (url, id, token) {
        campo.value = url;
        if (!email) { aviso('Link preenchido.', 'ok'); return; }
        aviso('Link preenchido. Compartilhando com ' + email + '...', 'ok');
        compartilharNoDrive(id, token, email).then(function () {
          aviso('Link preenchido e arquivo compartilhado com ' + email + '.', 'ok');
        }).catch(function () {
          aviso('Link preenchido, mas não consegui compartilhar com ' + email + ' (o e-mail precisa ser uma conta Google). Compartilhe no Drive.', 'erro');
        });
      }, function (t) { aviso(t, 'erro'); }, false, chavePasta);
    });
    return b;
  }

  /* Pasta no Drive. A pasta-mãe (onde nascem as pastas novas dos alunos ou dos clientes) é uma configuração, escolhida na
     lista (cartaoPastaBase) e guardada no Supabase (tabela drive_pastas). Cada aluno/cliente pode ter a pasta criada
     dentro dela ou usar uma pasta que já existe no Drive (cartaoPastaDrive). */
  var linkPasta = function (id) { return 'https://drive.google.com/drive/folders/' + encodeURIComponent(id); };
  /* chave do Drive sem nunca abrir janela do Google: a da memória ou a do servidor; null se não der */
  function tokenSemJanela() {
    return tokenEmCache().then(function (t) {
      if (t) return t;
      if (!DRIVE_API_URL) return null;
      return driveApi('token').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d) return null;
        guardarToken(d.access_token, d.expires_in); return driveToken;
      });
    }).catch(function () { return null; });
  }
  /* acha dentro da pasta-mãe a pasta que começa com o código (ex.: "0147 - Maria"); só liga se achar UMA */
  function acharPastaPeloCodigo(baseId, codigo) {
    if (!baseId || !codigo) return Promise.resolve(null);
    return tokenSemJanela().then(function (token) {
      if (!token) return null;
      var q = "'" + baseId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '" + String(codigo).replace(/['\\]/g, '') + "'";
      return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=50&fields=files(id,name)&q=' + encodeURIComponent(q),
        { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.files) return null;
        var cod = String(codigo).trim().toLowerCase();
        var certas = d.files.filter(function (f) {
          var n = String(f.name).trim().toLowerCase();
          return n === cod || n.indexOf(cod) === 0 && !/[0-9a-z]/.test(n.charAt(cod.length));
        });
        return certas.length === 1 ? certas[0].id : null;
      });
    }).catch(function () { return null; });
  }
  /* id do arquivo (não pasta) num link do Drive: /file/d/ID/... ou ?id=ID */
  function idArquivoDrive(url) {
    var m = String(url || '').match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) || String(url || '').match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]{10,})/);
    return m ? m[1] : null;
  }
  /* gravação: player do Drive dentro da página (abre ao tocar em Assistir) + Baixar + abrir no Drive.
     Devolve null se o link não for de um arquivo do Drive (aí quem chama usa o botão de sempre). */
  function playerGravacao(link, aoUsar) {
    var id = idArquivoDrive(link);
    if (!id) return null;
    var acoes = el('div', { class: 'portal-acoes' });
    var area = el('div');
    var assistir = el('button', { type: 'button', class: 'portal-btn', text: 'Assistir' });
    var aberto = false;
    assistir.addEventListener('click', function () {
      aberto = !aberto;
      if (aberto && aoUsar) aoUsar();
      area.textContent = '';
      assistir.textContent = aberto ? 'Fechar o vídeo' : 'Assistir';
      if (!aberto) return;
      var caixa = el('div', { style: 'position:relative;width:100%;aspect-ratio:16/9;margin-top:12px;border:1px solid #1F5FA3;overflow:hidden' });
      caixa.appendChild(el('iframe', { src: 'https://drive.google.com/file/d/' + id + '/preview', allow: 'autoplay; fullscreen', allowfullscreen: '',
        style: 'position:absolute;inset:0;width:100%;height:100%;border:0', title: 'Gravação' }));
      area.appendChild(caixa);
      area.appendChild(el('p', { class: 'portal-vazio', text: 'Se o vídeo não carregar, toque em "Abrir no Drive".' }));
    });
    var baixar = el('a', { class: 'portal-btn portal-btn-sec', href: 'https://drive.google.com/uc?export=download&id=' + id, target: '_blank', rel: 'noopener', text: 'Baixar' });
    var noDrive = el('a', { class: 'portal-btn portal-btn-sec', href: link, target: '_blank', rel: 'noopener', text: 'Abrir no Drive' });
    if (aoUsar) { baixar.addEventListener('click', aoUsar); noDrive.addEventListener('click', aoUsar); }
    acoes.appendChild(assistir);
    acoes.appendChild(baixar);
    acoes.appendChild(noDrive);
    return el('div', {}, [acoes, area]);
  }
  /* botão "Aplicações" do painel, com o número de aplicações novas (completas e não concluídas) */
  function linkAplicacoes() {
    var a = el('a', { class: 'portal-btn portal-btn-sec', href: 'admin-aplicacoes.html', text: 'Aplicações' });
    client.from('aplicacoes_mentoria').select('id', { count: 'exact', head: true }).eq('situacao', 'nova').then(function (r) {
      if (!r.error && r.count) a.textContent = 'Aplicações (' + r.count + ')';
    }, function () {});
    return a;
  }
  /* barra de cima igual em TODAS as telas do painel (Aplicações, Alunos, Clientes, Capa, Sair): a aba em que você está fica destacada */
  function navAdmin(atual, texto, aoSair) {
    var itens = [['aplicacoes', 'Aplicações', 'admin-aplicacoes.html'], ['alunos', 'Alunos', 'admin-alunos.html'], ['clientes', 'Clientes', 'admin-clientes.html'], ['checkouts', 'Checkouts', 'admin-checkouts.html'], ['financeiro', 'Financeiro', 'admin-financeiro.html'], ['capa', 'Capa', 'capa.html'], ['site', 'Site', 'admin-site.html'], ['blog', 'Blog', 'admin-blog.html'], ['producao', 'Produção', 'admin-producao.html'], ['visitas', 'Visitas', 'admin-visitas.html'], ['psicanalise', 'Psicanálise', 'https://pereiracassio.com.br/admin.html']];
    var botoes = itens.map(function (i) {
      var a = i[0] === 'aplicacoes' ? linkAplicacoes() : el('a', { class: 'portal-btn portal-btn-sec', href: i[2], text: i[1] });
      if (i[0] === atual) { a.setAttribute('aria-current', 'page'); a.style.cssText = 'border:3px solid #1F5FA3;padding:10px 22px;color:#A03E25'; }
      return a;
    });
    var sair = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Sair' });
    sair.addEventListener('click', aoSair);
    var grupo = el('div', { class: 'portal-grupo' }, botoes.concat([sair]));
    /* sem o "Olá, ...": ele só aparece na entrada, nas telas do painel não */
    var seta = function (lado, pontos, rotulo) {
      var b = el('button', { type: 'button', class: 'barra-seta barra-seta-' + lado, 'aria-label': rotulo });
      b.innerHTML = '<svg viewBox="0 0 64 64" width="20" height="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><polyline points="' + pontos + '"/></svg>';
      return b;
    };
    var esq = seta('esq', '40,12 20,32 40,52', 'Mais botões à esquerda'), dir = seta('dir', '24,12 44,32 24,52', 'Mais botões à direita');
    ligarSetas(grupo, esq, dir);
    return el('div', { class: 'portal-topo portal-topo-painel' }, [el('div', { class: 'rolagem-wrap' }, [esq, dir, grupo])]);
  }
  /* setinhas de aviso numa barra que rola (igual ao Astro Hellenic): só aparecem quando tem botão escondido daquele lado; onde a barra cabe, nunca */
  function ligarSetas(rolagem, esq, dir) {
    var atualiza = function () {
      esq.classList.toggle('visivel', rolagem.scrollLeft > 4);
      dir.classList.toggle('visivel', rolagem.scrollLeft + rolagem.clientWidth < rolagem.scrollWidth - 4);
    };
    var passo = function (sentido) { rolagem.scrollBy({ left: sentido * Math.max(160, rolagem.clientWidth * 0.6), behavior: 'smooth' }); };
    esq.addEventListener('click', function () { passo(-1); });
    dir.addEventListener('click', function () { passo(1); });
    rolagem.addEventListener('scroll', atualiza, { passive: true });
    window.addEventListener('resize', atualiza);
    if (window.ResizeObserver) new ResizeObserver(atualiza).observe(rolagem);
    setTimeout(atualiza, 0); setTimeout(atualiza, 400);
  }
  /* onde você estava, guardado no endereço (#aluno=ID&atividade=ID): ao recarregar a página ela volta pro mesmo lugar */
  var estado = {
    ler: function () {
      var o = {}, h = String(location.hash || '').replace(/^#/, '');
      if (/access_token|refresh_token|type=/.test(h)) return o; /* retorno de login/recuperação de senha: não é nosso */
      h.split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) { try { o[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* ignora */ } } });
      return o;
    },
    gravar: function (o) {
      var h = Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
      try { history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : '')); } catch (e) { /* sem histórico */ }
    },
    mesclar: function (o) { var a = estado.ler(); Object.keys(o).forEach(function (k) { a[k] = o[k]; }); estado.gravar(a); }
  };
  /* lembrar onde você parou: o app da tela de início sempre abre na página inicial dele (Produção, Alunos); ao abrir de novo, a primeira
     linha do <head> dessas páginas lê isto e leva você de volta ao lugar exato (página + o que estava aberto, que fica no endereço). */
  function lembrarOndeParou() {
    try {
      if (!/\/(admin-[a-z]+|aluno|cliente)\.html$/.test(location.pathname)) return;
      if (/access_token|refresh_token|type=/.test(String(location.hash))) return;
      localStorage.setItem('fda_ultima_pagina', location.pathname + location.search + location.hash);
    } catch (e) { /* sem armazenamento */ }
  }
  lembrarOndeParou();
  var gravarEstado = estado.gravar;
  estado.gravar = function (o) { gravarEstado(o); lembrarOndeParou(); };
  window.addEventListener('pagehide', lembrarOndeParou);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') lembrarOndeParou(); });
  /* seção que abre e fecha (sanfona): a barra com o título aparece sempre; o conteúdo só quando aberta.
     abertas = lista (compartilhada) das chaves abertas; o que está aberto fica guardado no endereço (#abertas=dados,atividades) e sobrevive ao recarregar. */
  function sanfona(abertas, chave, titulo, filhos) {
    filhos.forEach(function (f) { var h2 = f.querySelector && f.querySelector(':scope > h2'); if (h2) h2.remove(); }); /* o título agora é a barra */
    var corpo = el('div', { class: 'sanfona-corpo' }, filhos);
    var sinal = el('span', { 'aria-hidden': 'true', style: 'font-size:24px;line-height:1;font-family:Arial,sans-serif' });
    var barra = el('button', { type: 'button' }, [el('span', { text: titulo }), sinal]);
    /* sem quadro: uma linha em cima e outra embaixo; aberta, a de baixo desce para o fim do conteúdo e fecha a seção */
    var caixa = el('div', { class: 'sanfona', style: 'border-top:2px solid #1F5FA3;border-bottom:2px solid #1F5FA3;margin:0' }, [barra, corpo]);
    barra.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;background:transparent;border:0;border-radius:0;cursor:pointer;padding:14px 2px;' +
      'font-family:Cinzel,serif;font-size:16px;font-weight:700;letter-spacing:.5px;color:#A03E25;margin:0';
    function pintar() {
      var aberta = abertas.indexOf(chave) >= 0;
      corpo.style.display = aberta ? '' : 'none';
      corpo.style.paddingBottom = aberta ? '10px' : '';
      sinal.textContent = aberta ? '−' : '+';
      barra.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    }
    barra.addEventListener('click', function () {
      var i = abertas.indexOf(chave);
      if (i >= 0) abertas.splice(i, 1); else abertas.push(chave);
      estado.mesclar({ abertas: abertas.join(',') || '-' }); /* "-" = tudo fechado (vazio voltaria pro padrão) */
      pintar();
    });
    pintar();
    return caixa;
  }
  function guardarPasta(chave, pastaId) { return client.from('drive_pastas').upsert({ chave: chave, pasta_id: pastaId }, { onConflict: 'chave' }); }
  function botaoPasta(texto, aoClicar, sec) {
    var b = el('button', { type: 'button', class: 'portal-btn' + (sec ? ' portal-btn-sec' : ''), text: texto });
    b.addEventListener('click', function () { aoClicar(b); });
    return b;
  }

  /* cartão da lista: conexão permanente com o Google Drive (some se ainda não há servidor) */
  function cartaoConexaoDrive() {
    if (!DRIVE_API_URL) return null;
    var msg = el('p', { class: 'portal-msg' });
    var corpo = el('div');
    var cartao = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Google Drive' }), corpo, msg]);
    var retorno = (location.search.match(/[?&]drive=(\w+)/) || [])[1];
    if (retorno) {
      mensagem(msg, retorno === 'ok' ? 'Google Drive conectado.' : retorno === 'cancelado' ? 'A conexão foi cancelada.' : 'Não foi possível conectar. Tente de novo.', retorno === 'ok' ? 'ok' : 'erro');
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* sem histórico */ }
    }
    function desenhar() {
      corpo.textContent = '';
      driveApi('status').then(function (r) {
        if (r.ok) return r.json();
        return r.text().then(function (t) { throw new Error('servidor respondeu ' + r.status + ': ' + t.slice(0, 260)); });
      }).then(function (d) {
        if (d.conectado) {
          corpo.appendChild(el('p', { text: 'Conectado' + (d.email ? ' como ' + d.email : '') + '. Você não precisa autorizar de novo.' }));
          corpo.appendChild(botaoPasta('Desconectar', function () {
            if (!confirm('Desconectar o Google Drive? O site deixa de ver as suas pastas até você conectar de novo.')) return;
            driveApi('desconectar').then(function () { driveToken = null; try { sessionStorage.removeItem('fda_drive_token'); } catch (e) { /* sem armazenamento */ } desenhar(); });
          }, true));
        } else {
          corpo.appendChild(el('p', { text: 'Conecte uma vez e o site passa a usar o seu Drive sem pedir autorização de novo.' }));
          corpo.appendChild(botaoPasta('Conectar o Google Drive', function (b) {
            b.disabled = true;
            driveApi('iniciar', '&volta=' + encodeURIComponent(location.pathname)).then(function (r) { if (!r.ok) throw new Error('iniciar'); return r.json(); })
              .then(function (d) { location.href = d.url; })
              .catch(function () { b.disabled = false; mensagem(msg, 'Não foi possível iniciar a conexão. Tente de novo.', 'erro'); });
          }));
        }
      }).catch(function (e) { corpo.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível consultar o Google Drive agora (' + (e && e.message ? e.message : 'sem resposta') + ').' })); });
    }
    desenhar();
    return cartao;
  }

  /* cartão da lista: "onde criar as pastas dos clientes/alunos" */
  function cartaoPastaBase(plural) {
    var chave = 'base_' + plural;
    var msg = el('p', { class: 'portal-msg' });
    var corpo = el('div');
    var cartao = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Pasta dos ' + plural + ' no Drive' }), corpo, msg]);
    function desenhar() {
      corpo.textContent = '';
      carregarDrive().catch(function () {});
      client.from('drive_pastas').select('pasta_id').eq('chave', chave).maybeSingle().then(function (r) {
        var id = r.data && r.data.pasta_id;
        var um = plural === 'alunos' ? 'aluno' : 'cliente';
        corpo.appendChild(el('p', { text: id ? 'É dentro dessa pasta que o site cria a pasta de cada ' + um + ' novo.' : 'Escolha a pasta do seu Drive onde o site vai criar a pasta de cada ' + um + ' novo. Só precisa fazer isso uma vez.' }));
        var acoes = el('div', { class: 'portal-acoes' });
        if (id) acoes.appendChild(el('a', { class: 'portal-btn portal-btn-sec', href: linkPasta(id), target: '_blank', rel: 'noopener', text: 'Abrir a pasta' }));
        acoes.appendChild(botaoPasta(id ? 'Trocar a pasta' : 'Escolher a pasta', function () {
          escolherDoDrive(function (url, pastaId) {
            guardarPasta(chave, pastaId).then(function (x) {
              if (x.error) { mensagem(msg, traduzErro(x.error.message), 'erro'); return; }
              desenhar(); mensagem(msg, 'Pasta escolhida.', 'ok');
            });
          }, function (t) { mensagem(msg, t, 'erro'); }, true);
        }));
        corpo.appendChild(acoes);
      });
    }
    desenhar();
    return cartao;
  }

  /* cartão da página de um aluno/cliente.
     opcoes: { plural: 'alunos'|'clientes', tipo: 'aluno'|'cliente', id, nome: function () { return 'código - nome'; }, email } */
  function cartaoPastaDrive(opcoes) {
    var chaveBase = 'base_' + opcoes.plural, chaveItem = opcoes.tipo + ':' + opcoes.id;
    var msg = el('p', { class: 'portal-msg' });
    var corpo = el('div');
    var cartao = opcoes.dentroDeOutroBloco
      ? el('div', {}, [el('label', { text: 'Pasta no Drive' }), corpo, msg])
      : el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Pasta no Drive' }), corpo, msg]);
    var aviso = function (t, tipo) { mensagem(msg, t, tipo); };
    function compartilhar(pastaId, token) {
      return compartilharNoDrive(pastaId, token, opcoes.email).then(function () { return true; }, function () { return false; });
    }
    function fim(compartilhou) {
      desenhar();
      aviso(compartilhou ? 'Pronto. Pasta compartilhada com ' + opcoes.email + '.' : 'Pasta salva, mas não consegui compartilhar com ' + opcoes.email + ' (o e-mail precisa ser uma conta Google). Compartilhe no Drive.', compartilhou ? 'ok' : 'erro');
    }
    /* usar uma pasta que já existe */
    function usarExistente() {
      escolherDoDrive(function (url, pastaId, token) {
        guardarPasta(chaveItem, pastaId).then(function (x) {
          if (x.error) { aviso(traduzErro(x.error.message), 'erro'); return; }
          aviso('Compartilhando...', 'ok');
          compartilhar(pastaId, token).then(fim);
        });
      }, function (t) { aviso(t, 'erro'); }, true);
    }
    function criar(b, baseId) {
      b.disabled = true; aviso('Criando a pasta...', 'ok');
      tokenDoDrive().then(function (token) {
        return fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: opcoes.nome(), mimeType: 'application/vnd.google-apps.folder', parents: [baseId] })
        }).then(function (r) { if (!r.ok) throw new Error('criar'); return r.json(); }).then(function (pasta) {
          return guardarPasta(chaveItem, pasta.id).then(function () { return compartilhar(pasta.id, token); }).then(fim);
        });
      }).catch(function (e) {
        b.disabled = false;
        if (e.message === 'desconectado') aviso('O Google Drive ainda não está conectado. Toque em "Conectar o Google Drive", no cartão "Google Drive" da lista.', 'erro');
        else if (!/popup_closed|access_denied|cancel/i.test(String(e.message))) aviso('Não foi possível criar a pasta. Confira a pasta dos ' + opcoes.plural + ' na lista e tente de novo.', 'erro');
        else aviso('');
      });
    }
    var tentouLigar = false;
    function desenhar() {
      corpo.textContent = '';
      carregarDrive().catch(function () {});
      client.from('drive_pastas').select('chave,pasta_id').in('chave', [chaveBase, chaveItem]).then(function (r) {
        if (r.error) { corpo.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a pasta do Drive.' })); return; }
        var m = {};
        (r.data || []).forEach(function (x) { m[x.chave] = x.pasta_id; });
        var acoes = el('div', { class: 'portal-acoes' });
        if (m[chaveItem]) {
          if (!opcoes.dentroDeOutroBloco) corpo.appendChild(el('p', { text: 'A pasta deste ' + opcoes.tipo + ' no seu Drive:' }));
          acoes.appendChild(el('a', { class: 'portal-btn', href: linkPasta(m[chaveItem]), target: '_blank', rel: 'noopener', text: 'Abrir a pasta' }));
          acoes.appendChild(botaoPasta('Usar outra pasta', usarExistente, true));
        } else if (!tentouLigar && m[chaveBase] && opcoes.codigo && opcoes.codigo()) {
          tentouLigar = true;
          corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Procurando a pasta...' }));
          acharPastaPeloCodigo(m[chaveBase], opcoes.codigo()).then(function (id) {
            if (!id) { desenhar(); return; }
            guardarPasta(chaveItem, id).then(function () { desenhar(); });
          });
          return;
        } else {
          if (!opcoes.dentroDeOutroBloco) corpo.appendChild(el('p', { text: 'Este ' + opcoes.tipo + ' ainda não tem pasta ligada. Use uma pasta que já existe no seu Drive, ou crie uma nova.' }));
          acoes.appendChild(botaoPasta('Usar uma pasta que já existe', usarExistente));
          if (m[chaveBase]) acoes.appendChild(botaoPasta('Criar a pasta "' + opcoes.nome() + '"', function (b) { criar(b, m[chaveBase]); }, true));
          else corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Pra criar uma pasta nova, escolha antes a pasta dos ' + opcoes.plural + ' na lista de ' + opcoes.plural + '.' }));
        }
        corpo.appendChild(acoes);
      });
    }
    desenhar();
    return cartao;
  }

  /* do código maior pro menor (o mais novo primeiro); quem não tem código vai pro fim, por nome */
  function ordenarPorCodigo(lista) {
    return lista.sort(function (a, b) {
      if (!a.codigo !== !b.codigo) return a.codigo ? -1 : 1;
      if (a.codigo) {
        var c = String(b.codigo).localeCompare(String(a.codigo), 'pt-BR', { numeric: true });
        if (c) return c;
      }
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  function dataBR(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  function traduzErro(msg) {
    msg = String(msg || '');
    if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(msg)) return 'Esse acesso ainda não foi confirmado.';
    if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
    if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/failed to fetch|network/i.test(msg)) return 'Sem conexão. Confira a internet e tente de novo.';
    return 'Não foi possível concluir. Tente de novo.';
  }

  function mensagem(caixa, texto, tipo) {
    caixa.className = 'portal-msg' + (tipo ? ' ' + tipo : '');
    caixa.textContent = texto || '';
  }

  /* formulário de entrada (e-mail + senha + "esqueci minha senha") */
  function montarLogin(container, aoEntrar) {
    var msg = el('p', { class: 'portal-msg' });
    var email = el('input', { type: 'email', id: 'portalEmail', autocomplete: 'username', required: '' });
    var senha = el('input', { type: 'password', id: 'portalSenha', autocomplete: 'current-password', required: '' });
    var entrar = el('button', { type: 'submit', class: 'portal-btn', text: 'Entrar' });
    var esqueci = el('button', { type: 'button', class: 'portal-link', text: 'Esqueci minha senha' });
    var form = el('form', { class: 'portal-cartao' }, [
      el('label', { for: 'portalEmail', text: 'E-mail' }), email,
      el('label', { for: 'portalSenha', text: 'Senha' }), senha,
      msg, entrar, el('span', { text: '  ' }), esqueci
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      entrar.disabled = true; mensagem(msg, 'Entrando...');
      client.auth.signInWithPassword({ email: email.value.trim(), password: senha.value }).then(function (r) {
        if (r.error) { entrar.disabled = false; mensagem(msg, traduzErro(r.error.message), 'erro'); return; }
        aoEntrar(r.data.user);
      });
    });
    esqueci.addEventListener('click', function () {
      if (!email.value.trim()) { mensagem(msg, 'Digite seu e-mail acima e toque de novo.', 'erro'); return; }
      client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname }).then(function (r) {
        if (r.error) mensagem(msg, traduzErro(r.error.message), 'erro');
        else mensagem(msg, 'Enviamos um link para o seu e-mail. Abra-o para criar uma nova senha.', 'ok');
      });
    });
    container.appendChild(form);
  }

  /* tela de "criar nova senha" (quem chegou pelo link do e-mail) */
  function montarNovaSenha(container, aoConcluir, titulo) {
    var msg = el('p', { class: 'portal-msg' });
    var senha = el('input', { type: 'password', id: 'portalNova', autocomplete: 'new-password', minlength: '6', required: '' });
    var salvar = el('button', { type: 'submit', class: 'portal-btn', text: 'Salvar nova senha' });
    var form = el('form', { class: 'portal-cartao' }, [
      el('h2', { text: titulo || 'Crie sua nova senha' }),
      el('label', { for: 'portalNova', text: 'Nova senha (mínimo 6 caracteres)' }), senha, msg, salvar
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      salvar.disabled = true;
      client.auth.updateUser({ password: senha.value }).then(function (r) {
        if (r.error) { salvar.disabled = false; mensagem(msg, traduzErro(r.error.message), 'erro'); return; }
        history.replaceState(null, '', location.pathname);
        aoConcluir(r.data.user);
      });
    });
    container.appendChild(form);
  }

  /* login com o Google: volta para o endereço dado (ex.: '/cliente.html'); esse endereço precisa estar em Redirect URLs no Supabase */
  function entrarComGoogle(destino) {
    // guarda para onde voltar: se o Supabase devolver para a home, a home leva a pessoa pra cá (ver index.html)
    try { localStorage.setItem('fda_pos_login', destino); } catch (e) { /* sem armazenamento */ }
    return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + destino } });
  }
  function nomeDoGoogle(user) {
    var m = (user && user.user_metadata) || {};
    return m.full_name || m.name || '';
  }

  /* "entrou por link de recuperação de senha" — o Supabase limpa o # logo depois de ler, então decide já no carregamento */
  var emRecuperacao = /type=recovery/.test(location.hash);

  /* Ícones astrológicos (fonte AstroIcones, U+E000 a U+E020): paletaIcones(campo) põe um botão "Ícones" embaixo do campo; ele abre a fileira
     de ícones e cada toque coloca o ícone onde está o cursor. semIcones(texto) troca os ícones pelo NOME (PDF e lugares sem a fonte). */
  var NOMES_ICONES = ["Sol", "Lua", "Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno", "Fortuna", "Espírito", "Necessidade", "Eros", "Coragem", "Vitória", "Nêmesis", "Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes", "Lunação pré-natal", "Nodo Norte", "Nodo Sul", "Ascendente", "Descendente", "Meio do Céu", "Fundo do Céu"];
  function semIcones(t) { return String(t == null ? '' : t).replace(/[\uE000-\uE020]/g, function (c) { return NOMES_ICONES[c.charCodeAt(0) - 0xE000] + ' '; }); }
  function paletaIcones(campo) {
    if (!campo || campo.getAttribute('data-icones')) return;
    campo.setAttribute('data-icones', '1');
    var abre = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Ícones' });
    var fileira = el('div', { class: 'portal-acoes', style: 'gap:4px;margin:0 0 8px;display:none' });
    NOMES_ICONES.forEach(function (nome, i) {
      var ch = String.fromCharCode(0xE000 + i);
      var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', title: nome, 'aria-label': nome, text: ch });
      b.style.cssText = 'min-width:44px;padding:6px 8px;font-size:24px;line-height:1;font-family:AstroIcones,sans-serif!important';
      b.addEventListener('click', function () {
        var t = campo.value, ini = campo.selectionStart == null ? t.length : campo.selectionStart, fim = campo.selectionEnd == null ? ini : campo.selectionEnd;
        campo.value = t.slice(0, ini) + ch + t.slice(fim);
        campo.focus(); campo.selectionStart = campo.selectionEnd = ini + 1;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      });
      fileira.appendChild(b);
    });
    abre.style.cssText = 'margin:-6px 0 10px';
    abre.addEventListener('click', function () { var aberta = fileira.style.display !== 'none'; fileira.style.display = aberta ? 'none' : ''; abre.textContent = aberta ? 'Ícones' : 'Fechar ícones'; });
    var pai = campo.parentNode; if (!pai) return;
    pai.insertBefore(fileira, campo.nextSibling); pai.insertBefore(abre, campo.nextSibling);
  }
  /* põe a paleta em todo campo de texto grande (textarea) que aparecer dentro de "raiz", agora e depois (as telas são montadas por JS) */
  function iconesNosCampos(raiz) {
    function varrer(no) { if (no.nodeType !== 1) return; if (no.tagName === 'TEXTAREA') paletaIcones(no); Array.prototype.forEach.call(no.querySelectorAll ? no.querySelectorAll('textarea') : [], paletaIcones); }
    varrer(raiz);
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, varrer); }); }).observe(raiz, { childList: true, subtree: true });
  }

  /* próximo encontro puxado da Google Agenda (api/proximo-encontro.js); alunoId só para o administrador. Resolve com {inicio,fuso,meet} ou null */
  function proximoEncontro(alunoId) {
    return client.auth.getSession().then(function (r) {
      var sessao = r.data && r.data.session;
      if (!sessao) return null;
      return fetch('https://falandodeastrologia.vercel.app/api/proximo-encontro' + (alunoId ? '?aluno=' + encodeURIComponent(alunoId) : ''), { headers: { Authorization: 'Bearer ' + sessao.access_token } })
        .then(function (resp) { return resp.ok ? resp.json() : null; })
        .then(function (d) { if (d && !d.encontro && d.motivo && alunoId) console.warn('próximo encontro:', d.motivo); return d && d.encontro ? d.encontro : (alunoId && d && d.motivo ? { motivo: d.motivo } : null); });
    }).catch(function () { return null; });
  }
  function textoEncontro(e) {
    var q = new Date(e.inicio), fuso = e.fuso || 'America/Sao_Paulo';
    var dia = q.toLocaleDateString('pt-BR', { timeZone: fuso, weekday: 'long', day: '2-digit', month: 'long' });
    var hora = q.toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' }).replace(':00', 'h').replace(':', 'h');
    return 'Próximo encontro: ' + dia + ', às ' + hora;
  }

  /* cartão do próximo atendimento de cliente, vindo da Google Agenda (api/meu-atendimento.js). clienteId só para o administrador.
     Sem atendimento marcado, o cartão nem aparece. paraAdmin = texto "Atendimento: ..." em vez de "Seu ... será ..." */
  function cartaoAtendimento(clienteId, paraAdmin) {
    var lugar = el('div', {});
    client.auth.getSession().then(function (r) {
      var sessao = r.data && r.data.session;
      if (!sessao) return;
      return fetch('https://falandodeastrologia.vercel.app/api/meu-atendimento' + (clienteId ? '?cliente=' + encodeURIComponent(clienteId) : ''), { headers: { Authorization: 'Bearer ' + sessao.access_token } })
        .then(function (resp) { return resp.ok ? resp.json() : null; })
        .then(function (d) {
          var a = d && d.atendimento;
          if (!a) return;
          var quando = new Date(a.inicio);
          var dia = quando.toLocaleDateString('pt-BR', { timeZone: a.fuso, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
          var hora = quando.toLocaleTimeString('pt-BR', { timeZone: a.fuso, hour: '2-digit', minute: '2-digit' }).replace(':00', 'h').replace(':', 'h');
          var frase = paraAdmin ? (a.servico || 'Atendimento') + ': ' + dia + ', às ' + hora + '.'
                                : 'Seu ' + (a.servico || 'atendimento') + ' será ' + dia + ', às ' + hora + '.';
          var cartao = el('div', { class: 'portal-cartao' }, [el('p', { class: 'portal-proximo', text: frase })]);
          var link = linkSeguro(a.meet);
          if (link) cartao.appendChild(el('a', { class: 'portal-btn portal-btn-meet portal-meet', href: link, target: '_blank', rel: 'noopener' }, [el('img', { src: 'img/rede-meet.svg', alt: '', width: '40', height: '40' }), el('span', { text: 'Entrar no atendimento' })]));
          else cartao.appendChild(el('p', { text: paraAdmin ? 'Esse compromisso não tem link do Meet.' : 'O link da videochamada chega pelo WhatsApp.' }));
          lugar.appendChild(cartao);
        });
    }).catch(function () { /* sem o cartão, a página segue normal */ });
    return lugar;
  }

  /* Não contar as visitas de quem administra: o contador (GoatCounter) ignora o aparelho que tem skipgc = 't' guardado. Quem é administrador (função sou_admin
     do Supabase) ganha essa marca em qualquer navegador ou app em que abrir uma tela com login; a marca vale para o site todo naquele aparelho. */
  (function () {
    try { if (localStorage.getItem('skipgc') === 't') return; } catch (e) { return; }
    client.auth.getSession().then(function (r) {
      if (!(r.data && r.data.session)) return;
      return client.rpc('sou_admin').then(function (x) {
        if (x && x.data === true) { try { localStorage.setItem('skipgc', 't'); } catch (e) { /* sem armazenamento */ } }
      });
    }).catch(function () {});
  })();

  /* "← Voltar" em terracota: o botão de voltar padrão das telas do painel (em cima e embaixo de cada tela) */
  function botaoVoltar(aoClicar) {
    var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '← Voltar' });
    b.style.cssText = 'color:#A03E25!important;font-weight:700';
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* Campo com lista de escolha, o mesmo do Financeiro: campo comum onde se digita, apaga e escreve o que quiser; embaixo abre uma lista só de texto com o que combina.
     itens() devolve [{ valor, rotulo, busca }]; aoEscolher(item) roda quando toca num item; mostrarTudoNoFoco abre a lista já ao tocar no campo. Devolve [campo, lista]. */
  function combo(input, itens, aoEscolher, mostrarTudoNoFoco) {
    var lista = el('div', { style: 'display:none;margin:-8px 0 14px;border-top:2px solid #1F5FA3' });
    function fechar() { lista.style.display = 'none'; lista.textContent = ''; }
    function abrir() {
      var t = input.value.trim().toLowerCase();
      var achados = itens().filter(function (i) { return t ? (i.busca.indexOf(t) >= 0 && i.valor.toLowerCase() !== t) : mostrarTudoNoFoco; }).slice(0, 8);
      lista.textContent = '';
      if (!achados.length) { lista.style.display = 'none'; return; }
      achados.forEach(function (i) {
        var l = el('div', { text: i.rotulo, style: 'padding:10px 4px;border-bottom:1px solid rgba(31,95,163,.5);cursor:pointer;font-size:16px;font-weight:700' });
        l.addEventListener('pointerdown', function (ev) { ev.preventDefault(); aoEscolher(i); fechar(); });
        lista.appendChild(l);
      });
      lista.style.display = '';
    }
    input.addEventListener('input', abrir);
    if (mostrarTudoNoFoco) input.addEventListener('focus', abrir);
    input.addEventListener('blur', function () { setTimeout(fechar, 200); });
    return [input, lista];
  }
  /* os serviços para escolher: os cadastrados no Financeiro (fin_servicos) mais os do site que ainda não estão lá (precisa de carrinho.js na página; sem ele, só os cadastrados) */
  function servicosParaEscolher() {
    var site = [];
    try {
      var s = (window.Carrinho && window.Carrinho.servicos) || {};
      site = Object.keys(s).filter(function (k) { return !/teste/i.test(k); }).map(function (k) { return { nome: s[k].titulo, valor: s[k].centavos / 100 }; });
    } catch (e) { /* sem os do site */ }
    return client.from('fin_servicos').select('nome,valor').order('nome').then(function (r) {
      var cad = (!r.error && r.data) || [], tem = {};
      cad.forEach(function (x) { tem[String(x.nome).toLowerCase()] = true; });
      return cad.map(function (x) { return { nome: x.nome, valor: x.valor }; }).concat(site.filter(function (x) { return !tem[x.nome.toLowerCase()]; }));
    }, function () { return site; });
  }

  /* Apagar / Excluir / Remover / Tirar: SEMPRE assim, discreto (texto pequeno, apagado e sublinhado, sem contorno nem cor de destaque), para ninguém tocar sem querer.
     Fica longe dos outros botões, no fim da tela (ver apagarNoFim). A confirmação continua sendo de quem chama. */
  function botaoApagar(texto) {
    var b = el('button', { type: 'button', class: 'portal-apagar', text: texto });
    return b;
  }
  function apagarNoFim(app, botao) { /* no fim da tela, centralizado e bem afastado */
    app.appendChild(el('div', { style: 'margin:56px 0 8px;text-align:center' }, [botao]));
  }

  /* ← Voltar no FIM da tela, mesmo que as seções cheguem depois (carregamento assíncrono): fica sempre por último; sai sozinho quando a tela é limpa */
  function voltarNoFim(app, aoClicar) {
    var caixa = el('div', { class: 'portal-acoes', style: 'margin:24px 0 8px' }, [botaoVoltar(aoClicar)]);
    app.appendChild(caixa);
    var obs = new MutationObserver(function () {
      if (caixa.parentNode !== app) { obs.disconnect(); return; }
      if (app.lastChild !== caixa) app.appendChild(caixa);
    });
    obs.observe(app, { childList: true });
    return caixa;
  }

  /* ---------- avisos no celular (Web Push) ----------
     Quem manda é o servidor (api/push.js); aqui o aparelho só pede permissão, se cadastra e conta que algo aconteceu.
     No iPhone/iPad só funciona no app instalado pela tela inicial. */
  var API_PUSH = 'https://falandodeastrologia.vercel.app/api/push';
  var suportaAvisos = function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; };
  var ehIOS = function () { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
  var appInstalado = function () { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  var chaveEmBytes = function (b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4), base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(base), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  };
  function chamarPush(acao, corpo) {
    return client.auth.getSession().then(function (r) {
      var jwt = r.data && r.data.session && r.data.session.access_token;
      if (!jwt) throw new Error('sem login');
      return fetch(API_PUSH + '?acao=' + acao, { method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    }).then(function (resp) { return resp.json().catch(function () { return {}; }).then(function (d) { return { ok: resp.ok, dados: d }; }); });
  }
  var registrarAvisos = function () { return navigator.serviceWorker.register('/sw.js').then(function () { return navigator.serviceWorker.ready; }); };
  function jaAtivado() {
    if (!suportaAvisos() || Notification.permission !== 'granted') return Promise.resolve(false);
    return navigator.serviceWorker.getRegistration('/sw.js').then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).then(function (sub) { return !!sub; }, function () { return false; });
  }
  function ativarAvisos() {
    /* o pedido de permissão tem de sair direto do toque (regra do iPhone) */
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('negado');
      return registrarAvisos();
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub) return sub;
        /* a chave pública dos avisos vem do servidor (ele mesmo a criou) */
        return fetch(API_PUSH + '?acao=chave', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d || !d.chave) throw new Error('servidor');
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(d.chave) });
        });
      });
    }).then(function (sub) {
      return chamarPush('inscrever', { subscription: sub.toJSON(), aparelho: navigator.userAgent.slice(0, 160) }).then(function (r) { if (!r.ok) throw new Error('servidor'); });
    });
  }
  function desativarAvisos() {
    return navigator.serviceWorker.getRegistration('/sw.js').then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).then(function (sub) {
      if (!sub) return;
      var endpoint = sub.endpoint;
      return chamarPush('desinscrever', { endpoint: endpoint }).catch(function () {}).then(function () { return sub.unsubscribe(); });
    });
  }
  /* conta ao servidor que algo aconteceu (evento: 'enviada', 'nova' ou 'corrigida'); se falhar, ninguém precisa saber: o resto continua funcionando */
  function avisar(evento, atividadeId) {
    if (!atividadeId) return Promise.resolve();
    return chamarPush('avisar', { evento: evento, atividade_id: atividadeId }).then(function (r) { if (!r.ok && window.console) console.warn('Aviso não enviado', r.dados); }, function () {});
  }
  /* cartão "Avisos no celular": papel 'admin' ou 'aluno' só muda o texto de explicação */
  function cartaoAvisos(papel) {
    var corpo = el('div', {});
    var caixa = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Avisos no celular' }), corpo]);
    var explicacao = papel === 'admin' ? 'Receba um aviso quando um aluno enviar uma atividade.' : 'Receba um aviso quando tiver uma atividade nova ou quando o Cássio corrigir a sua.';
    function desenhar() {
      corpo.textContent = '';
      var msg = el('p', { class: 'portal-msg' });
      if (!suportaAvisos()) {
        corpo.appendChild(el('p', { text: ehIOS() && !appInstalado() ? 'No iPhone e no iPad os avisos funcionam depois de instalar o app: no Safari, toque em Compartilhar e em Adicionar à Tela de Início. Depois abra por lá e volte aqui.' : 'Este navegador não permite avisos.' }));
        return;
      }
      if (Notification.permission === 'denied') { corpo.appendChild(el('p', { text: 'Os avisos estão bloqueados neste aparelho. Para receber, libere as notificações deste site nas configurações do navegador.' })); return; }
      jaAtivado().then(function (ativo) {
        if (ativo) {
          var desligar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Desativar neste aparelho' });
          desligar.addEventListener('click', function () { desligar.disabled = true; desativarAvisos().then(desenhar, desenhar); });
          corpo.appendChild(el('p', { text: 'Avisos ativados neste aparelho.' }));
          corpo.appendChild(el('div', { class: 'portal-acoes' }, [desligar]));
          return;
        }
        var ligar = el('button', { type: 'button', class: 'portal-btn', text: 'Ativar avisos neste aparelho' });
        ligar.addEventListener('click', function () {
          ligar.disabled = true; mensagem(msg, 'Ativando...');
          ativarAvisos().then(desenhar, function (e) {
            ligar.disabled = false;
            mensagem(msg, e && e.message === 'negado' ? 'Sem a sua permissão não dá para avisar. Toque de novo e escolha Permitir.' : 'Não consegui ativar agora. Tente de novo em instantes.', 'erro');
          });
        });
        corpo.appendChild(el('p', { text: explicacao }));
        corpo.appendChild(el('div', { class: 'portal-acoes' }, [ligar]));
        corpo.appendChild(msg);
      });
    }
    desenhar();
    return caixa;
  }

  window.portal = {
    cartaoAtendimento: cartaoAtendimento,
    proximoEncontro: proximoEncontro, textoEncontro: textoEncontro,
    paletaIcones: paletaIcones, iconesNosCampos: iconesNosCampos, semIcones: semIcones,
    client: client, el: el, linkSeguro: linkSeguro, ordenarPorCodigo: ordenarPorCodigo, botaoDrive: botaoDrive, cartaoPastaDrive: cartaoPastaDrive, cartaoPastaBase: cartaoPastaBase, playerGravacao: playerGravacao, linkAplicacoes: linkAplicacoes, sanfona: sanfona, estado: estado, navAdmin: navAdmin, idArquivoDrive: idArquivoDrive, cartaoConexaoDrive: cartaoConexaoDrive, dataBR: dataBR,
    traduzErro: traduzErro, mensagem: mensagem, montarLogin: montarLogin, montarNovaSenha: montarNovaSenha,
    emRecuperacao: emRecuperacao, entrarComGoogle: entrarComGoogle, nomeDoGoogle: nomeDoGoogle,
    avisos: { avisar: avisar, cartao: cartaoAvisos }, botaoVoltar: botaoVoltar, voltarNoFim: voltarNoFim, combo: combo, servicosParaEscolher: servicosParaEscolher, botaoApagar: botaoApagar, apagarNoFim: apagarNoFim
  };
})();
