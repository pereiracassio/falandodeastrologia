/* Recebe o aviso (webhook) do InfinitePay quando um pagamento é aprovado e lança a entrada no Financeiro, sem digitar.

   O endereço deste aviso vai DENTRO do carrinho (carrinho.html, campo webhook_url ao criar cada link de pagamento), ou seja, é público: por isso aqui NÃO
   entra a WEBHOOK_CHAVE (ela protege o novo-cliente) e ninguém precisa confiar no que chega. Antes de lançar, o servidor pergunta ao próprio InfinitePay
   (payment_check) se aquele pedido foi mesmo pago e usa o valor que ELE devolve; aviso falso não lança nada.
   O aviso cru fica em fin_webhook_log (pra ver o que o InfinitePay realmente manda). A entrada nasce com id_externo único (o mesmo aviso duas vezes não
   lança duas vezes). Valores em centavos. Variável na Vercel: SUPABASE_SERVICE_ROLE_KEY.

   O carrinho guarda quem comprou (nome, e-mail, WhatsApp) na tabela `pedidos`, ligado ao order_nsu. Aqui, com o pagamento confirmado, o cliente é cadastrado
   (se ainda não existe), ganha o acesso ao Seu espaço e a entrada já sai com o nome dele. A pasta no Drive e o código continuam vindo do novo-cliente
   (aviso do Astro Hellenic, quando ele envia o formulário). Falha no cadastro nunca impede de lançar a entrada. */

const { supa } = require('./_drive');
const { criarAcesso } = require('./_acesso');

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
    let nome = String(cli.name || corpo.customer_name || '').trim() || null;

    /* quem comprou: vem do que o carrinho guardou (o aviso do InfinitePay não traz o nome) */
    let clienteCadastrado = null, emailComprador = null;
    try {
      const achados = await supa('/rest/v1/pedidos?order_nsu=eq.' + q(corpo.order_nsu) + '&select=order_nsu,nome,email,whatsapp');
      const ped = achados && achados[0];
      if (ped && ped.email && ped.nome) {
        const email = String(ped.email).trim().toLowerCase();
        let linhas = await supa('/rest/v1/clientes?email=eq.' + q(email) + '&select=id,nome,whatsapp');
        let cliente = linhas && linhas[0];
        if (!cliente) {
          const novo = await supa('/rest/v1/clientes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ email, nome: ped.nome, whatsapp: ped.whatsapp || null }) });
          cliente = novo[0];
        } else if (ped.whatsapp && String(ped.whatsapp).replace(/\D/g, '') !== String(cliente.whatsapp || '').replace(/\D/g, '')) {
          /* WhatsApp diferente do da ficha: a pessoa acabou de digitar, então o número mais recente vale (as pessoas trocam de número) */
          try { await supa('/rest/v1/clientes?id=eq.' + q(cliente.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ whatsapp: ped.whatsapp }) }); } catch (e) { console.error('infinitepay whatsapp:', e.message); }
        }
        try { await criarAcesso(email, ped.nome); } catch (e) { console.error('infinitepay acesso:', e.message); }
        await supa('/rest/v1/pedidos?order_nsu=eq.' + q(corpo.order_nsu), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pago_em: new Date().toISOString(), cliente_id: cliente.id }) });
        /* na lista do Financeiro o cliente aparece como "código - nome" quando já tem código */
        let codigo = null;
        try { const cods = await supa('/rest/v1/cliente_codigos?cliente_id=eq.' + q(cliente.id) + '&select=codigo'); codigo = cods && cods[0] && cods[0].codigo; } catch (e) { /* sem código ainda */ }
        /* o nome é o que a pessoa digitou no carrinho (pode comprar para outra pessoa, com o mesmo e-mail); o código só entra se for a mesma pessoa da ficha */
        const mesmaPessoa = String(cliente.nome || '').trim().toLowerCase() === String(ped.nome).trim().toLowerCase();
        nome = (codigo && mesmaPessoa ? codigo + ' - ' : '') + ped.nome;
        clienteCadastrado = cliente.id; emailComprador = email;
      }
    } catch (e) { console.error('infinitepay cadastro:', e.message); }
    const forma = FORMAS[String(corpo.capture_method || '').toLowerCase()] || null;
    const observacao = corpo.receipt_url ? 'Comprovante: ' + corpo.receipt_url : null;

    /* cada serviço do pedido vira UMA entrada no Financeiro, com o valor dele já com os descontos (o carrinho manda o preço final de cada item).
       Se o total pago for diferente da soma dos itens (taxa do cartão), a diferença é repartida na proporção do valor de cada um, para o total bater com o que entrou. */
    const servs = (await supa('/rest/v1/fin_servicos?select=nome,area_id')) || [];
    const areas = (await supa('/rest/v1/fin_areas?select=id,nome&order=ordem')) || [];
    const areaAstro = (areas.filter((a) => /astrolog/i.test(a.nome))[0] || {}).id || null;
    const areaDe = (nomeServico) => { const a = servs.filter((s) => String(s.nome).trim().toLowerCase() === String(nomeServico || '').toLowerCase())[0]; return a ? a.area_id : areaAstro; };
    const pagos = itens.map((i) => ({ desc: String(i.description || '').trim(), preco: (num(i.price) || 0) * (num(i.quantity) || 1) })).filter((i) => i.desc);
    let partes = [{ desc: produto, centavos: Math.round(centavos) }];
    if (pagos.length > 1 && pagos.every((i) => i.preco > 0)) {
      const soma = pagos.reduce((t, i) => t + i.preco, 0);
      partes = pagos.map((i) => ({ desc: i.desc, centavos: Math.round(centavos * i.preco / soma) }));
      partes[partes.length - 1].centavos += Math.round(centavos) - partes.reduce((t, p) => t + p.centavos, 0);
    }
    await supa('/rest/v1/fin_entradas?on_conflict=id_externo', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(partes.map((p, n) => ({ data: hojeBR(), cliente_nome: nome, produto: p.desc, valor: p.centavos / 100, area_id: areaDe(p.desc), forma_pagamento: forma, observacao, origem: 'infinitepay', id_externo: 'infinitepay-' + idExterno + (partes.length > 1 ? '-' + (n + 1) : '') })))
    });
    /* compra nova: o administrador recebe o aviso no celular (nunca deixa de lançar a entrada por causa disso) */
    try {
      const { entregarAviso, emailsDoAviso } = require('./push');
      const quem = String(nome || '').replace(/^\d+\s*-\s*/, '').trim() || 'Alguém';
      const oque = partes.map((p) => p.desc).filter(Boolean).join(' + ') || 'um serviço';
      for (const email of await emailsDoAviso('admins', null)) await entregarAviso(email, { title: 'Compra nova', body: quem + ' comprou: ' + oque, url: '/admin-financeiro.html' });
      if (emailComprador) await entregarAviso(emailComprador, { title: 'Pagamento recebido', body: 'Oi, ' + (quem.split(/\s+/)[0] || '') + '! Recebi o seu pagamento: ' + oque + '.', url: '/cliente.html?aviso=1' }, { guardar_sempre: true });
    } catch (e) { console.error('infinitepay aviso:', e.message); }
    await resultado('entrada lançada' + (clienteCadastrado ? ' e cliente cadastrado' : ''));
    res.status(200).json({ ok: true, entrada: true });
  } catch (e) {
    console.error('infinitepay:', e.message);
    if (logId) { try { await supa('/rest/v1/fin_webhook_log?id=eq.' + q(logId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resultado: 'erro: ' + e.message }) }); } catch (e2) { /* sem log */ } }
    res.status(400).json({ erro: 'não foi possível lançar agora' });
  }
};
