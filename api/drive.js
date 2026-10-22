/* Conexão PERMANENTE com o Google Drive do administrador (Falando de Astrologia).

   Por que existe: o navegador sozinho só consegue uma "chave" do Google que vale 1 hora. Aqui o administrador autoriza UMA vez
   (acao=iniciar), o servidor guarda o "refresh token" CIFRADO na tabela drive_conexao do Supabase (só a chave de serviço lê),
   e o site pede uma chave nova de 1 hora quando precisar (acao=token) — sem janela do Google, até o administrador revogar.

   Só o administrador (função sou_admin do Supabase) usa isto. Variáveis na Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   SUPABASE_SERVICE_ROLE_KEY. Sem dependências (só fetch e crypto do próprio Node). */

const crypto = require('crypto');
const { esquecerToken, SUPABASE_URL, SUPABASE_ANON, env, b64url, deB64url, cifrar, lerConexao, salvarConexao, apagarConexao, pedirTokens, tokenDeAcesso } = require('./_drive');
const SITE = 'https://falandodeastrologia.com.br';
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const VOLTAS_PERMITIDAS = ['/admin-alunos.html', '/admin-clientes.html'];
/* calendar.events.readonly: só leitura da agenda, para mostrar ao cliente o horário e o Meet do próprio atendimento (api/meu-atendimento.js) */
const ESCOPOS = 'openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.events.readonly';

/* "estado" do login: vai e volta pelo Google e prova que quem voltou é o administrador que começou (assinado, vale 15 min) */
const assinar = (payload) => b64url(crypto.createHmac('sha256', env('GOOGLE_CLIENT_SECRET')).update('estado|' + payload).digest());
function criarEstado(volta) {
  const payload = JSON.stringify({ exp: Date.now() + 15 * 60 * 1000, volta });
  return b64url(payload) + '.' + assinar(payload);
}
function lerEstado(estado) {
  const [p, sig] = String(estado || '').split('.');
  if (!p || !sig) return null;
  const payload = deB64url(p).toString('utf8');
  const esperado = assinar(payload);
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  try {
    const o = JSON.parse(payload);
    return o && o.exp > Date.now() ? o : null;
  } catch (e) { return null; }
}

/* o login que veio do site é do administrador? (pergunta ao Supabase com o token de login da própria pessoa) */
async function souAdmin(jwt) {
  if (!jwt) return false;
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!resp.ok) return false;
  return (await resp.json()) === true;
}

/* ---------- Google ---------- */

const redirectUri = (req) => 'https://' + req.headers.host + '/api/drive';

/* ---------- a função ---------- */

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const q = req.query || {};

    /* volta do Google (GET sem cabeçalho de login: quem prova a identidade é o "estado" assinado) */
    if (q.code || q.error) {
      const estado = lerEstado(q.state);
      if (!estado) { res.status(400).send('Link expirado. Volte ao painel e tente conectar de novo.'); return; }
      const volta = VOLTAS_PERMITIDAS.includes(estado.volta) ? estado.volta : VOLTAS_PERMITIDAS[0];
      if (q.error) { res.redirect(302, SITE + volta + '?drive=cancelado'); return; }
      try {
        const dados = await pedirTokens({ code: q.code, redirect_uri: redirectUri(req), grant_type: 'authorization_code' });
        if (!dados.refresh_token) throw new Error('sem refresh token');
        let email = '';
        try { email = JSON.parse(deB64url(dados.id_token.split('.')[1]).toString('utf8')).email || ''; } catch (e) { /* sem e-mail */ }
        await salvarConexao({ email, refresh_token_cifrado: cifrar(dados.refresh_token) });
        esquecerToken();
        res.redirect(302, SITE + volta + '?drive=ok');
      } catch (e) {
        console.error('drive callback:', e.message);
        res.redirect(302, SITE + volta + '?drive=erro');
      }
      return;
    }

    /* daqui pra baixo: só o administrador logado no site */
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'sem permissão' }); return; }

    const acao = q.acao;
    if (acao === 'status') {
      const c = await lerConexao();
      res.status(200).json({ conectado: !!c, email: c ? c.email : '' });
      return;
    }
    if (acao === 'iniciar') {
      const volta = VOLTAS_PERMITIDAS.includes(q.volta) ? q.volta : VOLTAS_PERMITIDAS[0];
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri(req), response_type: 'code', scope: ESCOPOS,
        access_type: 'offline', prompt: 'consent', state: criarEstado(volta)
      });
      res.status(200).json({ url });
      return;
    }
    if (acao === 'token') {
      const c = await lerConexao();
      if (!c) { res.status(401).json({ codigo: 'desconectado' }); return; }
      try {
        const t = await tokenDeAcesso(c);
        res.status(200).json({ access_token: t.valor, expires_in: Math.floor((t.expira - Date.now()) / 1000) });
      } catch (e) {
        if (e.codigo === 'invalid_grant') { await apagarConexao(); esquecerToken(); res.status(401).json({ codigo: 'desconectado' }); return; } // revogado no Google
        throw e;
      }
      return;
    }
    if (acao === 'desconectar') {
      await apagarConexao(); esquecerToken();
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ erro: 'ação desconhecida' });
  } catch (e) {
    console.error('drive:', e.message);
    // só chega aqui quem já passou pela checagem de administrador (ou o retorno do Google), então mostrar o motivo é seguro e ajuda a achar o problema
    res.status(500).json({ erro: 'erro no servidor', detalhe: String(e.message || e).slice(0, 200) });
  }
};
