/* Widget Horas planetárias (Scriptable). Roda dentro do carregador (widget/carregador.js): este arquivo é buscado no site,
   então mudar aqui muda o widget sem colar nada de novo. Usa o mesmo hora-planetaria.js da Agenda, e imagens fixas em img/widget/.
   LUGAR: latitude e longitude do lugar das horas (padrão Jacareí); troque aqui se mudar. */
const SITE = 'https://falandodeastrologia.com.br';
const LAT = -23.3053, LON = -45.9658;
const AZUL = '#1F5FA3', TERRACOTA = '#A03E25', TINTA = '#16233F';
const PLANETA_ARQ = { 'Sol': 'sol', 'Lua': 'lua', 'Mercúrio': 'mercurio', 'Vênus': 'venus', 'Marte': 'marte', 'Júpiter': 'jupiter', 'Saturno': 'saturno' };

const fm = FileManager.local();
const dir = fm.joinPath(fm.cacheDirectory(), 'fda-horas');
if (!fm.fileExists(dir)) fm.createDirectory(dir);
async function texto(nome) { /* com cópia no aparelho: sem internet, usa a última que baixou */
  const caminho = fm.joinPath(dir, nome.replace(/[^a-z0-9.]/gi, '_'));
  try { const s = await new Request(SITE + '/' + nome).loadString(); fm.writeString(caminho, s); return s; }
  catch (e) { if (fm.fileExists(caminho)) return fm.readString(caminho); throw e; }
}
async function imagem(nome) {
  const caminho = fm.joinPath(dir, nome);
  if (fm.fileExists(caminho)) return Image.fromFile(caminho);
  const img = await new Request(SITE + '/img/widget/' + nome).loadImage(); fm.writeImage(caminho, img); return img;
}

const modulo = { exports: {} };
new Function('module', 'exports', await texto('hora-planetaria.js'))(modulo, modulo.exports);
const HP = modulo.exports;

const p2 = n => String(n).padStart(2, '0');
const hhmm = ms => { const d = new Date(ms + HP.FUSO); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
const numPt = n => String(n).replace('.', ',');
function corTempo(f) { /* azul no começo, ocre no meio, terracota no fim: as barras de prazo do site */
  const A = [31, 95, 163], O = [181, 133, 47], T = [160, 62, 37], de = f < 0.5 ? A : O, para = f < 0.5 ? O : T, t = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5;
  const c = de.map((x, k) => Math.round(x + (para[k] - x) * t));
  return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
}
function diaPlanetario(ms) { /* as 24 horas do dia planetário (de um nascer do sol ao outro) que contém o instante */
  let d = new Date(ms + HP.FUSO), hs = HP.horasDoDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), LAT, LON);
  if (!hs.length || ms < hs[0].ini) { d = new Date(ms - 86400000 + HP.FUSO); hs = HP.horasDoDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), LAT, LON); }
  return hs;
}
function barra(ini, fim, agora, unidade) { /* "62% [barra] 12/23 horas", desenhada como imagem */
  const f = Math.max(0, Math.min(1, (agora - ini) / (fim - ini))), cor = new Color(corTempo(f)), pct = agora >= fim ? 100 : Math.floor(f * 100);
  const total = unidade === 'horas' ? Math.round((fim - ini) / 3600000 * 2) / 2 : Math.round((fim - ini) / 60000 * 2) / 2;
  const passou = agora >= fim ? total : Math.floor(Math.min(f * total, total));
  const W = 720, H = 44, dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = false;
  dc.setFont(new Font('Baskerville-Bold', 30)); dc.setTextColor(cor);
  dc.setTextAlignedLeft(); dc.drawTextInRect(pct + '%', new Rect(0, 5, 100, H));
  dc.setStrokeColor(cor); dc.setLineWidth(3); dc.strokeRect(new Rect(104, 13, 322, 20));
  dc.setFillColor(cor); dc.fillRect(new Rect(107, 16, 316 * f, 14));
  dc.setTextAlignedRight(); dc.drawTextInRect(numPt(passou) + '/' + numPt(total) + ' ' + unidade, new Rect(434, 5, 286, H));
  return dc.getImage();
}
function linhaTexto(pai, t, tam, cor, centro) {
  const x = pai.addText(t); x.font = new Font('Baskerville-Bold', tam); x.textColor = new Color(cor || TINTA); x.lineLimit = 1; x.minimumScaleFactor = 0.6;
  if (centro) x.centerAlignText(); return x;
}

const familia = config.widgetFamily || 'medium';
const w = new ListWidget();
w.url = SITE + '/admin-agenda.html#v=horas';
try {
  const agora = Date.now(), hs = diaPlanetario(agora), i = hs.findIndex(h => agora >= h.ini && agora < h.fim), h = hs[i];
  if (hs.length < 24 || !h) throw new Error('sem horas');
  const dia = hs[0];
  if (familia.indexOf('accessory') === 0) { /* TELA DE BLOQUEIO: o iPhone pinta tudo de branco, então só formas e imagens brancas */
    const SIMBOLO = { 'Sol': '☉', 'Lua': '☽', 'Mercúrio': '☿', 'Vênus': '♀', 'Marte': '♂', 'Júpiter': '♃', 'Saturno': '♄' };
    const f = Math.max(0, Math.min(1, (agora - h.ini) / (h.fim - h.ini))), BRANCO = new Color('#FFFFFF');
    if (familia === 'accessoryInline') {
      w.addText(SIMBOLO[h.planeta] + ' até ' + hhmm(h.fim) + ' · dia ' + SIMBOLO[dia.planeta]);
    } else if (familia === 'accessoryCircular') { /* o planeta da hora dentro de um anel que vai enchendo até a hora acabar */
      const dc = new DrawContext(); dc.size = new Size(240, 240); dc.opaque = false; dc.respectScreenScale = false;
      const anel = (frac, cor) => { const n = Math.max(2, Math.ceil(120 * frac)), cam = new Path();
        for (let k = 0; k <= n; k++) { const t = -Math.PI / 2 + frac * 2 * Math.PI * k / n, pt = new Point(120 + 104 * Math.cos(t), 120 + 104 * Math.sin(t)); if (k === 0) cam.move(pt); else cam.addLine(pt); }
        dc.addPath(cam); dc.setStrokeColor(cor); dc.setLineWidth(15); dc.strokePath(); };
      anel(0.9999, new Color('#FFFFFF', 0.3)); if (f > 0.01) anel(f, BRANCO);
      dc.drawImageInRect(await imagem(PLANETA_ARQ[h.planeta] + '-branco.png'), new Rect(68, 68, 104, 104));
      const im = w.addImage(dc.getImage()); im.centerAlignImage();
    } else { /* retangular: planeta da hora, "11ª hora até 17:11", planeta do dia e a barra da hora */
      const l = w.addStack(); l.centerAlignContent();
      const ic = l.addImage(await imagem(PLANETA_ARQ[h.planeta] + '-branco.png')); ic.imageSize = new Size(30, 30); l.addSpacer(8);
      const col = l.addStack(); col.layoutVertically();
      const t1 = col.addText((i % 12 + 1) + 'ª hora'); t1.font = Font.boldSystemFont(14); t1.textColor = BRANCO;
      const t2 = col.addText('até ' + hhmm(h.fim)); t2.font = Font.systemFont(13); t2.textColor = BRANCO;
      l.addSpacer();
      const dd = l.addImage(await imagem(PLANETA_ARQ[dia.planeta] + '-branco.png')); dd.imageSize = new Size(22, 22);
      w.addSpacer(4);
      const dc = new DrawContext(); dc.size = new Size(360, 16); dc.opaque = false; dc.respectScreenScale = false;
      dc.setStrokeColor(BRANCO); dc.setLineWidth(3); dc.strokeRect(new Rect(2, 2, 356, 12)); dc.setFillColor(BRANCO); dc.fillRect(new Rect(5, 5, 350 * f, 6));
      const b = w.addImage(dc.getImage()); b.imageSize = new Size(150, 150 * 16 / 360);
    }
    w.refreshAfterDate = new Date(Math.min(h.fim, agora + 10 * 60000));
  } else {
  w.backgroundImage = await imagem('papiro-' + (familia === 'small' ? 'pequeno' : familia === 'large' ? 'grande' : 'medio') + '.png');
  w.setPadding(familia === 'small' ? 12 : 14, 18, 10, 18);
  const pequeno = familia === 'small', tamDia = pequeno ? 40 : 46, tamHora = pequeno ? 28 : 32, larg = pequeno ? 134 : 300;

  const linha = w.addStack(); linha.centerAlignContent(); linha.addSpacer();
  const colDia = linha.addStack(); colDia.layoutVertically(); colDia.centerAlignContent();
  const rd = colDia.addImage(await imagem('rot-dia.png')); rd.imageSize = new Size(22, 9); rd.centerAlignImage(); colDia.addSpacer(2);
  const idia = colDia.addImage(await imagem(PLANETA_ARQ[dia.planeta] + '-azul.png')); idia.imageSize = new Size(tamDia, tamDia); idia.centerAlignImage();
  linha.addSpacer(pequeno ? 22 : 34);
  const colHora = linha.addStack(); colHora.layoutVertically(); colHora.centerAlignContent();
  const rh = colHora.addImage(await imagem('rot-hora.png')); rh.imageSize = new Size(28, 9); rh.centerAlignImage(); colHora.addSpacer(2);
  const ihora = colHora.addImage(await imagem(PLANETA_ARQ[h.planeta] + '-terracota.png')); ihora.imageSize = new Size(tamHora, tamHora); ihora.centerAlignImage();
  linha.addSpacer();
  w.addSpacer(pequeno ? 6 : 4);

  if (!pequeno) { const bd = w.addImage(barra(hs[0].ini, hs[23].fim, agora, 'horas')); bd.imageSize = new Size(larg, larg * 44 / 720); bd.centerAlignImage(); w.addSpacer(2); }
  const bh = w.addImage(barra(h.ini, h.fim, agora, 'minutos')); bh.imageSize = new Size(larg, larg * 44 / 720); bh.centerAlignImage();
  w.addSpacer(3);
  linhaTexto(w, (i % 12 + 1) + 'ª hora · ' + hhmm(h.ini) + ' às ' + hhmm(h.fim), pequeno ? 11 : 12, TINTA, true);

  if (familia === 'large') { /* as próximas horas */
    w.addSpacer(8); linhaTexto(w, 'Nascer do sol ' + hhmm(hs[0].ini) + ' · Pôr do sol ' + hhmm(hs[12].ini), 12, TINTA, true); w.addSpacer(8);
    for (let k = i + 1; k < Math.min(hs.length, i + 7); k++) {
      const l = w.addStack(); l.centerAlignContent(); l.addSpacer();
      const ic = l.addImage(await imagem(PLANETA_ARQ[hs[k].planeta] + '-azul.png')); ic.imageSize = new Size(24, 24); l.addSpacer(12);
      linhaTexto(l, (k % 12 + 1) + 'ª · ' + hhmm(hs[k].ini) + ' às ' + hhmm(hs[k].fim), 14); l.addSpacer(); w.addSpacer(4);
    }
  }
  w.refreshAfterDate = new Date(Math.min(h.fim, agora + 10 * 60000));
  }
} catch (e) {
  w.backgroundColor = new Color('#DCC590');
  linhaTexto(w, 'Horas planetárias', 14, TERRACOTA, true); w.addSpacer(6);
  linhaTexto(w, 'Sem conexão agora. Tente de novo em alguns minutos.', 11, TINTA, true);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60000);
}
if (config.runsInWidget) Script.setWidget(w); else if (familia === 'small') await w.presentSmall(); else if (familia === 'large') await w.presentLarge(); else await w.presentMedium();
Script.complete();
