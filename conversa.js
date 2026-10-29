/* Mensagens do aluno para o Cássio e as respostas (só texto), na aba Dúvidas. window.conversa.tela({ alunoId, souAdmin, nomeAluno, previa, aoLer }) devolve a tela pronta.
   Funciona como o WhatsApp: as mensagens ficam em ordem, a mais nova embaixo (as suas à direita, as do outro à esquerda); o campo e o botão Enviar ficam
   FIXOS embaixo da tela, com o Enviar do lado direito (alcança com o polegar); abre já na última mensagem e, depois de enviar, o teclado continua aberto.
   A mensagem nova do outro lado aparece na hora (Realtime do Supabase) e, como reserva, a tela confere de 30 em 30 segundos enquanto está aberta.
   Os avisos de mensagem nova são gravados pelo próprio banco (docs/conversa.sql). */
(function () {
  var P = window.portal, el = P.el, C = P.client;
  var AZUL = '#1F5FA3', AZUL_ESCURO = '#1034A6', OCRE = '#B5852F', TERRACOTA = '#A03E25';

  /* balão só de contorno, bem redondinho, sem bico (licença poética dele: é o ÚNICO lugar do site com canto arredondado; por isso o !important contra a regra de canto reto) */
  function estilosDosBaloes() {
    if (document.getElementById('conversa-css')) return;
    var st = document.createElement('style'); st.id = 'conversa-css';
    st.textContent =
      '.balao{position:relative;max-width:82%;margin:0 0 10px;padding:9px 14px 5px;border:1.5px solid;box-sizing:border-box;border-radius:20px!important;background:transparent}' +
      '.balao-eu{align-self:flex-end;border-color:' + OCRE + ';margin-right:6px}' +
      '.balao-outro{align-self:flex-start;border-color:' + AZUL_ESCURO + ';margin-left:6px}' +
      '.balao p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;font-family:"AstroIcones","Architects Daughter",cursive}' +
      '.balao-rodape{display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:2px;font:400 11px "Architects Daughter",cursive;color:rgba(22,35,63,.62)}' +
      '.dia-conversa{align-self:center;margin:6px 0 12px;font:700 12px "Cinzel",serif;text-transform:lowercase;letter-spacing:.03em;color:' + AZUL_ESCURO + '}';
    document.head.appendChild(st);
  }
  var SVG = 'http://www.w3.org/2000/svg';
  /* tracinhos de enviado (um, cinza) e lido (dois, azuis), desenhados à mão no SVG */
  function tracinhos(lido) {
    var svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('width', lido ? '19' : '14'); svg.setAttribute('height', '10'); svg.setAttribute('viewBox', lido ? '0 0 19 10' : '0 0 14 10'); svg.setAttribute('aria-label', lido ? 'Lida' : 'Enviada');
    [lido ? 'M1 5.5 L4.5 9 L12 1.5' : 'M1 5.5 L5 9 L13 1', 'M6.5 8.5 L7.8 9 L17.5 1.5'].slice(0, lido ? 2 : 1).forEach(function (d) {
      var pth = document.createElementNS(SVG, 'path'); pth.setAttribute('d', d); pth.setAttribute('fill', 'none'); pth.setAttribute('stroke', lido ? AZUL_ESCURO : 'rgba(22,35,63,.55)');
      pth.setAttribute('stroke-width', '1.6'); pth.setAttribute('stroke-linecap', 'round'); pth.setAttribute('stroke-linejoin', 'round'); svg.appendChild(pth);
    });
    return svg;
  }
  function hora(iso) {
    try { return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function diaDe(iso) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch (e) { return String(iso || '').slice(0, 10); }
  }
  function rotuloDoDia(dia) {
    var hoje = diaDe(new Date().toISOString()), ontem = diaDe(new Date(Date.now() - 86400000).toISOString());
    if (dia === hoje) return 'hoje'; if (dia === ontem) return 'ontem';
    return dia.slice(8, 10) + '/' + dia.slice(5, 7) + '/' + dia.slice(0, 4);
  }

  function quando(iso) {
    try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''); }
    catch (e) { return String(iso || '').slice(0, 10); }
  }
  var noFim = function () { return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 220; };
  var irAoFim = function () { window.scrollTo(0, document.documentElement.scrollHeight); };

  function tela(cfg) {
    var minha = cfg.souAdmin ? 'cassio' : 'aluno';
    var caixa = el('div', {});
    estilosDosBaloes();
    var lista = el('div', { style: 'display:flex;flex-direction:column' });
    var mensagens = [], vistas = {}, canal = null, relogio = null, vigia = null, barra = null, aoRedimensionar = null;

    function bloco(m) {
      var eu = m.de === minha;
      var rodape = el('div', { class: 'balao-rodape' }, [el('span', { text: hora(m.criado_em) })]);
      if (eu) rodape.appendChild(tracinhos(!!m.lida_em));
      return el('div', { class: 'balao ' + (eu ? 'balao-eu' : 'balao-outro') }, [el('p', { text: m.texto }), rodape]);
    }
    function desenhar() {
      lista.textContent = '';
      if (!mensagens.length) lista.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhuma mensagem ainda.' }));
      var diaAnterior = '';
      mensagens.forEach(function (m) {
        var d = diaDe(m.criado_em);
        if (d !== diaAnterior) { diaAnterior = d; lista.appendChild(el('span', { class: 'dia-conversa', text: rotuloDoDia(d) })); }
        lista.appendChild(bloco(m));
      });
    }
    function acrescentar(m) {
      if (!m || vistas[m.id]) return false;
      vistas[m.id] = true; mensagens.push(m);
      mensagens.sort(function (a, b) { return String(a.criado_em) < String(b.criado_em) ? -1 : 1; });
      return true;
    }
    function marcarLidas() {
      if (cfg.previa) return;
      if (!mensagens.some(function (m) { return m.de !== minha && !m.lida_em; })) return;
      C.rpc('marcar_conversa_lida', { p_aluno: cfg.alunoId }).then(function (r) {
        if (r && r.error) return;
        mensagens.forEach(function (m) { if (m.de !== minha) m.lida_em = m.lida_em || new Date().toISOString(); });
        if (cfg.aoLer) cfg.aoLer();
      }, function () {});
    }
    function carregar(primeira) {
      C.from('aluno_mensagens').select('id,de,texto,criado_em,lida_em').eq('aluno_id', cfg.alunoId).order('criado_em').limit(500).then(function (r) {
        if (r.error) { if (primeira) { lista.textContent = ''; lista.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a conversa agora.' })); } return; }
        var perto = noFim(), mudou = false;
        (r.data || []).forEach(function (m) {
          if (acrescentar(m)) { mudou = true; return; }
          var antiga = mensagens.filter(function (x) { return x.id === m.id; })[0];
          if (antiga && !antiga.lida_em && m.lida_em) { antiga.lida_em = m.lida_em; mudou = true; }   /* o outro lado leu: os tracinhos ficam azuis */
        });
        if (primeira || mudou) {
          desenhar();
          if (primeira) { setTimeout(irAoFim, 50); setTimeout(irAoFim, 400); } else if (perto) setTimeout(irAoFim, 0);
        }
        marcarLidas();
      }, function () {});
    }
    function parar() {
      if (relogio) { clearInterval(relogio); relogio = null; }
      if (vigia) { clearInterval(vigia); vigia = null; }
      if (canal) { try { C.removeChannel(canal); } catch (e) { /* já saiu */ } canal = null; }
      if (barra && barra.__restaurar) barra.__restaurar();
      if (barra && barra.parentNode) barra.parentNode.removeChild(barra);
      if (aoRedimensionar) { window.removeEventListener('resize', aoRedimensionar); aoRedimensionar = null; }
      barra = null;
    }
    function ligar() {
      try {
        canal = C.channel('conversa-' + cfg.alunoId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'aluno_mensagens', filter: 'aluno_id=eq.' + cfg.alunoId }, function (p) {
          if (p && p.new) { var perto = noFim(); if (acrescentar(p.new)) { desenhar(); if (perto || p.new.de === minha) setTimeout(irAoFim, 0); marcarLidas(); } }
        }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'aluno_mensagens', filter: 'aluno_id=eq.' + cfg.alunoId }, function (p) {
          var antiga = p && p.new ? mensagens.filter(function (x) { return x.id === p.new.id; })[0] : null;
          if (antiga && !antiga.lida_em && p.new.lida_em) { antiga.lida_em = p.new.lida_em; desenhar(); }
        }).subscribe();
      } catch (e) { canal = null; /* sem tempo real: vale a conferência periódica */ }
      relogio = setInterval(function () { if (document.visibilityState === 'visible') carregar(false); }, 30000);
    }

    /* barra de escrever, fixa embaixo da tela */
    function montarBarra() {
      var campo = el('textarea', { rows: '1', placeholder: 'Escreva a sua mensagem', 'aria-label': 'Mensagem', 'data-icones': '1' });
      campo.classList.add('escrita-livre');   /* já marcado, para o site não aplicar a escrita livre grande nem a paleta de ícones aqui */
      var estilo = { border: '1px solid ' + AZUL, 'border-radius': '0', padding: '9px 10px', margin: '0', background: 'transparent', color: '#16233F', 'min-height': '44px', 'max-height': '40vh',
        'font-size': '17px', 'font-family': '"Architects Daughter", cursive', 'line-height': '1.4', resize: 'none', 'overflow-y': 'auto', flex: '1 1 auto', width: '100%', display: 'block', 'box-sizing': 'border-box' };
      Object.keys(estilo).forEach(function (k) { campo.style.setProperty(k, estilo[k], 'important'); });
      var enviar = el('button', { type: 'button', class: 'portal-btn', text: 'Enviar' });
      enviar.style.cssText = 'flex:0 0 auto;margin:0;min-height:44px;white-space:nowrap;background:' + TERRACOTA + ';color:#F3E3B8;border:0;border-radius:0;padding:0 22px;font:700 15px Cinzel,serif;text-transform:lowercase;letter-spacing:.03em;cursor:pointer';
      var erro = el('p', { class: 'portal-msg', style: 'margin:0 0 6px;max-width:720px;margin-left:auto;margin-right:auto' });
      var linha = el('div', { style: 'display:flex;gap:10px;align-items:flex-end;max-width:720px;margin:0 auto' }, [campo, enviar]);
      barra = el('div', { style: 'position:fixed;left:0;right:0;bottom:0;z-index:90;padding:8px 14px calc(8px + env(safe-area-inset-bottom));box-sizing:border-box;background:var(--papiro-fundo-simples);border-top:2px solid ' + AZUL }, [erro, linha]);

      function medir() { document.body.style.setProperty('padding-bottom', barra.offsetHeight + 'px', 'important'); }   /* reserva o lugar da barra: nada fica escondido atrás dela */
      barra.__restaurar = function () { document.body.style.removeProperty('padding-bottom'); };
      function crescer() { campo.style.setProperty('height', 'auto', 'important'); campo.style.setProperty('height', Math.min(campo.scrollHeight + 2, window.innerHeight * 0.4) + 'px', 'important'); medir(); }
      campo.addEventListener('input', crescer);
      aoRedimensionar = medir; window.addEventListener('resize', medir);
      function mandar() {
        var t = campo.value.trim();
        if (!t || enviar.disabled) return;
        enviar.disabled = true; P.mensagem(erro, '');
        C.from('aluno_mensagens').insert({ aluno_id: cfg.alunoId, de: minha, texto: t }).select('id,de,texto,criado_em,lida_em').then(function (r) {
          enviar.disabled = false;
          if (r.error) { P.mensagem(erro, P.traduzErro(r.error.message), 'erro'); return; }
          campo.value = ''; crescer();
          if (r.data && r.data[0] && acrescentar(r.data[0])) { desenhar(); setTimeout(irAoFim, 0); }
          campo.focus();   /* como no WhatsApp: o teclado continua aberto para a próxima */
        }, function () { enviar.disabled = false; P.mensagem(erro, 'Não foi possível enviar agora.', 'erro'); });
      }
      enviar.addEventListener('click', mandar);
      enviar.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   /* tocar em Enviar não tira o foco do campo (o teclado não fecha) */
      /* no computador, Enter envia e Shift+Enter quebra a linha; no celular o Enter quebra a linha e o botão envia */
      campo.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && !(window.matchMedia && matchMedia('(pointer:coarse)').matches)) { ev.preventDefault(); mandar(); }
      });
      document.body.appendChild(barra);
      medir();
    }

    caixa.appendChild(lista);
    if (cfg.previa) caixa.appendChild(el('p', { class: 'portal-item-data', text: 'Prévia: o aluno escreve aqui.' }));
    lista.appendChild(el('p', { class: 'portal-vazio', text: 'Carregando...' }));
    carregar(true);
    ligar();
    if (!cfg.previa) {
      /* a barra só existe enquanto esta aba está na tela: sai quando a pessoa troca de aba ou de página */
      var vista = false, voltas = 0;
      setTimeout(function () { montarBarra(); }, 0);
      vigia = setInterval(function () {
        var dentro = document.body.contains(caixa);
        if (dentro) vista = true;
        if ((vista && !dentro) || (!vista && ++voltas > 10)) parar();   /* saiu da tela, ou nunca chegou a entrar */
      }, 400);
    }
    return caixa;
  }

  /* quantas mensagens do outro lado ainda não foram lidas (para o número ao lado do nome da aba) */
  function naoLidas(alunoId, souAdmin) {
    return C.from('aluno_mensagens').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId).eq('de', souAdmin ? 'aluno' : 'cassio').is('lida_em', null)
      .then(function (r) { return r && !r.error && typeof r.count === 'number' ? r.count : 0; }, function () { return 0; });
  }

  window.conversa = { tela: tela, naoLidas: naoLidas };
})();
