/* Recebe o aviso (webhook) do InfinitePay quando um pagamento é aprovado e lança a entrada no Financeiro, sem digitar.

   O endereço deste aviso vai DENTRO do carrinho (carrinho.html, campo webhook_url ao criar cada link de pagamento), ou seja, é público: por isso aqui NÃO
   entra a WEBHOOK_CHAVE (ela protege o novo-cliente) e ninguém precisa confiar no que chega. Antes de lançar, o servidor pergunta ao próprio InfinitePay
   (payment_check) se aquele pedido foi mesmo pago e usa o valor que ELE devolve; aviso falso não lança nada.
   O aviso cru fica em fin_webhook_log (pra ver o que o InfinitePay realmente manda). A entrada nasce com id_externo único (o mesmo aviso duas vezes não
   lança duas vezes). Valores em centavos. Variável na Vercel: SUPABASE_SERVICE_ROLE_KEY. */

const { supa } = require('./_drive');

const HANDLE = 'cassiopereira_';
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
    corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    /* só pedidos criados pelo nosso carrinho (order_nsu "fda-...") */
    if (!/^fda-\d+$/.test(String(corpo.order_nsu || ''))) { res.status(400).json({ erro: 'pedido desconhecido' }); return; }

    /* guarda o aviso cru primeiro: se algo abaixo falhar, o que chegou não se perde */
    const log = await supa('/rest/v1/fin_webhook_log', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ corpo, resultado: 'recebido' }) });
    logId = log && log[0] && log[0].id;
    const resultado = async (texto) => { if (logId) { try { await supa('/rest/v1/fin_webhook_log?id=eq.' + q(logId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resultado: texto }) }); } catch (e) { /* o log é só apoio */ } } };

    const idExterno = String(corpo.transaction_nsu || corpo.invoice_slug || corpo.slug || corpo.order_nsu || '').trim();

    /* confirma com o InfinitePay que foi pago e pega o valor de lá (nunca o do aviso) */
    const slug = String(corpo.invoice_slug || corpo.slug || '').trim();
    const conf = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: HANDLE, order_nsu: corpo.order_nsu, transaction_nsu: corpo.transaction_nsu, slug })
    });
    const textoConf = await conf.text();
    let dadosConf = {}; try { dadosConf = JSON.parse(textoConf); } catch (e) { /* resposta que não é JSON */ }
    if (!conf.ok || dadosConf.paid !== true) { await resultado('não confirmado pelo InfinitePay (' + conf.status + '): ' + textoConf.slice(0, 300)); res.status(400).json({ erro: 'pagamento não confirmado' }); return; }
    const centavos = num(dadosConf.paid_amount != null ? dadosConf.paid_amount : dadosConf.amount);
    if (!idExterno || centavos == null || centavos <= 0) { await resultado('sem entrada: faltou identificador ou valor'); res.status(200).json({ ok: true, entrada: false }); return; }
    if (dadosConf.capture_method && !corpo.capture_method) corpo.capture_method = dadosConf.capture_method;

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
