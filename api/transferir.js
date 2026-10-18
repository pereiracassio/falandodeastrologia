/* Passa a propriedade de uma gravação do Drive do administrador para o Gmail do cliente.

   O cliente logado (Supabase) toca em "Passar o vídeo pro meu Drive"; aqui o servidor confere que a gravação é mesmo dele
   (entrega do próprio e-mail dele), e, com a conexão permanente do administrador, deixa o cliente como "novo dono pendente".
   O Drive manda um e-mail e o cliente precisa ACEITAR lá; só então o vídeo passa a ser dele (e sai do espaço do administrador).
   Só funciona entre contas Gmail comuns, e só em arquivo que é do administrador. */

const { SUPABASE_URL, SUPABASE_ANON, supa, lerConexao, tokenDeAcesso } = require('./_drive');
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];

const idDoLink = (url) => {
  const m = String(url || '').match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) || String(url || '').match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]{10,})/);
  return m ? m[1] : null;
};

/* e-mail de quem está logado, confirmado pelo Supabase com o token de login da própria pessoa */
async function emailDoLogin(jwt) {
  if (!jwt) return '';
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt } });
  if (!r.ok) return '';
  const u = await r.json();
  return String(u.email || '').toLowerCase();
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
    const email = await emailDoLogin(jwt);
    if (!email) { res.status(401).json({ erro: 'faça login' }); return; }

    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const entregaId = String(corpo.entrega_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(entregaId)) { res.status(400).json({ erro: 'entrega inválida' }); return; }

    // a entrega tem que ser do e-mail de quem pediu
    const linhas = await supa('/rest/v1/entregas?id=eq.' + entregaId + '&select=gravacao_link,clientes(email)');
    const entrega = linhas && linhas[0];
    const dono = entrega && entrega.clientes && String(entrega.clientes.email || '').toLowerCase();
    if (!entrega || dono !== email) { res.status(403).json({ erro: 'sem permissão' }); return; }
    const arquivoId = idDoLink(entrega.gravacao_link);
    if (!arquivoId) { res.status(400).json({ erro: 'não é um arquivo do Drive' }); return; }

    const c = await lerConexao();
    if (!c) { res.status(503).json({ codigo: 'desconectado', detalhe: 'O Drive do administrador está desconectado.' }); return; }
    const token = (await tokenDeAcesso(c)).valor;
    const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const base = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(arquivoId);

    // só dá pra transferir o que é do administrador
    const info = await fetch(base + '?supportsAllDrives=true&fields=ownedByMe,driveId', { headers: H });
    if (!info.ok) { res.status(502).json({ codigo: 'arquivo', detalhe: 'Drive não leu o arquivo (' + info.status + '): ' + (await info.text()).slice(0, 200) }); return; }
    const i = await info.json();
    if (!i.ownedByMe || i.driveId) { res.status(409).json({ codigo: 'ja_transferido' }); return; }

    // o cliente já pode ter acesso de leitura: então atualiza a permissão dele; senão cria
    const lista = await fetch(base + '/permissions?supportsAllDrives=true&fields=permissions(id,emailAddress)', { headers: H });
    const perms = lista.ok ? ((await lista.json()).permissions || []) : [];
    const dele = perms.find((p) => String(p.emailAddress || '').toLowerCase() === email);
    const r = dele
      ? await fetch(base + '/permissions/' + encodeURIComponent(dele.id) + '?supportsAllDrives=true', { method: 'PATCH', headers: H, body: JSON.stringify({ role: 'writer', pendingOwner: true }) })
      : await fetch(base + '/permissions?supportsAllDrives=true&sendNotificationEmail=true', { method: 'POST', headers: H, body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email, pendingOwner: true }) });
    if (!r.ok) {
      const t = await r.text();
      console.error('transferir:', r.status, t.slice(0, 300));
      res.status(502).json({ codigo: 'drive', detalhe: 'Drive recusou (' + r.status + '): ' + t.slice(0, 250) });
      return;
    }
    res.status(200).json({ ok: true, email });
  } catch (e) {
    console.error('transferir:', e.message);
    res.status(500).json({ erro: 'erro no servidor', detalhe: String(e.message || e).slice(0, 200) });
  }
};
