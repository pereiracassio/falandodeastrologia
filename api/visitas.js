/* Visitas dos sites (contador GoatCounter), só para o administrador.
   O navegador pede com o login do administrador; este servidor confere (sou_admin) e lê o GoatCounter com o token guardado na Vercel.
   Variável na Vercel: GOATCOUNTER_TOKEN (token do GoatCounter só com "Read statistics", para todos os sites). */

const { SUPABASE_URL, SUPABASE_ANON, env } = require('./_drive');

const ORIGENS_PERMITIDAS = [
  'https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br',
  'https://pereiracassio.com.br', 'https://www.pereiracassio.com.br', 'https://pereiracassio.github.io'
];
const SITES = ['falandodeastrologia', 'pereiracassio'];

async function souAdmin(jwt) {
  if (!jwt) return false;
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', {
    method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: '{}'
  });
  return resp.ok && (await resp.json()) === true;
}

async function goat(site, caminho) {
  const resp = await fetch('https://' + site + '.goatcounter.com/api/v0' + caminho, {
    headers: { Authorization: 'Bearer ' + env('GOATCOUNTER_TOKEN'), Accept: 'application/json' }
  });
  const texto = await resp.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* resposta que não é JSON */ }
  if (!resp.ok) throw new Error('GoatCounter: ' + ((dados && (dados.error || dados.message)) || resp.status));
  return dados;
}

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'use POST' }); return; }
  try {
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await souAdmin(jwt))) { res.status(401).json({ erro: 'só o administrador' }); return; }
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const site = String(corpo.site || '');
    if (!SITES.includes(site)) { res.status(400).json({ erro: 'site desconhecido' }); return; }
    const dias = Math.min(Math.max(parseInt(corpo.dias, 10) || 7, 1), 365);
    const fim = new Date();
    const inicio = new Date(fim.getTime() - (dias - 1) * 86400000);
    inicio.setUTCHours(0, 0, 0, 0);
    const periodo = 'start=' + encodeURIComponent(inicio.toISOString()) + '&end=' + encodeURIComponent(fim.toISOString());

    const [total, paginas] = await Promise.all([
      goat(site, '/stats/total?' + periodo),
      goat(site, '/stats/hits?limit=10&' + periodo)
    ]);
    res.status(200).json({
      ok: true,
      visitas: total.total,
      porDia: (total.stats || []).map((d) => ({ dia: d.day, visitas: d.daily })),
      paginas: (paginas.hits || []).map((h) => ({ caminho: h.path, titulo: h.title || '', visitas: h.count }))
    });
  } catch (e) {
    res.status(500).json({ erro: 'não foi possível ler as visitas', detalhe: String(e.message || e) });
  }
};
