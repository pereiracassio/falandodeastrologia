/* Recebe o aviso (webhook) do InfinitePay quando um pagamento é aprovado e lança a entrada no Financeiro, sem digitar.

   O endereço (com ?chave=...) fica só na configuração do InfinitePay. Variáveis na Vercel: WEBHOOK_CHAVE e SUPABASE_SERVICE_ROLE_KEY (as mesmas do novo-cliente).
   Tudo que chega é guardado cru em fin_webhook_log (pra ver o que o InfinitePay realmente manda e conferir depois). A entrada em fin_entradas nasce com
   id_externo único (o mesmo aviso chegando duas vezes não lança duas vezes). O InfinitePay manda valores em centavos; sem valor, só registra no log. */

const crypto = require('crypto');
const { env, supa } = require('./_drive');

const igual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const q = (v) => encodeURIComponent(v);
const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
/* dia de hoje no fuso de Brasília (toISOString daria o dia seguinte à noite) */
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const FORMAS = { credit_card: 'Cartão de crédito', pix: 'Pix', debit_card: 'Cartão de débito', boleto: 'Outro' };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'use POST' }); return; }
  let logId = null, corpo = {};
  try {
    if (!igual((req.query && req.query.chave) || '', env('WEBHOOK_CHAVE'))) { res.status(401).json({ erro: 'chave inválida' }); return; }
    corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    /* guarda o aviso cru primeiro: se algo abaixo falhar, o que chegou não se perde */
    const log = await supa('/rest/v1/fin_webhook_log', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ corpo, resultado: 'recebido' }) });
    logId = log && log[0] && log[0].id;
    const resultado = async (texto) => { if (logId) { try { await supa('/rest/v1/fin_webhook_log?id=eq.' + q(logId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resultado: texto }) }); } catch (e) { /* o log é só apoio */ } } };

    const idExterno = String(corpo.transaction_nsu || corpo.invoice_slug || corpo.slug || corpo.order_nsu || '').trim();
    const centavos = num(corpo.paid_amount != null ? corpo.paid_amount : corpo.amount);
    if (!idExterno || centavos == null || centavos <= 0) { await resultado('sem entrada: faltou identificador ou valor'); res.status(200).json({ ok: true, entrada: false }); return; }

    const itens = Array.isArray(corpo.items) ? corpo.items : [];
    const produto = itens.map((i) => String(i.description || '').trim()).filter(Boolean).join(' + ') || null;
    const cli = corpo.customer || {};
    const nome = String(cli.name || corpo.customer_name || '').trim() || null;
    const forma = FORMAS[String(corpo.capture_method || '').toLowerCase()] || null;
    const observacao = corpo.receipt_url ? 'Comprovante: ' + corpo.receipt_url : null;

    /* área: a do serviço cadastrado com esse nome; senão Astrologia (os serviços do site) */
    let areaId = null;
    if (produto) {
      const servs = await supa('/rest/v1/fin_servicos?select=nome,area_id');
      const achado = (servs || []).filter((s) => String(s.nome).trim().toLowerCase() === produto.toLowerCase())[0];
      if (achado) areaId = achado.area_id;
    }
    if (!areaId) {
      const areas = await supa('/rest/v1/fin_areas?select=id,nome&order=ordem');
      const astro = (areas || []).filter((a) => /astrolog/i.test(a.nome))[0];
      if (astro) areaId = astro.id;
    }

    await supa('/rest/v1/fin_entradas?on_conflict=id_externo', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ data: hojeBR(), cliente_nome: nome, produto, valor: Math.round(centavos) / 100, area_id: areaId, forma_pagamento: forma, observacao, origem: 'infinitepay', id_externo: 'infinitepay-' + idExterno })
    });
    await resultado('entrada lançada');
    res.status(200).json({ ok: true, entrada: true });
  } catch (e) {
    console.error('infinitepay:', e.message);
    if (logId) { try { await supa('/rest/v1/fin_webhook_log?id=eq.' + q(logId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resultado: 'erro: ' + e.message }) }); } catch (e2) { /* sem log */ } }
    res.status(400).json({ erro: 'não foi possível lançar agora' });
  }
};
