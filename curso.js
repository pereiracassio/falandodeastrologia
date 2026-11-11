/* Curso na página do aluno: módulos (os que ainda não foram liberados ficam com cadeado), apostila e aulas.
   window.curso.buscar(email) -> matrícula (ou null); window.curso.cartao(m, app, voltar) -> elemento da aba */
(function () {
  var P = window.portal, el = P.el, C = P.client;

  function idDoVideo(origem, codigo) {
    var c = String(codigo || '').trim();
    var m = origem === 'drive' ? /\/d\/([A-Za-z0-9_-]+)/.exec(c) || /[?&]id=([A-Za-z0-9_-]+)/.exec(c)
      : /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/.exec(c);
    return m ? m[1] : c;
  }
  function enderecoDoVideo(origem, codigo) {
    var id = idDoVideo(origem, codigo);
    if (!id) return '';
    return origem === 'drive' ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview'
      : 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?rel=0&modestbranding=1';
  }

  function buscar(email) {
    return C.from('curso_matriculas').select('id,curso_id,modulo_liberado').eq('email', String(email || '').toLowerCase()).limit(1).maybeSingle()
      .then(function (r) { return r.error ? null : r.data; }, function () { return null; });
  }

  function telaDaAula(app, aula, voltar) {
    app.textContent = '';
    app.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 10px' }, [P.botaoVoltar(voltar)]));
    app.appendChild(el('h2', { class: 'curso-titulo', text: aula.tipo === 'ao_vivo' ? 'Aula ao vivo' : aula.titulo }));
    if (aula.tipo === 'ao_vivo') {
      if (aula.data_hora) app.appendChild(el('p', { text: 'Ao vivo · ' + new Date(aula.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }));
      if (aula.link_meet) app.appendChild(el('p', {}, [el('a', { href: aula.link_meet, target: '_blank', rel: 'noopener', class: 'portal-btn portal-btn-meet', text: 'Entrar na aula' })]));
    }
    var url = enderecoDoVideo(aula.video_origem, aula.video_codigo);
    if (url) {
      var caixa = el('div', { style: 'position:relative;width:100%;aspect-ratio:16/9;background:#000;margin:0 0 14px' });
      var f = el('iframe', { src: url, title: aula.tipo === 'ao_vivo' ? 'Aula ao vivo' : aula.titulo, allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: '' });
      f.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0';
      caixa.appendChild(f); app.appendChild(caixa);
    }
    P.voltarNoFim(app, voltar);
    window.scrollTo(0, 0);
  }

  function cartao(m, app, voltarParaAba) {
    var caixa = el('div', {}, [el('p', { class: 'portal-vazio', text: 'Carregando...' })]);
    Promise.all([
      C.from('cursos').select('id,titulo').eq('id', m.curso_id).maybeSingle(),
      C.from('curso_modulos').select('id,ordem,titulo,apostila_nome').eq('curso_id', m.curso_id).order('ordem'),
      C.from('curso_aulas').select('id,modulo_id,ordem,titulo,video_origem,video_codigo,video_teste,tipo,data_hora,link_meet').order('ordem')
    ]).then(function (rs) {
      caixa.textContent = '';
      if (rs[0].error || rs[1].error || rs[2].error || !rs[0].data) { caixa.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar o curso agora.' })); return; }
      var modulos = rs[1].data || [], aulas = rs[2].data || [];
      caixa.appendChild(el('h2', { text: rs[0].data.titulo }));
      modulos.forEach(function (mo) {
        var aberto = mo.ordem <= m.modulo_liberado;
        var tit = el('p', { class: 'proj-titulo', style: 'margin:0 0 6px;font-weight:700;color:' + (aberto ? FdaTema.cor('terracota') : 'var(--preto-tinta,#16233F);opacity:.55'), text: (aberto ? '' : '🔒 ') + (mo.ordem === 0 ? '' : 'Módulo ' + mo.ordem + ' · ') + mo.titulo });
        var bloco = el('div', { style: 'margin:0 0 18px;padding:0 0 12px;border-bottom:2px solid var(--azul-egipcio-claro,#1F5FA3)' }, [tit]);
        if (aberto) {
          if (mo.apostila_nome) bloco.appendChild(el('p', { style: 'margin:0 0 8px', text: 'Apostila: ' + mo.apostila_nome }));
          var contaTipo = { gravada: 0, ao_vivo: 0 };
          aulas.filter(function (a) { return a.modulo_id === mo.id; }).forEach(function (a) {
            var num = ++contaTipo[a.tipo === 'ao_vivo' ? 'ao_vivo' : 'gravada'];
            var l = el('a', { href: '#', style: 'display:block;margin:0 0 6px;color:var(--azul-egipcio-escuro,#1034A6);text-decoration:none', text: num + '. ' + (a.tipo === 'ao_vivo' ? 'Aula ao vivo' : a.titulo) });
            l.addEventListener('click', function (ev) { ev.preventDefault(); telaDaAula(app, a, voltarParaAba); });
            bloco.appendChild(l);
            if (a.tipo === 'ao_vivo' && a.data_hora) bloco.appendChild(el('p', { class: 'prod-sub', style: 'margin:-2px 0 8px', text: 'ao vivo · ' + new Date(a.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }));
          });
        }
        caixa.appendChild(bloco);
      });
    });
    return caixa;
  }

  window.curso = { buscar: buscar, cartao: cartao, enderecoDoVideo: enderecoDoVideo, idDoVideo: idDoVideo };
})();
