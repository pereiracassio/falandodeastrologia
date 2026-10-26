/* Caderno de estudos do vestibular em PDF (aba Estudos do painel): a capa (papiro) e, depois, as aulas em ordem de data — a explicação, cada questão com
   a resposta marcada, a alternativa certa, a resolução e o que foi escrito à mão no quadro da conta. Só entram aulas que já foram começadas.
   Mesmo visual do caderno do aluno (caderno.js): página 1 = folha de rosto, página 2 = índice, rodapé do índice em diante; a capa não conta.
   Depende de portal.js, caderno.js (peças comuns) e, na hora de gerar, de html2canvas e jsPDF (carregados só então). */
(function () {
  var P = window.portal, U = window.caderno.util, COR = U.cores, A4 = U.a4, M = U.margem;
  var LARGURA = A4.w - 2 * M, LIMITE = A4.h - M;

  /* tudo do banco: aulas, questões e respostas; só as aulas com alguma resposta */
  function dados() {
    var C = P.client;
    return Promise.all([
      C.from('estudo_aulas').select('id,data,materia,titulo,explicacao').order('data').order('criado_em'),
      C.from('estudo_questoes').select('*').order('ordem'),
      C.from('estudo_respostas').select('*')
    ]).then(function (rs) {
      var erro = rs[0].error || rs[1].error || rs[2].error; if (erro) throw erro;
      var resp = {}; rs[2].data.forEach(function (x) { resp[x.questao_id] = x; });
      var porAula = {}; rs[1].data.forEach(function (q) { (porAula[q.aula_id] = porAula[q.aula_id] || []).push(q); });
      return rs[0].data.map(function (a) { return { aula: a, questoes: porAula[a.id] || [] }; }).filter(function (b) {
        b.respostas = resp;
        return b.questoes.some(function (q) { var r = resp[q.id]; return r && (r.opcao != null || (r.texto && r.texto.trim()) || r.desenho); });
      });
    });
  }
  function tamanhoImagem(url) {
    return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok({ w: i.naturalWidth, h: i.naturalHeight }); }; i.onerror = function () { ok(null); }; i.src = url; });
  }
  function dataBR(iso) { var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  function montarPdf(doc, blocos, capaImg, nums) {
    var y = M, inicios = [];
    doc.addImage(capaImg, 'JPEG', 0, 0, A4.w, A4.h);
    function nova() { doc.addPage(); y = M; }
    function cabe(h) { if (y + h > LIMITE) nova(); }
    function cor(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function texto(str, o) {
      o = o || {};
      doc.setFont(o.fonte || 'Carlito', o.estilo || 'normal'); doc.setFontSize(o.tam || 12); cor(o.cor || COR.texto);
      var lh = (o.tam || 12) * 1.3;
      doc.splitTextToSize(String(str == null ? '' : str), LARGURA - (o.recuo || 0)).forEach(function (l) { cabe(lh); doc.text(l, M + (o.recuo || 0), y + (o.tam || 12) * 0.85); y += lh; });
      y += o.depois == null ? 6 : o.depois;
    }
    /* "## " no começo da linha = subtítulo; o resto, parágrafos separados por linha em branco */
    function explicacao(str) {
      var atual = [];
      var fechar = function () { if (atual.length) { texto(atual.join('\n'), { depois: 8 }); atual = []; } };
      String(str || '').split('\n').forEach(function (l) {
        if (/^##\s+/.test(l)) { fechar(); y += 6; texto(l.replace(/^##\s+/, ''), { estilo: 'bold', cor: COR.terracota, tam: 13, depois: 4 }); }
        else if (!l.trim()) fechar(); else atual.push(l);
      });
      fechar();
    }
    function titulo(str) {
      doc.setFont('Cinzel', 'bold'); doc.setFontSize(20);
      var linhas = doc.splitTextToSize(str.toUpperCase(), LARGURA);
      cabe(linhas.length * 26 + 60);
      linhas.forEach(function (l) { cor(COR.terracota); doc.text(l, M, y + 18); y += 26; });
      doc.setDrawColor(COR.azul[0], COR.azul[1], COR.azul[2]); doc.setLineWidth(1.4); doc.line(M, y + 2, M + LARGURA, y + 2);
      y += 12;
    }
    var nomeAula = function (b) { return b.aula.titulo + ' (' + b.aula.materia + ')'; };

    doc.addPage();
    doc.setFont('Cinzel', 'bold'); doc.setFontSize(32); cor(COR.terracota);
    var tr = doc.splitTextToSize('Caderno de Estudos', LARGURA), alt = tr.length * 42;
    tr.forEach(function (l, i) { doc.text(l, A4.w / 2, (A4.h - alt) / 2 + 32 + i * 42, { align: 'center' }); });

    nova(); titulo('Índice');
    blocos.forEach(function (b, i) {
      doc.setFont('Carlito', 'normal'); doc.setFontSize(12); cor(COR.texto);
      var num = nums ? String(nums[i]) : '00', linhas = doc.splitTextToSize(dataBR(b.aula.data).slice(0, 5) + '  ' + nomeAula(b), LARGURA - 36);
      cabe(linhas.length * 17 + 8);
      linhas.forEach(function (l, k) {
        doc.text(l, M, y + 12);
        if (k === linhas.length - 1) {
          var x0 = M + doc.getTextWidth(l) + 5, x1 = M + LARGURA - doc.getTextWidth(num) - 5;
          doc.setTextColor(COR.ocre[0], COR.ocre[1], COR.ocre[2]);
          doc.text(new Array(Math.max(0, Math.floor((x1 - x0) / doc.getTextWidth('.'))) + 1).join('.'), x0, y + 12);
          cor(COR.texto); doc.text(num, M + LARGURA, y + 12, { align: 'right' });
        }
        y += 17;
      });
      y += 5;
    });
    if (!blocos.length) texto('Ainda não há aulas começadas neste caderno.');

    blocos.forEach(function (b) {
      nova(); inicios.push(doc.getNumberOfPages() - 1);
      titulo(b.aula.titulo);
      texto(dataBR(b.aula.data) + ' · ' + b.aula.materia, { tam: 10.5, cor: COR.ocre, estilo: 'bold', depois: 8 });
      explicacao(b.aula.explicacao);
      b.questoes.forEach(function (q, n) {
        var r = b.respostas[q.id] || {};
        y += 8;
        doc.setFont('Carlito', 'bold'); doc.setFontSize(12);
        cabe(doc.splitTextToSize(String(q.enunciado || ''), LARGURA - 20).length * 15.6 + 34);
        doc.setFont('Carlito', 'bold'); doc.setFontSize(12); cor(COR.azul); doc.text((n + 1) + '.', M, y + 10);
        texto(q.enunciado, { estilo: 'bold', recuo: 20, depois: 4 });
        if (r.desenho && r.img) {
          texto('Conta feita à mão', { tam: 10.5, estilo: 'bold', cor: COR.azul, recuo: 20, depois: 2 });
          var iw = LARGURA - 20, ih = iw * r.img.h / r.img.w; if (ih > 360) { iw = iw * 360 / ih; ih = 360; }
          cabe(ih + 8);
          doc.setDrawColor(COR.azul[0], COR.azul[1], COR.azul[2]); doc.setLineWidth(0.6); doc.rect(M + 20, y, LARGURA - 20, ih);
          doc.addImage(r.desenho, 'PNG', M + 20, y, iw, ih); y += ih + 8;
        }
        if (q.tipo === 'multipla') {
          (q.opcoes || []).forEach(function (op, k) {
            var minha = r.opcao === k, certa = q.correta === k;
            texto(String.fromCharCode(65 + k) + ') ' + op + (minha ? '   (sua resposta)' : '') + (certa && r.opcao != null ? '   (resposta certa)' : ''),
              { recuo: 20, estilo: minha || certa ? 'bold' : 'normal', cor: certa && r.opcao != null ? COR.terracota : minha ? COR.azul : COR.texto, depois: 2 });
          });
          if (r.opcao == null) texto('Sem resposta.', { recuo: 20, estilo: 'italic', depois: 2 });
        } else {
          texto('Sua resposta', { tam: 10.5, estilo: 'bold', cor: COR.azul, recuo: 20, depois: 1 });
          var tem = r.texto && String(r.texto).trim();
          texto(tem ? r.texto : 'Sem resposta.', { recuo: 20, estilo: tem ? 'normal' : 'italic', depois: 2 });
        }
        if (q.resolucao && (r.opcao != null || (r.texto && r.texto.trim()))) {
          y += 8; texto('Resolução', { tam: 10.5, estilo: 'bold', cor: COR.terracota, recuo: 20, depois: 1 }); texto(q.resolucao, { recuo: 20, depois: 2 });
        }
        y += 4;
      });
    });

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

  /* gera o PDF e abre numa aba para ver (se o navegador bloquear a aba, baixa); aviso(texto, tipo) mostra o andamento */
  function gerar(nome, aviso) {
    var aba = null; try { aba = window.open('', '_blank'); } catch (e) { /* sem aba */ }
    aviso('Montando o seu caderno...', 'ok');
    return Promise.all([
      U.carregarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function () { return !!window.html2canvas; }),
      U.carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); }),
      U.carregarScript('capa.js?v=7', function () { return !!window.capaFolha; })
    ]).then(function () {
      return Promise.all([dados(), U.capaComoImagem(nome, { titulo: 'Caderno de Estudos', subtitulo: 'Preparação para o Vestibular', nome: 'Fatec · Desenvolvimento de Software Multiplataforma' }), U.baixarFontes()]);
    }).then(function (r) {
      var blocos = r[0];
      return Promise.all(blocos.map(function (b) {
        return Promise.all(b.questoes.map(function (q) {
          var x = b.respostas[q.id]; if (!x || !x.desenho) return null;
          return tamanhoImagem(x.desenho).then(function (t) { x.img = t; });
        }));
      })).then(function () {
        var inicios = montarPdf(U.novoDoc(r[2]), blocos, r[1], null);
        var doc = U.novoDoc(r[2]); montarPdf(doc, blocos, r[1], inicios);
        var url = doc.output('bloburl');
        if (aba && !aba.closed) { aba.location.href = url; aviso('Pronto! O caderno abriu em outra aba.', 'ok'); }
        else { doc.save('caderno-de-estudos.pdf'); aviso('Pronto! O caderno foi baixado. Procure em Arquivos (Downloads).', 'ok'); }
      });
    }).catch(function (e) {
      console.error('caderno de estudos:', e); if (aba) try { aba.close(); } catch (x) { /* nada */ }
      aviso('Não foi possível montar o caderno agora. Tente de novo em instantes.', 'erro');
    });
  }

  window.cadernoEstudos = { gerar: gerar };
})();
