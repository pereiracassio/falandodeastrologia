/* Atividades (perguntas de múltipla escolha e dissertativas) — cada aluno tem as suas.
   O administrador cria no painel (admin-alunos.html), o aluno responde na página dele (aluno.html) e envia,
   o administrador corrige ali mesmo e o aluno vê a correção. Tabelas e regras de acesso: docs/atividades.sql.
   Depende de portal.js (window.portal). Sem campo nativo no papiro: as opções são botões de contorno azul (escolhida = contorno grosso). */
(function () {
  var P = window.portal, el = P.el, C = P.client;
  var SITUACOES = { certo: 'Certo', errado: 'Errado', parcial: 'Parcialmente certo' };

  /* Texto da atividade com marcas simples (as mesmas do blog, mais negrito e lista): "## " no começo da linha = subtítulo,
     "**palavra**" = negrito, "- " no começo da linha = item de lista. Linha em branco separa parágrafos. Tudo entra como texto
     (textContent): nada digitado vira HTML. blocosDoTexto também serve ao PDF do caderno (caderno.js). */
  function blocosDoTexto(str) {
    var blocos = [], lista = null, par = null;
    String(str || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (l) {
      var t = l.trim(), m;
      if (!t) { lista = par = null; return; }
      if ((m = /^#{2,}\s+(.+)$/.exec(t))) { lista = par = null; blocos.push({ tipo: 'sub', texto: m[1] }); }
      else if ((m = /^[-•]\s+(.+)$/.exec(t))) { par = null; if (!lista) blocos.push(lista = { tipo: 'lista', itens: [] }); lista.itens.push(m[1]); }
      else { lista = null; if (!par) blocos.push(par = { tipo: 'p', linhas: [] }); par.linhas.push(t); }
    });
    return blocos;
  }
  /* a linha inteira da atividade faz a mesma ação do botão (Ver, Responder, Corrigir...): o botão fica só pra dizer o que vai acontecer */
  function linhaClicavel(caixa, acao) {
    caixa.className += ' portal-item-clicavel';
    caixa.setAttribute('role', 'button'); caixa.setAttribute('tabindex', '0');
    caixa.addEventListener('click', acao);
    caixa.addEventListener('keydown', function (ev) { if (ev.target === caixa && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); acao(); } });
    return caixa;
  }
  function semMarcas(t) { return String(t).replace(/\*\*(.+?)\*\*/g, '$1'); }
  function comNegrito(pai, t) {
    String(t).split(/(\*\*.+?\*\*)/).forEach(function (parte) {
      var m = /^\*\*(.+)\*\*$/.exec(parte);
      if (m) pai.appendChild(el('strong', { text: m[1] })); else if (parte) pai.appendChild(document.createTextNode(parte));
    });
  }
  function textoFormatado(str) {
    var caixa = el('div', { class: 'portal-texto' });
    blocosDoTexto(str).forEach(function (b) {
      if (b.tipo === 'sub') caixa.appendChild(el('h3', { class: 'portal-texto-sub', text: semMarcas(b.texto) }));
      else if (b.tipo === 'lista') {
        var ul = el('ul', { class: 'portal-texto-lista' });
        b.itens.forEach(function (i) { var li = el('li'); comNegrito(li, i); ul.appendChild(li); });
        caixa.appendChild(ul);
      } else {
        var p = el('p'); b.linhas.forEach(function (l, i) { if (i) p.appendChild(document.createElement('br')); comNegrito(p, l); });
        caixa.appendChild(p);
      }
    });
    return caixa;
  }

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
  var COLUNAS_BASE = 'id,titulo,descricao,criado_em,enviada_em,data_atividade,corrigida_em,antiga';
  var COLUNAS = COLUNAS_BASE + ',imagem_caminho,somente_leitura';
  /* lista as atividades do aluno; se a coluna da imagem ainda não existe no banco, tenta de novo sem ela (nunca derruba a tela) */
  function atividadesDoAluno(alunoId, ordem) {
    var pedir = function (cols) { var q = C.from('atividades').select(cols).eq('aluno_id', alunoId); return ordem ? ordenar(q) : q; };
    return pedir(COLUNAS).then(function (r) { return r.error && /imagem_caminho|somente_leitura/i.test(r.error.message || '') ? pedir(COLUNAS_BASE) : r; });
  }
  var ordenar = function (q) { return q.order('data_atividade', { ascending: false, nullsFirst: false }).order('criado_em', { ascending: false }); };
  var dataPostagem = function (a) { return a.data_atividade || diaDe(a.criado_em); };
  /* "Postada em 01/10/2026 · Respondida em 03/10/2026 · Corrigida em 05/10/2026" (só o que existe) */
  function linhaDatas(a) {
    if (a.somente_leitura) return 'Texto para leitura · ' + dataCurta(dataPostagem(a));
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
      if (!ids.length) return { perguntas: [], respostas: {}, correcoes: {}, gabarito: {}, comentarios: {} };
      var pedidos = [
        C.from('atividade_respostas').select('pergunta_id,texto,opcao').in('pergunta_id', ids),
        C.from('atividade_correcoes').select('pergunta_id,situacao,comentario').in('pergunta_id', ids),
        C.from('atividade_comentarios').select('id,pergunta_id,autor,texto,criado_em').in('pergunta_id', ids).order('criado_em')
      ];
      if (comGabarito) pedidos.push(C.from('atividade_gabarito').select('pergunta_id,correta').in('pergunta_id', ids));
      return Promise.all(pedidos).then(function (r) {
        var mapa = function (res, campo) { var m = {}; ((res && res.data) || []).forEach(function (x) { m[x.pergunta_id] = x; }); return m; };
        var conversas = {}; /* pergunta_id -> [comentários em ordem] (sem a tabela nova ainda, vem vazio: nunca derruba a tela) */
        ((r[2] && r[2].data) || []).forEach(function (x) { (conversas[x.pergunta_id] = conversas[x.pergunta_id] || []).push(x); });
        return { perguntas: perguntas, respostas: mapa(r[0]), correcoes: mapa(r[1]), gabarito: comGabarito ? mapa(r[3]) : {}, comentarios: conversas };
      });
    });
  }

  /* ============ IMAGEM DO MAPA e CONVERSA (comentários) ============ */

  var BUCKET = 'atividades', LIMITE_IMAGEM = 8 * 1024 * 1024;
  var urlAssinada = function (caminho) { return C.storage.from(BUCKET).createSignedUrl(caminho, 3600).then(function (r) { return r.error || !r.data ? null : r.data.signedUrl; }, function () { return null; }); };

  /* a imagem do mapa da atividade; tocar abre em tamanho grande */
  function figuraDoMapa(caminho) {
    var caixa = el('div', { style: 'margin:12px 0' }, [el('p', { class: 'portal-vazio', text: 'Carregando a imagem...' })]);
    urlAssinada(caminho).then(function (url) {
      caixa.textContent = '';
      if (!url) { caixa.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a imagem agora.' })); return; }
      var img = el('img', { src: url, alt: 'Mapa da atividade', style: 'display:block;width:100%;height:auto;border:1px solid #1F5FA3;border-radius:8px' });
      caixa.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener' }, [img]));
      caixa.appendChild(el('p', { class: 'portal-vazio', style: 'margin-top:6px', text: 'Toque na imagem para ver em tamanho grande.' }));
    });
    return caixa;
  }
  function enviarImagem(atividadeId, arquivo, caminhoAntigo) {
    if (!/^image\/(png|jpeg)$/.test(arquivo.type)) return Promise.reject(new Error('Use uma imagem PNG ou JPEG.'));
    if (arquivo.size > LIMITE_IMAGEM) return Promise.reject(new Error('A imagem é grande demais (máximo 8 MB).'));
    var caminho = atividadeId + '/mapa-' + Date.now() + '.' + (arquivo.type === 'image/png' ? 'png' : 'jpg');
    return C.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      return C.from('atividades').update({ imagem_caminho: caminho }).eq('id', atividadeId);
    }).then(function (r) {
      if (r.error) throw r.error;
      if (caminhoAntigo) C.storage.from(BUCKET).remove([caminhoAntigo]);
      return caminho;
    });
  }
  function removerImagem(atividadeId, caminho) {
    return C.from('atividades').update({ imagem_caminho: null }).eq('id', atividadeId).then(function (r) {
      if (r.error) throw r.error;
      C.storage.from(BUCKET).remove([caminho]);
    });
  }
  /* botão que abre o seletor de arquivo (o campo nativo fica escondido) */
  function botaoDeImagem(rotulo, aoEscolher) {
    var input = el('input', { type: 'file', accept: 'image/png,image/jpeg' });
    input.style.display = 'none';
    var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: rotulo });
    b.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { if (input.files && input.files[0]) aoEscolher(input.files[0]); input.value = ''; });
    return el('span', {}, [b, input]);
  }

  /* conversa embaixo de uma pergunta: o aluno comenta/pergunta (opcional) e o administrador responde.
     quem = { euAutor: 'aluno' | 'admin', nomeAluno, previa } */
  function conversaDaPergunta(perguntaId, lista, quem) {
    var souAluno = quem.euAutor === 'aluno';
    var fio = el('div'), msg = el('p', { class: 'portal-msg' });
    var texto = el('textarea', { rows: '3', placeholder: souAluno ? 'Escreva aqui um comentário ou uma dúvida (opcional)' : 'Escreva a sua resposta ao aluno' });
    var enviar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: souAluno ? 'Enviar comentário' : 'Responder' });
    var comoAluno = false; /* só o administrador: escrever o comentário em nome do aluno (pra registrar uma dúvida que ele fez por outro canal) */
    var nomeDe = function (c) { return c.autor === quem.euAutor ? 'Você' : (c.autor === 'admin' ? 'Cássio' : primeiroNome(quem.nomeAluno)); };
    function desenhar() {
      fio.textContent = '';
      lista.forEach(function (c) {
        var caixa = el('div', { class: 'portal-item' }, [el('span', { class: 'portal-item-titulo', text: nomeDe(c) }),
          el('span', { class: 'portal-item-data', text: dataHoraBR(c.criado_em) }), el('p', { class: 'portal-descricao', text: c.texto })]);
        if (!souAluno) { /* o administrador pode apagar qualquer comentário (o aluno não apaga) */
          var apagar = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Apagar' });
          apagar.style.marginTop = '8px';
          apagar.addEventListener('click', function () {
            if (!confirm('Apagar este comentário?')) return;
            apagar.disabled = true;
            C.from('atividade_comentarios').delete().eq('id', c.id).then(function (r) {
              if (r.error) { apagar.disabled = false; P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
              lista.splice(lista.indexOf(c), 1); desenhar();
            });
          });
          caixa.appendChild(apagar);
        }
        fio.appendChild(caixa);
      });
    }
    enviar.addEventListener('click', function () {
      var t = texto.value.trim();
      if (!t) { P.mensagem(msg, 'Escreva alguma coisa antes de enviar.', 'erro'); return; }
      if (quem.previa) { P.mensagem(msg, 'Isto é só uma prévia: nada foi enviado.', 'erro'); return; }
      enviar.disabled = true; P.mensagem(msg, 'Enviando...');
      C.from('atividade_comentarios').insert({ pergunta_id: perguntaId, autor: comoAluno ? 'aluno' : quem.euAutor, texto: t }).select('id,pergunta_id,autor,texto,criado_em').single().then(function (r) {
        enviar.disabled = false;
        if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
        lista.push(r.data); texto.value = ''; P.mensagem(msg, ''); desenhar();
      });
    });
    desenhar();
    var partes = [el('p', { class: 'portal-item-titulo', text: souAluno ? 'Comentários e dúvidas' : 'Conversa com o aluno' }), fio];
    if (!souAluno && quem.antiga) { /* escolher quem assina só faz sentido em atividade ANTIGA (já feita antes, que você está passando para cá); em atividade nova você sempre escreve como você */
      var escolha = el('div', { style: 'margin:10px 0' });
      var pintar = function () {
        escolha.textContent = '';
        var b1 = botaoOpcao('Escrever como eu (Cássio)', !comoAluno, function () { comoAluno = false; pintar(); });
        var b2 = botaoOpcao('Escrever como ' + primeiroNome(quem.nomeAluno), comoAluno, function () { comoAluno = true; pintar(); });
        b1.style.display = b2.style.display = 'inline-block'; b1.style.width = b2.style.width = 'auto';
        escolha.appendChild(b1); escolha.appendChild(b2);
      };
      pintar(); partes.push(escolha);
    }
    partes.push(texto, msg, el('div', { class: 'portal-acoes' }, [enviar]));
    return el('div', { style: 'margin-top:14px' }, partes);
  }

  /* formulário de UMA pergunta (editar ou acrescentar numa atividade que já existe).
     cfg: { tipoFixo, tipo, enunciado, opcoes[], certa, comResposta (só atividade antiga), resposta {texto,opcao}, comCorrecao (só ao acrescentar numa antiga) }
     devolve { caixa, ler() } — ler() dá os valores ou { erro } */
  function formularioPergunta(cfg) {
    var tipo = el('select', {}, [el('option', { value: 'dissertativa', text: 'Dissertativa (o aluno escreve)' }), el('option', { value: 'multipla', text: 'Múltipla escolha' })]);
    tipo.value = cfg.tipo || 'dissertativa'; if (cfg.tipoFixo) tipo.disabled = true;
    var enunciado = el('textarea', { rows: '3', placeholder: 'Escreva a pergunta' }); enunciado.value = cfg.enunciado || '';
    var opcoes = el('textarea', { rows: '4', placeholder: 'Uma alternativa por linha' }); opcoes.value = (cfg.opcoes || []).join('\n');
    var certa = el('select');
    var areaOpcoes = el('div', {}, [el('label', { text: 'Alternativas (uma por linha)' }), opcoes,
      el('label', { text: 'Alternativa certa (só você vê; serve para corrigir sozinho)' }), certa]);
    var respTexto = el('textarea', { rows: '5', placeholder: 'Cole aqui a resposta do aluno' }); respTexto.value = (cfg.resposta && cfg.resposta.texto) || '';
    var respOpcao = el('select');
    var sit = el('select', {}, [el('option', { value: '', text: 'Sem avaliação' })].concat(Object.keys(SITUACOES).map(function (k) { return el('option', { value: k, text: SITUACOES[k] }); })));
    var com = el('textarea', { rows: '4', placeholder: 'Cole aqui a sua correção (opcional)' });
    var linhas = function () { return opcoes.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    function atualizarSelects() {
      var a1 = certa.value, a2 = respOpcao.value;
      certa.textContent = ''; respOpcao.textContent = '';
      certa.appendChild(el('option', { value: '', text: 'Sem gabarito (eu corrijo)' }));
      respOpcao.appendChild(el('option', { value: '', text: 'O aluno não respondeu' }));
      linhas().forEach(function (op, k) {
        var txt = String.fromCharCode(65 + k) + ') ' + op;
        certa.appendChild(el('option', { value: String(k), text: txt })); respOpcao.appendChild(el('option', { value: String(k), text: txt }));
      });
      certa.value = a1; respOpcao.value = a2;
    }
    var rotuloResp = el('label', { text: 'Resposta do aluno' });
    var areaResp = el('div', {}, [rotuloResp, respTexto, respOpcao]);
    var areaCorr = el('div', {}, [el('label', { text: 'Sua correção' }), sit, com]);
    function mostrar() {
      var m = tipo.value === 'multipla';
      areaOpcoes.style.display = m ? '' : 'none';
      respTexto.style.display = m ? 'none' : ''; respOpcao.style.display = m ? '' : 'none';
      areaResp.style.display = cfg.comResposta ? '' : 'none';
      areaCorr.style.display = cfg.comCorrecao ? '' : 'none';
    }
    opcoes.addEventListener('input', atualizarSelects); tipo.addEventListener('change', mostrar);
    atualizarSelects();
    if (cfg.certa != null) certa.value = String(cfg.certa);
    if (cfg.resposta && cfg.resposta.opcao != null) respOpcao.value = String(cfg.resposta.opcao);
    mostrar();
    var caixa = el('div', {}, [el('label', { text: 'Tipo' }), tipo, el('label', { text: 'Pergunta' }), enunciado, areaOpcoes, areaResp, areaCorr]);
    return { caixa: caixa, ler: function () {
      if (!enunciado.value.trim()) return { erro: 'A pergunta está sem texto.' };
      var m = tipo.value === 'multipla';
      if (m && linhas().length < 2) return { erro: 'A pergunta precisa de pelo menos 2 alternativas.' };
      return { tipo: tipo.value, enunciado: enunciado.value.trim(), opcoes: m ? linhas() : null, certa: m && certa.value !== '' ? Number(certa.value) : null,
        respTexto: m ? '' : respTexto.value.trim(), respOpcao: m && respOpcao.value !== '' ? Number(respOpcao.value) : null, sit: sit.value || null, com: com.value.trim() || null };
    } };
  }

  /* ============ ALUNO ============ */

  /* lista de atividades do aluno; aoAbrir(atividade) abre uma.
     opcoes.semMoldura: sem cartão nem título (quando já está dentro da aba); opcoes.aoCarregar(qtd): avisa quantas atividades vieram */
  function cartaoDoAluno(aluno, aoAbrir, opcoes) {
    opcoes = opcoes || {};
    var cartao = opcoes.semMoldura ? el('div') : el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Atividades' })]);
    cartao.style.display = 'none'; /* sem atividade nem aparece */
    atividadesDoAluno(aluno.id, true).then(function (r) {
      var lista = (r.error || !r.data) ? [] : r.data;
      if (opcoes.aoCarregar) opcoes.aoCarregar(lista.length, lista.filter(function (a) { return !a.enviada_em; }).length);
      if (!lista.length) return;
      cartao.style.display = '';
      lista.forEach(function (a) {
        var abrir = el('button', { type: 'button', class: 'portal-btn', text: a.somente_leitura ? 'Ler' : a.enviada_em ? 'Ver' : 'Responder' });
        cartao.appendChild(linhaClicavel(el('div', { class: 'portal-item' }, [el('div', { class: 'portal-item-linha' }, [
          el('div', {}, [el('span', { class: 'portal-item-titulo', text: a.titulo }),
            el('span', { class: 'portal-item-data', text: linhaDatas(a) + (a.enviada_em ? '' : ' · Para responder') })]),
          abrir
        ])]), function () { aoAbrir(a); }));
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
      if (atividade.descricao) cab.appendChild(textoFormatado(atividade.descricao));
      cab.appendChild(el('p', { class: 'portal-item-data', text: linhaDatas(atividade) }));
      if (atividade.imagem_caminho) cab.appendChild(figuraDoMapa(atividade.imagem_caminho));
      if (!editavel) {
        var corrigida = Object.keys(d.correcoes).some(function (k) { return d.correcoes[k].situacao || d.correcoes[k].comentario; });
        if (!corrigida && !atividade.antiga) {
          cab.appendChild(el('p', { class: 'portal-vazio', text: 'Quer avisar o Cássio que terminou? A mensagem já vai pronta no WhatsApp, e você pode mudar antes de enviar.' }));
          cab.appendChild(botaoWhats('Avisar o Cássio no WhatsApp', WHATS_ADMIN,
            'Oi Cássio! Terminei a atividade "' + atividade.titulo + '" e já enviei na página Alunos. Pode corrigir quando puder. ' + (atividade.alunoNome ? '(' + primeiroNome(atividade.alunoNome) + ')' : '')));
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
        cartao.appendChild(conversaDaPergunta(p.id, d.comentarios[p.id] || (d.comentarios[p.id] = []), { euAutor: 'aluno', nomeAluno: atividade.alunoNome, previa: previa }));
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
  function painelAdmin(aluno, abrirId) {
    var cartao = el('div', { class: 'portal-cartao' }, [el('h2', { text: 'Atividades' })]);
    var corpo = el('div');
    cartao.appendChild(corpo);

    function lista() {
      P.estado.mesclar({ atividade: '' });
      corpo.textContent = '';
      corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Carregando...' }));
      atividadesDoAluno(aluno.id, true).then(function (r) {
        if (r.error || !r.data) return { r: r, corrigidas: {} };
        /* atividade antiga: só dá pra saber se já foi corrigida olhando as correções (a data da correção pode ficar em branco) */
        var antigas = r.data.filter(function (a) { return a.antiga && !a.somente_leitura; }).map(function (a) { return a.id; });
        if (!antigas.length) return { r: r, corrigidas: {} };
        return C.from('atividade_perguntas').select('id,atividade_id').in('atividade_id', antigas).then(function (rp) {
          var ids = ((rp && rp.data) || []).map(function (p) { return p.id; }), dona = {};
          ((rp && rp.data) || []).forEach(function (p) { dona[p.id] = p.atividade_id; });
          if (!ids.length) return { r: r, corrigidas: {} };
          return C.from('atividade_correcoes').select('pergunta_id,situacao,comentario').in('pergunta_id', ids).then(function (rc) {
            var corrigidas = {};
            ((rc && rc.data) || []).forEach(function (c) { if (c.situacao || c.comentario) corrigidas[dona[c.pergunta_id]] = true; });
            return { r: r, corrigidas: corrigidas };
          });
        });
      }).then(function (x) {
        var r = x.r;
        corpo.textContent = '';
        var nova = el('button', { type: 'button', class: 'portal-btn', text: 'Nova atividade' });
        nova.addEventListener('click', function () { construtor(); });
        corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-bottom:14px' }, [nova])); /* no topo: com muitas atividades, não precisa descer a lista toda */
        if (r.error) { corpo.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar as atividades.' })); return; }
        if (!r.data.length) corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhuma atividade ainda.' }));
        r.data.forEach(function (a) {
          /* "Corrigir" só depois que o aluno enviou e enquanto falta corrigir (antiga: enquanto não tem nenhuma correção); senão "Abrir" */
          var falta = a.enviada_em && !a.somente_leitura && (a.antiga ? !x.corrigidas[a.id] : !a.corrigida_em);
          var abrir = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: falta ? 'Corrigir' : 'Abrir' });
          var info = el('span', { class: 'portal-item-data', text: linhaDatas(a) + (a.enviada_em ? '' : ' · O aluno ainda não enviou') });
          corpo.appendChild(linhaClicavel(el('div', { class: 'portal-item' }, [el('div', { class: 'portal-item-linha' }, [
            el('div', {}, [el('span', { class: 'portal-item-titulo', text: a.titulo }), info]), abrir
          ])]), function () { telaDaAtividade(a); }));
        });
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
          'Oi ' + primeiroNome(aluno.nome) + '! Deixei uma atividade nova para você na página Alunos: "' + tituloAtividade + '". Quando terminar, é só enviar por lá. ' + SITE_ALUNO),
        voltar
      ]));
      if (!aluno.whatsapp) corpo.appendChild(el('p', { class: 'portal-vazio', style: 'margin-top:10px', text: 'Dica: se você guardar o WhatsApp do aluno em "Dados do aluno", a conversa já abre direto com ele.' }));
    }

    /* criar uma atividade: nova (o aluno vai responder) ou antiga (já feita: você cola as respostas e as correções) */
    function construtor() {
      corpo.textContent = '';
      var msg = el('p', { class: 'portal-msg' });
      var antiga = false, leitura = false;
      var titulo = el('input', { type: 'text', placeholder: 'Ex.: Atividade sobre as casas' });
      var descricao = el('textarea', { rows: '6', placeholder: 'Texto que aparece antes das perguntas (opcional)' });
      var dAtividade = el('input', { type: 'date' });
      var dResposta = el('input', { type: 'date' });
      var dCorrecao = el('input', { type: 'date' });
      var blocos = [];
      var areaPerguntas = el('div');
      var imagemEscolhida = null; /* arquivo do mapa; é enviado depois que a atividade é salva */
      var nomeImagem = el('p', { class: 'portal-vazio', style: 'margin:6px 0 14px' });
      var areaImagem = el('div', {}, [el('label', { text: 'Imagem do mapa (opcional, PNG ou JPEG)' }),
        botaoDeImagem('Escolher a imagem', function (arq) {
          if (!/^image\/(png|jpeg)$/.test(arq.type)) { P.mensagem(msg, 'Use uma imagem PNG ou JPEG.', 'erro'); return; }
          if (arq.size > LIMITE_IMAGEM) { P.mensagem(msg, 'A imagem é grande demais (máximo 8 MB).', 'erro'); return; }
          imagemEscolhida = arq; P.mensagem(msg, ''); nomeImagem.textContent = 'Imagem escolhida: ' + arq.name;
        }), nomeImagem]);

      /* escolha do tipo (botões, não campo nativo) */
      var modo = el('div', { class: 'portal-acoes', style: 'margin-bottom:14px' });
      var areaDatasAntiga = el('div');
      areaDatasAntiga.style.display = 'none';
      areaDatasAntiga.appendChild(el('p', { class: 'portal-vazio', style: 'margin-bottom:10px', text: 'Atividade que o aluno já fez: preencha as datas de quando aconteceu e cole, em cada pergunta, a resposta dele e a sua correção. Ela já fica como enviada, e ele não consegue mexer.' }));
      areaDatasAntiga.appendChild(el('label', { text: 'Data da atividade (quando foi passada)' })); areaDatasAntiga.appendChild(dAtividade);
      areaDatasAntiga.appendChild(el('label', { text: 'Data em que o aluno respondeu (opcional)' })); areaDatasAntiga.appendChild(dResposta);
      areaDatasAntiga.appendChild(el('label', { text: 'Data da correção (opcional; se não souber, deixe em branco)' })); areaDatasAntiga.appendChild(dCorrecao);
      /* texto para leitura: sem perguntas, só título, data, texto (e imagem, se quiser); entra no caderno na ordem da data */
      var dLeitura = el('input', { type: 'date' });
      var areaDataLeitura = el('div', {}, [el('label', { text: 'Data do texto' }), dLeitura]);
      areaDataLeitura.style.display = 'none';
      function desenharModo() {
        modo.textContent = '';
        var b1 = botaoOpcao('Atividade nova (o aluno vai responder)', !antiga && !leitura, function () { antiga = false; leitura = false; aplicarModo(); });
        var b2 = botaoOpcao('Atividade antiga (já feita)', antiga, function () { antiga = true; leitura = false; aplicarModo(); });
        var b3 = botaoOpcao('Texto para leitura (sem perguntas)', leitura, function () { antiga = false; leitura = true; aplicarModo(); });
        b1.style.margin = b2.style.margin = b3.style.margin = '0'; b1.style.width = b2.style.width = b3.style.width = 'auto';
        modo.appendChild(b1); modo.appendChild(b2); modo.appendChild(b3);
      }
      function aplicarModo() {
        desenharModo();
        areaDataLeitura.style.display = leitura ? '' : 'none';
        areaPerguntas.style.display = leitura ? 'none' : '';
        areaMais.style.display = leitura ? 'none' : '';
        descricaoRotulo.textContent = leitura ? 'Texto (o que o aluno vai ler)' : 'Texto antes das perguntas (opcional)';
        areaDatasAntiga.style.display = antiga ? '' : 'none';
        blocos.forEach(function (b) { b.areaAntiga.style.display = antiga ? '' : 'none'; });
      }
      var descricaoRotulo = el('label', { text: 'Texto antes das perguntas (opcional)' });

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
        if (leitura && !descricao.value.trim() && !imagemEscolhida) { P.mensagem(msg, 'Escreva o texto (ou escolha uma imagem).', 'erro'); return; }
        if (!leitura && !blocos.length) { P.mensagem(msg, 'Coloque pelo menos uma pergunta.', 'erro'); return; }
        for (var i = 0; !leitura && i < blocos.length; i++) {
          var b = blocos[i];
          if (!b.enunciado.value.trim()) { P.mensagem(msg, 'A pergunta ' + (i + 1) + ' está sem texto.', 'erro'); return; }
          if (b.tipo.value === 'multipla' && b.linhasOpcoes().length < 2) { P.mensagem(msg, 'A pergunta ' + (i + 1) + ' precisa de pelo menos 2 alternativas.', 'erro'); return; }
        }
        salvar.disabled = true; P.mensagem(msg, 'Salvando...');
        var idNova = null;
        var registro = { aluno_id: aluno.id, titulo: titulo.value.trim(), descricao: descricao.value.trim() || null, data_atividade: antiga ? dAtividade.value : (leitura && dLeitura.value ? dLeitura.value : hojeISO()), antiga: antiga || leitura };
        if (leitura) { registro.somente_leitura = true; registro.enviada_em = new Date().toISOString(); } /* sem perguntas: já nasce "enviada" (nada pra responder nem corrigir) */
        if (antiga) {
          registro.enviada_em = new Date((dResposta.value || dAtividade.value) + 'T12:00:00').toISOString(); /* já feita: entra como enviada */
          registro.corrigida_em = dCorrecao.value || null;
        }
        C.from('atividades').insert(registro).select('id').single().then(function (r) {
          if (r.error) throw r.error;
          idNova = r.data.id;
          if (leitura) return { error: null };
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
          /* a imagem só sobe depois de tudo salvo; se ela falhar, a atividade já existe e dá pra anexar de novo na tela dela */
          return imagemEscolhida ? enviarImagem(idNova, imagemEscolhida, null).then(function () { return null; }, function () { return 'imagem'; }) : null;
        }).then(function (falhou) {
          if (falhou === 'imagem') { alert('A atividade foi salva, mas a imagem não subiu. Abra a atividade e anexe a imagem de novo.'); lista(); return; }
          if (antiga || leitura) lista(); else avisarNovaAtividade(titulo.value.trim());
        }).catch(function (e) { salvar.disabled = false; P.mensagem(msg, P.traduzErro(e.message), 'erro'); });
      });

      corpo.appendChild(modo);
      desenharModo();
      corpo.appendChild(el('label', { text: 'Título' })); corpo.appendChild(titulo);
      corpo.appendChild(areaDatasAntiga);
      corpo.appendChild(areaDataLeitura);
      corpo.appendChild(descricaoRotulo); corpo.appendChild(descricao);
      corpo.appendChild(areaImagem);
      corpo.appendChild(areaPerguntas);
      novaPergunta();
      var areaMais = el('div', { class: 'portal-acoes', style: 'margin-bottom:14px' }, [maisUma]);
      corpo.appendChild(areaMais);
      corpo.appendChild(msg);
      corpo.appendChild(el('div', { class: 'portal-acoes' }, [salvar, cancelar]));
    }

    /* ver as respostas do aluno e corrigir */
    function telaDaAtividade(a) {
      P.estado.mesclar({ atividade: a.id });
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
        if (a.enviada_em && !a.somente_leitura) { cartaoDatas.appendChild(el('label', { text: 'Data em que o aluno respondeu' })); cartaoDatas.appendChild(dResp); }
        if (!a.somente_leitura) { cartaoDatas.appendChild(el('label', { text: 'Data da correção (opcional)' })); cartaoDatas.appendChild(dCorr); }
        cartaoDatas.appendChild(msgDatas); cartaoDatas.appendChild(salvarDatas);
        area.appendChild(cartaoDatas);

        /* texto que aparece antes das perguntas (dá pra mexer a qualquer hora, também nas antigas) */
        var tituloAtividade = el('input', { type: 'text' }); tituloAtividade.value = a.titulo || '';
        var textoAtividade = el('textarea', { rows: '6', placeholder: 'Texto que aparece antes das perguntas (opcional)' });
        textoAtividade.value = a.descricao || '';
        var msgTexto = el('p', { class: 'portal-msg' });
        var salvarTexto = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Salvar título e texto' });
        salvarTexto.addEventListener('click', function () {
          var novo = textoAtividade.value.trim() || null, novoTitulo = tituloAtividade.value.trim();
          if (!novoTitulo) { P.mensagem(msgTexto, 'O título não pode ficar em branco.', 'erro'); return; }
          salvarTexto.disabled = true;
          C.from('atividades').update({ titulo: novoTitulo, descricao: novo }).eq('id', a.id).then(function (r) {
            salvarTexto.disabled = false;
            if (r.error) { P.mensagem(msgTexto, P.traduzErro(r.error.message), 'erro'); return; }
            a.descricao = novo; a.titulo = novoTitulo; P.mensagem(msgTexto, 'Salvo.', 'ok');
          });
        });
        area.appendChild(el('div', { class: 'portal-cartao' }, [el('p', { class: 'portal-item-titulo', text: 'Título e texto antes das perguntas' }), el('label', { text: 'Título' }), tituloAtividade, el('label', { text: 'Texto (opcional)' }), textoAtividade, msgTexto, salvarTexto]));

        /* imagem do mapa da atividade (PNG ou JPEG): o aluno vê em cima das perguntas e ela entra no caderno */
        var cartaoImagem = el('div', { class: 'portal-cartao' });
        var msgImagem = el('p', { class: 'portal-msg' });
        function desenharImagem() {
          cartaoImagem.textContent = '';
          cartaoImagem.appendChild(el('p', { class: 'portal-item-titulo', text: 'Imagem do mapa' }));
          if (a.imagem_caminho) cartaoImagem.appendChild(figuraDoMapa(a.imagem_caminho));
          else cartaoImagem.appendChild(el('p', { class: 'portal-vazio', style: 'margin-bottom:10px', text: 'Nenhuma imagem. Se a atividade for sobre um mapa, anexe a imagem aqui (PNG ou JPEG).' }));
          var acoesImg = el('div', { class: 'portal-acoes' }, [botaoDeImagem(a.imagem_caminho ? 'Trocar a imagem' : 'Anexar imagem', function (arq) {
            P.mensagem(msgImagem, 'Enviando a imagem...');
            enviarImagem(a.id, arq, a.imagem_caminho).then(function (caminho) { a.imagem_caminho = caminho; desenharImagem(); P.mensagem(msgImagem, 'Imagem salva.', 'ok'); })
              .catch(function (e) { P.mensagem(msgImagem, P.traduzErro(e.message), 'erro'); });
          })]);
          if (a.imagem_caminho) {
            var tirarImg = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Tirar a imagem' });
            tirarImg.addEventListener('click', function () {
              if (!confirm('Tirar a imagem desta atividade?')) return;
              removerImagem(a.id, a.imagem_caminho).then(function () { a.imagem_caminho = null; desenharImagem(); P.mensagem(msgImagem, 'Imagem removida.', 'ok'); })
                .catch(function (e) { P.mensagem(msgImagem, P.traduzErro(e.message), 'erro'); });
            });
            acoesImg.appendChild(tirarImg);
          }
          cartaoImagem.appendChild(acoesImg); cartaoImagem.appendChild(msgImagem);
        }
        desenharImagem();
        area.appendChild(cartaoImagem);
        if (a.somente_leitura) { /* texto para leitura: não tem perguntas nem correção */
          var apagarTexto = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Apagar este texto' });
          apagarTexto.addEventListener('click', function () {
            if (!confirm('Apagar o texto "' + a.titulo + '"?')) return;
            C.from('atividades').delete().eq('id', a.id).then(function (r) {
              if (r.error) { alert(P.traduzErro(r.error.message)); return; }
              lista();
            });
          });
          area.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:14px' }, [apagarTexto]));
          return;
        }
        var campos = {}; /* pergunta_id -> { sit, com } */
        /* SALVA SOZINHO: cada avaliação e cada comentário de correção vai para o banco logo depois que você muda (nada se perde ao recarregar).
           Só grava a correção das perguntas; a data da correção e o aviso no WhatsApp continuam no botão "Salvar correção". */
        var autoTimer = null, autoSalvando = false, autoDeNovo = false, autoMsg = el('p', { class: 'portal-msg' });
        function autoLinhas() {
          return Object.keys(campos).map(function (id) { return { pergunta_id: id, situacao: campos[id].sit.value || null, comentario: campos[id].com.value.trim() || null }; });
        }
        function autoSalvar() {
          clearTimeout(autoTimer);
          if (autoSalvando) { autoDeNovo = true; return; }
          autoSalvando = true; P.mensagem(autoMsg, 'Salvando...');
          C.from('atividade_correcoes').upsert(autoLinhas(), { onConflict: 'pergunta_id' }).then(function (r) {
            autoSalvando = false;
            if (r.error) { P.mensagem(autoMsg, 'Não consegui salvar sozinho agora: ' + P.traduzErro(r.error.message) + '. O que você escreveu continua na tela.', 'erro'); return; }
            if (autoDeNovo) { autoDeNovo = false; autoSalvar(); return; }
            P.mensagem(autoMsg, 'Salvo automaticamente.', 'ok');
          });
        }
        function autoAgendar(imediato) { clearTimeout(autoTimer); if (imediato) autoSalvar(); else autoTimer = setTimeout(autoSalvar, 1500); }
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
          cx.appendChild(conversaDaPergunta(p.id, d.comentarios[p.id] || (d.comentarios[p.id] = []), { euAutor: 'admin', nomeAluno: aluno.nome, antiga: !!a.antiga }));
          /* editar o texto/alternativas (e, na antiga, a resposta do aluno) ou tirar a pergunta */
          var areaEdicao = el('div', { style: 'margin-top:14px' });
          var botEditar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Editar a pergunta' });
          var botTirar = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Tirar esta pergunta' });
          botEditar.addEventListener('click', function () {
            if (areaEdicao.firstChild) return; /* já está aberto: só "Cancelar" fecha (tocar de novo não pode apagar o que você escreveu) */
            var f = formularioPergunta({ tipoFixo: true, tipo: p.tipo, enunciado: p.enunciado, opcoes: p.opcoes, certa: certa, comResposta: !!a.antiga, resposta: { texto: r.texto, opcao: r.opcao } });
            var msgE = el('p', { class: 'portal-msg' });
            var gravar = el('button', { type: 'button', class: 'portal-btn', text: 'Salvar a pergunta' });
            var fechar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Cancelar' });
            fechar.addEventListener('click', function () { areaEdicao.textContent = ''; });
            gravar.addEventListener('click', function () {
              var v = f.ler(); if (v.erro) { P.mensagem(msgE, v.erro, 'erro'); return; }
              gravar.disabled = true; P.mensagem(msgE, 'Salvando...');
              C.from('atividade_perguntas').update({ enunciado: v.enunciado, opcoes: v.opcoes }).eq('id', p.id).then(function (r1) {
                if (r1.error) throw r1.error;
                if (p.tipo !== 'multipla') return null;
                return v.certa != null ? C.from('atividade_gabarito').upsert({ pergunta_id: p.id, correta: v.certa }, { onConflict: 'pergunta_id' }) : C.from('atividade_gabarito').delete().eq('pergunta_id', p.id);
              }).then(function (r2) {
                if (r2 && r2.error) throw r2.error;
                if (!a.antiga) return null;
                var tem = p.tipo === 'multipla' ? v.respOpcao != null : !!v.respTexto;
                return tem ? C.from('atividade_respostas').upsert({ pergunta_id: p.id, texto: v.respTexto || null, opcao: v.respOpcao, atualizado_em: new Date().toISOString() }, { onConflict: 'pergunta_id' })
                           : C.from('atividade_respostas').delete().eq('pergunta_id', p.id);
              }).then(function (r3) {
                if (r3 && r3.error) throw r3.error;
                telaDaAtividade(a);
              }).catch(function (e) { gravar.disabled = false; P.mensagem(msgE, P.traduzErro(e.message), 'erro'); });
            });
            areaEdicao.appendChild(f.caixa); areaEdicao.appendChild(msgE);
            areaEdicao.appendChild(el('div', { class: 'portal-acoes' }, [gravar, fechar]));
          });
          botTirar.addEventListener('click', function () {
            if (!confirm('Tirar a pergunta ' + (i + 1) + '? A resposta, a correção e a conversa dela também somem.')) return;
            C.from('atividade_perguntas').delete().eq('id', p.id).then(function (rd) {
              if (rd.error) { alert(P.traduzErro(rd.error.message)); return; }
              telaDaAtividade(a);
            });
          });
          cx.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:14px' }, [botEditar, botTirar]));
          cx.appendChild(areaEdicao);
          campos[p.id] = { sit: sit, com: com, tipo: p.tipo, opcao: r.opcao, certa: certa };
          sit.addEventListener('change', function () { autoAgendar(true); });
          com.addEventListener('input', function () { autoAgendar(false); });
          com.addEventListener('blur', function () { autoAgendar(true); });
          area.appendChild(cx);
        });

        /* acrescentar perguntas numa atividade que já existe: dá pra montar várias de uma vez e salvar tudo junto;
           nada some sem você mandar (só "Tirar esta" e "Descartar" apagam o que está na tela) */
        var cartaoMais = el('div', { class: 'portal-cartao' });
        var listaNovas = el('div');
        var novas = []; /* { f, caixa } */
        var msgM = el('p', { class: 'portal-msg' });
        var botMais = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '+ Acrescentar uma pergunta' });
        var gravarNovas = el('button', { type: 'button', class: 'portal-btn', text: 'Salvar as perguntas novas' });
        var descartar = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Descartar' });
        function atualizarNovas() {
          gravarNovas.style.display = descartar.style.display = novas.length ? '' : 'none';
          novas.forEach(function (n, i) { n.titulo.textContent = 'Pergunta nova ' + (i + 1); });
        }
        botMais.addEventListener('click', function () {
          var f = formularioPergunta({ comResposta: !!a.antiga, comCorrecao: !!a.antiga });
          var titulo = el('p', { class: 'portal-item-titulo' });
          var tirar = el('button', { type: 'button', class: 'portal-btn portal-btn-perigo', text: 'Tirar esta' });
          var caixa = el('div', { class: 'portal-item' }, [titulo, f.caixa, el('div', { class: 'portal-acoes', style: 'margin-top:10px' }, [tirar])]);
          var item = { f: f, caixa: caixa, titulo: titulo };
          tirar.addEventListener('click', function () { novas.splice(novas.indexOf(item), 1); caixa.remove(); atualizarNovas(); });
          novas.push(item); listaNovas.appendChild(caixa); atualizarNovas();
          caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        descartar.addEventListener('click', function () {
          if (!confirm('Descartar as perguntas novas que ainda não foram salvas?')) return;
          novas = []; listaNovas.textContent = ''; atualizarNovas(); P.mensagem(msgM, '');
        });
        gravarNovas.addEventListener('click', function () {
          var valores = [];
          for (var i = 0; i < novas.length; i++) {
            var v = novas[i].f.ler();
            if (v.erro) { P.mensagem(msgM, 'Pergunta nova ' + (i + 1) + ': ' + v.erro, 'erro'); return; }
            valores.push(v);
          }
          gravarNovas.disabled = true; P.mensagem(msgM, 'Salvando...');
          var ordem0 = d.perguntas.reduce(function (m, q) { return Math.max(m, q.ordem); }, -1) + 1;
          var linhas = valores.map(function (v, i) { return { atividade_id: a.id, ordem: ordem0 + i, tipo: v.tipo, enunciado: v.enunciado, opcoes: v.opcoes }; });
          C.from('atividade_perguntas').insert(linhas).select('id,ordem').then(function (r1) {
            if (r1.error) throw r1.error;
            var passos = [];
            r1.data.forEach(function (p) {
              var v = valores[p.ordem - ordem0];
              if (v.tipo === 'multipla' && v.certa != null) passos.push(C.from('atividade_gabarito').insert({ pergunta_id: p.id, correta: v.certa }));
              if (a.antiga) {
                if (v.respTexto || v.respOpcao != null) passos.push(C.from('atividade_respostas').insert({ pergunta_id: p.id, texto: v.respTexto || null, opcao: v.respOpcao }));
                if (v.sit || v.com) passos.push(C.from('atividade_correcoes').insert({ pergunta_id: p.id, situacao: v.sit, comentario: v.com }));
              }
            });
            return Promise.all(passos);
          }).then(function (rs) {
            var falha = rs.filter(function (x) { return x && x.error; })[0];
            if (falha) throw falha.error;
            telaDaAtividade(a);
          }).catch(function (e) { gravarNovas.disabled = false; P.mensagem(msgM, P.traduzErro(e.message), 'erro'); });
        });
        cartaoMais.appendChild(listaNovas);
        cartaoMais.appendChild(msgM);
        /* o botão fica EMBAIXO das perguntas novas: cada toque acrescenta mais uma, embaixo da última */
        cartaoMais.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:10px' }, [botMais, gravarNovas, descartar]));
        atualizarNovas();
        area.appendChild(cartaoMais);

        var msg = el('p', { class: 'portal-msg' });
        area.appendChild(autoMsg);
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
              'Oi ' + primeiroNome(aluno.nome) + '! Corrigi a sua atividade "' + a.titulo + '". Dá uma olhada na página Alunos: ' + SITE_ALUNO));
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

    if (abrirId) { /* recarregou a página dentro de uma atividade: volta pra ela */
      atividadesDoAluno(aluno.id, false).then(function (r) {
        var a = ((r && r.data) || []).filter(function (x) { return x.id === abrirId; })[0];
        if (a) telaDaAtividade(a); else lista();
      }, lista);
    } else lista();
    return cartao;
  }

  /* tudo do aluno, em ordem de data, pro caderno em PDF (caderno.js): [{ atividade, perguntas, respostas, correcoes }] */
  function dadosDoCaderno(aluno) {
    return atividadesDoAluno(aluno.id, false).then(function (r) {
      if (r.error) throw r.error;
      var lista = (r.data || []).slice().sort(function (a, b) { return dataPostagem(a) < dataPostagem(b) ? -1 : dataPostagem(a) > dataPostagem(b) ? 1 : String(a.criado_em).localeCompare(String(b.criado_em)); });
      return Promise.all(lista.map(function (a) {
        return carregar(a.id, false).then(function (d) { return { atividade: a, datas: linhaDatas(a), perguntas: d.perguntas, respostas: d.respostas, correcoes: d.correcoes, comentarios: d.comentarios }; });
      }));
    });
  }

  window.atividades = { blocosDoTexto: blocosDoTexto, semMarcas: semMarcas, dadosDoCaderno: dadosDoCaderno, urlAssinada: urlAssinada, situacoes: SITUACOES, cartaoDoAluno: cartaoDoAluno, telaDaAtividadeAluno: telaDaAtividadeAluno, painelAdmin: painelAdmin };
})();
