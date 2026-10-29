/* Troca o e-mail de acesso (login) de um aluno, a partir do painel (admin-alunos.html).
   Só o administrador (função sou_admin do Supabase) chama isto. Se o acesso antigo não existir, cria o novo.
   Variável na Vercel: SUPABASE_SERVICE_ROLE_KEY (a mesma que o resto do servidor já usa). Sem dependências (só fetch). */

const { SUPABASE_URL, SUPABASE_ANON, env } = require('./_drive');
const { criarAcesso } = require('./_acesso');

const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];

async function souAdmin(jwt) {
  if (!jwt) return false;
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', {
    method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: '{}'
  });
  return resp.ok && (await resp.json()) === true;
}

function cabecalho(chave) {
  return { apikey: chave, ...(chave.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + chave }), 'Content-Type': 'application/json' };
}

async function acharUsuario(email, chave) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const resp = await fetch(SUPABASE_URL + '/auth/v1/admin/users?page=' + pagina + '&per_page=1000', { headers: cabecalho(chave) });
    if (!resp.ok) throw new Error('Supabase ' + resp.status);
    const d = await resp.json();
    const lista = d.users || [];
    const u = lista.find(function (x) { return String(x.email || '').toLowerCase() === email; });
    if (u) return u;
    if (lista.length < 1000) return null;
  }
  return null;
}

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'Método não permitido.' }); return; }
  try {
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'Só quem administra pode trocar o e-mail.' }); return; }
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const antigo = String(corpo.antigo || '').trim().toLowerCase();
    const novo = String(corpo.novo || '').trim().toLowerCase();
    const nome = String(corpo.nome || '').trim();
    const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!valido.test(novo) || (antigo && !valido.test(antigo))) { res.status(400).json({ erro: 'E-mail inválido.' }); return; }
    if (antigo === novo) { res.status(200).json({ ok: true }); return; }
    const chave = env('SUPABASE_SERVICE_ROLE_KEY');
    const jaTem = await acharUsuario(novo, chave);
    if (jaTem) { res.status(409).json({ erro: 'Já existe um acesso com esse e-mail.' }); return; }
    const u = antigo ? await acharUsuario(antigo, chave) : null;
    if (!u) { await criarAcesso(novo, nome); res.status(200).json({ ok: true, criado: true }); return; }
    const resp = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + u.id, {
      method: 'PUT', headers: cabecalho(chave), body: JSON.stringify({ email: novo, email_confirm: true })
    });
    if (!resp.ok) { let d = {}; try { d = await resp.json(); } catch (e) { /* sem corpo */ } throw new Error('Supabase ' + resp.status + ' ' + (d.msg || d.message || d.error_description || '')); }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: 'Não foi possível trocar o e-mail agora.', detalhe: String(e.message || e) });
  }
};
