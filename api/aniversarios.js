/* Lembrete de aniversário: roda uma vez por dia (agenda do Vercel, vercel.json) e avisa o administrador, no celular e na lista de avisos,
   de quem faz aniversário HOJE entre clientes e alunos (data de nascimento do cadastro). O dia é o de Brasília.
   Chamar de novo no mesmo dia não repete o aviso. A resposta não revela nomes. Sem variável nova: usa as de sempre. */

const { supa } = require('./_drive');
const { entregarAviso, emailsDoAviso } = require('./push');

const pad = (n) => String(n).padStart(2, '0');
const bissexto = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/* dia de hoje em Brasília (AAAA-MM-DD) */
function hojeEmBrasilia(agora = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return p; /* en-CA já dá AAAA-MM-DD */
}

/* quem faz aniversário no dia `hoje` (29/02 comemora em 28/02 nos anos sem 29); a mesma pessoa em clientes e alunos conta uma vez */
function aniversariantes(pessoas, hoje) {
  const [ano, mes, dia] = hoje.split('-').map(Number);
  const vistos = new Set(), saida = [];
  for (const p of pessoas) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(p.nascimento || '')) continue;
    const m = +p.nascimento.slice(5, 7); let d = +p.nascimento.slice(8, 10);
    if (m === 2 && d === 29 && !bissexto(ano)) d = 28;
    if (m !== mes || d !== dia) continue;
    const k = p.email ? String(p.email).toLowerCase() : String(p.nome).toLowerCase() + '|' + p.nascimento;
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push({ nome: String(p.nome || '').trim(), idade: ano - +p.nascimento.slice(0, 4) });
  }
  return saida;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const hoje = hojeEmBrasilia();
    const pessoas = [].concat(
      (await supa('/rest/v1/clientes?select=nome,email,nascimento&nascimento=not.is.null')) || [],
      (await supa('/rest/v1/alunos?select=nome,email,nascimento&nascimento=not.is.null')) || []);
    const lista = aniversariantes(pessoas, hoje);
    const admins = await emailsDoAviso('admins', null);
    const desdeHoje = new Date(hoje + 'T03:00:00Z').toISOString(); /* meia-noite de Brasília */
    let avisados = 0;
    for (const a of lista) {
      const corpo = 'Hoje é aniversário de ' + a.nome + (a.idade > 0 && a.idade < 120 ? ' (' + a.idade + ' anos)' : '') + '. Mande os parabéns e veja se quer fazer a revolução solar.';
      for (const email of admins) {
        const ja = (await supa('/rest/v1/avisos_recebidos?select=id&email=eq.' + encodeURIComponent(email) + '&titulo=eq.' + encodeURIComponent('Aniversário hoje') + '&corpo=eq.' + encodeURIComponent(corpo) + '&criado_em=gte.' + encodeURIComponent(desdeHoje) + '&limit=1').catch(() => [])) || [];
        if (ja.length) continue;
        await entregarAviso(email, { title: 'Aniversário hoje', body: corpo, url: '/admin-agenda.html#v=dia&d=' + hoje });
        avisados++;
      }
    }
    res.status(200).json({ ok: true, aniversariantes: lista.length, avisos: avisados });
  } catch (e) {
    res.status(500).json({ erro: 'Não foi possível verificar os aniversários agora.', detalhe: String(e.message || e) });
  }
}
module.exports = handler;
module.exports.aniversariantes = aniversariantes;
module.exports.hojeEmBrasilia = hojeEmBrasilia;
