const fs = require('fs');
const D = require('/opt/node22/lib/node_modules/docx');
const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, LevelFormat, BorderStyle, TabStopType, LeaderType, PageNumber, HeadingLevel,
        Table, TableRow, TableCell, WidthType, ShadingType, ExternalHyperlink, VerticalAlign, LineRuleType } = D;
const AUTO = LineRuleType.AUTO;

const COR = { terracota: 'A03E25', azul: '1F5FA3', ocre: 'B5852F', texto: '16233F' };
const W = 11906, H = 16838, MARGEM = 1417, LARGURA = W - 2 * MARGEM; // A4, margens de 2,5 cm
const blocos = JSON.parse(fs.readFileSync('conteudo.json', 'utf8'));
const numeros = fs.existsSync('numeros.json') ? JSON.parse(fs.readFileSync('numeros.json', 'utf8')) : null;

const titulo = blocos[0].runs.map(r => r.t).join('');
const capitulos = blocos.filter(b => b.k === 'h' && b.level === 2).map(b => b.runs.map(r => r.t).join(''));

function runs(rs, extra) {
  extra = extra || {};
  return rs.map(r => {
    const o = { text: r.t, bold: r.b || extra.bold, italics: r.i || extra.italics };
    if (r.h) {
      return new ExternalHyperlink({ link: r.h, children: [new TextRun(Object.assign(o, { color: COR.azul, underline: {} }))] });
    }
    return new TextRun(o);
  });
}

// listas numeradas: cada lista numerada ganha a sua própria numeração (recomeça em 1)
const numConfig = [{ reference: 'marcadores', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
  style: { run: { color: COR.ocre }, paragraph: { indent: { left: 720, hanging: 360 } } } }] }];
let nOl = 0;
function novaLista() {
  const ref = 'num' + (nOl++);
  numConfig.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
    style: { run: { color: COR.azul, bold: true }, paragraph: { indent: { left: 720, hanging: 360 } } } }] });
  return ref;
}

const borda = (cor, tam) => ({ style: BorderStyle.SINGLE, size: tam, color: cor });
function tabela(b) {
  const nCols = Math.max(...b.rows.map(r => r.length));
  const pesos = [];
  for (let c = 0; c < nCols; c++) {
    let m = 0; b.rows.forEach(r => { if (r[c]) m = Math.max(m, r[c].runs.map(x => x.t).join('').length); });
    pesos.push(Math.min(Math.max(m, 8), 70));
  }
  const soma = pesos.reduce((a, c) => a + c, 0);
  let larguras = pesos.map(p => Math.max(1300, Math.round(LARGURA * p / soma)));
  const ajuste = LARGURA - larguras.reduce((a, c) => a + c, 0);
  larguras[larguras.indexOf(Math.max(...larguras))] += ajuste;
  const linhas = b.rows.map((r, ri) => new TableRow({
    tableHeader: ri === 0, cantSplit: true,
    children: larguras.map((w, ci) => {
      const cel = r[ci] || { runs: [], h: false };
      const cab = ri === 0 && b.rows[0].every(x => x.h);
      return new TableCell({
        width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
        margins: { top: 70, bottom: 70, left: 110, right: 110 },
        borders: { top: borda(COR.azul, 4), bottom: borda(COR.azul, cab ? 12 : 4), left: borda(COR.azul, 4), right: borda(COR.azul, 4) },
        children: [new Paragraph({ spacing: { before: 0, after: 0, line: 264, lineRule: AUTO }, keepNext: ri < b.rows.length - 1 && ri < 2,
          children: runs(cel.runs, cab ? { bold: true } : {}).map(x => x) })]
      });
    })
  }));
  return [new Table({ width: { size: LARGURA, type: WidthType.DXA }, columnWidths: larguras, rows: linhas }),
          new Paragraph({ spacing: { before: 0, after: 120 }, children: [] })];
}

const corpo = [];
let aposTitulo = false;
for (const b of blocos.slice(1)) {
  if (b.k === 'h') { aposTitulo = true; }
  if (b.k === 'h') {
    corpo.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: false, children: [new TextRun(b.runs.map(r => r.t).join(''))] }));
  } else if (b.k === 'p') {
    const todoNegrito = b.runs.length && b.runs.every(r => r.b);
    const abertura = aposTitulo; aposTitulo = false;
    corpo.push(new Paragraph(todoNegrito
      ? { style: 'Texto', keepNext: true, spacing: { before: 240, after: 100 }, children: runs(b.runs) }
      : abertura ? { style: 'Abertura', children: runs(b.runs) }
      : { style: 'Texto', children: runs(b.runs) }));
  } else if (b.k === 'ul') {
    b.items.forEach(it => corpo.push(new Paragraph({ numbering: { reference: 'marcadores', level: 0 }, spacing: { after: 80 }, children: runs(it) })));
  } else if (b.k === 'ol') {
    const ref = novaLista();
    b.items.forEach(it => corpo.push(new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 }, children: runs(it) })));
  } else if (b.k === 'table') {
    tabela(b).forEach(x => corpo.push(x));
  }
}

const indice = capitulos.map((c, i) => new Paragraph({
  style: 'Indice1',
  tabStops: [{ type: TabStopType.RIGHT, position: LARGURA, leader: LeaderType.DOT }],
  children: [new TextRun(c), new TextRun('\t'), new TextRun(numeros ? String(numeros[i]) : '00')]
}));

const doc = new Document({
  creator: 'Falando de Astrologia', title: titulo,
  styles: {
    default: { document: { run: { font: 'Calibri', size: 24, color: COR.texto, language: { value: 'pt-BR' } }, paragraph: { spacing: { line: 264, lineRule: AUTO, after: 120 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cinzel', size: 44, bold: true, allCaps: true, color: COR.terracota },
        paragraph: { spacing: { before: 480, after: 200, line: 276, lineRule: AUTO }, keepNext: true, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COR.azul, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cinzel', size: 32, bold: true, color: COR.azul }, paragraph: { spacing: { before: 360, after: 140, line: 276, lineRule: AUTO }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cinzel', size: 26, bold: true, color: COR.texto }, paragraph: { spacing: { before: 280, after: 100, line: 276, lineRule: AUTO }, keepNext: true, outlineLevel: 2 } },
      { id: 'TituloIndice', name: 'Título do índice', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cinzel', size: 44, bold: true, allCaps: true, color: COR.terracota },
        paragraph: { spacing: { before: 0, after: 240, line: 276, lineRule: AUTO }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COR.azul, space: 4 } } } },
      { id: 'Indice1', name: 'Índice 1', basedOn: 'Normal', quickFormat: true, run: { size: 24 }, paragraph: { spacing: { before: 0, after: 100, line: 300, lineRule: AUTO } } },
      { id: 'TituloApostila', name: 'Título da apostila', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cinzel', size: 64, bold: true, color: COR.terracota }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 300, lineRule: AUTO } } },
      { id: 'Texto', name: 'Texto', basedOn: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 24, color: COR.texto }, paragraph: { spacing: { line: 264, lineRule: AUTO, after: 120 } } },
      { id: 'Abertura', name: 'Abertura do capítulo', basedOn: 'Texto', quickFormat: true, run: { bold: true, size: 26 }, paragraph: { spacing: { line: 276, lineRule: AUTO, after: 160 } } },
      { id: 'Rodape', name: 'Rodapé do documento', basedOn: 'Normal', run: { font: 'Cinzel', size: 18, color: COR.ocre }, paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: AUTO } } }
    ]
  },
  numbering: { config: numConfig },
  sections: [{
    properties: { page: { size: { width: W, height: H }, margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM }, pageNumbers: { start: 1 } } },
    headers: { default: new Header({ children: [new Paragraph('')] }) },
    footers: { default: new Footer({ children: [new Paragraph('')] }) },
    children: [ ...Array.from({ length: 7 }, () => new Paragraph({ spacing: { before: 0, after: 0, line: 880, lineRule: LineRuleType.EXACT }, children: [] })), new Paragraph({ style: 'TituloApostila', children: [new TextRun(titulo)] }) ]
  }, {
    properties: { page: { size: { width: W, height: H }, margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM } } },
    headers: { default: new Header({ children: [new Paragraph('')] }) },
    footers: { default: new Footer({ children: [new Paragraph({ style: 'Rodape',
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: COR.ocre, space: 6 } },
        tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }],
        children: [new TextRun('Falando de Astrologia Helenística'), new TextRun('\t'), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
    children: [
      new Paragraph({ style: 'TituloIndice', children: [new TextRun('Índice')] }),
      ...indice,
      new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun(capitulos[0])] }),
      ...corpo.slice(1)
    ]
  }]
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(process.argv[2] || 'saida.docx', buf); console.log('ok', capitulos.length, 'capitulos'); });
