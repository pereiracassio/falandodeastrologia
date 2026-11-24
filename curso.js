/* Curso na página do aluno: módulos (os que ainda não foram liberados ficam com cadeado), apostila e aulas.
   window.curso.buscar(email) -> matrícula (ou null); window.curso.cartao(m, app, voltar) -> elemento da aba */
(function () {
  var P = window.portal, el = P.el, C = P.client;

  function idDoVideo(origem, codigo) {
    var c = String(codigo || '').trim();
    var m = /\/d\/([A-Za-z0-9_-]+)/.exec(c) || /[?&]id=([A-Za-z0-9_-]+)/.exec(c);
    return m ? m[1] : c;
  }
  function enderecoDoVideo(origem, codigo) {
    var id = idDoVideo(origem, codigo);
    if (!id) return '';
    return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview';
  }

  function buscar(email) {
    return C.from('curso_matriculas').select('id,curso_id,modulo_liberado').eq('email', String(email || '').toLowerCase()).limit(1).maybeSingle()
      .then(function (r) { return r.error ? null : r.data; }, function () { return null; });
  }

  function telaDaAula(app, aula, voltar, ctx) {
    app.textContent = '';
    app.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 10px' }, [P.botaoVoltar(voltar)]));
    app.appendChild(el('h2', { class: 'curso-titulo', text: aula.titulo || 'Aula ao vivo' }));
    if (aula.tipo === 'ao_vivo') {
      if (aula.data_hora) app.appendChild(el('p', { text: 'Ao vivo · ' + new Date(aula.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }));
      if (aula.link_meet) app.appendChild(el('p', {}, [el('a', { href: aula.link_meet, target: '_blank', rel: 'noopener', class: 'portal-btn portal-btn-meet', text: 'Entrar na aula' })]));
    }
    var url = enderecoDoVideo(aula.video_origem, aula.video_codigo);
    if (url) {
      var caixa = el('div', { style: 'position:relative;width:100%;aspect-ratio:16/9;background:#000;margin:0 0 14px' });
      var tocar = function () {
        caixa.textContent = '';
        var f = el('iframe', { src: url, title: aula.titulo, allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: '' });
        f.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0';
        caixa.appendChild(f);
        if (botao.parentNode) botao.parentNode.removeChild(botao);
      };
      var botao = el('button', { type: 'button', class: 'portal-btn', style: 'margin:0 0 14px', text: 'assistir aula' });
      if (ctx && window.capaAula) {
        var capa = window.capaAula({ romano: ctx.romano, nomeModulo: ctx.nomeModulo, numero: ctx.num, titulo: aula.titulo });
        capa.style.cursor = 'pointer';
        caixa.style.background = 'none';
        caixa.appendChild(capa);
        capa.addEventListener('click', tocar); botao.addEventListener('click', tocar);
        app.appendChild(caixa); app.appendChild(botao);
      } else { tocar(); app.appendChild(caixa); }
    } else if (ctx && window.capaAula) {
      /* aula ao vivo ainda sem gravação: só a capa, no mesmo lugar do vídeo */
      var soCapa = window.capaAula({ romano: ctx.romano, nomeModulo: ctx.nomeModulo, numero: ctx.num, titulo: aula.titulo });
      soCapa.style.margin = '0 0 14px';
      app.appendChild(soCapa);
    }
    P.voltarNoFim(app, voltar);
    window.scrollTo(0, 0);
  }

  function cartao(m, app, voltarParaAba) {
    var caixa = el('div', {}, [el('p', { class: 'portal-vazio', text: 'Carregando...' })]);
    Promise.all([
      C.from('cursos').select('id,titulo').eq('id', m.curso_id).maybeSingle(),
      C.from('curso_modulos').select('id,ordem,titulo,apostila_nome,apostila_drive_id').eq('curso_id', m.curso_id).order('ordem'),
      C.from('curso_aulas').select('id,modulo_id,ordem,titulo,video_origem,video_codigo,video_teste,tipo,data_hora,link_meet').order('ordem')
    ]).then(function (rs) {
      caixa.textContent = '';
      if (rs[0].error || rs[1].error || rs[2].error || !rs[0].data) { caixa.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar o curso agora.' })); return; }
      var modulos = rs[1].data || [], aulas = rs[2].data || [];
      caixa.appendChild(el('h2', { text: rs[0].data.titulo }));
      modulos.forEach(function (mo) {
        var aberto = mo.ordem <= m.modulo_liberado;
        var romano = mo.ordem === 0 ? '' : (window.capaAula && window.capaAula.romano(mo.ordem));
        var bloco = el('div', { style: 'margin:0 0 26px;padding:0 0 22px;border-bottom:2px solid var(--azul-egipcio-claro,#1F5FA3)' });
        var grade = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px' });
        function cartaoCapa(opcoes, aoTocar, legenda, trancado) {
          var c = el('div', { style: 'position:relative;min-width:0' });
          var capa = window.capaAula(opcoes);
          c.appendChild(capa);
          if (trancado) {
            capa.style.opacity = '.45';
            c.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#1A1410" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)"><rect x="14" y="28" width="36" height="26" rx="2"/><path d="M22 28V20a10 10 0 0 1 20 0v8"/></svg>');
          } else if (aoTocar) {
            capa.style.cursor = 'pointer';
            c.setAttribute('role', 'button'); c.setAttribute('tabindex', '0');
            c.addEventListener('click', aoTocar);
            c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); aoTocar(); } });
          }
          if (legenda) c.appendChild(el('p', { class: 'prod-sub', style: 'margin:6px 0 0', text: legenda }));
          return c;
        }
        if (!window.capaAula) return;
        if (!aberto) {
          grade.appendChild(cartaoCapa({ romano: romano, nomeModulo: mo.titulo, titulo: '' }, null, '', true));
        } else {
          if (mo.apostila_drive_id) {
            grade.appendChild(cartaoCapa({ romano: romano, nomeModulo: mo.titulo, titulo: 'apostila' }, function () {
              window.Leitor.abrirDoServidor({ nome: mo.apostila_nome || ('Apostila ' + mo.titulo), id: mo.apostila_drive_id, voltar: function () {} });
            }));
          }
          var contaTipo = { gravada: 0, ao_vivo: 0 };
          aulas.filter(function (a) { return a.modulo_id === mo.id; }).forEach(function (a) {
            var num = ++contaTipo[a.tipo === 'ao_vivo' ? 'ao_vivo' : 'gravada'];
            var ctx = { romano: romano, nomeModulo: mo.titulo, num: num };
            var legenda = a.tipo === 'ao_vivo' && a.data_hora ? 'ao vivo · ' + new Date(a.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            grade.appendChild(cartaoCapa({ romano: romano, nomeModulo: mo.titulo, numero: num, titulo: a.titulo || 'aula ao vivo' }, function () { telaDaAula(app, a, voltarParaAba, ctx); }, legenda));
          });
        }
        bloco.appendChild(grade);
        caixa.appendChild(bloco);
      });
    });
    return caixa;
  }

  window.curso = { buscar: buscar, cartao: cartao, enderecoDoVideo: enderecoDoVideo, idDoVideo: idDoVideo };
})();
