/* Widget Horas e Tempo (Scriptable). Roda dentro do carregador (widget/carregador-tempo.js).
   Canto de cima à esquerda: o planeta da hora (grande) com a barra da hora, e o planeta do dia (pequeno) com a barra do dia.
   O resto é o tempo de hoje (Open-Meteo, sem chave nem login): agora, próximas horas e detalhes. Ícones do tempo no traço do site.
   LUGAR: LAT/LON/CIDADE abaixo. */
const VERSAO = 'tempo 4';
const SITE = 'https://falandodeastrologia.com.br';
const LAT = -23.3053, LON = -45.9658, CIDADE = 'Jacareí';
const TINTA = '#16233F', AZUL = '#1034A6', TERRACOTA = '#A03E25';
const COR_HORA_DIA = 'ocre';
const PLANETA_ARQ = { 'Sol': 'sol', 'Lua': 'lua', 'Mercúrio': 'mercurio', 'Vênus': 'venus', 'Marte': 'marte', 'Júpiter': 'jupiter', 'Saturno': 'saturno' };

const fm = FileManager.local();
const dir = fm.joinPath(fm.cacheDirectory(), 'fda-horas');
if (!fm.fileExists(dir)) fm.createDirectory(dir);
async function texto(nome, urlCompleta) { /* com cópia no aparelho: sem internet usa a última que baixou */
  const caminho = fm.joinPath(dir, nome.replace(/[^a-z0-9.]/gi, '_'));
  try { const s = await new Request(urlCompleta || (SITE + '/' + nome)).loadString(); fm.writeString(caminho, s); return s; }
  catch (e) { if (fm.fileExists(caminho)) return fm.readString(caminho); throw e; }
}
const V_IMAGENS = '2';
async function imagem(nome) {
  const caminho = fm.joinPath(dir, V_IMAGENS + '-' + nome);
  if (fm.fileExists(caminho)) return Image.fromFile(caminho);
  const img = await new Request(SITE + '/img/widget/' + nome + '?v=' + V_IMAGENS).loadImage(); fm.writeImage(caminho, img); return img;
}
const modulo = { exports: {} };
new Function('module', 'exports', await texto('hora-planetaria.js'))(modulo, modulo.exports);
const HP = modulo.exports;

const p2 = n => String(n).padStart(2, '0');
const numPt = n => String(n).replace('.', ',');
const hh = ms => { const d = new Date(ms + HP.FUSO); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
function corTempo(f) {
  const A = [31, 95, 163], O = [181, 133, 47], T = [160, 62, 37], de = f < 0.5 ? A : O, para = f < 0.5 ? O : T, t = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5;
  return '#' + de.map((x, k) => Math.round(x + (para[k] - x) * t).toString(16).padStart(2, '0')).join('');
}
function diaPlanetario(ms) {
  let d = new Date(ms + HP.FUSO), hs = HP.horasDoDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), LAT, LON);
  if (!hs.length || ms < hs[0].ini) { d = new Date(ms - 86400000 + HP.FUSO); hs = HP.horasDoDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), LAT, LON); }
  return hs;
}
function barra(ini, fim, agora, unidade, largPt) { /* "62% [barra] 12/23 horas" como imagem (4x para ficar nítida): porcentagem antes, o tanto depois */
  const f = Math.max(0, Math.min(1, (agora - ini) / (fim - ini))), cor = new Color(corTempo(f)), pct = agora >= fim ? 100 : Math.floor(f * 100);
  const total = unidade === 'horas' ? Math.round((fim - ini) / 3600000 * 2) / 2 : Math.round((fim - ini) / 60000 * 2) / 2, passou = agora >= fim ? total : Math.floor(Math.min(f * total, total));
  const W = largPt * 4, H = 56, dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = false;
  const larguraTexto = unidade === 'horas' ? 215 : 275, x0 = 92, x1 = W - larguraTexto - 8;
  dc.setFont(new Font('Baskerville-Bold', 31)); dc.setTextColor(cor); dc.setTextAlignedLeft(); dc.drawTextInRect(pct + '%', new Rect(0, 8, x0 - 4, H));
  dc.setStrokeColor(cor); dc.setLineWidth(4); dc.strokeRect(new Rect(x0 + 2, 16, x1 - x0 - 4, 24)); dc.setFillColor(cor); dc.fillRect(new Rect(x0 + 6, 20, (x1 - x0 - 12) * f, 16));
  dc.setTextAlignedRight(); dc.drawTextInRect(numPt(passou) + '/' + numPt(total) + ' ' + unidade, new Rect(W - larguraTexto, 8, larguraTexto, H));
  return dc.getImage();
}
function linhaTexto(pai, t, tam, cor, centro, negrito) {
  const x = pai.addText(t); x.font = new Font(negrito === false ? 'Baskerville' : 'Baskerville-Bold', tam); x.textColor = new Color(cor || TINTA); x.lineLimit = 1; x.minimumScaleFactor = 0.6;
  if (centro) x.centerAlignText(); return x;
}

/* ---- o tempo (Open-Meteo, de graça e sem chave) ---- */
const DESCRICAO = c => c === 0 ? 'Céu limpo' : c <= 2 ? 'Poucas nuvens' : c === 3 ? 'Nublado' : c <= 48 ? 'Neblina' : c <= 57 ? 'Garoa' : c <= 64 ? 'Chuva' : c === 65 ? 'Chuva forte' : c <= 67 ? 'Chuva gelada' : c <= 77 ? 'Neve' : c <= 81 ? 'Pancadas de chuva' : c === 82 ? 'Chuva forte' : c <= 86 ? 'Neve' : 'Tempestade';
const ICONE_TEMPO = (c, dia) => c === 0 ? (dia ? 'sol' : 'lua') : c <= 2 ? (dia ? 'nuvem-sol' : 'nuvem-lua') : c === 3 ? 'nuvem' : c <= 48 ? 'neblina' : c <= 57 ? 'garoa' : c <= 67 ? 'chuva' : c <= 77 ? 'neve' : c <= 82 ? 'chuva' : c <= 86 ? 'neve' : 'tempestade';
async function tempoDe() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation' +
    '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max,precipitation_sum' +
    '&wind_speed_unit=kmh&timezone=America%2FSao_Paulo&forecast_days=2';
  const s = await texto('tempo-previsao.json', url); return JSON.parse(s);
}

const familia = config.widgetFamily || 'large';
const w = new ListWidget();
try {
  const agoraMs = Date.now(), hs = diaPlanetario(agoraMs), i = hs.findIndex(h => agoraMs >= h.ini && agoraMs < h.fim), h = hs[i];
  if (hs.length < 24 || !h) throw new Error('sem horas');
  const t = await tempoDe(), atual = t.current;
  w.backgroundImage = await imagem('papiro-' + (familia === 'small' ? 'pequeno' : familia === 'large' ? 'grande' : familia === 'extraLarge' ? 'enorme' : 'medio') + '.png');
  w.setPadding(22, 32, 14, 30);
  const grande = familia === 'large' || familia === 'extraLarge';

  /* linha de cima: à esquerda o quarto das horas, à direita o tempo de agora */
  const topo = w.addStack(); topo.topAlignContent();
  const LARG = 160; /* largura do quarto das horas */
  const esq = topo.addStack(); esq.layoutVertically(); esq.size = new Size(LARG, 0);
  const diaLinha = esq.addStack(); diaLinha.centerAlignContent(); /* planeta do dia, pequeno e discreto, no alto, com a barra do dia */
  const ipd = diaLinha.addImage(await imagem(PLANETA_ARQ[hs[0].planeta] + '-terracota.png')); ipd.imageSize = new Size(17, 17); diaLinha.addSpacer(7);
  const bd = diaLinha.addImage(barra(hs[0].ini, hs[23].fim, agoraMs, 'horas', LARG - 24)); bd.imageSize = new Size(LARG - 24, 14);
  esq.addSpacer(10);
  const horaLinha = esq.addStack(); horaLinha.centerAlignContent(); horaLinha.addSpacer(); /* planeta da hora, grande e no meio do quarto */
  const TAM = grande ? 78 : 60;
  const iph = horaLinha.addImage(await imagem(PLANETA_ARQ[h.planeta] + '-' + (h.noite ? 'azul' : COR_HORA_DIA) + '.png')); iph.imageSize = new Size(TAM, TAM); horaLinha.addSpacer();
  const nHora = esq.addStack(); nHora.addSpacer(); linhaTexto(nHora, (i % 12 + 1) + 'ª hora', 11.5, TINTA, false, false); nHora.addSpacer(); /* só o número da hora, discreto, embaixo do planeta */
  esq.addSpacer(6);
  const bh = esq.addImage(barra(h.ini, h.fim, agoraMs, 'minutos', LARG)); bh.imageSize = new Size(LARG, 14); /* a barra da hora ocupa a largura toda do quarto */

  topo.addSpacer();
  const dir = topo.addStack(); dir.layoutVertically();
  linhaTexto(dir, CIDADE, 11, TINTA, false, false);
  linhaTexto(dir, Math.round(atual.temperature_2m) + '°', 48, TERRACOTA);
  const cond = dir.addStack(); cond.centerAlignContent();
  const ic = cond.addImage(await imagem('tempo-' + ICONE_TEMPO(atual.weather_code, atual.is_day === 1) + '.png')); ic.imageSize = new Size(32, 32); cond.addSpacer(6);
  linhaTexto(cond, DESCRICAO(atual.weather_code), 12, TINTA);
  dir.addSpacer(2);
  linhaTexto(dir, 'Máx ' + Math.round(t.daily.temperature_2m_max[0]) + '° · Mín ' + Math.round(t.daily.temperature_2m_min[0]) + '°', 11, TINTA, false, false);

  /* próximas 6 horas */
  w.addSpacer(); 
  const agoraIso = new Date(agoraMs + HP.FUSO).toISOString().slice(0, 13); /* "AAAA-MM-DDTHH" no horário de Brasília */
  let k0 = t.hourly.time.findIndex(x => x.slice(0, 13) >= agoraIso); if (k0 < 0) k0 = 0;
  const horas = w.addStack(); horas.centerAlignContent();
  const nHoras = grande ? 6 : 4;
  for (let n = 0; n < nHoras; n++) {
    const k = k0 + n + 1; if (k >= t.hourly.time.length) break;
    const col = horas.addStack(); col.layoutVertically(); col.centerAlignContent(); col.size = new Size(grande ? 46 : 60, 0);
    const meio = (fn) => { const r = col.addStack(); r.addSpacer(); fn(r); r.addSpacer(); }; /* cada item centralizado na coluna */
    meio(r => linhaTexto(r, t.hourly.time[k].slice(11, 13) + 'h', 12, AZUL));
    col.addSpacer(3);
    const im2 = await imagem('tempo-' + ICONE_TEMPO(t.hourly.weather_code[k], t.hourly.is_day[k] === 1) + '.png');
    meio(r => { const im = r.addImage(im2); im.imageSize = new Size(26, 26); });
    col.addSpacer(3);
    meio(r => linhaTexto(r, Math.round(t.hourly.temperature_2m[k]) + '°', 14, TINTA));
    const chuva = t.hourly.precipitation_probability[k]; meio(r => linhaTexto(r, chuva > 0 ? chuva + '%' : ' ', 10.5, AZUL, false, false));
    if (n < nHoras - 1) horas.addSpacer();
  }

  /* aviso de chuva forte e detalhes de hoje */
  if (grande) {
    w.addSpacer();
    const forte = t.hourly.precipitation.slice(k0, k0 + 7).some(x => x >= 4) || atual.weather_code === 65 || atual.weather_code === 82;
    if (forte) { linhaTexto(w, 'Chuva forte nas próximas horas', 12, TERRACOTA, true); w.addSpacer(4); }
    linhaTexto(w, 'Sensação ' + Math.round(atual.apparent_temperature) + '° · Chuva ' + (t.daily.precipitation_probability_max[0] || 0) + '% · Umidade ' + Math.round(atual.relative_humidity_2m) + '%', 11.5, TINTA, true, false);
    w.addSpacer(2);
    linhaTexto(w, 'Vento ' + Math.round(atual.wind_speed_10m) + ' km/h · UV ' + Math.round(t.daily.uv_index_max[0]) + ' · Nascer ' + hh(hs[0].ini) + ' · Pôr ' + hh(hs[12].ini), 11.5, TINTA, true, false);
  }
  w.refreshAfterDate = new Date(Math.min(h.fim, agoraMs + 15 * 60000));
} catch (e) {
  w.backgroundColor = new Color('#DCC590');
  linhaTexto(w, 'Horas e Tempo', 14, TERRACOTA, true); w.addSpacer(6);
  linhaTexto(w, 'Sem conexão agora. Tente de novo em alguns minutos.', 11, TINTA, true, false);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60000);
}
if (config.runsInWidget) Script.setWidget(w); else { /* play dentro do Scriptable: mostra a versão e não abre o widget */
  const a = new Alert(); a.title = 'Horas e Tempo'; a.message = VERSAO; a.addAction('OK'); await a.present();
}
Script.complete();
