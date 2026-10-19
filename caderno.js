/* Caderno de estudos do aluno em PDF: a capa (papiro, a mesma do gerador de capas, com o nome do aluno) e, depois, todas as atividades
   dele em ordem de data — perguntas, respostas e correções — no visual do documento A4 dos estudos: fundo branco, títulos em Cinzel
   (terracota, com filete azul), texto em Calibri (Carlito), rodapé "Falando de Astrologia Helenística" + número da página.
   A capa não entra na contagem: a página 1 é a folha de rosto (só o título), a 2 é o índice, e as atividades vêm depois. Texto de verdade (selecionável e bom de imprimir).
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
  var FONTES = [['Cinzel-Regular.ttf', 'Cinzel', 'normal'], ['Cinzel-Bold.ttf', 'Cinzel', 'bold'],
    ['Carlito-Regular.ttf', 'Carlito', 'normal'], ['Carlito-Bold.ttf', 'Carlito', 'bold'], ['Carlito-Italic.ttf', 'Carlito', 'italic']];
  function baixarFontes() {
    return Promise.all(FONTES.map(function (f) {
      return fetch('fonts/' + f[0]).then(function (r) { if (!r.ok) throw new Error('fonte'); return r.arrayBuffer(); }).then(paraBase64);
    }));
  }
  function novoDoc(base64s) {
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    FONTES.forEach(function (f, i) { doc.addFileToVFS(f[0], base64s[i]); doc.addFont(f[0], f[1], f[2]); });
    return doc;
  }

  /* baixa a imagem do mapa (link assinado do Supabase) e devolve { dados, tipo, w, h } pra entrar no PDF; null se não deu */
  function imagemDoMapa(caminho) {
    if (!caminho) return Promise.resolve(null);
    return window.atividades.urlAssinada(caminho).then(function (url) {
      if (!url) return null;
      return fetch(url).then(function (r) { return r.ok ? r.blob() : null; }).then(function (blob) {
        if (!blob) return null;
        return new Promise(function (ok) {
          var fr = new FileReader();
          fr.onload = function () {
            var img = new Image();
            img.onload = function () { ok({ dados: fr.result, tipo: /png/i.test(blob.type) ? 'PNG' : 'JPEG', w: img.naturalWidth, h: img.naturalHeight }); };
            img.onerror = function () { ok(null); };
            img.src = fr.result;
          };
          fr.onerror = function () { ok(null); };
          fr.readAsDataURL(blob);
        });
      });
    }).catch(function () { return null; });
  }

  /* a capa vira uma imagem (ela é desenho, não texto) */
  function capaComoImagem(nomeAluno) {
    var F = window.capaFormato('a4');
    var palco = el('div'); palco.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + F.w + 'px;height:' + F.h + 'px';
    palco.appendChild(window.capaFolha({ titulo: 'Caderno de Estudos', subtitulo: 'Acompanhamento Prático de Astrologia', nome: 'Mentoria em Astrologia Clássica',
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

  /* monta o PDF; blocos = o que atividades.dadosDoCaderno devolveu. nums = página (já numerada) onde cada atividade começa; sem ele, usa "00"
     (primeira passada, só pra descobrir onde cada atividade cai). Ordem das páginas: capa (fora da contagem), folha de rosto = página 1,
     índice = página 2 (e seguintes, se for grande), depois as atividades, cada uma começando em página nova. Devolve os inícios. */
  function montarPdf(doc, blocos, capaImg, nums, nomeDoAluno) {
    var y = M, inicios = [];
    doc.addImage(capaImg, 'JPEG', 0, 0, A4.w, A4.h);

    function nova() { doc.addPage(); y = M; }
    function cabe(h) { if (y + h > LIMITE) nova(); }
    function cor(c) { doc.setTextColor(c[0], c[1], c[2]); }
    /* escreve um texto com quebra de linha; recuo = margem esquerda extra */
    function texto(str, o) {
      o = o || {};
      doc.setFont(o.fonte || 'Carlito', o.estilo || 'normal'); doc.setFontSize(o.tam || 12); cor(o.cor || COR.texto);
      var lh = (o.tam || 12) * (o.entre || 1.3);
      var linhas = doc.splitTextToSize(String(str == null ? '' : str), LARGURA - (o.recuo || 0));
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

    /* folha de rosto (página 1): só o título, no meio da página, sem rodapé */
    doc.addPage();
    doc.setFont('Cinzel', 'bold'); doc.setFontSize(32); cor(COR.terracota);
    var tr = doc.splitTextToSize('Caderno de Estudos', LARGURA), alt = tr.length * 42;
    tr.forEach(function (l, i) { doc.text(l, A4.w / 2, (A4.h - alt) / 2 + 32 + i * 42, { align: 'center' }); });

    /* índice (só o título de cada atividade, com o número da página) */
    nova();
    titulo('Índice');
    blocos.forEach(function (b, i) {
      doc.setFont('Carlito', 'normal'); doc.setFontSize(12); cor(COR.texto);
      var num = nums ? String(nums[i]) : '00';
      var linhas = doc.splitTextToSize(String(b.atividade.titulo), LARGURA - 36);
      cabe(linhas.length * 17 + 8);
      linhas.forEach(function (l, k) {
        doc.text(l, M, y + 12);
        if (k === linhas.length - 1) {
          var x0 = M + doc.getTextWidth(l) + 5, x1 = M + LARGURA - doc.getTextWidth(num) - 5;
          doc.setTextColor(COR.ocre[0], COR.ocre[1], COR.ocre[2]);
          var pontos = Math.max(0, Math.floor((x1 - x0) / doc.getTextWidth('.')));
          doc.text(new Array(pontos + 1).join('.'), x0, y + 12);
          cor(COR.texto); doc.text(num, M + LARGURA, y + 12, { align: 'right' });
        }
        y += 17;
      });
      y += 5;
    });
    if (!blocos.length) texto('Ainda não há atividades neste caderno.');

    blocos.forEach(function (b, i) {
      nova(); inicios.push(doc.getNumberOfPages() - 1);
      titulo(b.atividade.titulo);
      texto(b.datas, { tam: 10.5, cor: COR.ocre, estilo: 'bold', depois: 8 });
      if (b.atividade.descricao) {
        window.atividades.blocosDoTexto(b.atividade.descricao).forEach(function (bl) {
          var sm = window.atividades.semMarcas;
          if (bl.tipo === 'sub') { y += 6; texto(sm(bl.texto), { estilo: 'bold', cor: COR.terracota, tam: 13, depois: 4 }); }
          else if (bl.tipo === 'lista') bl.itens.forEach(function (it) { texto('•  ' + sm(it), { recuo: 10, depois: 3 }); });
          else texto(sm(bl.linhas.join('\n')), { depois: 8 });
        });
        y += 4;
      }
      if (b.mapa) {
        var iw = LARGURA, ih = LARGURA * b.mapa.h / b.mapa.w, maxH = 380;
        if (ih > maxH) { iw = iw * maxH / ih; ih = maxH; }
        cabe(ih + 10);
        doc.addImage(b.mapa.dados, b.mapa.tipo, M + (LARGURA - iw) / 2, y, iw, ih);
        y += ih + 12;
      }
      if (!b.perguntas.length && !b.atividade.somente_leitura) texto('Esta atividade não tem perguntas.', { estilo: 'italic' });
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
          y += 14; /* uma linha de respiro entre a resposta e a correção */
          texto('Correção' + (c.situacao ? ': ' + (window.atividades.situacoes[c.situacao] || c.situacao) : ''), { tam: 10.5, estilo: 'bold', cor: COR.terracota, recuo: 20, depois: 1 });
          if (c.comentario) texto(c.comentario, { recuo: 20, depois: 2 });
        }
        var conversa = (b.comentarios && b.comentarios[q.id]) || [];
        if (conversa.length) {
          texto('Comentários', { tam: 10.5, estilo: 'bold', cor: COR.azul, recuo: 20, depois: 1 });
          conversa.forEach(function (c) {
            var quem = c.autor === 'admin' ? 'Cássio' : (String(nomeDoAluno || '').trim().split(/\s+/)[0] || 'Aluno');
            var quando = c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '';
            texto(quem + (quando ? ' · ' + quando : ''), { tam: 10, estilo: 'bold', cor: c.autor === 'admin' ? COR.terracota : COR.azul, recuo: 28, depois: 0 });
            texto(c.texto, { recuo: 28, depois: 4 });
          });
        }
        y += 4;
      });
    });

    /* rodapé: do índice em diante (a capa e a folha de rosto não têm); a folha de rosto é a página 1, então o número é a página física menos 1 */
    var total = doc.getNumberOfPages();
    for (var p = 3; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(COR.ocre[0], COR.ocre[1], COR.ocre[2]); doc.setLineWidth(0.75); doc.line(M, A4.h - M + 14, M + LARGURA, A4.h - M + 14);
      doc.setFont('Cinzel', 'normal'); doc.setFontSize(9); cor(COR.ocre);
      doc.text('Falando de Astrologia Helenística', M, A4.h - M + 30);
      doc.text(String(p - 1), M + LARGURA, A4.h - M + 30, { align: 'right' });
    }
    return inicios;
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
      return Promise.all([window.atividades.dadosDoCaderno(aluno), capaComoImagem(aluno.nome), baixarFontes()]).then(function (r) {
        return Promise.all(r[0].map(function (b) { return imagemDoMapa(b.atividade.imagem_caminho).then(function (m) { b.mapa = m; }); })).then(function () { return r; });
      }).then(function (r) {
        /* duas passadas: a primeira só descobre em que página cada atividade começa, pra o índice sair com os números certos */
        var inicios = montarPdf(novoDoc(r[2]), r[0], r[1], null, aluno.nome);
        var doc = novoDoc(r[2]);
        montarPdf(doc, r[0], r[1], inicios, aluno.nome);
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
