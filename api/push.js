/* Avisos no celular (Web Push) das atividades.
   - inscrever / desinscrever: cada aparelho cadastra (ou tira) o próprio aviso; quem é a pessoa vem do login (token do Supabase).
   - avisar: o site conta que algo aconteceu (aluno enviou, atividade nova, atividade corrigida); o SERVIDOR confere nos dados se é verdade e
     quem pode avisar quem, e decide para quem vai. O navegador nunca escolhe o destinatário nem o texto.
   Nenhuma variável nova: usa SUPABASE_SERVICE_ROLE_KEY e GOOGLE_CLIENT_SECRET (as de sempre). As chaves dos avisos (VAPID) o próprio servidor gera na primeira vez
   e guarda cifradas na tabela push_chaves, como já faz com o acesso do Drive: ninguém precisa copiar chave nenhuma. Tabelas: push_inscricoes e push_chaves (docs/avisos.sql). */

const { SUPABASE_URL, SUPABASE_ANON, supa, cifrar, decifrar } = require('./_drive');
const webpush = require('web-push');

const VAPID_CONTATO = 'mailto:cassiofalandodeastrologia@gmail.com';
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const URL_ADMIN = '/admin-alunos.html', URL_ALUNO = '/aluno.html?aviso=1';   /* ?aviso=1 abre a aba Avisos */

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || 'O aluno';
const dia = (d) => d.toISOString().slice(0, 10);

/* decide se o aviso pode sair e como ele é; não mexe em nada de fora (por isso dá para testar sozinha) */
function decidirAviso({ evento, atividade, aluno, usuario, ehAdmin, agora = new Date() }) {
  if (!atividade || !aluno) return { erro: 'Atividade não encontrada.', status: 404 };
  const email = String(usuario.email || '').toLowerCase();
  const titulo = String(atividade.titulo || '').slice(0, 120);
  if (evento === 'enviada') {
    if (email !== String(aluno.email || '').toLowerCase()) return { erro: 'Só o próprio aluno avisa que enviou.', status: 403 };
    if (!atividade.enviada_em || atividade.antiga || atividade.somente_leitura) return { ignorar: 'não é um envio' };
    return { para: 'admins', carga: { title: 'Atividade enviada', body: primeiroNome(aluno.nome) + ' enviou: ' + titulo, url: URL_ADMIN } };
  }
  if (evento === 'nova' || evento === 'corrigida') {
    if (!ehAdmin) return { erro: 'Só quem administra avisa o aluno.', status: 403 };
    const ontem = dia(new Date(agora.getTime() - 86400000));
    if (evento === 'nova') {
      if (atividade.antiga && !atividade.somente_leitura) return { ignorar: 'atividade antiga' };
      if (Date.parse(atividade.criado_em) < agora.getTime() - 86400000) return { ignorar: 'não é nova' };
      if (atividade.data_atividade && String(atividade.data_atividade).slice(0, 10) < ontem) return { ignorar: 'material de data passada' };
      return { para: 'aluno', carga: atividade.somente_leitura
        ? { title: 'Material novo', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Deixei um novo material para você: ' + titulo, url: URL_ALUNO }
        : { title: 'Atividade nova', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Deixei uma nova atividade para você: ' + titulo, url: URL_ALUNO } };
    }
    if (!atividade.corrigida_em || atividade.antiga || String(atividade.corrigida_em).slice(0, 10) < ontem) return { ignorar: 'não é uma correção de agora' };
    return { para: 'aluno', carga: { title: 'Atividade corrigida', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Corrigi a sua atividade: ' + titulo, url: URL_ALUNO } };
  }
  return { erro: 'Aviso desconhecido.', status: 400 };
}

/* chaves dos avisos: criadas uma vez só (se duas chamadas chegarem juntas, vale a que gravou primeiro) e lembradas em memória */
let chavesEmMemoria = null;
async function chaves() {
  if (chavesEmMemoria) return chavesEmMemoria;
  const ler = () => supa('/rest/v1/push_chaves?id=eq.1&select=publica,privada');
  let l = await ler();
  if (!l || !l[0]) {
    const k = webpush.generateVAPIDKeys();
    await supa('/rest/v1/push_chaves?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, publica: k.publicKey, privada: cifrar(k.privateKey) }) });
    l = await ler();
  }
  chavesEmMemoria = { publica: l[0].publica, privada: decifrar(l[0].privada) };
  return chavesEmMemoria;
}

/* manda para cada aparelho; o que o celular diz que não existe mais (404/410) é apagado do cadastro */
async function enviar(inscricoes, carga, wp = webpush, apagar = apagarInscricao) {
  const k = await chaves();
  wp.setVapidDetails(VAPID_CONTATO, k.publica, k.privada);
  let enviados = 0, removidos = 0, falhas = 0;
  for (const s of inscricoes) {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(carga), { TTL: 86400 });
      enviados++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { removidos++; await apagar(s.endpoint); } else falhas++;
    }
  }
  return { enviados, removidos, falhas };
}
const apagarInscricao = (endpoint) => supa('/rest/v1/push_inscricoes?endpoint=eq.' + encodeURIComponent(endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});

async function usuarioDoToken(jwt) {
  if (!jwt) return null;
  const resp = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt } });
  if (!resp.ok) return null;
  const u = await resp.json();
  return u && u.id && u.email ? { id: u.id, email: u.email } : null;
}
async function souAdmin(jwt) {
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', { method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: '{}' });
  return resp.ok && (await resp.json()) === true;
}
const emLista = (emails) => '(' + emails.map((e) => '"' + String(e).replace(/"/g, '') + '"').join(',') + ')';

async function destinatarios(para, aluno) {
  if (para === 'aluno') return supa('/rest/v1/push_inscricoes?select=endpoint,p256dh,auth&email=eq.' + encodeURIComponent(String(aluno.email || '').toLowerCase()));
  const admins = ((await supa('/rest/v1/admins?select=email')) || []).map((a) => String(a.email || '').toLowerCase()).filter(Boolean);
  if (!admins.length) return [];
  return supa('/rest/v1/push_inscricoes?select=endpoint,p256dh,auth&email=in.' + encodeURIComponent(emLista(admins)));
}

async function tratar(req, res) {
  if (String((req.query && req.query.acao) || '') === 'chave') { res.status(200).json({ chave: (await chaves()).publica }); return; } /* a chave pública não é segredo: o aparelho precisa dela para se cadastrar */
  const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const usuario = await usuarioDoToken(jwt);
  if (!usuario) { res.status(401).json({ erro: 'Entre de novo para usar os avisos.' }); return; }
  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const acao = String((req.query && req.query.acao) || '');

  if (acao === 'inscrever') {
    const s = corpo.subscription || {};
    if (!/^https:\/\//.test(String(s.endpoint || '')) || !s.keys || !s.keys.p256dh || !s.keys.auth) { res.status(400).json({ erro: 'Inscrição inválida.' }); return; }
    await supa('/rest/v1/push_inscricoes?on_conflict=endpoint', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: usuario.id, email: usuario.email.toLowerCase(), endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, aparelho: String(corpo.aparelho || '').slice(0, 160) || null })
    });
    res.status(200).json({ ok: true }); return;
  }
  if (acao === 'desinscrever') {
    await supa('/rest/v1/push_inscricoes?endpoint=eq.' + encodeURIComponent(String(corpo.endpoint || '')) + '&user_id=eq.' + usuario.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    res.status(200).json({ ok: true }); return;
  }
  if (acao === 'avisar') {
    const evento = String(corpo.evento || ''), id = String(corpo.atividade_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(400).json({ erro: 'Atividade inválida.' }); return; }
    const [atividade] = (await supa('/rest/v1/atividades?id=eq.' + id + '&select=id,titulo,aluno_id,antiga,somente_leitura,enviada_em,corrigida_em,criado_em,data_atividade')) || [];
    const [aluno] = atividade ? ((await supa('/rest/v1/alunos?id=eq.' + atividade.aluno_id + '&select=id,nome,email')) || []) : [];
    const ehAdmin = evento === 'enviada' ? false : await souAdmin(jwt);
    const d = decidirAviso({ evento, atividade, aluno, usuario, ehAdmin });
    if (d.erro) { res.status(d.status).json({ erro: d.erro }); return; }
    if (d.ignorar) { res.status(200).json({ ok: true, enviados: 0, motivo: d.ignorar }); return; }
    /* o aviso do aluno também fica guardado na lista dele (aba Avisos); o banco só mantém os 10 mais novos de cada aluno */
    if (d.para === 'aluno') await supa('/rest/v1/avisos_recebidos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ email: String(aluno.email || '').toLowerCase(), titulo: d.carga.title, corpo: d.carga.body, url: d.carga.url, atividade_id: atividade.id }) }).catch(() => {});
    const lista = (await destinatarios(d.para, aluno)) || [];
    const r = lista.length ? await enviar(lista, d.carga) : { enviados: 0, removidos: 0, falhas: 0 };
    res.status(200).json({ ok: true, ...r }); return;
  }
  res.status(400).json({ erro: 'Ação desconhecida.' });
}

async function handler(req, res) {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'Método não permitido.' }); return; }
  try { await tratar(req, res); }
  catch (e) { res.status(500).json({ erro: 'Não foi possível enviar o aviso agora.', detalhe: String(e.message || e) }); }
}
module.exports = handler;
module.exports.decidirAviso = decidirAviso;
module.exports.enviar = enviar;
