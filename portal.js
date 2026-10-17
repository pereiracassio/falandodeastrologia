/* Portal do Aluno — peças comuns à página do aluno (aluno.html) e ao painel da administrador (admin-alunos.html).
   Projeto Supabase PRÓPRIO do Falando de Astrologia (separado do Astro Hellenic). A chave "publishable" é pública
   por natureza: quem protege os dados são as regras de acesso (RLS) de docs/portal-aluno.sql. */
(function () {
  var SUPABASE_URL = 'https://wqkgsotfwkzjwaowenrb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt';

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  var driveCarregado = null, driveToken = null, driveTokenAte = 0;

  function carregarScript(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = ok; s.onerror = function () { erro(new Error('script')); };
      document.head.appendChild(s);
    });
  }
  function carregarDrive() {
    if (!driveCarregado) driveCarregado = carregarScript('https://accounts.google.com/gsi/client').catch(function (e) { driveCarregado = null; throw e; });
    return driveCarregado;
  }
  function tokenDoDrive() {
    return new Promise(function (ok, erro) {
      if (driveToken && Date.now() < driveTokenAte) { ok(driveToken); return; }
      var tc = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CLIENT_ID,
        scope: DRIVE_ESCOPO,
        callback: function (r) {
          if (r.error || !r.access_token) { erro(new Error(r.error || 'sem token')); return; }
          driveToken = r.access_token; driveTokenAte = Date.now() + (Number(r.expires_in || 3000) - 60) * 1000;
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
      if (r.status === 401) { driveToken = null; }
      if (!r.ok) throw new Error('lista');
      return r.json();
    });
  }
  var PASTA_MIME = 'application/vnd.google-apps.folder';

  /* abre a lista; soPastas: só deixa escolher pasta */
  function abrirListaDoDrive(token, soPastas, aoEscolher) {
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
    var aspas = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };
    function linha(texto, extras) {
      var l = el('div'); l.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(31,95,163,.35)';
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
        lista.textContent = '';
        lista.appendChild(el('p', { text: 'Não foi possível carregar o Drive. Feche e tente de novo.' }));
      });
    }
    var espera = null;
    busca.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(function () { carregar(); }, 400); });
    carregar();
  }

  /* escolherDoDrive(function (url, id, token) { ... }, function (textoDeErro) { ... }, soPastas) */
  function escolherDoDrive(aoEscolher, aoErrar, soPastas) {
    carregarDrive().then(tokenDoDrive).then(function (token) {
      abrirListaDoDrive(token, soPastas, aoEscolher);
    }).catch(function (e) {
      if (aoErrar && !/popup_closed|access_denied|cancel/i.test(String(e.message))) aoErrar('Não foi possível entrar no Google Drive. Tente de novo.');
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
  function botaoDrive(campo, aviso, email) {
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
      }, function (t) { aviso(t, 'erro'); });
    });
    return b;
  }

  /* Pasta no Drive: a pasta-mãe (dos alunos ou dos clientes) é escolhida uma vez e fica guardada no Supabase (tabela drive_pastas);
     cada aluno/cliente ganha, dentro dela, uma pasta "código - nome" compartilhada com o e-mail dele.
     opcoes: { plural: 'alunos'|'clientes', tipo: 'aluno'|'cliente', id, nome: function () { return 'código - nome'; }, email } */
  function cartaoPastaDrive(opcoes) {
    var chaveBase = 'base_' + opcoes.plural, chaveItem = opcoes.tipo + ':' + opcoes.id;
    var msg = el('p', { class: 'portal-msg' });
    var corpo = el('div');
    var cartao = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Pasta no Drive' }), corpo, msg]);
    var aviso = function (t, tipo) { mensagem(msg, t, tipo); };
    var linkPasta = function (id) { return 'https://drive.google.com/drive/folders/' + encodeURIComponent(id); };
    function guardar(chave, pastaId) { return client.from('drive_pastas').upsert({ chave: chave, pasta_id: pastaId }, { onConflict: 'chave' }); }
    function botao(texto, aoClicar, sec) {
      var b = el('button', { type: 'button', class: 'portal-btn' + (sec ? ' portal-btn-sec' : ''), text: texto });
      b.addEventListener('click', function () { aoClicar(b); });
      return b;
    }
    function escolherBase() {
      escolherDoDrive(function (url, id) {
        guardar(chaveBase, id).then(function (r) {
          if (r.error) { aviso(traduzErro(r.error.message), 'erro'); return; }
          desenhar();
          aviso('Pasta escolhida.', 'ok');
        });
      }, function (t) { aviso(t, 'erro'); }, true);
    }
    function criar(b, baseId) {
      b.disabled = true; aviso('Criando a pasta...', 'ok');
      carregarDrive().then(tokenDoDrive).then(function (token) {
        return fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: opcoes.nome(), mimeType: 'application/vnd.google-apps.folder', parents: [baseId] })
        }).then(function (r) { if (!r.ok) throw new Error('criar'); return r.json(); }).then(function (pasta) {
          return guardar(chaveItem, pasta.id).then(function () {
            return compartilharNoDrive(pasta.id, token, opcoes.email).then(function () { return true; }, function () { return false; });
          }).then(function (compartilhou) {
            desenhar();
            aviso(compartilhou ? 'Pasta criada e compartilhada com ' + opcoes.email + '.' : 'Pasta criada, mas não consegui compartilhar com ' + opcoes.email + ' (o e-mail precisa ser uma conta Google). Compartilhe no Drive.', compartilhou ? 'ok' : 'erro');
          });
        });
      }).catch(function (e) {
        b.disabled = false;
        if (!/popup_closed|access_denied|cancel/i.test(String(e.message))) aviso('Não foi possível criar a pasta. Se a pasta escolhida foi apagada ou trocada, escolha de novo.', 'erro');
        else aviso('');
      });
    }
    function desenhar() {
      corpo.textContent = '';
      carregarDrive().catch(function () {});
      client.from('drive_pastas').select('chave,pasta_id').in('chave', [chaveBase, chaveItem]).then(function (r) {
        if (r.error) { corpo.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a pasta do Drive.' })); return; }
        var m = {};
        (r.data || []).forEach(function (x) { m[x.chave] = x.pasta_id; });
        if (!m[chaveBase]) {
          corpo.appendChild(el('p', { text: 'Primeiro escolha a pasta do seu Drive onde ficarão as pastas dos ' + opcoes.plural + '. Só precisa fazer isso uma vez.' }));
          corpo.appendChild(botao('Escolher a pasta dos ' + opcoes.plural, escolherBase));
          return;
        }
        if (m[chaveItem]) {
          corpo.appendChild(el('p', { text: 'A pasta já existe no seu Drive.' }));
          corpo.appendChild(el('a', { class: 'portal-btn', href: linkPasta(m[chaveItem]), target: '_blank', rel: 'noopener', text: 'Abrir a pasta' }));
        } else {
          corpo.appendChild(el('p', { text: 'Cria a pasta "' + opcoes.nome() + '" dentro da pasta dos ' + opcoes.plural + ' e compartilha com ' + opcoes.email + '.' }));
          corpo.appendChild(botao('Criar a pasta no Drive', function (b) { criar(b, m[chaveBase]); }));
        }
        corpo.appendChild(el('p', { class: 'portal-vazio' }, [botao('Trocar a pasta dos ' + opcoes.plural, escolherBase, true)]));
      });
    }
    desenhar();
    return cartao;
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

  window.portal = {
    client: client, el: el, linkSeguro: linkSeguro, botaoDrive: botaoDrive, cartaoPastaDrive: cartaoPastaDrive, dataBR: dataBR,
    traduzErro: traduzErro, mensagem: mensagem, montarLogin: montarLogin, montarNovaSenha: montarNovaSenha,
    emRecuperacao: emRecuperacao, entrarComGoogle: entrarComGoogle, nomeDoGoogle: nomeDoGoogle
  };
})();
