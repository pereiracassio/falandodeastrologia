/* Peças em comum das funções que usam o Drive do administrador (o "_" no começo do nome faz a Vercel NÃO tratar este arquivo como um endpoint).
   Variáveis na Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY. */

const crypto = require('crypto');

const SUPABASE_URL = 'https://wqkgsotfwkzjwaowenrb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt'; // a mesma chave pública que o próprio site já usa

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


/* cria uma pasta no Drive (dentro de paiId, se vier) e devolve o id */
async function criarPasta(token, nome, paiId) {
  const resp = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', ...(paiId ? { parents: [paiId] } : {}) })
  });
  if (!resp.ok) throw new Error('Drive não criou a pasta (' + resp.status + ')');
  return (await resp.json()).id;
}
/* dá acesso de leitura ao e-mail (sem aviso do Drive) */
async function compartilhar(token, arquivoId, email) {
  const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(arquivoId) + '/permissions?sendNotificationEmail=false&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email })
  });
  return resp.ok;
}

const esquecerToken = () => { tokenEmMemoria = null; };

module.exports = {
  esquecerToken,
  SUPABASE_URL, SUPABASE_ANON, env, b64url, deB64url, cifrar, decifrar, supa,
  lerConexao, salvarConexao, apagarConexao, pedirTokens, tokenDeAcesso, criarPasta, compartilhar
};
