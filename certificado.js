/* Certificado de conclusão do curso, desenhado direto numa folha A4 deitada (papiro, moldura com meandro, logos) e entregue em PDF.
   window.certificado.baixarPdf({ nome, curso, data (AAAA-MM-DD), codigo }) | .desenhar(op) -> Promise<canvas> | .dataExtenso('AAAA-MM-DD')
   Só precisa do jsPDF (carregado na hora de baixar) e das fontes e imagens do próprio site. */
(function () {
  var W = 1123, H = 794, ESC = 2; /* A4 deitado a 96 por polegada; desenhado em dobro para ficar nítido */
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataExtenso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1] + ' de ' + m[1] : '';
  }
  function carregarImagem(src) {
    return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; });
  }
  function carregarScript(url, pronto) {
    if (pronto()) return Promise.resolve();
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = url; s.onload = function () { pronto() ? ok() : erro(new Error('script')); }; s.onerror = function () { erro(new Error('script')); };
      document.head.appendChild(s);
    });
  }
  function desenhar(op) {
    var fontes = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('400 20px Cinzel')]) : null;
    return Promise.all([fontes, carregarImagem('img/papiro-folha.jpg'), carregarImagem('img/logo-falando.svg'), carregarImagem('img/logo-fundamentos.svg')]).then(function (r) {
      var cv = document.createElement('canvas'); cv.width = W * ESC; cv.height = H * ESC;
      var c = cv.getContext('2d'); c.scale(ESC, ESC);
      c.fillStyle = '#dcc590'; c.fillRect(0, 0, W, H);
      if (r[1]) c.drawImage(r[1], 0, 0, W, H);
      /* três filetes (tinta, ocre grosso, tinta) */
      c.fillStyle = 'rgba(0,0,0,0)';
      [[28, '#2B1D12', 1.5], [35, '#B5852F', 4], [42, '#2B1D12', 1.5]].forEach(function (f) { c.strokeStyle = f[1]; c.lineWidth = f[2]; c.strokeRect(f[0], f[0], W - 2 * f[0], H - 2 * f[0]); });
      /* meandros em cima e embaixo */
      c.strokeStyle = '#1F5FA3'; c.lineWidth = 3.4; c.lineJoin = 'miter';
      [58, H - 90].forEach(function (y) {
        for (var x = 64; x + 48 <= W - 64 + 0.1; x += 48) {
          c.beginPath(); c.moveTo(x, y + 28); c.lineTo(x + 8, y + 28); c.lineTo(x + 8, y + 4); c.lineTo(x + 40, y + 4); c.lineTo(x + 40, y + 28);
          c.lineTo(x + 24, y + 28); c.lineTo(x + 24, y + 14); c.lineTo(x + 32, y + 14); c.lineTo(x + 32, y + 20); c.stroke();
        }
      });
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      function linha(txt, y, tam, cor, peso, esp) {
        c.font = (peso || 700) + ' ' + tam + 'px Cinzel, serif'; c.fillStyle = cor;
        if ('letterSpacing' in c) c.letterSpacing = (esp || 0) + 'px';
        c.fillText(txt, W / 2, y);
      }
      function ajustada(txt, y, tam, cor, larguraMax) {
        c.font = '700 ' + tam + 'px Cinzel, serif';
        while (tam > 20 && c.measureText(txt).width > larguraMax) { tam -= 2; c.font = '700 ' + tam + 'px Cinzel, serif'; }
        linha(txt, y, tam, cor, 700, 0);
      }
      linha('certificado de conclusão', 186, 52, '#A03E25', 700, 2);
      c.strokeStyle = '#1F5FA3'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W / 2 - 230, 206); c.lineTo(W / 2 + 230, 206); c.moveTo(W / 2 - 230, 211); c.lineTo(W / 2 + 230, 211); c.stroke();
      linha('certificamos que', 262, 22, '#16233F', 400, 1);
      ajustada(op.nome, 330, 46, '#16233F', W - 300);
      linha('concluiu com aproveitamento o curso', 386, 22, '#16233F', 400, 1);
      ajustada(op.curso, 442, 38, '#A03E25', W - 300);
      linha('em ' + dataExtenso(op.data), 494, 22, '#16233F', 400, 1);
      linha('código de verificação  ' + op.codigo, 566, 18, '#16233F', 700, 1);
      linha('falandodeastrologia.com.br/certificado.html', 590, 15, '#16233F', 400, 1);
      c.strokeStyle = '#16233F'; c.lineWidth = 1; c.beginPath(); c.moveTo(W / 2 - 140, 650); c.lineTo(W / 2 + 140, 650); c.stroke();
      linha('Cássio Pereira', 674, 20, '#16233F', 700, 1);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      if (r[2]) { var k = 0.33; c.drawImage(r[2], 55, 690 - 112 * 1 - 0, 912 * k, 400 * k); }
      if (r[3]) { var k2 = 0.19; c.drawImage(r[3], W - 80 - 1555 * k2 + 12, 672 - 296 * k2 * 0.78, 1555 * k2, 296 * k2); }
      return cv;
    });
  }
  function baixarPdf(op) {
    return Promise.all([desenhar(op), carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); })]).then(function (r) {
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
      doc.addImage(r[0].toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 841.89, 595.28);
      doc.save('Certificado - ' + String(op.curso || 'curso') + '.pdf');
    });
  }
  window.certificado = { desenhar: desenhar, baixarPdf: baixarPdf, dataExtenso: dataExtenso };
})();
