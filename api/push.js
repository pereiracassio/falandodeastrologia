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
const URL_ADMIN = '/admin-alunos.html', URL_ALUNO = '/aluno.html';   /* ?atividade=ID abre a lista de atividades mostrando onde ela está */

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || 'O aluno';
const dia = (d) => d.toISOString().slice(0, 10);

/* decide se o aviso pode sair e como ele é; não mexe em nada de fora (por isso dá para testar sozinha) */
function decidirAviso({ evento, atividade, aluno, usuario, ehAdmin, agora = new Date() }) {
  if (!atividade || !aluno) return { erro: 'Atividade não encontrada.', status: 404 };
  const email = String(usuario.email || '').toLowerCase();
  const titulo = String(atividade.titulo || '').slice(0, 120);
  if (evento === 'enviada') {
    if (email !== String(aluno.email || '').toLowerCase()) return { erro: 'Só o próprio aluno avisa que enviou.', status: 403 };
    if (!atividade.enviada_em || atividade.somente_leitura) return { ignorar: 'não é um envio' };
    return { para: 'admins', carga: { title: 'Atividade enviada', body: primeiroNome(aluno.nome) + ' enviou: ' + titulo, url: URL_ADMIN + '#aluno=' + aluno.id + '&atividade=' + atividade.id } };
  }
  if (evento === 'nova' || evento === 'corrigida') {
    if (!ehAdmin) return { erro: 'Só quem administra avisa o aluno.', status: 403 };
    if (evento === 'nova') {
      /* quem chama é o painel, só na criação (editar não chama): sem filtro de data nem de "antiga" */
      return { para: 'aluno', carga: atividade.somente_leitura
        ? { title: 'Material novo', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Deixei um novo material para você: ' + titulo, url: URL_ALUNO + '?atividade=' + atividade.id }
        : { title: 'Atividade nova', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Deixei uma nova atividade para você: ' + titulo, url: URL_ALUNO + '?atividade=' + atividade.id } };
    }
    return { para: 'aluno', carga: { title: 'Atividade corrigida', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Corrigi a sua atividade: ' + titulo, url: URL_ALUNO + '?atividade=' + atividade.id } };
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
  let enviados = 0, removidos = 0, falhas = 0, erroEnvio = null;
  for (const s of inscricoes) {
    try {
      /* urgency alta: no Android, o aviso normal pode esperar o celular "acordar" (modo economia) e chegar minutos depois */
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(carga), { TTL: 86400, urgency: 'high' });
      enviados++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { removidos++; await apagar(s.endpoint); } else { falhas++; erroEnvio = String((e && e.statusCode) || '') + ' ' + String((e && (e.body || e.message)) || '').slice(0, 140); console.error('push:', erroEnvio); }
    }
  }
  return { enviados, removidos, falhas, erroEnvio };
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

async function emailsDoAviso(para, aluno) {
  if (para === 'aluno') return [String(aluno.email || '').toLowerCase()].filter(Boolean);
  return ((await supa('/rest/v1/admins?select=email')) || []).map((a) => String(a.email || '').toLowerCase()).filter(Boolean);
}
const aparelhosDe = (email) => supa('/rest/v1/push_inscricoes?select=endpoint,p256dh,auth&email=eq.' + encodeURIComponent(email));

/* guarda o aviso na lista de quem recebe e manda para o celular dele, com a quantidade de não lidos (número no ícone do app) */
async function entregarAviso(email, carga, extras = {}) {
  let erroGuardar = null;
  await supa('/rest/v1/avisos_recebidos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ email, titulo: carga.title, corpo: carga.body, url: carga.url, ...extras }) }).catch((e) => { erroGuardar = String(e.message || e); console.error('avisos_recebidos:', erroGuardar); });
  const naoLidos = ((await supa('/rest/v1/avisos_recebidos?select=id&lido=eq.false&email=eq.' + encodeURIComponent(email)).catch(() => [])) || []).length;
  const lista = (await aparelhosDe(email)) || [];
  const vazio = { enviados: 0, removidos: 0, falhas: 0, erroGuardar, aparelhos: lista.length };
  if (!lista.length) return vazio;
  return { ...vazio, ...(await enviar(lista, { ...carga, contagem: naoLidos })) };
}
const somar = (a, b) => ({ enviados: a.enviados + b.enviados, removidos: a.removidos + b.removidos, falhas: a.falhas + b.falhas, erroEnvio: a.erroEnvio || b.erroEnvio || null, aparelhos: (a.aparelhos || 0) + (b.aparelhos || 0), erroGuardar: a.erroGuardar || b.erroGuardar || null });
const URL_CLIENTE = '/cliente.html?aviso=1', URL_ADMIN_CLIENTES = '/admin-clientes.html';
const urlDaEntrega = (id) => URL_CLIENTE + '&e=' + id;
const NOME_DO_ARQUIVO = { pdf: 'o PDF', gravacao: 'a gravação' };

async function entregaECliente(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return {};
  const [entrega] = (await supa('/rest/v1/entregas?id=eq.' + id + '&select=id,servico,cliente_id,pdf_link,gravacao_link')) || [];
  const [cliente] = entrega ? ((await supa('/rest/v1/clientes?id=eq.' + entrega.cliente_id + '&select=id,nome,email')) || []) : [];
  return { entrega, cliente };
}

async function tratar(req, res) {
  /* aplicação da mentoria enviada (quem preenche não tem login): o servidor confere no banco que ela existe e está completa, e avisa o administrador uma vez só */
  if (String((req.query && req.query.acao) || '') === 'aplicacao') {
    const corpoA = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const aid = String(corpoA.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(aid)) { res.status(400).json({ erro: 'Aplicação inválida.' }); return; }
    const [ap] = (await supa('/rest/v1/aplicacoes_mentoria?id=eq.' + aid + '&select=id,nome,concluida')) || [];
    if (!ap || ap.concluida !== true) { res.status(200).json({ ok: true, enviados: 0, motivo: 'não está completa' }); return; }
    const urlAp = '/admin-aplicacoes.html#aplicacao=' + aid;
    let r = { enviados: 0, removidos: 0, falhas: 0 };
    for (const email of await emailsDoAviso('admins', null)) {
      const ja = (await supa('/rest/v1/avisos_recebidos?select=id&email=eq.' + encodeURIComponent(email) + '&url=eq.' + encodeURIComponent(urlAp) + '&limit=1').catch(() => [])) || [];
      if (ja.length) continue;
      r = somar(r, await entregarAviso(email, { title: 'Nova aplicação', body: String(ap.nome || 'Alguém').trim() + ' enviou a aplicação para a mentoria', url: urlAp }));
    }
    res.status(200).json({ ok: true, ...r }); return;
  }
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
    /* o aviso fica guardado na lista de quem recebe (aluno ou administrador; o banco só mantém os 10 mais novos de cada um) e o celular recebe também,
       com a quantidade de avisos não lidos para o número no ícone do app */
    let r = { enviados: 0, removidos: 0, falhas: 0 };
    for (const email of await emailsDoAviso(d.para, aluno)) {
      r = somar(r, await entregarAviso(email, d.carga, { atividade_id: atividade.id }));
    }
    res.status(200).json({ ok: true, ...r }); return;
  }
  /* o administrador acabou de cadastrar um material ou uma gravação na página do aluno (aba Materiais / Gravações): o aluno recebe o aviso */
  if (acao === 'item') {
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'Só quem administra avisa o aluno.' }); return; }
    const iid = String(corpo.item_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(iid)) { res.status(400).json({ erro: 'Item inválido.' }); return; }
    const [item] = (await supa('/rest/v1/itens?id=eq.' + iid + '&select=id,aluno_id,bloco,titulo')) || [];
    const [aluno] = item ? ((await supa('/rest/v1/alunos?id=eq.' + item.aluno_id + '&select=id,nome,email')) || []) : [];
    if (!aluno || !aluno.email) { res.status(404).json({ erro: 'Aluno não encontrado.' }); return; }
    const nome = primeiroNome(aluno.nome), titulo = String(item.titulo || '').slice(0, 120);
    const aba = ['gravacoes', 'materiais', 'caderno'].includes(item.bloco) ? item.bloco : 'materiais';
    const carga = item.bloco === 'gravacoes'
      ? { title: 'Gravação disponível', body: 'Oi, ' + nome + '! Já disponibilizei a gravação do nosso encontro: ' + titulo, url: URL_ALUNO + '?aba=' + aba }
      : { title: 'Material novo', body: 'Oi, ' + nome + '! Deixei um novo material para você: ' + titulo, url: URL_ALUNO + '?aba=' + aba };
    const r = await entregarAviso(String(aluno.email).toLowerCase(), carga);
    res.status(200).json({ ok: true, ...r }); return;
  }
  /* pagamento lançado no Financeiro: quem pagou (aluno ou cliente, achado pelo código do "código - nome" ou pelo nome) recebe o aviso */
  if (acao === 'pagamento') {
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'Só quem administra avisa.' }); return; }
    const eid = String(corpo.entrada_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(eid)) { res.status(400).json({ erro: 'Entrada inválida.' }); return; }
    const [ent] = (await supa('/rest/v1/fin_entradas?id=eq.' + eid + '&select=id,cliente_nome,produto')) || [];
    const rotulo = String((ent && ent.cliente_nome) || '').trim();
    if (!ent || !rotulo) { res.status(200).json({ ok: true, enviados: 0, motivo: 'sem cliente na entrada' }); return; }
    const mc = /^(\d{3,6})\s*-\s*(.*)$/.exec(rotulo), cod = mc ? mc[1] : '', nomeSo = (mc ? mc[2] : rotulo).trim();
    const cods = cod ? [cod, cod.replace(/^0+/, ''), cod.replace(/^0+/, '').padStart(4, '0')] : [];
    const achar = async (tabelaCod, campo, tabela) => {
      let id = null;
      if (cods.length) { const [l] = (await supa('/rest/v1/' + tabelaCod + '?select=' + campo + '&codigo=in.(' + cods.join(',') + ')&limit=1').catch(() => [])) || []; id = l && l[campo]; }
      if (id) { const [p] = (await supa('/rest/v1/' + tabela + '?id=eq.' + id + '&select=id,nome,email').catch(() => [])) || []; return p || null; }
      const todos = (await supa('/rest/v1/' + tabela + '?select=id,nome,email&nome=ilike.' + encodeURIComponent(nomeSo)).catch(() => [])) || [];
      return todos.length === 1 ? todos[0] : null; /* só avisa se achar UMA pessoa */
    };
    const aluno = await achar('aluno_codigos', 'aluno_id', 'alunos');
    const pessoa = aluno || await achar('cliente_codigos', 'cliente_id', 'clientes');
    if (!pessoa || !pessoa.email) { res.status(200).json({ ok: true, enviados: 0, motivo: 'pessoa não encontrada' }); return; }
    const oque = String(ent.produto || '').slice(0, 120);
    const carga = { title: 'Pagamento recebido', body: 'Oi, ' + primeiroNome(pessoa.nome) + '! Recebi o seu pagamento' + (oque ? ': ' + oque : '') + '.', url: aluno ? URL_ALUNO + '?aba=mensalidade' : URL_CLIENTE };
    const r = await entregarAviso(String(pessoa.email).toLowerCase(), carga, aluno ? {} : { guardar_sempre: true });
    res.status(200).json({ ok: true, ...r }); return;
  }
  /* comentário em uma pergunta de atividade: o aluno comentou → o administrador é avisado; o administrador respondeu → o aluno é avisado */
  if (acao === 'comentario') {
    const pid = String(corpo.pergunta_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(pid)) { res.status(400).json({ erro: 'Pergunta inválida.' }); return; }
    const [perg] = (await supa('/rest/v1/atividade_perguntas?id=eq.' + pid + '&select=atividade_id')) || [];
    const [atividade] = perg ? ((await supa('/rest/v1/atividades?id=eq.' + perg.atividade_id + '&select=id,titulo,aluno_id')) || []) : [];
    const [aluno] = atividade ? ((await supa('/rest/v1/alunos?id=eq.' + atividade.aluno_id + '&select=id,nome,email')) || []) : [];
    if (!aluno) { res.status(404).json({ erro: 'Atividade não encontrada.' }); return; }
    const titulo = String(atividade.titulo || '').slice(0, 120);
    const doAluno = String(usuario.email).toLowerCase() === String(aluno.email || '').toLowerCase();
    let r = { enviados: 0, removidos: 0, falhas: 0 };
    if (doAluno) {
      const carga = { title: 'Comentário novo', body: primeiroNome(aluno.nome) + ' comentou na atividade: ' + titulo, url: URL_ADMIN + '#aluno=' + aluno.id + '&atividade=' + atividade.id };
      for (const email of await emailsDoAviso('admins', null)) r = somar(r, await entregarAviso(email, carga, { atividade_id: atividade.id }));
    } else if (await souAdmin(jwt)) {
      const carga = { title: 'Resposta', body: 'Oi, ' + primeiroNome(aluno.nome) + '! Respondi o seu comentário na atividade: ' + titulo, url: URL_ALUNO + '?atividade=' + atividade.id };
      r = somar(r, await entregarAviso(String(aluno.email).toLowerCase(), carga, { atividade_id: atividade.id }));
    } else { res.status(403).json({ erro: 'Sem permissão.' }); return; }
    res.status(200).json({ ok: true, ...r }); return;
  }
  /* o administrador acabou de disponibilizar PDF e/ou gravação para o cliente: o cliente recebe o aviso (e ele fica guardado sempre) */
  if (acao === 'entrega') {
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'Só quem administra avisa o cliente.' }); return; }
    const { entrega, cliente } = await entregaECliente(corpo.entrega_id);
    if (!entrega || !cliente || !cliente.email) { res.status(404).json({ erro: 'Entrega não encontrada.' }); return; }
    const nome = primeiroNome(cliente.nome), servico = String(entrega.servico || '').slice(0, 120);
    let r = { enviados: 0, removidos: 0, falhas: 0 };
    for (const tipo of ['gravacao', 'pdf']) {
      if (!(corpo.tipos || []).includes(tipo) || !(tipo === 'pdf' ? entrega.pdf_link : entrega.gravacao_link)) continue;
      const carga = tipo === 'gravacao'
        ? { title: 'Gravação disponível', body: 'Oi, ' + nome + '! Já disponibilizei a gravação do seu atendimento: ' + servico, url: urlDaEntrega(entrega.id) }
        : { title: 'Material disponível', body: 'Oi, ' + nome + '! Disponibilizei o material complementar do seu serviço: ' + servico, url: urlDaEntrega(entrega.id) };
      r = somar(r, await entregarAviso(String(cliente.email).toLowerCase(), carga, { guardar_sempre: true }));
    }
    res.status(200).json({ ok: true, ...r }); return;
  }
  /* aviso escrito (ou pronto) pelo administrador, enviado na hora para um aluno ou um cliente */
  if (acao === 'manual') {
    if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'Só quem administra envia avisos.' }); return; }
    const texto = String(corpo.texto || '').trim().slice(0, 300);
    const id = String(corpo.id || '');
    if (!texto || !/^[0-9a-f-]{36}$/i.test(id) || !['aluno', 'cliente'].includes(corpo.para)) { res.status(400).json({ erro: 'Aviso inválido.' }); return; }
    const [pessoa] = (await supa('/rest/v1/' + (corpo.para === 'aluno' ? 'alunos' : 'clientes') + '?id=eq.' + id + '&select=id,email')) || [];
    if (!pessoa || !pessoa.email) { res.status(404).json({ erro: 'Essa pessoa não tem e-mail cadastrado.' }); return; }
    const carga = { title: 'Aviso', body: texto, url: corpo.para === 'aluno' ? URL_ALUNO + '?aviso=1' : URL_CLIENTE };
    const r = await entregarAviso(String(pessoa.email).toLowerCase(), carga, corpo.para === 'cliente' ? { guardar_sempre: true } : {});
    res.status(200).json({ ok: true, ...r }); return;
  }
  /* o cliente tocou em baixar: o administrador recebe o aviso (só vale para o próprio cliente da entrega) */
  if (acao === 'baixou') {
    const tipo = corpo.tipo === 'pdf' ? 'pdf' : corpo.tipo === 'gravacao' ? 'gravacao' : '';
    const { entrega, cliente } = await entregaECliente(corpo.entrega_id);
    if (!tipo || !entrega || !cliente) { res.status(404).json({ erro: 'Entrega não encontrada.' }); return; }
    if (String(cliente.email || '').toLowerCase() !== String(usuario.email).toLowerCase()) { res.status(403).json({ erro: 'Só o próprio cliente avisa que baixou.' }); return; }
    const carga = { title: 'Arquivo baixado', body: String(cliente.nome || 'O cliente').trim() + ' baixou ' + NOME_DO_ARQUIVO[tipo] + ': ' + String(entrega.servico || '').slice(0, 120), url: URL_ADMIN_CLIENTES + '?cliente=' + cliente.id };
    let r = { enviados: 0, removidos: 0, falhas: 0 };
    for (const email of await emailsDoAviso('admins', null)) r = somar(r, await entregarAviso(email, carga));
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
module.exports.entregarAviso = entregarAviso;
module.exports.emailsDoAviso = emailsDoAviso;
