/* Widget Agenda (Scriptable). Roda dentro do carregador (widget/carregador-agenda.js).
   Lê os compromissos do app Calendário do próprio aparelho (onde a conta do Google já está), sem login e sem servidor.
   Cada compromisso leva o planeta da hora em que começa (ocre de dia, azul de noite); de dia todo leva o planeta do dia (terracota).
   LUGAR das horas planetárias: LAT/LON. NAO_MOSTRAR: agendas do Calendário que não entram (pedaço do nome basta). */
const SITE = 'https://falandodeastrologia.com.br';
const LAT = -23.3053, LON = -45.9658;
const NAO_MOSTRAR = ['feriado', 'holiday', 'aniversário', 'birthday', 'siri', 'sugestões'];
const TINTA = '#16233F', AZUL = '#1034A6', TERRACOTA = '#A03E25';
const COR_HORA_DIA = 'ocre';
const MOSTRAR_PREVIA = false; /* true = ao tocar no play dentro do Scriptable, mostra o widget na tela para testar */
const PLANETA_ARQ = { 'Sol': 'sol', 'Lua': 'lua', 'Mercúrio': 'mercurio', 'Vênus': 'venus', 'Marte': 'marte', 'Júpiter': 'jupiter', 'Saturno': 'saturno' };
const REGENTE_DO_DIA = ['Sol', 'Lua', 'Marte', 'Mercúrio', 'Júpiter', 'Vênus', 'Saturno'];

const fm = FileManager.local();
const dir = fm.joinPath(fm.cacheDirectory(), 'fda-horas');
if (!fm.fileExists(dir)) fm.createDirectory(dir);
async function texto(nome) {
  const caminho = fm.joinPath(dir, nome.replace(/[^a-z0-9.]/gi, '_'));
  try { const s = await new Request(SITE + '/' + nome).loadString(); fm.writeString(caminho, s); return s; }
  catch (e) { if (fm.fileExists(caminho)) return fm.readString(caminho); throw e; }
}
const V_IMAGENS = '2'; /* o mesmo conjunto de imagens do widget de Horas */
async function imagem(nome) {
  const caminho = fm.joinPath(dir, V_IMAGENS + '-' + nome);
  if (fm.fileExists(caminho)) return Image.fromFile(caminho);
  const img = await new Request(SITE + '/img/widget/' + nome + '?v=' + V_IMAGENS).loadImage(); fm.writeImage(caminho, img); return img;
}
const modulo = { exports: {} };
new Function('module', 'exports', await texto('hora-planetaria.js'))(modulo, modulo.exports);
const HP = modulo.exports;

const p2 = n => String(n).padStart(2, '0');
const hhmm = d => p2(d.getHours()) + ':' + p2(d.getMinutes());
const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function linhaTexto(pai, t, tam, cor, negrito) {
  const x = pai.addText(t); x.font = new Font(negrito === false ? 'Baskerville' : 'Baskerville-Bold', tam); x.textColor = new Color(cor || TINTA); x.lineLimit = 1; x.minimumScaleFactor = 0.6; return x;
}
async function postit(img) { /* o planeta sobre uma pecinha clara de papiro, como na Agenda do site (lê bem em cima de qualquer cor) */
  const dc = new DrawContext(); dc.size = new Size(120, 120); dc.opaque = false; dc.respectScreenScale = false;
  dc.setFillColor(new Color('#F3E3B8')); dc.fillRect(new Rect(0, 0, 120, 120)); dc.drawImageInRect(img, new Rect(16, 16, 88, 88)); return dc.getImage();
}
async function iconeDe(e) { /* planeta da hora em que o compromisso começa; de dia todo, o planeta do dia (terracota) */
  if (e.isAllDay) return postit(await imagem(PLANETA_ARQ[REGENTE_DO_DIA[e.startDate.getDay()]] + '-terracota.png'));
  const hs = HP.horasEntre(e.startDate.getTime(), e.startDate.getTime() + 1, LAT, LON), h = hs[0];
  return h ? postit(await imagem(PLANETA_ARQ[h.planeta] + '-' + (h.noite ? 'azul' : COR_HORA_DIA) + '.png')) : null;
}

function corTempo(f) { /* azul no começo, ocre no meio, terracota no fim */
  const A = [31, 95, 163], O = [181, 133, 47], T = [160, 62, 37], de = f < 0.5 ? A : O, para = f < 0.5 ? O : T, t = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5;
  return '#' + de.map((x, k) => Math.round(x + (para[k] - x) * t).toString(16).padStart(2, '0')).join('');
}
const numPt = n => String(n).replace('.', ',');
function diaPlanetario(ms) {
  let d = new Date(ms + HP.FUSO), hs = HP.horasDoDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), LAT, LON);
  if (!hs.length || ms < hs[0].ini) { d = new Date(ms - 86400000 + HP.FUSO); hs = HP.horasDoDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), LAT, LON); }
  return hs;
}
function barra(ini, fim, agora, unidade) { /* "62% [barra] 12/23 horas" como imagem */
  const f = Math.max(0, Math.min(1, (agora - ini) / (fim - ini))), cor = new Color(corTempo(f)), pct = agora >= fim ? 100 : Math.floor(f * 100);
  const total = unidade === 'horas' ? Math.round((fim - ini) / 3600000 * 2) / 2 : Math.round((fim - ini) / 60000 * 2) / 2, passou = agora >= fim ? total : Math.floor(Math.min(f * total, total));
  const dc = new DrawContext(); dc.size = new Size(720, 44); dc.opaque = false; dc.respectScreenScale = false;
  dc.setFont(new Font('Baskerville-Bold', 30)); dc.setTextColor(cor); dc.setTextAlignedLeft(); dc.drawTextInRect(pct + '%', new Rect(0, 5, 100, 44));
  dc.setStrokeColor(cor); dc.setLineWidth(3); dc.strokeRect(new Rect(104, 13, 322, 20)); dc.setFillColor(cor); dc.fillRect(new Rect(107, 16, 316 * f, 14));
  dc.setTextAlignedRight(); dc.drawTextInRect(numPt(passou) + '/' + numPt(total) + ' ' + unidade, new Rect(434, 5, 286, 44)); return dc.getImage();
}
async function cabecalhoHoras(pai) { /* planeta do dia (terracota) e da hora (ocre de dia, azul de noite), as duas barras e a hora de agora */
  const agoraMs = Date.now(), hs = diaPlanetario(agoraMs), i = hs.findIndex(h => agoraMs >= h.ini && agoraMs < h.fim), h = hs[i];
  if (hs.length < 24 || !h) return;
  const hh = ms => { const d = new Date(ms + HP.FUSO); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
  const linha = pai.addStack(); linha.centerAlignContent(); linha.addSpacer();
  const cd = linha.addStack(); cd.layoutVertically(); cd.centerAlignContent();
  const rd = cd.addImage(await imagem('rot-dia.png')); rd.imageSize = new Size(22, 9); rd.centerAlignImage(); cd.addSpacer(2);
  const idia = cd.addImage(await imagem(PLANETA_ARQ[hs[0].planeta] + '-terracota.png')); idia.imageSize = new Size(56, 56); idia.centerAlignImage();
  linha.addSpacer(30);
  const ch = linha.addStack(); ch.layoutVertically(); ch.centerAlignContent();
  const rh = ch.addImage(await imagem('rot-hora.png')); rh.imageSize = new Size(28, 9); rh.centerAlignImage(); ch.addSpacer(2);
  const ihora = ch.addImage(await imagem(PLANETA_ARQ[h.planeta] + '-' + (h.noite ? 'azul' : COR_HORA_DIA) + '.png')); ihora.imageSize = new Size(38, 38); ihora.centerAlignImage();
  linha.addSpacer(); pai.addSpacer(4);
  const bd = pai.addImage(barra(hs[0].ini, hs[23].fim, agoraMs, 'horas')); bd.imageSize = new Size(250, 250 * 44 / 720); pai.addSpacer(2);
  const bh = pai.addImage(barra(h.ini, h.fim, agoraMs, 'minutos')); bh.imageSize = new Size(250, 250 * 44 / 720); pai.addSpacer(4);
  linhaTexto(pai, (i % 12 + 1) + 'ª hora · ' + hh(h.ini) + ' às ' + hh(h.fim), 12, TINTA); pai.addSpacer(6);
  linhaTexto(pai, 'Nascer do sol ' + hh(hs[0].ini) + ' · Pôr do sol ' + hh(hs[12].ini), 12, TINTA);
}

const familia = config.widgetFamily || 'medium';
const w = new ListWidget();
try {
  const agora = new Date(), inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fimAmanha = new Date(inicioHoje.getTime() + 2 * 86400000);
  let evs = await CalendarEvent.between(inicioHoje, fimAmanha);
  const ruim = t => NAO_MOSTRAR.some(n => String(t || '').toLowerCase().indexOf(n) >= 0);
  evs = evs.filter(e => !ruim(e.calendar && e.calendar.title) && (e.isAllDay || e.endDate > agora) && !(e.isAllDay && e.endDate <= agora));
  /* de dia todo primeiro dentro de cada dia, depois por horário */
  evs.sort((a, b) => { const da = new Date(a.startDate.getFullYear(), a.startDate.getMonth(), a.startDate.getDate()).getTime(), db = new Date(b.startDate.getFullYear(), b.startDate.getMonth(), b.startDate.getDate()).getTime(); return da - db || (b.isAllDay ? 1 : 0) - (a.isAllDay ? 1 : 0) || a.startDate - b.startDate; });

  const rotuloDia = d => mesmoDia(d, agora) ? 'Hoje' : mesmoDia(d, new Date(agora.getTime() + 86400000)) ? 'Amanhã' : '';
  const linhaEvento = async (pai, e, tam) => {
    const l = pai.addStack(); l.centerAlignContent();
    const barra = l.addStack(); barra.size = new Size(3, tam + 8); barra.backgroundColor = (e.calendar && e.calendar.color) || new Color(TERRACOTA); l.addSpacer(6);
    const ic = await iconeDe(e); if (ic) { const im = l.addImage(ic); im.imageSize = new Size(tam + 6, tam + 6); l.addSpacer(6); }
    linhaTexto(l, e.isAllDay ? 'o dia todo' : hhmm(e.startDate), tam - 1, AZUL, false); l.addSpacer(8);
    linhaTexto(l, e.title || '(sem título)', tam, TINTA); l.addSpacer(); pai.addSpacer(4);
  };

  if (familia.indexOf('accessory') === 0) { /* TELA DE BLOQUEIO: tudo branco */
    const proximo = evs.filter(e => !e.isAllDay && e.endDate > agora)[0] || evs[0];
    if (familia === 'accessoryInline') {
      w.addText(proximo ? (proximo.isAllDay ? 'dia todo ' : hhmm(proximo.startDate) + ' ') + proximo.title : 'Sem compromissos');
    } else if (familia === 'accessoryCircular') {
      const t = w.addText(proximo ? (proximo.isAllDay ? 'dia' : hhmm(proximo.startDate)) : '–'); t.font = Font.boldSystemFont(16); t.textColor = Color.white(); t.centerAlignText();
    } else {
      const lista = evs.filter(e => !e.isAllDay && e.endDate > agora).slice(0, 3);
      if (!lista.length) { const t = w.addText('Sem compromissos'); t.textColor = Color.white(); }
      for (const e of lista) { const l = w.addStack(); l.centerAlignContent();
        const t1 = l.addText(hhmm(e.startDate)); t1.font = Font.boldSystemFont(12); t1.textColor = Color.white(); l.addSpacer(6);
        const t2 = l.addText(e.title || ''); t2.font = Font.systemFont(12); t2.textColor = Color.white(); t2.lineLimit = 1; }
    }
  } else {
    w.backgroundImage = await imagem('papiro-' + (familia === 'small' ? 'pequeno' : familia === 'large' ? 'grande' : familia === 'extraLarge' ? 'enorme' : 'medio') + '.png');
    w.setPadding(familia === 'small' ? 16 : 18, 20, 12, 20);
    const maximo = familia === 'small' ? 2 : familia === 'medium' ? 3 : familia === 'large' ? 8 : 9, tam = familia === 'small' ? 11 : familia === 'medium' ? 13 : 14;
    let alvo = w;
    if (familia === 'extraLarge') { /* iPad, o grandão: cabeçalho das horas à esquerda e os compromissos à direita */
      const dois = w.addStack(); dois.centerAlignContent(); const esq = dois.addStack(); esq.layoutVertically(); dois.addSpacer(28);
      alvo = dois.addStack(); alvo.layoutVertically(); await cabecalhoHoras(esq);
    }
    let dia = '';
    if (!evs.length) linhaTexto(alvo, 'Nada marcado', tam + 2, TERRACOTA);
    let n = 0;
    for (const e of evs) {
      if (n >= maximo) break;
      const r = rotuloDia(e.startDate);
      if (r && r !== dia && familia !== 'small') { dia = r; linhaTexto(alvo, r, tam, TERRACOTA); alvo.addSpacer(2); }
      await linhaEvento(alvo, e, tam); n++;
    }
  }
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
} catch (e) {
  w.backgroundColor = new Color('#DCC590');
  linhaTexto(w, 'Agenda', 14, TERRACOTA); w.addSpacer(6);
  linhaTexto(w, 'Não consegui ler o Calendário. Confira se o Scriptable tem permissão.', 11, TINTA, false);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60000);
}
if (config.runsInWidget) Script.setWidget(w); else if (!MOSTRAR_PREVIA) { /* sem tela fora do widget */ } else if (familia === 'small') await w.presentSmall(); else if (familia === 'large') await w.presentLarge(); else await w.presentMedium();
Script.complete();
