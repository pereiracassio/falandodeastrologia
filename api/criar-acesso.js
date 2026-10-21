/* Cria o acesso (login) de um aluno, a partir do painel (admin-alunos.html), sem ninguém precisar abrir o Supabase.
   Só o administrador (função sou_admin do Supabase) chama isto. O aluno entra depois com o Google (o mesmo Gmail)
   ou pede "Esqueci minha senha" na tela de entrada; não há tela pública para criar conta.
   Variável na Vercel: SUPABASE_SERVICE_ROLE_KEY (a mesma que o resto do servidor já usa). Sem dependências (só fetch). */

const { SUPABASE_URL, SUPABASE_ANON, supa } = require('./_drive');

const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];

async function souAdmin(jwt) {
  if (!jwt) return false;
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', {
    method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: '{}'
  });
  return resp.ok && (await resp.json()) === true;
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
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'Só quem administra pode criar acessos.' }); return; }
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(corpo.email || '').trim().toLowerCase();
    const nome = String(corpo.nome || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ erro: 'E-mail inválido.' }); return; }
    try {
      await supa('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, email_confirm: true, user_metadata: { nome } }) });
      res.status(200).json({ ok: true, criado: true });
    } catch (e) {
      // já existe um acesso com esse e-mail: tudo certo, o aluno só precisa da ficha
      if (/already|registered|exists|duplicate/i.test(String(e.message))) { res.status(200).json({ ok: true, criado: false }); return; }
      throw e;
    }
  } catch (e) {
    res.status(500).json({ erro: 'Não foi possível criar o acesso agora.', detalhe: String(e.message || e) });
  }
};
