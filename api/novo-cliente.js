/* Recebe o aviso (webhook) do Astro Hellenic quando um cliente envia o formulário e deixa tudo pronto aqui, sem fazer na unha:
   1) cria o cliente (nome + e-mail) na área do cliente, se ainda não existir;
   2) grava o código dele (o mesmo do Astro Hellenic);
   3) cria a pasta "código - nome" dentro da pasta dos clientes no Drive e compartilha com o e-mail dele.

   O endereço (com ?chave=...) fica só na configuração do Astro Hellenic (Configurações → Captação → URL do webhook).
   Variáveis na Vercel: WEBHOOK_CHAVE, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.
   Pode chegar mais de uma vez pro mesmo cliente (formulário e depois agendamento): tudo aqui é "só cria o que falta". */

const crypto = require('crypto');
const { env, supa, lerConexao, tokenDeAcesso, criarPasta, compartilhar } = require('./_drive');
const { criarAcesso } = require('./_acesso');

const igual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const q = (v) => encodeURIComponent(v);

/* Sinastria chega como "0157 A": a pasta e o código do cliente são o "0157" */
const normalizarCodigo = (c) => {
  const t = String(c || '').trim();
  const m = t.match(/^(.*\d)\s*[AB]$/i);
  return (m ? m[1] : t).trim();
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'use POST' }); return; }
  try {
    if (!igual((req.query && req.query.chave) || '', env('WEBHOOK_CHAVE'))) { res.status(401).json({ erro: 'chave inválida' }); return; }

    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const c = corpo.cliente || {};
    const email = String(c.email || '').trim().toLowerCase();
    const nome = String(c.nome || '').trim();
    const codigo = normalizarCodigo(c.codigo);
    const whatsapp = String(c.whatsapp || '').trim();
    if (!email || !nome) { res.status(400).json({ erro: 'faltou nome ou e-mail' }); return; }

    /* 1) cliente */
    let linhas = await supa('/rest/v1/clientes?email=eq.' + q(email) + '&select=id,nome,whatsapp');
    let cliente = linhas && linhas[0];
    let criado = false;
    if (!cliente) {
      const novo = await supa('/rest/v1/clientes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ email, nome, whatsapp: whatsapp || null }) });
      cliente = novo[0]; criado = true;
    } else if (whatsapp && !cliente.whatsapp) {
      // cliente que já existia sem WhatsApp: completa (nunca troca um que já está salvo)
      try { await supa('/rest/v1/clientes?id=eq.' + q(cliente.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ whatsapp }) }); } catch (e) { console.error('novo-cliente whatsapp:', e.message); }
    }

    /* 1a) data de nascimento (se o Astro Hellenic mandar): "DD/MM/AAAA" ou "AAAA-MM-DD"; só completa, nunca troca uma que já está salva */
    try {
      const bruto = String(c.nascimento || c.data_nascimento || '').trim();
      const m = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) || bruto.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const iso = m ? (bruto.includes('/') ? m[3] + '-' + m[2] + '-' + m[1] : m[1] + '-' + m[2] + '-' + m[3]) : '';
      if (iso) await supa('/rest/v1/clientes?id=eq.' + q(cliente.id) + '&nascimento=is.null', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ nascimento: iso }) });
    } catch (e) { console.error('novo-cliente nascimento:', e.message); }

    /* 1b) acesso (login) do cliente: só quem foi cliente consegue entrar no Seu espaço (o cadastro aberto do Supabase fica desligado) */
    try { await criarAcesso(email, nome); } catch (e) { console.error('novo-cliente acesso:', e.message); }

    /* 1c) número do cliente na agenda (cliente_id do aviso): guardado pra, na próxima compra, o Seu espaço abrir a agenda direto, sem o formulário.
       Sinastria e retificação ficam de fora (o número delas é de outro cadastro e elas sempre passam pelo formulário). */
    if (/^[0-9a-f-]{36}$/i.test(String(corpo.cliente_id || '')) && !/sinastria|retifica/i.test(String(corpo.servico || ''))) {
      try { await supa('/rest/v1/clientes?id=eq.' + q(cliente.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ agenda_id: String(corpo.cliente_id) }) }); }
      catch (e) { console.error('novo-cliente agenda_id:', e.message); }
    }

    /* 2) código (se já é de outro cliente, não mexe: o banco recusa duplicado) */
    let codigoGravado = false;
    if (codigo) {
      try {
        await supa('/rest/v1/cliente_codigos?on_conflict=cliente_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cliente_id: cliente.id, codigo }) });
        codigoGravado = true;
      } catch (e) { console.error('novo-cliente código:', e.message); }
    }

    /* 3) pasta no Drive (falha aqui não desfaz o cliente: ele já está criado) */
    let pasta = false, compartilhada = false, aviso = '';
    try {
      const conexao = await lerConexao();
      const pastas = await supa('/rest/v1/drive_pastas?chave=in.(' + q('base_clientes') + ',' + q('cliente:' + cliente.id) + ')&select=chave,pasta_id');
      const m = {};
      (pastas || []).forEach((p) => { m[p.chave] = p.pasta_id; });
      if (m['cliente:' + cliente.id]) { pasta = true; }
      else if (!conexao) aviso = 'Google Drive não conectado';
      else if (!m.base_clientes) aviso = 'pasta dos clientes não escolhida';
      else {
        const t = await tokenDeAcesso(conexao);
        const id = await criarPasta(t.valor, (codigo ? codigo + ' - ' : '') + nome, m.base_clientes);
        await supa('/rest/v1/drive_pastas?on_conflict=chave', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ chave: 'cliente:' + cliente.id, pasta_id: id }) });
        pasta = true;
        compartilhada = await compartilhar(t.valor, id, email);
      }
    } catch (e) {
      console.error('novo-cliente drive:', e.message);
      aviso = 'erro ao criar a pasta';
    }

    /* 4) retificação: o aviso chega DEPOIS que o cliente enviou os fatos da vida (o formulário só avisa no fim); marca o cliente pro painel mostrar o selinho "fatos enviados".
       Falha aqui (ex.: colunas ainda não criadas) nunca desfaz o resto. */
    let selinho = false;
    if (/retifica/i.test(String(corpo.servico || ''))) {
      try {
        await supa('/rest/v1/clientes?id=eq.' + q(cliente.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ retificacao_fatos_em: new Date().toISOString(), retificacao_fatos_vistos_em: null }) });
        selinho = true;
      } catch (e) { console.error('novo-cliente selinho:', e.message); }
    }

    res.status(200).json({ ok: true, cliente_id: cliente.id, criado, codigo: codigoGravado, pasta, compartilhada, aviso, selinho });
  } catch (e) {
    console.error('novo-cliente:', e.message);
    res.status(500).json({ erro: 'erro no servidor' });
  }
};
