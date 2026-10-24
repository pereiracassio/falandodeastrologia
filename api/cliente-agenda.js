/* Depois do pagamento, o Seu espaço pergunta aqui: "esse cliente já tem cadastro no site? então qual é o número dele na agenda?".
   Com o número, o Seu espaço abre a AGENDA direto; sem ele, abre o formulário (que depois leva à agenda).

   A resposta é imediata: não espera a confirmação do pagamento (o cliente não pode ficar parado numa tela de espera, ele fecha a página).
   O e-mail vem do pedido que o carrinho guardou (pedidos), nunca da URL. É a mesma exposição que o formulário do Astro Hellenic já tem
   (reconhecer o cadastro pelo e-mail). Sem dependências. */

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
    const linhas = await supa('/rest/v1/pedidos?order_nsu=eq.' + q(pedido) + '&select=email');
    const email = linhas && linhas[0] && String(linhas[0].email || '').trim().toLowerCase();
    let agenda = null;
    if (email) {
      const c = await supa('/rest/v1/clientes?email=eq.' + q(email) + '&select=agenda_id');
      agenda = c && c[0] && c[0].agenda_id ? String(c[0].agenda_id) : null;
    }
    res.status(200).json({ agenda });
  } catch (e) {
    console.error('cliente-agenda:', e.message);
    res.status(200).json({ agenda: null });
  }
};
