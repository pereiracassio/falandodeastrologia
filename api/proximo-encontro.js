/* Próximo encontro do aluno (dia, horário e link do Google Meet), puxado da Google Agenda do administrador.

   Mesma conexão do Drive (escopo calendar.events.readonly), como em api/meu-atendimento.js. Quem pergunta entra com o login do site:
   - o aluno recebe o próprio encontro;
   - o administrador pode passar ?aluno=ID e recebe o daquele aluno.
   O compromisso é achado quando o convidado tem o e-mail do aluno OU o título começa com o código dele ("0147 - Nome").
   Devolve SÓ o horário e o link do compromisso. Variáveis na Vercel: as mesmas do Drive. Sem dependências. */

const { SUPABASE_URL, SUPABASE_ANON, supa, lerConexao, tokenDeAcesso } = require('./_drive');
const ORIGENS_PERMITIDAS = ['https://falandodeastrologia.com.br', 'https://www.falandodeastrologia.com.br'];
const DIAS_A_FRENTE = 60;

async function usuarioDoToken(jwt) {
  if (!jwt) return null;
  const resp = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt } });
  if (!resp.ok) return null;
  const u = await resp.json();
  return u && u.email ? String(u.email).toLowerCase() : null;
}
async function souAdmin(jwt) {
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/sou_admin', { method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: '{}' });
  return resp.ok && (await resp.json()) === true;
}

const semZeros = (c) => String(c || '').trim().replace(/^0+/, '');

module.exports = async (req, res) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) res.setHeader('Access-Control-Allow-Origin', origem);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const email = await usuarioDoToken(jwt);
    if (!email) { res.status(401).json({ erro: 'sem login' }); return; }

    const alunoId = new URL(req.url, 'http://x').searchParams.get('aluno');
    let filtro = 'email=eq.' + encodeURIComponent(email);
    if (alunoId) {
      if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'só o administrador' }); return; }
      filtro = 'id=eq.' + encodeURIComponent(alunoId);
    }
    const al = await supa('/rest/v1/alunos?' + filtro + '&select=id,email');
    if (!al || !al[0]) { res.status(200).json({ encontro: null, motivo: 'aluno não encontrado' }); return; }
    const emailAluno = String(al[0].email || '').toLowerCase();
    const cod = await supa('/rest/v1/aluno_codigos?aluno_id=eq.' + encodeURIComponent(al[0].id) + '&select=codigo');
    const codigo = semZeros(cod && cod[0] && cod[0].codigo);

    const conexao = await lerConexao();
    if (!conexao) { res.status(200).json({ encontro: null, motivo: 'o Google Drive não está conectado' }); return; }
    const t = await tokenDeAcesso(conexao);
    const agora = new Date();
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
      timeMin: agora.toISOString(), timeMax: new Date(agora.getTime() + DIAS_A_FRENTE * 86400000).toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      fields: 'items(summary,status,start,end,hangoutLink,attendees(email),conferenceData/entryPoints(entryPointType,uri))'
    });
    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + t.valor } });
    if (!resp.ok) { console.error('proximo-encontro google:', resp.status); res.status(200).json({ encontro: null, motivo: resp.status === 403 ? 'a conexão com o Google ainda não tem a permissão da agenda: conecte o Google Drive de novo' : 'o Google respondeu erro ' + resp.status }); return; }
    const dados = await resp.json();
    const achado = (dados.items || []).find((ev) => {
      if (ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) return false;
      if (emailAluno && (ev.attendees || []).some((a) => String(a.email || '').toLowerCase() === emailAluno)) return true;
      const m = String(ev.summary || '').match(/^\s*(\d{3,6})\b/);
      return !!(codigo && m && semZeros(m[1]) === codigo);
    });
    if (!achado) { res.status(200).json({ encontro: null, motivo: 'nenhum evento nos próximos ' + DIAS_A_FRENTE + ' dias com o código ' + (codigo || '(aluno sem código)') + ' no começo do título' }); return; }
    const video = ((achado.conferenceData && achado.conferenceData.entryPoints) || []).find((p) => p.entryPointType === 'video');
    const meet = achado.hangoutLink || (video && video.uri) || null;
    res.status(200).json({ encontro: {
      inicio: achado.start.dateTime, fim: achado.end && achado.end.dateTime || null, fuso: achado.start.timeZone || 'America/Sao_Paulo',
      meet: meet && /^https:\/\//.test(meet) ? meet : null
    } });
  } catch (e) {
    console.error('proximo-encontro:', e.message);
    res.status(200).json({ encontro: null, motivo: 'erro no servidor: ' + e.message });
  }
};
