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
    return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + destino } });
  }
  function nomeDoGoogle(user) {
    var m = (user && user.user_metadata) || {};
    return m.full_name || m.name || '';
  }

  /* "entrou por link de recuperação de senha" — o Supabase limpa o # logo depois de ler, então decide já no carregamento */
  var emRecuperacao = /type=recovery/.test(location.hash);

  window.portal = {
    client: client, el: el, linkSeguro: linkSeguro, dataBR: dataBR,
    traduzErro: traduzErro, mensagem: mensagem, montarLogin: montarLogin, montarNovaSenha: montarNovaSenha,
    emRecuperacao: emRecuperacao, entrarComGoogle: entrarComGoogle, nomeDoGoogle: nomeDoGoogle
  };
})();
