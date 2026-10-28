/* Peças em comum dos widgets da tela de início do iPhone (o "_" no começo do nome faz a Vercel NÃO tratar este arquivo como um endpoint).
   O Scriptable (app grátis) só baixa a imagem PNG que estas funções desenham: papiro com moldura de meandro, Cinzel, ícones dos planetas.
   Variável na Vercel: WIDGET_CHAVE (a senha do endereço do widget). Mais: SUPABASE_SERVICE_ROLE_KEY (como o resto do servidor). */

const crypto = require('crypto');
const path = require('path');

const PASTA_FONTES = path.join(__dirname, '..', 'fonts');
const FONTES = ['Cinzel-Regular.ttf', 'Cinzel-Bold.ttf', 'ArchitectsDaughter-Regular.ttf', 'astro-icones.ttf'].map((f) => path.join(PASTA_FONTES, f));

const AZUL_NOITE = '#16233F', TERRACOTA = '#A03E25', OCRE = '#B5852F', AZUL_EGIPCIO = '#1F5FA3';
const ICONES = ['Sol', 'Lua', 'Mercúrio', 'Vênus', 'Marte', 'Júpiter', 'Saturno'];
const icone = (planeta) => String.fromCharCode(0xE000 + Math.max(0, ICONES.indexOf(planeta)));

/* tamanhos do widget em pontos do iPhone (pequeno, médio, grande), desenhados em escala 3 */
const TAMANHOS = { p: [158, 158], m: [338, 158], g: [338, 354] };
const ESCALA = 3;

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* confere a senha do endereço (?k=...) sem pistas de tempo */
function chaveConfere(req) {
  const esperada = process.env.WIDGET_CHAVE;
  if (!esperada) throw new Error('WIDGET_CHAVE não configurada');
  const enviada = new URL(req.url, 'http://x').searchParams.get('k') || '';
  const a = crypto.createHash('sha256').update(enviada).digest();
  const b = crypto.createHash('sha256').update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
}

function tamanhoDe(req) {
  const t = new URL(req.url, 'http://x').searchParams.get('t');
  const [w, h] = TAMANHOS[t] || TAMANHOS.m;
  return { w: w * ESCALA, h: h * ESCALA, e: ESCALA, t: TAMANHOS[t] ? t : 'm' };
}

/* o papiro (mesmo degradê, luz, sombra e fibras do papiro.css) + moldura dupla + meandro azul em cima e embaixo; `corpo` é o SVG do conteúdo.
   `area` devolve onde cabe o conteúdo (dentro da moldura e dos meandros). */
function folha(w, h, e, corpo) {
  const m = 5 * e, faixa = 11 * e;                 // margem até a moldura e altura de cada faixa de meandro
  const x0 = m, y0 = m, x1 = w - m, y1 = h - m;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d3a0"/><stop offset=".5" stop-color="#dcc590"/><stop offset="1" stop-color="#d2b980"/></linearGradient>
<radialGradient id="luz" cx=".12" cy=".06" r=".6"><stop offset="0" stop-color="#fff4d2" stop-opacity=".6"/><stop offset="1" stop-color="#fff4d2" stop-opacity="0"/></radialGradient>
<radialGradient id="sombra" cx=".9" cy=".96" r=".6"><stop offset="0" stop-color="#6e461e" stop-opacity=".22"/><stop offset="1" stop-color="#6e461e" stop-opacity="0"/></radialGradient>
<pattern id="fibras" width="${6 * e}" height="${6 * e}" patternUnits="userSpaceOnUse"><rect width="${6 * e}" height="${e}" fill="#785528" fill-opacity=".07"/></pattern>
<pattern id="meandro" width="${16 * e}" height="${11 * e}" patternUnits="userSpaceOnUse"><path d="M0 ${9.5 * e} H ${2.7 * e} V ${1.3 * e} H ${13.3 * e} V ${9.5 * e} H ${8 * e} V ${4.7 * e} H ${10.7 * e} V ${6.7 * e}" fill="none" stroke="${AZUL_EGIPCIO}" stroke-width="${1.1 * e}"/></pattern>
</defs>
<rect width="${w}" height="${h}" fill="url(#pg)"/><rect width="${w}" height="${h}" fill="url(#luz)"/><rect width="${w}" height="${h}" fill="url(#sombra)"/><rect width="${w}" height="${h}" fill="url(#fibras)"/>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#2B1D12" stroke-width="${0.5 * e}"/>
<rect x="${x0 + 2 * e}" y="${y0 + 2 * e}" width="${x1 - x0 - 4 * e}" height="${y1 - y0 - 4 * e}" fill="none" stroke="${OCRE}" stroke-width="${1.3 * e}"/>
<rect x="${x0 + 4 * e}" y="${y0 + 4 * e}" width="${x1 - x0 - 8 * e}" height="${faixa}" fill="url(#meandro)"/>
<rect x="${x0 + 4 * e}" y="${y1 - 4 * e - faixa}" width="${x1 - x0 - 8 * e}" height="${faixa}" fill="url(#meandro)" transform="translate(0 0)"/>
${corpo}
</svg>`;
}
/* retângulo útil para o conteúdo */
function area(w, h, e) {
  const dentro = 5 * e + 4 * e + 11 * e + 4 * e;
  return { x: dentro, y: dentro, w: w - 2 * dentro, h: h - 2 * dentro };
}

function pngDe(svg) {
  const { Resvg } = require('@resvg/resvg-js');
  const r = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: FONTES, defaultFontFamily: 'Cinzel' } });
  return r.render().asPng();
}

const SUPA = { url: 'https://wqkgsotfwkzjwaowenrb.supabase.co' };
const { supa } = require('./_drive');
async function lugarDasHoras() {
  const padrao = { lat: -23.3053, lon: -45.9658 }; // Jacareí
  try {
    const l = await supa('/rest/v1/site_config?chave=eq.prod_local_horas&select=valor');
    const v = l && l[0] ? JSON.parse(l[0].valor) : null;
    if (v && typeof v.lat === 'number' && typeof v.lon === 'number') return { lat: v.lat, lon: v.lon };
  } catch (e) { /* cai no padrão */ }
  return padrao;
}

/* Responde com a imagem (ou com a mensagem de erro dentro de uma imagem, para o widget nunca ficar em branco) */
function responder(res, png) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(Buffer.from(png));
}

module.exports = { AZUL_NOITE, TERRACOTA, OCRE, AZUL_EGIPCIO, ICONES, icone, esc, chaveConfere, tamanhoDe, folha, area, pngDe, lugarDasHoras, responder };
