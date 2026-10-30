/* Gera as imagens fixas dos widgets (ícones dos planetas, papiro com moldura e rótulos) em img/widget/.
   Uso (uma vez, ou quando o papiro/ícones mudarem): servir esta pasta (ex.: http-server -p 8765) e rodar
   node widget/gerar-imagens.js http://localhost:8765 */
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765';
const PLANETAS = [['sol', 0], ['lua', 1], ['mercurio', 2], ['venus', 3], ['marte', 4], ['jupiter', 5], ['saturno', 6]];
const CORES = { azul: '#1F5FA3', terracota: '#A03E25' };
const FUNDOS = { pequeno: [474, 474], medio: [1014, 474], grande: [1014, 1062] }; /* tamanho dos widgets no iPhone (158 e 338 pt) a 3x */
(async () => {
  const nav = await chromium.launch(), pg = await nav.newPage({ deviceScaleFactor: 1 });
  await pg.goto(base + '/papiro.css'); /* só para ter a origem; as páginas abaixo carregam o CSS por link */
  for (const [nome, i] of PLANETAS) for (const [c, hex] of Object.entries(CORES)) {
    await pg.setContent(`<style>@font-face{font-family:AstroIcones;src:url(${base}/fonts/astro-icones.woff2)}body{margin:0;background:transparent}span{display:inline-block;font:200px/1 AstroIcones;color:${hex}}</style><span id=g>${String.fromCharCode(0xE000 + i)}</span>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.locator('#g').screenshot({ path: `img/widget/${nome}-${c}.png`, omitBackground: true });
  }
  for (const [t, [w, h]] of Object.entries(FUNDOS)) {
    await pg.setViewportSize({ width: w, height: h });
    await pg.setContent(`<link rel=stylesheet href="${base}/papiro.css"><style>:root{--moldura-m:.26}body{margin:0}#f{position:relative;width:${w}px;height:${h}px;background:var(--papiro-fundo)}</style><div id=f class=papiro-moldura></div>`);
    await pg.waitForTimeout(600);
    await pg.screenshot({ path: `img/widget/papiro-${t}.png` });
  }
  for (const [nome, txt] of [['dia', 'dia'], ['hora', 'hora']]) {
    await pg.setViewportSize({ width: 400, height: 200 });
    await pg.setContent(`<style>@font-face{font-family:Cinzel;src:url(${base}/fonts/Cinzel-Bold.ttf)}body{margin:0;background:transparent}span{display:inline-block;font:700 80px/1.2 Cinzel;color:#16233F;letter-spacing:6px}</style><span id=g>${txt}</span>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.locator('#g').screenshot({ path: `img/widget/rot-${nome}.png`, omitBackground: true });
  }
  await nav.close();
})();
