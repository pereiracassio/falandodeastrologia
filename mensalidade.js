/* Mensalidade do aluno (último pagamento, próximo, histórico, Pix e cartão recorrente). Mora na página Seu espaço (cliente.html).
   window.mensalidade.tela(aluno, previa) devolve o bloco pronto; o aluno vê só os dados dele (a função minha_mensalidade do banco devolve só os dele). */
(function () {
  var P = window.portal, el = P.el;
    var CHAVE_PIX = '11970404508';
    var LINK_RECORRENTE_NOVO = 'https://invoice.infinitepay.io/plans/cassiopereira_/TnbWjchMtJ'; /* valor atual, para quem entra agora; quem já tinha o link antigo leva o seu na ficha (painel) */

    function dinheiro(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function rotuloMensalidade(texto) { return el('p', { class: 'impresso', style: 'margin:0 0 4px;font-weight:700;color:#A03E25;font-size:14px', text: texto }); }

    function copiarChavePix(botao) {
      var ok = function () { botao.textContent = 'Chave copiada'; setTimeout(function () { botao.textContent = 'Copiar chave'; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(CHAVE_PIX).then(ok, function () {}); return; }
      var t = document.createElement('textarea'); t.value = CHAVE_PIX; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* sem cópia */ } document.body.removeChild(t);
    }

    /* aba Mensalidade: o aluno vê só os dados dele (a função minha_mensalidade devolve só os dele; o administrador pode pedir os de um aluno) */
    function telaMensalidade(aluno, previa) {
      var caixa = el('div', {}, [el('p', { class: 'portal-vazio', text: 'Carregando...' })]);
      P.client.rpc('minha_mensalidade', { p_aluno: previa ? aluno.id : null }).then(function (r) {
        caixa.textContent = '';
        if (r.error || !r.data) { caixa.appendChild(el('p', { class: 'portal-msg erro', text: 'Não foi possível carregar a mensalidade agora.' })); return; }
        var d = r.data;
        caixa.appendChild(rotuloMensalidade('Último pagamento'));
        caixa.appendChild(el('p', { style: 'margin:0 0 12px', text: d.ultimo ? P.dataBR(String(d.ultimo).slice(0, 10)) : 'Ainda não registrado.' }));
        caixa.appendChild(rotuloMensalidade('Próximo pagamento'));
        caixa.appendChild(el('p', { style: 'margin:0 0 12px', text: d.proximo ? P.dataBR(String(d.proximo).slice(0, 10)) : 'Ainda não definido.' }));
        caixa.appendChild(rotuloMensalidade('Histórico de pagamentos'));
        var hist = d.historico || [];
        if (!hist.length) caixa.appendChild(el('p', { style: 'margin:0 0 12px', text: 'Nenhum pagamento registrado ainda.' }));
        hist.forEach(function (h) {
          caixa.appendChild(el('p', { class: 'portal-item-data', style: 'margin:0 0 4px', text: P.dataBR(String(h.data).slice(0, 10)) + ' · ' + dinheiro(h.valor) + (h.forma ? ' · ' + h.forma : '') }));
        });
        caixa.appendChild(el('hr', { style: 'border:0;border-top:2px solid #1F5FA3;margin:16px 0 14px' }));
        caixa.appendChild(rotuloMensalidade('Formas de pagamento'));
        caixa.appendChild(el('p', { class: 'impresso', style: 'margin:8px 0 2px;font-weight:700;font-size:13px', text: 'Pix' }));
        caixa.appendChild(el('p', { style: 'margin:0 0 6px', text: 'Chave: ' + CHAVE_PIX + ' (celular)' }));
        var copiar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Copiar chave' });
        copiar.addEventListener('click', function () { copiarChavePix(copiar); });
        caixa.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 14px' }, [copiar]));
        caixa.appendChild(el('p', { class: 'impresso', style: 'margin:8px 0 2px;font-weight:700;font-size:13px', text: 'Cartão, pagamento recorrente' }));
        if (d.recorrente) {
          caixa.appendChild(el('p', { style: 'margin:0 0 8px', text: 'Seu pagamento recorrente por cartão está ativo. Para cancelar, é só me avisar.' }));
          caixa.appendChild(el('div', { class: 'portal-whats' }, [el('a', { href: 'https://wa.me/5511970404508?text=' + encodeURIComponent('Oi, Cássio! Quero cancelar o pagamento recorrente da mensalidade.'), target: '_blank', rel: 'noopener', title: 'WhatsApp', 'aria-label': 'Falar pelo WhatsApp' }, [el('img', { src: 'img/rede-whatsapp.svg', alt: 'WhatsApp', width: '44', height: '44' })])]));
        } else {
          caixa.appendChild(el('p', { style: 'margin:0 0 8px', text: 'A mensalidade é cobrada todo mês no seu cartão, sem você precisar lembrar.' }));
          var link = P.linkSeguro(d.link) || LINK_RECORRENTE_NOVO;
          caixa.appendChild(el('div', { class: 'portal-acoes' }, [el('a', { class: 'portal-btn', href: link, target: '_blank', rel: 'noopener', text: 'Ativar pagamento recorrente' })]));
        }
      });
      return caixa;
    }

  window.mensalidade = { tela: telaMensalidade };
})();
