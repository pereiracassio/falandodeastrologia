/* Gera os ícones do tempo do widget "Horas e Tempo" (traço fino, nas cores do site) em img/widget/tempo-*.png.
   Uso: NODE_PATH=... node widget/gerar-icones-tempo.js  (não precisa de servidor) */
const { chromium } = require('playwright');
const AZ = '#1F5FA3', OC = '#B5852F';
const NUVEM = (dx = 0, dy = 0, cor = AZ) => `<path transform="translate(${dx} ${dy})" d="M20 46H46A10 10 0 0 0 47 26A15 15 0 0 0 18 30A8 8 0 0 0 20 46Z" stroke="${cor}"/>`;
const SOL = (cx, cy, r, cor = OC) => `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${cor}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const t = a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return `<line x1="${cx + c * (r + 5)}" y1="${cy + s * (r + 5)}" x2="${cx + c * (r + 11)}" y2="${cy + s * (r + 11)}" stroke="${cor}"/>`; }).join('');
const SOLPARCIAL = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${OC}"/>` + [180, 225, 270].map(a => { const t = a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return `<line x1="${cx + c * (r + 4)}" y1="${cy + s * (r + 4)}" x2="${cx + c * (r + 9)}" y2="${cy + s * (r + 9)}" stroke="${OC}"/>`; }).join('');
const LUA = (dx = 0, dy = 0, esc = 1) => `<path transform="translate(${dx} ${dy}) scale(${esc})" d="M44 10a24 24 0 1 0 10 34A20 20 0 0 1 44 10z" stroke="${AZ}"/>`;
const GOTAS = (n) => [0, 1, 2].slice(0, n).map(i => `<line x1="${24 + i * 10}" y1="50" x2="${20 + i * 10}" y2="58" stroke="${AZ}"/>`).join('');
const ICONES = {
  'sol': SOL(32, 32, 10),
  'lua': LUA(),
  'nuvem': NUVEM(0, 3),
  'nuvem-sol': SOLPARCIAL(20, 20, 6) + NUVEM(5, 10),
  'nuvem-lua': LUA(3, 3, .5) + NUVEM(5, 10),
  'chuva': NUVEM(0, -4) + GOTAS(3),
  'garoa': NUVEM(0, -4) + [0, 1, 2].map(i => `<line x1="${24 + i * 10}" y1="52" x2="${23 + i * 10}" y2="55" stroke="${AZ}"/>`).join(''),
  'tempestade': NUVEM(0, -4) + `<polyline points="34,44 28,54 36,54 30,63" stroke="${OC}"/>`,
  'neblina': [20, 29, 38, 47].map((y, i) => `<line x1="${14 + (i % 2) * 6}" y1="${y}" x2="${50 - (i % 2) * 4}" y2="${y}" stroke="${AZ}"/>`).join(''),
  'neve': NUVEM(0, -4) + [0, 1, 2].map(i => { const x = 24 + i * 10; return `<line x1="${x}" y1="50" x2="${x}" y2="58" stroke="${AZ}"/><line x1="${x - 4}" y1="54" x2="${x + 4}" y2="54" stroke="${AZ}"/>`; }).join('')
};
(async () => {
  const nav = await chromium.launch(), pg = await nav.newPage({ deviceScaleFactor: 4 });
  await pg.setViewportSize({ width: 64, height: 64 });
  for (const [nome, corpo] of Object.entries(ICONES)) {
    await pg.setContent(`<style>body{margin:0;background:transparent}</style><svg id="s" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`);
    await pg.locator('#s').screenshot({ path: `img/widget/tempo-${nome}.png`, omitBackground: true });
  }
  await nav.close();
})();
