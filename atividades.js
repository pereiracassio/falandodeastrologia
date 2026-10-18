/* Atividades (perguntas de múltipla escolha e dissertativas) — cada aluno tem as suas.
   O administrador cria no painel (admin-alunos.html), o aluno responde na página dele (aluno.html) e envia,
   o administrador corrige ali mesmo e o aluno vê a correção. Tabelas e regras de acesso: docs/atividades.sql.
   Depende de portal.js (window.portal). Sem campo nativo no papiro: as opções são botões de contorno azul (escolhida = contorno grosso). */
(function () {
  var P = window.portal, el = P.el, C = P.client;
  var SITUACOES = { certo: 'Certo', errado: 'Errado', parcial: 'Parcialmente certo' };

  function dataHoraBR(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* datas: "AAAA-MM-DD" (campo de data) ou data com hora; nunca desloca o dia por fuso */
  function dataCurta(v) {
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) { var p = String(v).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    return new Date(v).toLocaleDateString('pt-BR');
  }
  var hojeISO = function () { return new Date().toLocaleDateString('sv-SE'); }; /* AAAA-MM-DD no dia do aparelho */
  var diaDe = function (iso) { return iso ? new Date(iso).toLocaleDateString('sv-SE') : ''; };
  var COLUNAS = 'id,titulo,descricao,criado_em,enviada_em,data_atividade,corrigida_em,antiga';
  var ordenar = function (q) { return q.order('data_atividade', { ascending: false, nullsFirst: false }).order('criado_em', { ascending: false }); };
  var dataPostagem = function (a) { return a.data_atividade || diaDe(a.criado_em); };
  /* "Postada em 01/10/2026 · Respondida em 03/10/2026 · Corrigida em 05/10/2026" (só o que existe) */
  function linhaDatas(a) {
    var p = ['Postada em ' + dataCurta(dataPostagem(a))];
    if (a.enviada_em) p.push('Respondida em ' + dataCurta(a.enviada_em));
    if (a.corrigida_em) p.push('Corrigida em ' + dataCurta(a.corrigida_em));
    return p.join(' · ');
  }

  /* WhatsApp: abre a conversa com a mensagem pronta; quem envia (e pode editar antes) é a própria pessoa, nada sai sozinho */
  var SITE_ALUNO = 'https://falandodeastrologia.com.br/aluno.html';
  var WHATS_ADMIN = '5511970404508';
  function numeroWhats(n) {
    var d = String(n || '').replace(/\D/g, '');
    if (!d) return '';
    return (d.length === 10 || d.length === 11) ? '55' + d : d; /* sem código do país: Brasil */
  }
  function botaoWhats(rotulo, numero, mensagem) {
    var n = numeroWhats(numero);
    return el('a', { class: 'portal-btn portal-btn-whats', href: 'https://wa.me/' + n + '?text=' + encodeURIComponent(mensagem), target: '_blank', rel: 'noopener', text: rotulo });
  }
  var primeiroNome = function (nome) { return String(nome || '').trim().split(/\s+/)[0] || ''; };

  /* botão de opção (no lugar da bolinha nativa) */
  function botaoOpcao(texto, marcada, aoClicar) {
    var b = el('button', { type: 'button', text: texto, 'aria-pressed': marcada ? 'true' : 'false' });
    b.style.cssText = 'display:block;width:100%;text-align:left;background:transparent;color:#16233F;font:inherit;font-size:16px;cursor:pointer;border-radius:8px;margin:0 0 8px;' +
      (marcada ? 'border:3px solid #1F5FA3;padding:10px 12px' : 'border:1px solid #1F5FA3;padding:12px');
    if (aoClicar) b.addEventListener('click', aoClicar); else b.style.cursor = 'default';
    return b;
  }

  /* tudo de uma atividade: perguntas, respostas, correções (e gabarito, só o administrador consegue ler) */
  function carregar(atividadeId, comGabarito) {
    return C.from('atividade_perguntas').select('id,ordem,tipo,enunciado,opcoes').eq('atividade_id', atividadeId).order('ordem').then(function (rp) {
      if (rp.error) throw rp.error;
      var perguntas = rp.data || [];
      var ids = perguntas.map(function (p) { return p.id; });
      if (!ids.length) return { perguntas: [], respostas: {}, correcoes: {}, gabarito: {} };
      var pedidos = [
        C.from('atividade_respostas').select('pergunta_id,texto,opcao').in('pergunta_id', ids),
        C.from('atividade_correcoes').select('pergunta_id,situacao,comentario').in('pergunta_id', ids)
      ];
      if (comGabarito) pedidos.push(C.from('atividade_gabarito').select('pergunta_id,correta').in('pergunta_id', ids));
      return Promise.all(pedidos).then(function (r) {
        var mapa = function (res, campo) { var m = {}; ((res && res.data) || []).forEach(function (x) { m[x.pergunta_id] = x; }); return m; };
        return { perguntas: perguntas, respostas: mapa(r[0]), correcoes: mapa(r[1]), gabarito: comGabarito ? mapa(r[2]) : {} };
      });
    });
  }

  /* ============ ALUNO ============ */

  /* lista de atividades do aluno; aoAbrir(atividade) abre uma.
     opcoes.semMoldura: sem cartão nem título (quando já está dentro da aba); opcoes.aoCarregar(qtd): avisa quantas atividades vieram */
  function cartaoDoAluno(aluno, aoAbrir, opcoes) {
    opcoes = opcoes || {};
    var cartao = opcoes.semMoldura ? el('div') : el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Atividades' })]);
    cartao.style.display = 'none'; /* sem atividade nem aparece */
    ordenar(C.from('atividades').select(COLUNAS).eq('aluno_id', aluno.id)).then(function (r) {
      var lista = (r.error || !r.data) ? [] : r.data;
      if (opcoes.aoCarregar) opcoes.aoCarregar(lista.length);
      if (!lista.length) return;
      cartao.style.display = '';
      lista.forEach(function (a) {
        var abrir = el('button', { type: 'button', class: 'portal-btn', text: a.enviada_em ? 'Ver' : 'Responder' });
        abrir.addEventListener('click', function () { aoAbrir(a); });
        cartao.appendChild(el('div', { class: 'portal-item' }, [el('div', { class: 'portal-item-linha' }, [
          el('div', {}, [el('span', { class: 'portal-item-titulo', text: a.titulo }),
            el('span', { class: 'portal-item-data', text: linhaDatas(a) + (a.enviada_em ? '' : ' · Para responder') })]),
          abrir
        ])]));
      });
    });
    return cartao;
  }

  /* a atividade aberta: responder (se ainda não enviou) ou ver as respostas e a correção */
  function telaDaAtividadeAluno(app, atividade, aoVoltar, previa) {
    app.textContent = '';
    var voltar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '← Voltar' });
    voltar.addEventListener('click', aoVoltar);
    app.appendChild(el('div', { class: 'portal-topo' }, [voltar]));
    var corpo = el('div', {}, [el('p', { class: 'portal-vazio', text: 'Carregando...' })]);
    app.appendChild(corpo);

    carregar(atividade.id, false).then(function (d) {
      corpo.textContent = '';
      var editavel = !atividade.enviada_em;
      var msg = el('p', { class: 'portal-msg' });
      var respostas = {}; /* pergunta_id -> { texto, opcao } do que está na tela */
      Object.keys(d.respostas).forEach(function (k) { respostas[k] = { texto: d.respostas[k].texto, opcao: d.respostas[k].opcao }; });
      var sujo = {}; /* o que mudou e ainda não foi salvo */

      var cab = el('div', { class: 'portal-cartao' }, [el('h2', { text: atividade.titulo })]);
      if (atividade.descricao) cab.appendChild(el('p', { text: atividade.descricao, class: 'portal-descricao' }));
      cab.appendChild(el('p', { class: 'portal-item-data', text: linhaDatas(atividade) }));
      if (!editavel) {
        var corrigida = Object.keys(d.correcoes).some(function (k) { return d.correcoes[k].situacao || d.correcoes[k].comentario; });
        if (!corrigida && !atividade.antiga) {
          cab.appendChild(el('p', { class: 'portal-vazio', text: 'Quer avisar o Cássio que terminou? A mensagem já vai pronta no WhatsApp, e você pode mudar antes de enviar.' }));
          cab.appendChild(botaoWhats('Avisar o Cássio no WhatsApp', WHATS_ADMIN,
            'Oi Cássio! Terminei a atividade "' + atividade.titulo + '" e já enviei na área do aluno. Pode corrigir quando puder. ' + (atividade.alunoNome ? '(' + primeiroNome(atividade.alunoNome) + ')' : '')));
        }
      }
      corpo.appendChild(cab);

      d.perguntas.forEach(function (p, i) {
        var cartao = el('div', { class: 'portal-cartao' }, [el('p', { text: (i + 1) + '. ' + p.enunciado, class: 'portal-item-titulo' })]);
        var r = respostas[p.id] = respostas[p.id] || { texto: '', opcao: null };
        if (p.tipo === 'multipla') {
          var caixaOpcoes = el('div');
          var desenharOpcoes = function () {
            caixaOpcoes.textContent = '';
            (p.opcoes || []).forEach(function (op, k) {
              caixaOpcoes.appendChild(botaoOpcao(String.fromCharCode(65 + k) + ') ' + op, r.opcao === k, editavel ? function () {
                r.opcao = k; sujo[p.id] = true; desenharOpcoes();
              } : null));
            });
          };
          desenharOpcoes();
          cartao.appendChild(caixaOpcoes);
        } else {
          var t = el('textarea', { rows: '5', placeholder: 'Escreva a sua resposta' });
          t.value = r.texto || '';
          if (editavel) t.addEventListener('input', function () { r.texto = t.value; sujo[p.id] = true; });
          else { t.readOnly = true; }
          cartao.appendChild(t);
        }
        var c = d.correcoes[p.id];
        if (c && (c.situacao || c.comentario)) {
          var box = el('div', { class: 'portal-item' });
          if (c.situacao) box.appendChild(el('span', { class: 'portal-item-titulo', text: SITUACOES[c.situacao] }));
          if (c.comentario) box.appendChild(el('p', { class: 'portal-descricao', text: c.comentario }));
          cartao.appendChild(box);
        }
        corpo.appendChild(cartao);
      });

      if (!editavel) return;
      function salvarTudo() {
        var pedidos = Object.keys(sujo).map(function (id) {
          var r = respostas[id];
          return C.from('atividade_respostas').upsert({ pergunta_id: id, texto: r.texto || null, opcao: r.opcao == null ? null : r.opcao, atualizado_em: new Date().toISOString() }, { onConflict: 'pergunta_id' });
        });
        return Promise.all(pedidos).then(function (rs) {
          var falha = rs.filter(function (x) { return x.error; })[0];
          if (falha) throw falha.error;
          sujo = {};
        });
      }
      if (previa) cab.appendChild(el('p', { class: 'portal-msg erro', text: 'Prévia do administrador: nada do que for escrito aqui é salvo ou enviado.' }));
      var salvar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Salvar e continuar depois' });
      var enviar = el('button', { type: 'button', class: 'portal-btn', text: 'Enviar para correção' });
      salvar.addEventListener('click', function () {
        if (previa) { P.mensagem(msg, 'Isto é só uma prévia: nada foi salvo.', 'erro'); return; }
        salvar.disabled = true; P.mensagem(msg, 'Salvando...');
        salvarTudo().then(function () { salvar.disabled = false; P.mensagem(msg, 'Respostas salvas. Você pode voltar depois.', 'ok'); })
          .catch(function (e) { salvar.disabled = false; P.mensagem(msg, P.traduzErro(e.message), 'erro'); });
      });
      enviar.addEventListener('click', function () {
        if (previa) { P.mensagem(msg, 'Isto é só uma prévia: nada foi enviado.', 'erro'); return; }
        if (!confirm('Enviar para correção? Depois de enviar você não consegue mais mudar as respostas.')) return;
        enviar.disabled = true; salvar.disabled = true; P.mensagem(msg, 'Enviando...');
        salvarTudo().then(function () { return C.rpc('enviar_atividade', { p_id: atividade.id }); }).then(function (r) {
          if (r && r.error) throw r.error;
          atividade.enviada_em = new Date().toISOString();
          telaDaAtividadeAluno(app, atividade, aoVoltar, previa);
        }).catch(function (e) { enviar.disabled = false; salvar.disabled = false; P.mensagem(msg, P.traduzErro(e.message), 'erro'); });
      });
      corpo.appendChild(msg);
      corpo.appendChild(el('div', { class: 'portal-acoes' }, [salvar, enviar]));
    }).catch(function () {
      corpo.textContent = '';
      corpo.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a atividade agora.' }));
    });
  }

  /* ============ ADMINISTRADOR ============ */

  function situacaoDaAtividade(a, qtdPerguntas, qtdCorrigidas) {
    if (!a.enviada_em) return 'O aluno ainda não enviou';
    if (qtdPerguntas && qtdCorrigidas >= qtdPerguntas) return 'Enviada e corrigida';
    return 'Enviada, aguardando correção';
  }

  /* cartão "Atividades" na página do aluno, no painel */
  function painelAdmin(aluno) {
    var cartao = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Atividades' })]);
    var corpo = el('div');
    cartao.appendChild(corpo);

    function lista() {
      corpo.textContent = '';
      corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Carregando...' }));
      ordenar(C.from('atividades').select(COLUNAS).eq('aluno_id', aluno.id)).then(function (r) {
        corpo.textContent = '';
        var nova = el('button', { type: 'button', class: 'portal-btn', text: 'Nova atividade' });
        nova.addEventListener('click', function () { construtor(); });
        if (r.error) { corpo.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar as atividades.' })); return; }
        if (!r.data.length) corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhuma atividade ainda.' }));
        r.data.forEach(function (a) {
          var abrir = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: a.enviada_em ? 'Corrigir' : 'Abrir' });
          abrir.addEventListener('click', function () { telaDaAtividade(a); });
          var info = el('span', { class: 'portal-item-data', text: linhaDatas(a) + (a.enviada_em ? '' : ' · O aluno ainda não enviou') });
          corpo.appendChild(el('div', { class: 'portal-item' }, [el('div', { class: 'portal-item-linha' }, [
            el('div', {}, [el('span', { class: 'portal-item-titulo', text: a.titulo }), info]), abrir
          ])]));
        });
        corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:14px' }, [nova]));
      });
    }

    /* depois de salvar: oferece avisar o aluno no WhatsApp (mensagem pronta, você envia) */
    function avisarNovaAtividade(tituloAtividade) {
      corpo.textContent = '';
      corpo.appendChild(el('p', { class: 'portal-msg ok', text: 'Atividade salva.' }));
      corpo.appendChild(el('p', { text: 'Quer avisar ' + primeiroNome(aluno.nome) + ' no WhatsApp? A mensagem já vai pronta e você pode mudar antes de enviar.' }));
      var voltar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Voltar às atividades' });
      voltar.addEventListener('click', lista);
      corpo.appendChild(el('div', { class: 'portal-acoes' }, [
        botaoWhats('Avisar ' + primeiroNome(aluno.nome) + ' no WhatsApp', aluno.whatsapp,
          'Oi ' + primeiroNome(aluno.nome) + '! Deixei uma atividade nova para você na área do aluno: "' + tituloAtividade + '". Quando terminar, é só enviar por lá. ' + SITE_ALUNO),
        voltar
      ]));
      if (!aluno.whatsapp) corpo.appendChild(el('p', { class: 'portal-vazio', style: 'margin-top:10px', text: 'Dica: se você guardar o WhatsApp do aluno em "Dados do aluno", a conversa já abre direto com ele.' }));
    }

    /* criar uma atividade: nova (o aluno vai responder) ou antiga (já feita: você cola as respostas e as correções) */
    function construtor() {
      corpo.textContent = '';
      var msg = el('p', { class: 'portal-msg' });
      var antiga = false;
      var titulo = el('input', { type: 'text', placeholder: 'Ex.: Atividade sobre as casas' });
      var descricao = el('textarea', { rows: '3', placeholder: 'Instruções para o aluno (opcional)' });
      var dAtividade = el('input', { type: 'date' });
      var dResposta = el('input', { type: 'date' });
      var dCorrecao = el('input', { type: 'date' });
      var blocos = [];
      var areaPerguntas = el('div');

      /* escolha do tipo (botões, não campo nativo) */
      var modo = el('div', { class: 'portal-acoes', style: 'margin-bottom:14px' });
      var areaDatasAntiga = el('div');
      areaDatasAntiga.style.display = 'none';
      areaDatasAntiga.appendChild(el('p', { class: 'portal-vazio', style: 'margin-bottom:10px', text: 'Atividade que o aluno já fez: preencha as datas de quando aconteceu e cole, em cada pergunta, a resposta dele e a sua correção. Ela já fica como enviada, e ele não consegue mexer.' }));
      areaDatasAntiga.appendChild(el('label', { text: 'Data da atividade (quando foi passada)' })); areaDatasAntiga.appendChild(dAtividade);
      areaDatasAntiga.appendChild(el('label', { text: 'Data em que o aluno respondeu (opcional)' })); areaDatasAntiga.appendChild(dResposta);
      areaDatasAntiga.appendChild(el('label', { text: 'Data da correção (opcional; se não souber, deixe em branco)' })); areaDatasAntiga.appendChild(dCorrecao);
      function desenharModo() {
        modo.textContent = '';
        var b1 = botaoOpcao('Atividade nova (o aluno vai responder)', !antiga, function () { antiga = false; aplicarModo(); });
        var b2 = botaoOpcao('Atividade antiga (já feita)', antiga, function () { antiga = true; aplicarModo(); });
        b1.style.margin = '0'; b2.style.margin = '0'; b1.style.width = b2.style.width = 'auto';
        modo.appendChild(b1); modo.appendChild(b2);
      }
      function aplicarModo() {
        desenharModo();
        areaDatasAntiga.style.display = antiga ? '' : 'none';
        descricao.style.display = antiga ? 'none' : '';
        descricaoRotulo.style.display = antiga ? 'none' : '';
        blocos.forEach(function (b) { b.areaAntiga.style.display = antiga ? '' : 'none'; });
      }
      var descricaoRotulo = el('label', { text: 'Instruções (opcional)' });

      function novaPergunta() {
        var tipo = el('select', {}, [el('option', { value: 'dissertativa', text: 'Dissertativa (o aluno escreve)' }), el('option', { value: 'multipla', text: 'Múltipla escolha' })]);
        var enunciado = el('textarea', { rows: '3', placeholder: 'Escreva a pergunta' });
        var opcoes = el('textarea', { rows: '4', placeholder: 'Uma alternativa por linha' });
        var certa = el('select');
        var areaOpcoes = el('div', {}, [
          el('label', { text: 'Alternativas (uma por linha)' }), opcoes,
          el('label', { text: 'Alternativa certa (só você vê; serve para corrigir sozinho)' }), certa
        ]);
        areaOpcoes.style.display = 'none';
        /* só na atividade antiga: o que o aluno respondeu e a sua correção */
        var respTexto = el('textarea', { rows: '5', placeholder: 'Cole aqui a resposta do aluno' });
        var respOpcao = el('select');
        var sit = el('select', {}, [el('option', { value: '', text: 'Sem avaliação' })].concat(Object.keys(SITUACOES).map(function (k) { return el('option', { value: k, text: SITUACOES[k] }); })));
        var com = el('textarea', { rows: '4', placeholder: 'Cole aqui a sua correção (opcional)' });
        var rotuloResp = el('label', { text: 'Resposta do aluno' });
        var areaAntiga = el('div', {}, [rotuloResp, respTexto, respOpcao, el('label', { text: 'Sua correção' }), sit, com]);
        areaAntiga.style.display = 'none';
        var linhasOpcoes = function () { return opcoes.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
        function atualizarCerta() {
          var atual = certa.value, atualR = respOpcao.value;
          certa.textContent = ''; respOpcao.textContent = '';
          certa.appendChild(el('option', { value: '', text: 'Sem gabarito (eu corrijo)' }));
          respOpcao.appendChild(el('option', { value: '', text: 'O aluno não respondeu' }));
          linhasOpcoes().forEach(function (op, k) {
            var txt = String.fromCharCode(65 + k) + ') ' + op;
            certa.appendChild(el('option', { value: String(k), text: txt })); respOpcao.appendChild(el('option', { value: String(k), text: txt }));
          });
          certa.value = atual; respOpcao.value = atualR;
        }
        function mostrarTipo() {
          var m = tipo.value === 'multipla';
          areaOpcoes.style.display = m ? '' : 'none';
          respTexto.style.display = m ? 'none' : '';
          respOpcao.style.display = m ? '' : 'none';
        }
        opcoes.addEventListener('input', atualizarCerta);
        tipo.addEventListener('change', mostrarTipo);
        atualizarCerta(); mostrarTipo();
        var tirar = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Tirar esta pergunta' });
        var titulo = el('strong');
        var bloco = { tipo: tipo, enunciado: enunciado, linhasOpcoes: linhasOpcoes, certa: certa, respTexto: respTexto, respOpcao: respOpcao, sit: sit, com: com, areaAntiga: areaAntiga };
        var cx = el('div', { class: 'portal-cartao' }, [titulo, el('label', { text: 'Tipo' }), tipo, el('label', { text: 'Pergunta' }), enunciado, areaOpcoes, areaAntiga, tirar]);
        tirar.addEventListener('click', function () { blocos.splice(blocos.indexOf(bloco), 1); cx.remove(); numerar(); });
        bloco.caixa = cx; bloco.rotulo = titulo;
        areaAntiga.style.display = antiga ? '' : 'none';
        blocos.push(bloco); areaPerguntas.appendChild(cx); numerar();
      }
      function numerar() { blocos.forEach(function (b, i) { b.rotulo.textContent = 'Pergunta ' + (i + 1); }); }

      var maisUma = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '+ Outra pergunta' });
      maisUma.addEventListener('click', novaPergunta);
      var salvar = el('button', { type: 'button', class: 'portal-btn', text: 'Salvar atividade' });
      var cancelar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Cancelar' });
      cancelar.addEventListener('click', lista);
      salvar.addEventListener('click', function () {
        if (!titulo.value.trim()) { P.mensagem(msg, 'Escreva o título da atividade.', 'erro'); return; }
        if (antiga && !dAtividade.value) { P.mensagem(msg, 'Escolha a data da atividade.', 'erro'); return; }
        if (!blocos.length) { P.mensagem(msg, 'Coloque pelo menos uma pergunta.', 'erro'); return; }
        for (var i = 0; i < blocos.length; i++) {
          var b = blocos[i];
          if (!b.enunciado.value.trim()) { P.mensagem(msg, 'A pergunta ' + (i + 1) + ' está sem texto.', 'erro'); return; }
          if (b.tipo.value === 'multipla' && b.linhasOpcoes().length < 2) { P.mensagem(msg, 'A pergunta ' + (i + 1) + ' precisa de pelo menos 2 alternativas.', 'erro'); return; }
        }
        salvar.disabled = true; P.mensagem(msg, 'Salvando...');
        var registro = { aluno_id: aluno.id, titulo: titulo.value.trim(), descricao: antiga ? null : (descricao.value.trim() || null), data_atividade: antiga ? dAtividade.value : hojeISO(), antiga: antiga };
        if (antiga) {
          registro.enviada_em = new Date((dResposta.value || dAtividade.value) + 'T12:00:00').toISOString(); /* já feita: entra como enviada */
          registro.corrigida_em = dCorrecao.value || null;
        }
        C.from('atividades').insert(registro).select('id').single().then(function (r) {
          if (r.error) throw r.error;
          var linhas = blocos.map(function (b, i) {
            return { atividade_id: r.data.id, ordem: i, tipo: b.tipo.value, enunciado: b.enunciado.value.trim(), opcoes: b.tipo.value === 'multipla' ? b.linhasOpcoes() : null };
          });
          return C.from('atividade_perguntas').insert(linhas).select('id,ordem').then(function (rp) {
            if (rp.error) throw rp.error;
            var gab = [], resp = [], corr = [];
            rp.data.forEach(function (p) {
              var b = blocos[p.ordem];
              var multipla = b.tipo.value === 'multipla';
              if (multipla && b.certa.value !== '') gab.push({ pergunta_id: p.id, correta: Number(b.certa.value) });
              if (!antiga) return;
              var texto = multipla ? '' : b.respTexto.value.trim();
              var opcao = multipla && b.respOpcao.value !== '' ? Number(b.respOpcao.value) : null;
              if (texto || opcao !== null) resp.push({ pergunta_id: p.id, texto: texto || null, opcao: opcao });
              if (b.sit.value || b.com.value.trim()) corr.push({ pergunta_id: p.id, situacao: b.sit.value || null, comentario: b.com.value.trim() || null });
            });
            var passos = [];
            if (gab.length) passos.push(C.from('atividade_gabarito').insert(gab));
            if (resp.length) passos.push(C.from('atividade_respostas').insert(resp));
            if (corr.length) passos.push(C.from('atividade_correcoes').insert(corr));
            return Promise.all(passos).then(function (rs) { return { error: (rs.filter(function (x) { return x && x.error; })[0] || {}).error || null }; });
          });
        }).then(function (rg) {
          if (rg && rg.error) throw rg.error;
          if (antiga) lista(); else avisarNovaAtividade(titulo.value.trim());
        }).catch(function (e) { salvar.disabled = false; P.mensagem(msg, P.traduzErro(e.message), 'erro'); });
      });

      corpo.appendChild(modo);
      desenharModo();
      corpo.appendChild(el('label', { text: 'Título' })); corpo.appendChild(titulo);
      corpo.appendChild(areaDatasAntiga);
      corpo.appendChild(descricaoRotulo); corpo.appendChild(descricao);
      corpo.appendChild(areaPerguntas);
      novaPergunta();
      corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-bottom:14px' }, [maisUma]));
      corpo.appendChild(msg);
      corpo.appendChild(el('div', { class: 'portal-acoes' }, [salvar, cancelar]));
    }

    /* ver as respostas do aluno e corrigir */
    function telaDaAtividade(a) {
      corpo.textContent = '';
      var voltar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '← Atividades' });
      voltar.addEventListener('click', lista);
      corpo.appendChild(voltar);
      var area = el('div', { style: 'margin-top:14px' }, [el('p', { class: 'portal-vazio', text: 'Carregando...' })]);
      corpo.appendChild(area);

      carregar(a.id, true).then(function (d) {
        area.textContent = '';
        area.appendChild(el('p', { class: 'portal-item-titulo', text: a.titulo }));
        area.appendChild(el('p', { class: 'portal-item-data', text: linhaDatas(a) + (a.enviada_em ? '' : ' · O aluno ainda não enviou (o que aparece abaixo é um rascunho)') }));

        /* datas da atividade (dá pra acertar à mão, principalmente nas antigas) */
        var dAt = el('input', { type: 'date' }); dAt.value = dataPostagem(a);
        var dResp = el('input', { type: 'date' }); dResp.value = a.enviada_em ? diaDe(a.enviada_em) : '';
        var dCorr = el('input', { type: 'date' }); dCorr.value = a.corrigida_em || '';
        var msgDatas = el('p', { class: 'portal-msg' });
        var salvarDatas = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Salvar datas' });
        salvarDatas.addEventListener('click', function () {
          var campos = { data_atividade: dAt.value || null, corrigida_em: dCorr.value || null };
          if (a.enviada_em && dResp.value) campos.enviada_em = new Date(dResp.value + 'T12:00:00').toISOString();
          salvarDatas.disabled = true;
          C.from('atividades').update(campos).eq('id', a.id).then(function (r) {
            salvarDatas.disabled = false;
            if (r.error) { P.mensagem(msgDatas, P.traduzErro(r.error.message), 'erro'); return; }
            Object.assign(a, campos); P.mensagem(msgDatas, 'Datas salvas.', 'ok');
          });
        });
        var cartaoDatas = el('div', { class: 'portal-cartao' }, [el('p', { class: 'portal-item-titulo', text: 'Datas' }),
          el('label', { text: 'Data da atividade' }), dAt]);
        if (a.enviada_em) { cartaoDatas.appendChild(el('label', { text: 'Data em que o aluno respondeu' })); cartaoDatas.appendChild(dResp); }
        cartaoDatas.appendChild(el('label', { text: 'Data da correção (opcional)' })); cartaoDatas.appendChild(dCorr);
        cartaoDatas.appendChild(msgDatas); cartaoDatas.appendChild(salvarDatas);
        area.appendChild(cartaoDatas);
        var campos = {}; /* pergunta_id -> { sit, com } */
        d.perguntas.forEach(function (p, i) {
          var r = d.respostas[p.id] || {};
          var c = d.correcoes[p.id] || {};
          var cx = el('div', { class: 'portal-cartao' }, [el('p', { class: 'portal-item-titulo', text: (i + 1) + '. ' + p.enunciado })]);
          if (p.tipo === 'multipla') {
            var certa = d.gabarito[p.id] ? d.gabarito[p.id].correta : null;
            (p.opcoes || []).forEach(function (op, k) {
              var marca = (r.opcao === k ? '  ← resposta do aluno' : '') + (certa === k ? '  ✓ certa' : '');
              cx.appendChild(botaoOpcao(String.fromCharCode(65 + k) + ') ' + op + marca, r.opcao === k, null));
            });
            if (r.opcao == null) cx.appendChild(el('p', { class: 'portal-vazio', text: 'O aluno não respondeu.' }));
          } else {
            cx.appendChild(el('p', { class: 'portal-descricao', text: r.texto ? r.texto : 'O aluno não respondeu.' }));
          }
          var sit = el('select', {}, [el('option', { value: '', text: 'Sem avaliação' })].concat(Object.keys(SITUACOES).map(function (k) { return el('option', { value: k, text: SITUACOES[k] }); })));
          sit.value = c.situacao || '';
          var com = el('textarea', { rows: '3', placeholder: 'Comentário para o aluno (opcional)' });
          com.value = c.comentario || '';
          cx.appendChild(el('label', { text: 'Sua correção' })); cx.appendChild(sit); cx.appendChild(com);
          campos[p.id] = { sit: sit, com: com, tipo: p.tipo, opcao: r.opcao, certa: certa };
          area.appendChild(cx);
        });

        var msg = el('p', { class: 'portal-msg' });
        function salvarCorrecao() {
          var linhas = Object.keys(campos).map(function (id) {
            return { pergunta_id: id, situacao: campos[id].sit.value || null, comentario: campos[id].com.value.trim() || null };
          });
          return C.from('atividade_correcoes').upsert(linhas, { onConflict: 'pergunta_id' }).then(function (r) {
            if (r.error) throw r.error;
            /* atividade nova: a data da correção é a de hoje; antiga: só se você preencheu */
            var quando = dCorr.value || (a.antiga ? null : (a.corrigida_em || hojeISO()));
            if (!quando || quando === a.corrigida_em) return;
            return C.from('atividades').update({ corrigida_em: quando }).eq('id', a.id).then(function (r2) {
              if (r2.error) throw r2.error;
              a.corrigida_em = quando; dCorr.value = quando;
            });
          });
        }
        var avisoCorrecao = el('div', { style: 'margin:10px 0' });
        var salvar = el('button', { type: 'button', class: 'portal-btn', text: 'Salvar correção' });
        salvar.addEventListener('click', function () {
          salvar.disabled = true; P.mensagem(msg, 'Salvando...');
          salvarCorrecao().then(function () {
            salvar.disabled = false; P.mensagem(msg, 'Correção salva. O aluno já vê.', 'ok');
            avisoCorrecao.textContent = '';
            avisoCorrecao.appendChild(botaoWhats('Avisar ' + primeiroNome(aluno.nome) + ' no WhatsApp', aluno.whatsapp,
              'Oi ' + primeiroNome(aluno.nome) + '! Corrigi a sua atividade "' + a.titulo + '". Dá uma olhada na área do aluno: ' + SITE_ALUNO));
          })
            .catch(function (e) { salvar.disabled = false; P.mensagem(msg, P.traduzErro(e.message), 'erro'); });
        });
        var auto = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Corrigir a múltipla escolha sozinho' });
        auto.addEventListener('click', function () {
          var n = 0;
          Object.keys(campos).forEach(function (id) {
            var x = campos[id];
            if (x.tipo !== 'multipla' || x.certa == null || x.opcao == null) return;
            x.sit.value = x.opcao === x.certa ? 'certo' : 'errado'; n++;
          });
          P.mensagem(msg, n ? n + ' pergunta(s) marcadas. Toque em "Salvar correção" para valer.' : 'Nenhuma pergunta com gabarito e resposta do aluno.', n ? 'ok' : 'erro');
        });
        var acoes = el('div', { class: 'portal-acoes' }, [salvar, auto]);
        if (a.enviada_em) {
          var reabrir = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Devolver para o aluno refazer' });
          reabrir.addEventListener('click', function () {
            if (!confirm('Devolver para o aluno? Ele poderá mudar as respostas e enviar de novo.')) return;
            C.from('atividades').update({ enviada_em: null }).eq('id', a.id).then(function (r) {
              if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
              a.enviada_em = null; telaDaAtividade(a);
            });
          });
          acoes.appendChild(reabrir);
        }
        var apagar = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Apagar atividade' });
        apagar.addEventListener('click', function () {
          if (!confirm('Apagar a atividade "' + a.titulo + '" com as respostas e correções?')) return;
          C.from('atividades').delete().eq('id', a.id).then(function (r) {
            if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
            lista();
          });
        });
        area.appendChild(msg);
        area.appendChild(avisoCorrecao);
        area.appendChild(acoes);
        area.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:14px' }, [apagar]));
      }).catch(function () {
        area.textContent = '';
        area.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a atividade.' }));
      });
    }

    lista();
    return cartao;
  }

  /* tudo do aluno, em ordem de data, pro caderno em PDF (caderno.js): [{ atividade, perguntas, respostas, correcoes }] */
  function dadosDoCaderno(aluno) {
    return C.from('atividades').select(COLUNAS).eq('aluno_id', aluno.id).then(function (r) {
      if (r.error) throw r.error;
      var lista = (r.data || []).slice().sort(function (a, b) { return dataPostagem(a) < dataPostagem(b) ? -1 : dataPostagem(a) > dataPostagem(b) ? 1 : String(a.criado_em).localeCompare(String(b.criado_em)); });
      return Promise.all(lista.map(function (a) {
        return carregar(a.id, false).then(function (d) { return { atividade: a, datas: linhaDatas(a), perguntas: d.perguntas, respostas: d.respostas, correcoes: d.correcoes }; });
      }));
    });
  }

  window.atividades = { dadosDoCaderno: dadosDoCaderno, situacoes: SITUACOES, cartaoDoAluno: cartaoDoAluno, telaDaAtividadeAluno: telaDaAtividadeAluno, painelAdmin: painelAdmin };
})();
