/* Caderno de estudos do aluno em PDF: a capa (papiro, a mesma do gerador de capas, com o nome do aluno) e, depois, todas as atividades
   dele em ordem de data — perguntas, respostas e correções — no visual do documento A4 dos estudos: fundo branco, títulos em Cinzel
   (terracota, com filete azul), texto em Calibri (Carlito), rodapé "Falando de Astrologia Helenística" + número da página.
   A página 1 é a capa (sem rodapé); as outras já saem numeradas. Texto de verdade (selecionável e bom de imprimir).
   Depende de portal.js, atividades.js e, na hora de baixar, de html2canvas e jsPDF (carregados só então) e capa.js. */
(function () {
  var P = window.portal, el = P.el;
  var COR = { terracota: [160, 62, 37], azul: [31, 95, 163], ocre: [181, 133, 47], texto: [22, 35, 63] };
  var A4 = { w: 595.28, h: 841.89 }, M = 70.87; /* pontos; margens de 2,5 cm */
  var LARGURA = A4.w - 2 * M, LIMITE = A4.h - M;

  function carregarScript(url, pronto) {
    if (pronto()) return Promise.resolve();
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = url; s.onload = function () { pronto() ? ok() : erro(new Error('script')); }; s.onerror = function () { erro(new Error('script')); };
      document.head.appendChild(s);
    });
  }
  function paraBase64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fonte(doc, arquivo, nome, estilo) {
    return fetch('fonts/' + arquivo).then(function (r) { if (!r.ok) throw new Error('fonte'); return r.arrayBuffer(); }).then(function (buf) {
      doc.addFileToVFS(arquivo, paraBase64(buf)); doc.addFont(arquivo, nome, estilo);
    });
  }

  /* a capa vira uma imagem (ela é desenho, não texto) */
  function capaComoImagem(nomeAluno) {
    var F = window.capaFormato('a4');
    var palco = el('div'); palco.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + F.w + 'px;height:' + F.h + 'px';
    palco.appendChild(window.capaFolha({ titulo: 'Caderno de Estudos', subtitulo: 'Acompanhamento Prático Individual', nome: 'Mentoria em Astrologia Clássica',
      aluno: nomeAluno, tamanho: 'm', powered: false, formato: 'a4' }));
    document.body.appendChild(palco);
    var pronto = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var imagens = Array.prototype.map.call(palco.querySelectorAll('img'), function (i) { return i.complete ? 1 : new Promise(function (ok) { i.onload = i.onerror = ok; }); });
    return Promise.all([pronto].concat(imagens)).then(function () {
      return document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 48px Cinzel'), document.fonts.load('700 26px Cinzel')]) : null;
    }).then(function () {
      return window.html2canvas(palco.firstChild, { scale: 2, useCORS: true, backgroundColor: null, width: F.w, height: F.h, windowWidth: F.w });
    }).then(function (c) { palco.remove(); return c.toDataURL('image/jpeg', 0.92); }, function (e) { palco.remove(); throw e; });
  }

  /* monta o PDF; blocos = o que atividades.dadosDoCaderno devolveu */
  function montarPdf(doc, blocos, capaImg) {
    var y = M;
    doc.addImage(capaImg, 'JPEG', 0, 0, A4.w, A4.h);
    doc.addPage(); y = M;

    function nova() { doc.addPage(); y = M; }
    function cabe(h) { if (y + h > LIMITE) nova(); }
    function cor(c) { doc.setTextColor(c[0], c[1], c[2]); }
    /* escreve um texto com quebra de linha; recuo = margem esquerda extra */
    function texto(str, o) {
      o = o || {};
      doc.setFont(o.fonte || 'Carlito', o.estilo || 'normal'); doc.setFontSize(o.tam || 12); cor(o.cor || COR.texto);
      var lh = (o.tam || 12) * (o.entre || 1.3);
      var linhas = doc.splitTextToSize(String(str == null ? '' : str), LARGURA - (o.recuo || 0));
      if (o.juntoComProximo) cabe(lh * linhas.length + (o.juntoComProximo || 0));
      linhas.forEach(function (l) { cabe(lh); doc.text(l, M + (o.recuo || 0), y + (o.tam || 12) * 0.85); y += lh; });
      y += o.depois == null ? 6 : o.depois;
    }
    function titulo(str) {
      doc.setFont('Cinzel', 'bold'); doc.setFontSize(20);
      var linhas = doc.splitTextToSize(str.toUpperCase(), LARGURA);
      cabe(linhas.length * 26 + 60);
      linhas.forEach(function (l) { cor(COR.terracota); doc.text(l, M, y + 18); y += 26; });
      doc.setDrawColor(COR.azul[0], COR.azul[1], COR.azul[2]); doc.setLineWidth(1.4); doc.line(M, y + 2, M + LARGURA, y + 2);
      y += 12;
    }

    if (!blocos.length) {
      titulo('Caderno de estudos');
      texto('Ainda não há atividades neste caderno.');
    }
    blocos.forEach(function (b, i) {
      if (i > 0) nova();
      titulo(b.atividade.titulo);
      texto(b.datas, { tam: 10.5, cor: COR.ocre, estilo: 'bold', depois: 8 });
      if (b.atividade.descricao) texto(b.atividade.descricao, { depois: 10 });
      if (!b.perguntas.length) texto('Esta atividade não tem perguntas.', { estilo: 'italic' });
      b.perguntas.forEach(function (q, n) {
        var r = b.respostas[q.id] || {}, c = b.correcoes[q.id] || {};
        y += 6;
        /* o número e o enunciado ficam juntos (e com pelo menos uma linha da resposta embaixo) na mesma página */
        doc.setFont('Carlito', 'bold'); doc.setFontSize(12);
        var nEnun = doc.splitTextToSize(String(q.enunciado || ''), LARGURA - 20).length;
        cabe(nEnun * 15.6 + 4 + 30);
        doc.setFont('Carlito', 'bold'); doc.setFontSize(12); cor(COR.azul); doc.text((n + 1) + '.', M, y + 10);
        texto(q.enunciado, { estilo: 'bold', recuo: 20, depois: 4 });
        if (q.tipo === 'multipla') {
          (q.opcoes || []).forEach(function (op, k) {
            var minha = r.opcao === k;
            texto(String.fromCharCode(65 + k) + ') ' + op + (minha ? '   (sua resposta)' : ''), { recuo: 20, estilo: minha ? 'bold' : 'normal', cor: minha ? COR.azul : COR.texto, depois: 2 });
          });
          if (r.opcao == null) texto('Sem resposta.', { recuo: 20, estilo: 'italic', depois: 2 });
        } else {
          texto('Sua resposta', { tam: 10.5, estilo: 'bold', cor: COR.azul, recuo: 20, depois: 1 });
          texto(r.texto && String(r.texto).trim() ? r.texto : 'Sem resposta.', { recuo: 20, estilo: r.texto && String(r.texto).trim() ? 'normal' : 'italic', depois: 2 });
        }
        if (c.situacao || c.comentario) {
          texto('Correção' + (c.situacao ? ': ' + (window.atividades.situacoes[c.situacao] || c.situacao) : ''), { tam: 10.5, estilo: 'bold', cor: COR.terracota, recuo: 20, depois: 1 });
          if (c.comentario) texto(c.comentario, { recuo: 20, depois: 2 });
        }
        y += 4;
      });
    });

    /* rodapé de todas as páginas, menos a capa */
    var total = doc.getNumberOfPages();
    for (var p = 2; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(COR.ocre[0], COR.ocre[1], COR.ocre[2]); doc.setLineWidth(0.75); doc.line(M, A4.h - M + 14, M + LARGURA, A4.h - M + 14);
      doc.setFont('Cinzel', 'normal'); doc.setFontSize(9); cor(COR.ocre);
      doc.text('Falando de Astrologia Helenística', M, A4.h - M + 30);
      doc.text(String(p), M + LARGURA, A4.h - M + 30, { align: 'right' });
    }
  }

  function nomeArquivo(nome) {
    var b = String(nome || 'aluno').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/ +/g, '-').toLowerCase();
    return 'caderno-de-estudos-' + (b || 'aluno') + '.pdf';
  }

  /* gera e baixa o caderno do aluno; aviso(texto, tipo) mostra o andamento */
  function baixar(aluno, aviso) {
    aviso('Montando o seu caderno...', 'ok');
    return Promise.all([
      carregarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function () { return !!window.html2canvas; }),
      carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); }),
      carregarScript('capa.js?v=7', function () { return !!window.capaFolha; })
    ]).then(function () {
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
      return Promise.all([
        window.atividades.dadosDoCaderno(aluno),
        capaComoImagem(aluno.nome),
        fonte(doc, 'Cinzel-Regular.ttf', 'Cinzel', 'normal'), fonte(doc, 'Cinzel-Bold.ttf', 'Cinzel', 'bold'),
        fonte(doc, 'Carlito-Regular.ttf', 'Carlito', 'normal'), fonte(doc, 'Carlito-Bold.ttf', 'Carlito', 'bold'), fonte(doc, 'Carlito-Italic.ttf', 'Carlito', 'italic')
      ]).then(function (r) {
        montarPdf(doc, r[0], r[1]);
        doc.save(nomeArquivo(aluno.nome));
        aviso('Pronto! O caderno foi baixado. Procure em Arquivos (Downloads).', 'ok');
      });
    }).catch(function (e) {
      console.error('caderno:', e);
      aviso('Não foi possível montar o caderno agora. Tente de novo em instantes.', 'erro');
    });
  }

  /* o botão (e o aviso) que a página do aluno coloca na aba Atividades */
  function botao(aluno) {
    var msg = el('p', { class: 'portal-msg' });
    var b = el('button', { type: 'button', class: 'portal-btn', text: 'Baixar meu caderno' });
    b.addEventListener('click', function () {
      b.disabled = true;
      baixar(aluno, function (t, tipo) { P.mensagem(msg, t, tipo); }).then(function () { b.disabled = false; });
    });
    return el('div', { style: 'margin-top:14px' }, [el('div', { class: 'portal-acoes' }, [b]), msg]);
  }

  window.caderno = { botao: botao, baixar: baixar, montarPdf: montarPdf };
})();
