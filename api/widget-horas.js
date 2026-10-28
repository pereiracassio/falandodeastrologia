/* Widget "Horas planetárias" da tela de início (Scriptable). Devolve um PNG: a hora planetária de agora e as seguintes.
   Endereço: /api/widget-horas?k=<WIDGET_CHAVE>&t=p|m|g. Sem dependências além do @resvg/resvg-js. */

const W = require('./_widget');
const HP = require('../hora-planetaria');

const hh = (ms) => { const d = new Date(ms + HP.FUSO); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

module.exports = async (req, res) => {
  try {
    if (!W.chaveConfere(req)) { res.status(401).send('sem acesso'); return; }
    const { w, h, e, t } = W.tamanhoDe(req);
    const agora = Date.now();
    const lugar = await W.lugarDasHoras();
    const horas = HP.horasEntre(agora - 3600000, agora + 36 * 3600000, lugar.lat, lugar.lon);
    const i = horas.findIndex((x) => x.ini <= agora && x.fim > agora);
    const atual = horas[i], seguintes = horas.slice(i + 1, i + 1 + (t === 'g' ? 6 : t === 'm' ? 3 : 0));
    const a = W.area(w, h, e);
    let corpo = '';
    const nome = (p) => 'hora de ' + p.toLowerCase();
    if (t === 'm') {
      const gx = a.x + a.w * 0.36;
      corpo += `<text x="${a.x + a.w * 0.17}" y="${a.y + a.h * 0.5}" font-family="Astro Icones" font-size="${a.h * 0.58}" text-anchor="middle" fill="${atual.noite ? W.AZUL_NOITE : W.TERRACOTA}">${W.icone(atual.planeta)}</text>`;
      corpo += `<text x="${a.x + a.w * 0.17}" y="${a.y + a.h * 0.78}" font-family="Cinzel" font-size="${a.h * 0.1}" text-anchor="middle" fill="${W.TERRACOTA}">${W.esc(nome(atual.planeta))}</text>`;
      corpo += `<text x="${a.x + a.w * 0.17}" y="${a.y + a.h * 0.96}" font-family="Cinzel" font-size="${a.h * 0.1}" text-anchor="middle" fill="${W.AZUL_NOITE}">${hh(atual.ini)} a ${hh(atual.fim)}</text>`;
      corpo += `<line x1="${gx}" y1="${a.y}" x2="${gx}" y2="${a.y + a.h}" stroke="${W.AZUL_EGIPCIO}" stroke-width="${e}"/>`;
      seguintes.forEach((s, k) => {
        const y = a.y + a.h * (0.07 + k * 0.33);
        corpo += `<text x="${gx + a.w * 0.07}" y="${y + a.h * 0.2}" font-family="Astro Icones" font-size="${a.h * 0.2}" fill="${W.AZUL_NOITE}">${W.icone(s.planeta)}</text>`;
        corpo += `<text x="${gx + a.w * 0.16}" y="${y + a.h * 0.19}" font-family="Cinzel" font-size="${a.h * 0.115}" fill="${W.AZUL_NOITE}">${hh(s.ini)}</text>`;
        corpo += `<text x="${gx + a.w * 0.34}" y="${y + a.h * 0.19}" font-family="Architects Daughter" font-size="${a.h * 0.12}" fill="${W.TERRACOTA}">${W.esc(s.planeta)}</text>`;
      });
    } else if (t === 'p') {
      corpo += `<text x="${a.x + a.w / 2}" y="${a.y + a.h * 0.62}" font-family="Astro Icones" font-size="${a.h * 0.62}" text-anchor="middle" fill="${atual.noite ? W.AZUL_NOITE : W.TERRACOTA}">${W.icone(atual.planeta)}</text>`;
      corpo += `<text x="${a.x + a.w / 2}" y="${a.y + a.h * 0.88}" font-family="Cinzel" font-size="${a.h * 0.13}" text-anchor="middle" fill="${W.TERRACOTA}">${W.esc(atual.planeta.toLowerCase())}</text>`;
      corpo += `<text x="${a.x + a.w / 2}" y="${a.y + a.h}" font-family="Cinzel" font-size="${a.h * 0.115}" text-anchor="middle" fill="${W.AZUL_NOITE}">${hh(atual.ini)} a ${hh(atual.fim)}</text>`;
    } else {
      corpo += `<text x="${a.x + a.w / 2}" y="${a.y + a.h * 0.2}" font-family="Astro Icones" font-size="${a.h * 0.2}" text-anchor="middle" fill="${W.TERRACOTA}">${W.icone(atual.planeta)}</text>`;
      corpo += `<text x="${a.x + a.w / 2}" y="${a.y + a.h * 0.29}" font-family="Cinzel" font-size="${a.h * 0.055}" text-anchor="middle" fill="${W.TERRACOTA}">${W.esc(nome(atual.planeta))}  ${hh(atual.ini)} a ${hh(atual.fim)}</text>`;
      seguintes.forEach((s, k) => {
        const y = a.y + a.h * (0.4 + k * 0.1);
        corpo += `<text x="${a.x + a.w * 0.2}" y="${y}" font-family="Astro Icones" font-size="${a.h * 0.075}" fill="${W.AZUL_NOITE}">${W.icone(s.planeta)}</text>`;
        corpo += `<text x="${a.x + a.w * 0.36}" y="${y}" font-family="Cinzel" font-size="${a.h * 0.055}" fill="${W.AZUL_NOITE}">${hh(s.ini)}</text>`;
        corpo += `<text x="${a.x + a.w * 0.6}" y="${y}" font-family="Architects Daughter" font-size="${a.h * 0.06}" fill="${W.TERRACOTA}">${W.esc(s.planeta)}</text>`;
      });
    }
    W.responder(res, W.pngDe(W.folha(w, h, e, corpo)));
  } catch (err) {
    res.status(500).send('erro: ' + (err && err.message));
  }
};
