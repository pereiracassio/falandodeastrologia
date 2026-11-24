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
        if (ctx && ctx.marcar) ctx.marcar(aula.id).then(function (erro) {
          if (erro) app.insertBefore(el('p', { class: 'portal-msg erro', text: 'Não consegui registrar que você viu esta aula. Se a avaliação não abrir, avise o Cássio.' }), caixa.nextSibling);
        });
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

  /* avaliação ainda fechada: mostra as aulas que o aluno não viu, nas próprias capinhas */
  function telaFaltam(app, mo, faltam, voltar, romano) {
    app.textContent = '';
    app.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 10px' }, [P.botaoVoltar(voltar)]));
    app.appendChild(el('h2', { class: 'curso-titulo', text: 'Avaliação · ' + (romano ? 'módulo ' + romano + ' · ' : '') + mo.titulo }));
    app.appendChild(el('p', { text: faltam.length === 1 ? 'Antes da avaliação, você ainda precisa assistir esta aula:' : 'Antes da avaliação, você ainda precisa assistir estas aulas:' }));
    var grade = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px;margin:14px 0' });
    faltam.forEach(function (x) {
      var c = el('div', { role: 'button', tabindex: '0', style: 'cursor:pointer;min-width:0' }, [window.capaAula({ romano: x.ctx.romano, nomeModulo: x.ctx.nomeModulo, numero: x.ctx.num, titulo: x.a.titulo })]);
      c.addEventListener('click', function () { telaDaAula(app, x.a, voltar, x.ctx); });
      grade.appendChild(c);
    });
    app.appendChild(grade);
    app.appendChild(el('div', { class: 'portal-acoes', style: 'margin:24px 0 8px' }, [P.botaoVoltar(voltar)]));
    window.scrollTo(0, 0);
  }

  /* ---------- avaliação do módulo: perguntas de marcar (mesmo desenho das atividades da mentoria); nota = acertos de 10; 7 ou mais libera o próximo módulo; refazer só depois de 24 horas ---------- */
  function notaTxt(n) { return String(n).replace('.', ','); }
  function horasParaRefazer(t) { return Math.ceil((new Date(t.criado_em).getTime() + 864e5 - Date.now()) / 36e5); }
  function legendaAvaliacao(ult) {
    if (!ult) return 'nota 7 ou mais libera o próximo módulo';
    if (ult.aprovado) return 'nota ' + notaTxt(ult.nota) + ' · aprovado';
    var h = horasParaRefazer(ult);
    return 'nota ' + notaTxt(ult.nota) + (h > 0 ? ' · você pode refazer em ' + h + (h === 1 ? ' hora' : ' horas') : ' · você pode refazer agora');
  }
  function telaAvaliacao(app, mo, perguntas, tentativas, voltar, romano) {
    var botaoOpcao = window.atividades.botaoOpcao;
    app.textContent = '';
    app.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 10px' }, [P.botaoVoltar(voltar)]));
    app.appendChild(el('h2', { class: 'curso-titulo', text: 'Avaliação · ' + (romano ? 'módulo ' + romano + ' · ' : '') + mo.titulo }));
    var corpo = el('div'); app.appendChild(corpo);
    app.appendChild(el('div', { class: 'portal-acoes', style: 'margin:24px 0 8px' }, [P.botaoVoltar(voltar)]));
    window.scrollTo(0, 0);

    function resultado(t) {
      corpo.textContent = '';
      corpo.appendChild(el('p', { class: 'portal-item-titulo', style: 'font-size:28px;margin:0 0 4px', text: 'Nota ' + notaTxt(t.nota) }));
      corpo.appendChild(el('p', { style: 'margin:0 0 14px', text: 'Você acertou ' + t.acertos + ' de ' + t.total + '.' }));
      var espera = !t.aprovado && horasParaRefazer(t) > 0;
      corpo.appendChild(el('p', { class: 'portal-msg ' + (t.aprovado ? 'ok' : 'erro'), text: t.aprovado ? 'Aprovado. O próximo módulo foi liberado.' : 'A nota mínima é 7. ' + (espera ? 'Você pode refazer em ' + horasParaRefazer(t) + (horasParaRefazer(t) === 1 ? ' hora.' : ' horas.') : 'Você já pode refazer.') }));
      perguntas.forEach(function (p, i) {
        var certa = t.resultado && t.resultado[p.id] === true, k = t.respostas ? t.respostas[p.id] : null;
        corpo.appendChild(el('p', { class: 'portal-item-titulo', style: 'margin:16px 0 8px', text: (i + 1) + '. ' + p.enunciado }));
        if (k != null && p.opcoes[k] != null) corpo.appendChild(botaoOpcao(String.fromCharCode(65 + Number(k)) + ') ' + p.opcoes[k] + (certa ? '  ✓' : '  ✗'), true, null));
        else corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Sem resposta.' }));
      });
      if (!t.aprovado && !espera) {
        var refazer = el('button', { type: 'button', class: 'portal-btn', text: 'Refazer' });
        refazer.addEventListener('click', formulario);
        corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:16px' }, [refazer]));
      }
    }
    function formulario() {
      corpo.textContent = '';
      var resp = {}, enviar = el('button', { type: 'button', class: 'portal-btn', text: 'Enviar avaliação' }), msg = el('p', { class: 'portal-msg' });
      function pronto() { enviar.disabled = !perguntas.every(function (p) { return resp[p.id] != null; }); }
      perguntas.forEach(function (p, i) {
        corpo.appendChild(el('p', { class: 'portal-item-titulo', style: 'margin:16px 0 8px', text: (i + 1) + '. ' + p.enunciado }));
        var caixa = el('div'); corpo.appendChild(caixa);
        (function desenhar() {
          caixa.textContent = '';
          p.opcoes.forEach(function (op, k) { caixa.appendChild(botaoOpcao(String.fromCharCode(65 + k) + ') ' + op, resp[p.id] === k, function () { resp[p.id] = k; desenhar(); pronto(); })); });
        })();
      });
      corpo.appendChild(msg); corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:16px' }, [enviar])); pronto();
      enviar.addEventListener('click', function () {
        enviar.disabled = true;
        C.rpc('enviar_avaliacao', { p_modulo: mo.id, p_respostas: resp }).then(function (r) {
          if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message || ''), 'erro'); pronto(); return; }
          var d = r.data || {};
          if (d.ok === false) { P.mensagem(msg, d.motivo === 'aprovado' ? 'Você já foi aprovado neste módulo.' : 'Você poderá refazer mais tarde.', 'erro'); return; }
          var t = { nota: d.nota, acertos: d.acertos, total: d.total, aprovado: d.aprovado, resultado: d.resultado, respostas: resp, criado_em: new Date().toISOString() };
          tentativas.unshift(t); resultado(t); window.scrollTo(0, 0);
        });
      });
    }
    var ult = tentativas[0];
    if (ult && (ult.aprovado || horasParaRefazer(ult) > 0)) resultado(ult); else formulario();
  }

  var API_PDF = 'https://falandodeastrologia.vercel.app/api/pdf';
  /* a apostila é uma folha de sulfite (A4 em pé) com a própria capa do PDF; abre no leitor e tem um "baixar" discreto */
  function folhaApostila(mo) {
    var nome = mo.apostila_nome || ('Apostila ' + mo.titulo);
    var url = C.storage.from('site').getPublicUrl('curso-apostila-' + mo.apostila_drive_id + '.jpg').data.publicUrl;
    var abrir = function () { window.Leitor.abrirDoServidor({ nome: nome, id: mo.apostila_drive_id, voltar: function () {} }); };
    var folha = el('div', { role: 'button', tabindex: '0', 'aria-label': 'Abrir ' + nome, style: 'aspect-ratio:210/297;background:#fff;border:1px solid #2B1D12;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center' });
    var img = el('img', { src: url, alt: nome, style: 'width:100%;height:100%;object-fit:cover;display:block' });
    img.addEventListener('error', function () { folha.textContent = ''; folha.appendChild(el('span', { class: 'proj-titulo', style: 'padding:14px;color:#1A1410', text: nome })); });
    folha.appendChild(img);
    folha.addEventListener('click', abrir);
    folha.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } });
    var baixar = P.botaoApagar('Baixar');
    baixar.addEventListener('click', function () {
      baixar.disabled = true;
      C.auth.getSession().then(function (r) {
        var sessao = r.data && r.data.session; if (!sessao) throw new Error('sem login');
        return fetch(API_PDF + '?id=' + encodeURIComponent(mo.apostila_drive_id), { headers: { Authorization: 'Bearer ' + sessao.access_token } });
      }).then(function (r) { if (!r.ok) throw new Error('servidor'); return r.blob(); }).then(function (b) {
        var a = el('a', { href: URL.createObjectURL(b), download: nome + '.pdf' }); document.body.appendChild(a); a.click(); a.remove();
      }).catch(function () { alert('Não consegui baixar agora.'); }).then(function () { baixar.disabled = false; });
    });
    return el('div', { style: 'width:190px;flex:none' }, [folha, el('div', { style: 'text-align:center;margin-top:6px' }, [baixar])]);
  }

  function cartao(m, app, voltarParaAba) {
    var caixa = el('div', {}, [el('p', { class: 'portal-vazio', text: 'Carregando...' })]);
    Promise.all([
      C.from('cursos').select('id,titulo').eq('id', m.curso_id).maybeSingle(),
      C.from('curso_modulos').select('id,ordem,titulo,apostila_nome,apostila_drive_id').eq('curso_id', m.curso_id).order('ordem'),
      C.from('curso_aulas').select('id,modulo_id,ordem,titulo,video_origem,video_codigo,video_teste,tipo,data_hora,link_meet').order('ordem'),
      C.from('curso_av_perguntas').select('id,modulo_id,ordem,enunciado,opcoes').order('ordem'),
      C.from('curso_av_tentativas').select('modulo_id,nota,acertos,total,aprovado,respostas,resultado,criado_em').order('criado_em', { ascending: false }),
      C.from('curso_aulas_vistas').select('aula_id')
    ]).then(function (rs) {
      caixa.textContent = '';
      if (rs[0].error || rs[1].error || rs[2].error || !rs[0].data) { caixa.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar o curso agora.' })); return; }
      var modulos = rs[1].data || [], aulas = rs[2].data || [];
      var perguntasTodas = rs[3].error ? [] : (rs[3].data || []), tentativasTodas = rs[4].error ? [] : (rs[4].data || []);
      /* aulas já vistas (marcadas quando o aluno toca em "assistir aula"); se a tabela não existe/falha, a avaliação não fica travada */
      var vistasOk = !rs[5].error, vistas = {}; (rs[5].data || []).forEach(function (x) { vistas[x.aula_id] = true; });
      function marcarVista(aulaId) {
        if (!vistasOk || vistas[aulaId]) return Promise.resolve(null);
        return C.auth.getSession().then(function (r) {
          var u = r.data && r.data.session && r.data.session.user; if (!u) throw new Error('sem login');
          return C.from('curso_aulas_vistas').upsert({ aula_id: aulaId, email: String(u.email || '').toLowerCase() }, { onConflict: 'aula_id,email', ignoreDuplicates: true });
        }).then(function (r) { if (r && r.error) throw r.error; vistas[aulaId] = true; return null; }, function (e) { return e || new Error('falhou'); });
      }
      caixa.appendChild(el('h2', { text: rs[0].data.titulo }));
      var vivoNoCurso = 0; /* aula ao vivo: numeração do curso inteiro; aula gravada: recomeça a cada módulo */
      modulos.forEach(function (mo) {
        var gravadasNoModulo = 0, gravadasDoModulo = [];
        var aberto = mo.ordem <= m.modulo_liberado;
        var romano = mo.ordem === 0 ? '' : (window.capaAula && window.capaAula.romano(mo.ordem));
        var bloco = el('div', { style: 'margin:0 0 26px;padding:0 0 22px;border-bottom:2px solid var(--azul-egipcio-claro,#1F5FA3)' });
        var linha = el('div', { style: 'display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start' });
        var grade = el('div', { style: 'flex:1 1 280px;min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px' });
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
          if (mo.apostila_drive_id) linha.appendChild(folhaApostila(mo));
          aulas.filter(function (a) { return a.modulo_id === mo.id; }).forEach(function (a) {
            var vivo = a.tipo === 'ao_vivo';
            var num = vivo ? 'aula ao vivo ' + (++vivoNoCurso) : ++gravadasNoModulo;
            var ctx = { romano: romano, nomeModulo: mo.titulo, num: num, marcar: marcarVista };
            if (!vivo && a.video_codigo) gravadasDoModulo.push({ a: a, ctx: ctx });
            var legenda = a.tipo === 'ao_vivo' && a.data_hora ? 'ao vivo · ' + new Date(a.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            grade.appendChild(cartaoCapa({ romano: romano, nomeModulo: mo.titulo, numero: num, titulo: a.titulo || 'aula ao vivo' }, function () { telaDaAula(app, a, voltarParaAba, ctx); }, legenda));
          });
        }
        if (aberto && window.atividades && window.atividades.botaoOpcao) {
          var pergs = perguntasTodas.filter(function (q) { return q.modulo_id === mo.id; }).sort(function (a, b) { return a.ordem - b.ordem; });
          if (pergs.length) {
            var tent = tentativasTodas.filter(function (t) { return t.modulo_id === mo.id; });
            var faltam = vistasOk && !tent.length ? gravadasDoModulo.filter(function (x) { return !vistas[x.a.id]; }) : [];
            var abrirAv = faltam.length ? function () { telaFaltam(app, mo, faltam, voltarParaAba, romano); } : function () { telaAvaliacao(app, mo, pergs, tent, voltarParaAba, romano); };
            grade.appendChild(cartaoCapa({ romano: romano, nomeModulo: mo.titulo, titulo: 'avaliação', formato: 'quase' }, abrirAv, faltam.length ? 'falta ver ' + faltam.length + (faltam.length === 1 ? ' aula' : ' aulas') : legendaAvaliacao(tent[0])));
          }
        }
        linha.appendChild(grade);
        bloco.appendChild(linha);
        caixa.appendChild(bloco);
      });
    });
    return caixa;
  }

  window.curso = { buscar: buscar, cartao: cartao, enderecoDoVideo: enderecoDoVideo, idDoVideo: idDoVideo };
})();
