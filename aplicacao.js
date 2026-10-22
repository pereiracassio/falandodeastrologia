/* Aplicação para a mentoria (Acompanhamento Prático de Astrologia), dentro da página mentoria.html, em páginas (passos).
   Substitui o formulário do Tally. Sem login: o primeiro passo já salva o contato como "não concluída" (assim o administrador
   pode chamar quem abandonou), e cada passo seguinte atualiza a mesma aplicação; no fim ela vira "concluída".
   Tudo vai pelo Supabase (função aplicacao_salvar, docs/aplicacoes-mentoria.sql) e aparece em admin-aplicacoes.html.
   Visual do portal: nada de campo nativo no papiro — as opções são botões de contorno azul (escolhida = contorno grosso). */
(function () {
  var P = window.portal, el = P.el, raiz = document.getElementById('aplicacao-form');
  if (!raiz) return;
  var WHATS = '5511970404508';
  var est = { id: null, nome: '', whatsapp: '', email: '', nivel: '', metodo: '', objetivos: [], outros: '', motivo: '' };

  var NIVEIS = ['Estou começando agora, ainda não estudei', 'Já estudei astrologia moderna', 'Já estudei astrologia tradicional', 'Já estudo astrologia clássica', 'Já atendo clientes e quero me aprimorar'];
  var PERGUNTA_METODO = 'A astrologia é o estudo do céu, e céu é o que conseguimos ver quando olhamos para cima. O que não dá para ver a olho nu não é céu, é espaço sideral. Por isso, na astrologia clássica usamos apenas os planetas que podemos encontrar no céu (do Sol a Saturno) e apenas as casas por signos inteiros. Você topa estudar assim?';
  var METODOS = ['Sim, é exatamente o que eu busco.', 'Tenho curiosidade, mas ainda tenho dúvidas.', 'Prefiro continuar usando os planetas modernos.', 'Prefiro outro sistema de casas.'];
  var OBJETIVOS = ['Entender o meu próprio mapa com profundidade', 'Ter segurança para atender clientes', 'Organizar o que já sei e tirar as confusões', 'Aprender técnicas de previsão', 'Outro objetivo'];

  function opcao(texto, marcada, aoClicar) {
    var b = el('button', { type: 'button', class: 'impresso', text: texto, 'aria-pressed': marcada ? 'true' : 'false' });
    b.style.cssText = 'display:block;width:100%;text-align:left;background:transparent;color:#16233F;font:inherit;font-size:16px;cursor:pointer;border-radius:8px;margin:0 0 10px;' +
      (marcada ? 'border:3px solid #1F5FA3;padding:10px 12px' : 'border:1px solid #1F5FA3;padding:12px');
    b.addEventListener('click', aoClicar);
    return b;
  }
  function primeiroNome() { return String(est.nome).trim().split(/\s+/)[0] || ''; }

  /* grava o que já foi respondido (cria a aplicação no 1º passo; depois só atualiza a mesma) */
  function salvar(concluida) {
    return P.client.rpc('aplicacao_salvar', {
      p_id: est.id, p_nome: est.nome, p_whatsapp: est.whatsapp, p_email: est.email, p_nivel: est.nivel || null, p_metodo: est.metodo || null,
      p_objetivos: est.objetivos.length ? est.objetivos : null, p_outros: est.outros || null, p_motivo: est.motivo || null, p_concluida: concluida === true
    }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data) est.id = r.data;
    });
  }

  var passo = 0;
  var PASSOS = [
    { titulo: 'Vamos nos conhecer', desenhar: function (cx, msg) {
      var nome = el('input', { type: 'text', autocomplete: 'name' }); nome.value = est.nome;
      var whats = el('input', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '(11) 99999-9999' }); whats.value = est.whatsapp;
      var email = el('input', { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'seunome@gmail.com' }); email.value = est.email;
      var isca = el('input', { type: 'text', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'empresa' }); /* campo-isca contra robô: pessoa de verdade não vê nem preenche */
      isca.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
      cx.appendChild(el('label', { text: 'Nome completo *' })); cx.appendChild(nome);
      cx.appendChild(el('label', { text: 'WhatsApp (com DDD) *' })); cx.appendChild(whats);
      cx.appendChild(el('label', { text: 'Seu Gmail, o e-mail que você usa no Google *' })); cx.appendChild(email); cx.appendChild(isca);
      return function () {
        est.nome = nome.value.trim(); est.whatsapp = whats.value.trim(); est.email = email.value.trim();
        if (est.nome.length < 3) return 'Escreva o seu nome completo.';
        if (est.whatsapp.replace(/\D/g, '').length < 10) return 'Escreva o seu WhatsApp com DDD.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(est.email)) return 'Escreva um e-mail válido.';
        if (isca.value) { est.robo = true; }
        return null;
      };
    } },
    { titulo: 'De onde você parte', desenhar: function (cx) {
      cx.appendChild(el('label', { text: 'Como você descreveria o seu momento na astrologia? *' }));
      var area = el('div');
      (function pintar() { area.textContent = ''; NIVEIS.forEach(function (n) { area.appendChild(opcao(n, est.nivel === n, function () { est.nivel = n; pintar(); })); }); })();
      cx.appendChild(area);
      return function () { return est.nivel ? null : 'Escolha uma opção.'; };
    } },
    { titulo: 'O céu e a astrologia clássica', desenhar: function (cx) {
      cx.appendChild(el('p', { class: 'impresso', style: 'font-size:16px;font-weight:700;line-height:1.5;margin:0 0 14px', text: PERGUNTA_METODO + ' *' }));
      var area = el('div');
      (function pintar() { area.textContent = ''; METODOS.forEach(function (n) { area.appendChild(opcao(n, est.metodo === n, function () { est.metodo = n; pintar(); })); }); })();
      cx.appendChild(area);
      return function () { return est.metodo ? null : 'Escolha uma opção.'; };
    } },
    { titulo: 'O que você busca', desenhar: function (cx) {
      cx.appendChild(el('label', { text: 'O que você espera da mentoria? (pode marcar mais de um) *' }));
      var area = el('div'), outros = el('textarea', { rows: '3', placeholder: 'Conte quais outros objetivos' });
      outros.value = est.outros;
      outros.addEventListener('input', function () { est.outros = outros.value; });
      function pintar() {
        area.textContent = '';
        OBJETIVOS.forEach(function (n) {
          var marcada = est.objetivos.indexOf(n) >= 0;
          area.appendChild(opcao(n, marcada, function () {
            if (marcada) est.objetivos = est.objetivos.filter(function (x) { return x !== n; }); else est.objetivos.push(n);
            pintar();
          }));
        });
        outros.style.display = est.objetivos.indexOf('Outro objetivo') >= 0 ? '' : 'none';
      }
      pintar(); cx.appendChild(area); cx.appendChild(outros);
      var motivo = el('textarea', { rows: '5' }); motivo.value = est.motivo;
      cx.appendChild(el('label', { text: 'O que te chamou atenção na mentoria? *' })); cx.appendChild(motivo);
      return function () {
        est.motivo = motivo.value.trim();
        if (!est.objetivos.length) return 'Marque pelo menos um objetivo.';
        if (est.objetivos.indexOf('Outro objetivo') >= 0 && !est.outros.trim()) return 'Conte quais são os outros objetivos.';
        if (est.motivo.length < 3) return 'Conte o que te chamou atenção na mentoria.';
        return null;
      };
    } }
  ];

  function agradecimento() {
    raiz.textContent = '';
    var msgWhats = 'Oi, Cássio! Aqui é ' + primeiroNome() + '. Acabei de enviar a aplicação para o Acompanhamento Prático de Astrologia.';
    var botao = el('a', { class: 'portal-btn portal-btn-whats', href: 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(msgWhats), target: '_blank', rel: 'noopener', text: 'Avisar o Cássio no WhatsApp' });
    raiz.appendChild(el('div', { class: 'portal-cartao' }, [
      el('h2', { text: 'Recebi a sua aplicação, obrigado!' }),
      el('p', { text: 'Vou ler as suas respostas com cuidado para entender o seu momento e o que podemos trabalhar juntos.' }),
      el('p', { text: 'Entro em contato pelo seu WhatsApp em até 48 horas para combinarmos os próximos passos.' }),
      el('p', { style: 'font-weight:700', text: 'Se quiser que eu veja mais rápido, toque no botão abaixo e me avise no WhatsApp. A mensagem já vai pronta.' }),
      el('div', { class: 'portal-acoes' }, [botao])
    ]));
  }

  function mostrar() {
    raiz.textContent = '';
    var p = PASSOS[passo], ultimo = passo === PASSOS.length - 1;
    var cx = el('div', { class: 'portal-cartao' });
    cx.appendChild(el('p', { class: 'portal-item-data impresso', text: 'Passo ' + (passo + 1) + ' de ' + PASSOS.length }));
    cx.appendChild(el('h2', { text: p.titulo }));
    var msg = el('p', { class: 'portal-msg' });
    var validar = p.desenhar(cx, msg);
    var proximo = el('button', { type: 'button', class: 'portal-btn', text: ultimo ? 'Enviar aplicação' : 'Próximo' });
    var acoes = el('div', { class: 'portal-acoes' });
    if (passo > 0) {
      var voltar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Voltar' });
      voltar.addEventListener('click', function () { validar(); passo--; mostrar(); });
      acoes.appendChild(voltar);
    }
    acoes.appendChild(proximo);
    cx.appendChild(msg); cx.appendChild(acoes);
    proximo.addEventListener('click', function () {
      var erro = validar();
      if (erro) { P.mensagem(msg, erro, 'erro'); return; }
      proximo.disabled = true; P.mensagem(msg, ultimo ? 'Enviando...' : 'Salvando...');
      /* robô (campo-isca preenchido): finge que deu certo e não grava nada */
      var gravar = est.robo ? Promise.resolve() : salvar(ultimo);
      gravar.then(function () {
        if (ultimo) { agradecimento(); return; }
        passo++; mostrar();
        raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function () {
        proximo.disabled = false;
        P.mensagem(msg, 'Não foi possível enviar agora. Confira a sua internet e tente de novo. Se continuar, me chame no WhatsApp.', 'erro');
      });
    });
    raiz.appendChild(cx);
  }
  mostrar();
})();
