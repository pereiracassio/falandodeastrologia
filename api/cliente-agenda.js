/* Depois do pagamento, o Seu espaço pergunta aqui: "esse cliente já tem cadastro no site? então qual é o número dele na agenda?".
   Com o número, o Seu espaço abre a AGENDA direto; sem ele, abre o formulário (que depois leva à agenda).

   Só responde para pedido PAGO (pedidos.pago_em, preenchido pelo api/infinitepay.js quando o InfinitePay confirma): quem não pagou não consegue
   descobrir o número de ninguém. O e-mail vem do próprio pedido, nunca da URL. Sem dependências. */

const { supa } = require('./_drive');
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const q = (v) => encodeURIComponent(v);

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    const pedido = String((req.query && req.query.pedido) || '');
    if (!/^fda-\d+$/.test(pedido)) { res.status(400).json({ erro: 'pedido inválido' }); return; }
    const linhas = await supa('/rest/v1/pedidos?order_nsu=eq.' + q(pedido) + '&select=pago_em,cliente_id');
    const p = linhas && linhas[0];
    if (!p || !p.pago_em) { res.status(200).json({ pago: false, agenda: null }); return; }
    let agenda = null;
    if (p.cliente_id) {
      const c = await supa('/rest/v1/clientes?id=eq.' + q(p.cliente_id) + '&select=agenda_id');
      agenda = c && c[0] && c[0].agenda_id ? String(c[0].agenda_id) : null;
    }
    res.status(200).json({ pago: true, agenda });
  } catch (e) {
    console.error('cliente-agenda:', e.message);
    res.status(200).json({ pago: false, agenda: null });
  }
};
