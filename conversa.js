/* Mensagens do aluno para o Cássio e as respostas (só texto), na aba Dúvidas. window.conversa.tela({ alunoId, souAdmin, nomeAluno, previa, aoLer }) devolve a tela pronta.
   A mensagem nova aparece na hora (Realtime do Supabase) e, como reserva, a tela confere de 30 em 30 segundos enquanto está aberta.
   Os avisos de mensagem nova são gravados pelo próprio banco (docs/conversa.sql). */
(function () {
  var P = window.portal, el = P.el, C = P.client;

  function quando(iso) {
    try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''); }
    catch (e) { return String(iso || '').slice(0, 10); }
  }

  function tela(cfg) {
    var minha = cfg.souAdmin ? 'cassio' : 'aluno';
    var caixa = el('div', {});
    var lista = el('div', {});
    var campo = el('textarea', { rows: '2', placeholder: 'Escreva a sua mensagem', 'aria-label': 'Mensagem' });
    var enviar = el('button', { type: 'button', class: 'portal-btn', text: 'Enviar' });
    var msg = el('p', { class: 'portal-msg' });
    var mensagens = [], vistas = {}, canal = null, relogio = null;

    function bloco(m) {
      var eu = m.de === minha;
      var nome = eu ? 'Você' : (cfg.souAdmin ? (cfg.nomeAluno || 'Aluno') : 'Cássio');
      return el('div', { style: 'margin:0 0 16px' }, [
        el('span', { class: 'impresso', style: 'display:block;font-size:13px;font-weight:700;color:' + (eu ? '#A03E25' : '#1034A6'), text: nome + ' · ' + quando(m.criado_em) }),
        el('p', { style: 'margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:\'AstroIcones\',\'Architects Daughter\',cursive', text: m.texto })   /* os ícones de astrologia do campo de escrever aparecem na mensagem */
      ]);
    }
    function desenhar(irParaOFim) {
      lista.textContent = '';
      if (!mensagens.length) lista.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhuma mensagem ainda.' }));
      mensagens.forEach(function (m) { lista.appendChild(bloco(m)); });
      if (irParaOFim && mensagens.length > 3) setTimeout(function () { campo.scrollIntoView({ block: 'end' }); }, 0);
    }
    function acrescentar(m) {
      if (!m || vistas[m.id]) return false;
      vistas[m.id] = true; mensagens.push(m);
      mensagens.sort(function (a, b) { return String(a.criado_em) < String(b.criado_em) ? -1 : 1; });
      return true;
    }
    function marcarLidas() {
      if (cfg.previa) return;
      var temNova = mensagens.some(function (m) { return m.de !== minha && !m.lida_em; });
      if (!temNova) return;
      C.rpc('marcar_conversa_lida', { p_aluno: cfg.alunoId }).then(function (r) {
        if (r && r.error) return;
        mensagens.forEach(function (m) { if (m.de !== minha) m.lida_em = m.lida_em || new Date().toISOString(); });
        if (cfg.aoLer) cfg.aoLer();
      }, function () {});
    }
    function carregar(primeira) {
      C.from('aluno_mensagens').select('id,de,texto,criado_em,lida_em').eq('aluno_id', cfg.alunoId).order('criado_em').limit(500).then(function (r) {
        if (r.error) { if (primeira) mensagens.length = 0; if (primeira) { lista.textContent = ''; lista.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar as mensagens agora.' })); } return; }
        var mudou = false;
        (r.data || []).forEach(function (m) { if (acrescentar(m)) mudou = true; });
        if (primeira || mudou) desenhar(primeira);
        marcarLidas();
      }, function () {});
    }
    function parar() {
      if (relogio) { clearInterval(relogio); relogio = null; }
      if (canal) { try { C.removeChannel(canal); } catch (e) { /* já saiu */ } canal = null; }
    }
    function ligar() {
      try {
        canal = C.channel('conversa-' + cfg.alunoId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'aluno_mensagens', filter: 'aluno_id=eq.' + cfg.alunoId }, function (p) {
          if (p && p.new && acrescentar(p.new)) { desenhar(true); marcarLidas(); }
        }).subscribe();
      } catch (e) { canal = null; /* sem tempo real: vale a conferência periódica */ }
      relogio = setInterval(function () {
        if (!document.body.contains(caixa)) { parar(); return; }   /* a tela foi trocada */
        if (document.visibilityState === 'visible') carregar(false);
      }, 30000);
    }

    enviar.addEventListener('click', function () {
      var t = campo.value.trim();
      if (!t) return;
      enviar.disabled = true; P.mensagem(msg, '');
      C.from('aluno_mensagens').insert({ aluno_id: cfg.alunoId, de: minha, texto: t }).select('id,de,texto,criado_em,lida_em').then(function (r) {
        enviar.disabled = false;
        if (r.error) { P.mensagem(msg, P.traduzErro(r.error.message), 'erro'); return; }
        campo.value = ''; campo.dispatchEvent(new Event('input'));
        if (r.data && r.data[0] && acrescentar(r.data[0])) desenhar(true);
      }, function () { enviar.disabled = false; P.mensagem(msg, 'Não foi possível enviar agora.', 'erro'); });
    });

    caixa.appendChild(lista);
    if (cfg.previa) caixa.appendChild(el('p', { class: 'portal-item-data', text: 'Prévia: o aluno escreve aqui.' }));
    else { caixa.appendChild(campo); caixa.appendChild(el('div', { class: 'portal-acoes' }, [enviar])); caixa.appendChild(msg); }
    lista.appendChild(el('p', { class: 'portal-vazio', text: 'Carregando...' }));
    carregar(true);
    ligar();
    return caixa;
  }

  /* quantas mensagens do outro lado ainda não foram lidas (para o número ao lado do nome da aba) */
  function naoLidas(alunoId, souAdmin) {
    return C.from('aluno_mensagens').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId).eq('de', souAdmin ? 'aluno' : 'cassio').is('lida_em', null)
      .then(function (r) { return r && !r.error && typeof r.count === 'number' ? r.count : 0; }, function () { return 0; });
  }

  window.conversa = { tela: tela, naoLidas: naoLidas };
})();
