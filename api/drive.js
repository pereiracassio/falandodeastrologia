/* Conexão PERMANENTE com o Google Drive do administrador (Falando de Astrologia).

   Por que existe: o navegador sozinho só consegue uma "chave" do Google que vale 1 hora. Aqui o administrador autoriza UMA vez
   (acao=iniciar), o servidor guarda o "refresh token" CIFRADO na tabela drive_conexao do Supabase (só a chave de serviço lê),
   e o site pede uma chave nova de 1 hora quando precisar (acao=token) — sem janela do Google, até o administrador revogar.

   Só o administrador (função sou_admin do Supabase) usa isto. Variáveis na Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   SUPABASE_SERVICE_ROLE_KEY. Sem dependências (só fetch e crypto do próprio Node). */

const crypto = require('crypto');

const SUPABASE_URL = 'https://wqkgsotfwkzjwaowenrb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt'; // a mesma chave pública que o próprio site já usa
const SITE = 'https://falandodeastrologia.com.br';
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const VOLTAS_PERMITIDAS = ['/admin-alunos.html', '/admin-clientes.html'];
const ESCOPOS = 'openid email https://www.googleapis.com/auth/drive';

const env = (nome) => {
  const v = process.env[nome];
  if (!v) throw new Error(nome + ' não configurada');
  return v;
};

/* ---------- cifra do token e "estado" assinado do login ---------- */

const chaveCifra = () => crypto.createHash('sha256').update('falandodeastrologia-drive|' + env('GOOGLE_CLIENT_SECRET')).digest();
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const deB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chaveCifra(), iv);
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decifrar(base64) {
  const buf = Buffer.from(base64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', chaveCifra(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

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

/* ---------- Supabase ---------- */

async function supa(caminho, opcoes = {}) {
  const chave = env('SUPABASE_SERVICE_ROLE_KEY');
  const resp = await fetch(SUPABASE_URL + caminho, {
    ...opcoes,
    // chave nova ("sb_secret_...") não é um JWT: vai só em apikey; a antiga ("service_role", JWT) vai também em Authorization
    headers: { apikey: chave, ...(chave.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + chave }), 'Content-Type': 'application/json', ...(opcoes.headers || {}) }
  });
  const texto = await resp.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new Error('Supabase: ' + ((dados && (dados.message || dados.error)) || resp.status));
  return dados;
}
const lerConexao = async () => { const l = await supa('/rest/v1/drive_conexao?id=eq.1&select=*'); return l && l[0] ? l[0] : null; };
const salvarConexao = (campos) => supa('/rest/v1/drive_conexao?on_conflict=id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ id: 1, ...campos, atualizado_em: new Date().toISOString() })
});
const apagarConexao = () => supa('/rest/v1/drive_conexao?id=eq.1', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

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

async function pedirTokens(params) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params })
  });
  const dados = await resp.json();
  if (!resp.ok) { const e = new Error(dados.error_description || dados.error || String(resp.status)); e.codigo = dados.error; throw e; }
  return dados;
}

let tokenEmMemoria = null; // { valor, expira } — evita pedir ao Google a cada chamada
async function tokenDeAcesso(conexao) {
  if (tokenEmMemoria && tokenEmMemoria.expira - 60000 > Date.now()) return tokenEmMemoria;
  const dados = await pedirTokens({ grant_type: 'refresh_token', refresh_token: decifrar(conexao.refresh_token_cifrado) });
  tokenEmMemoria = { valor: dados.access_token, expira: Date.now() + Number(dados.expires_in || 3600) * 1000 };
  return tokenEmMemoria;
}

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
        tokenEmMemoria = null;
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
        if (e.codigo === 'invalid_grant') { await apagarConexao(); tokenEmMemoria = null; res.status(401).json({ codigo: 'desconectado' }); return; } // revogado no Google
        throw e;
      }
      return;
    }
    if (acao === 'desconectar') {
      await apagarConexao(); tokenEmMemoria = null;
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
