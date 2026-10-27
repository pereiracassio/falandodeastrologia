/* Próximo atendimento do cliente (com o link do Google Meet), para a página Seu espaço.

   O cliente entra com o login do site; aqui o servidor confere quem é (pergunta ao Supabase com o token dele), acha o código do cliente
   e procura na Google Agenda do administrador (a mesma conexão do Drive, escopo calendar.events.readonly) o compromisso futuro cujo
   título começa com esse código ("0158 - Fulano - Serviço", como o Astro Hellenic cria). Devolve SÓ o horário e o link desse compromisso:
   nada de título, descrição ou compromissos de outras pessoas. Variáveis na Vercel: as mesmas do Drive. Sem dependências. */

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

    /* ?cliente=ID: o administrador vendo o atendimento de um cliente (painel e "Ver como cliente") */
    const clienteId = new URL(req.url, 'http://x').searchParams.get('cliente');
    let filtro = 'email=eq.' + encodeURIComponent(email);
    if (clienteId) {
      if (!(await souAdmin(jwt))) { res.status(403).json({ erro: 'só o administrador' }); return; }
      filtro = 'id=eq.' + encodeURIComponent(clienteId);
    }
    const cli = await supa('/rest/v1/clientes?' + filtro + '&select=id');
    if (!cli || !cli[0]) { res.status(200).json({ atendimento: null }); return; }
    const cod = await supa('/rest/v1/cliente_codigos?cliente_id=eq.' + encodeURIComponent(cli[0].id) + '&select=codigo');
    const codigo = semZeros(cod && cod[0] && cod[0].codigo);
    if (!codigo) { res.status(200).json({ atendimento: null }); return; }

    const conexao = await lerConexao();
    if (!conexao) { res.status(200).json({ atendimento: null }); return; }
    const t = await tokenDeAcesso(conexao);
    const agora = new Date();
    /* o "q" do Google casa palavra inteira: "123" não acha "0123 - Fulano". Por isso busca com o código como está na agenda (4 dígitos com zeros) e também sem zeros */
    const itens = [];
    for (const q of [...new Set([codigo.padStart(4, '0'), codigo])]) {
      const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
        timeMin: agora.toISOString(), timeMax: new Date(agora.getTime() + DIAS_A_FRENTE * 86400000).toISOString(),
        singleEvents: 'true', orderBy: 'startTime', maxResults: '250', q,
        fields: 'items(summary,status,start,end,hangoutLink,conferenceData/entryPoints(entryPointType,uri))'
      });
      const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + t.valor } });
      if (!resp.ok) {
        // 403 = a conexão ainda não tem a permissão da agenda (o administrador precisa conectar o Drive de novo): a página simplesmente não mostra o cartão
        console.error('meu-atendimento google:', resp.status);
        res.status(200).json({ atendimento: null });
        return;
      }
      itens.push(...((await resp.json()).items || []));
    }
    itens.sort((a, b) => String(a.start && a.start.dateTime).localeCompare(String(b.start && b.start.dateTime)));
    const achado = itens.find((ev) => {
      if (ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) return false;
      const m = String(ev.summary || '').match(/^\s*(\d{3,6})\b/);
      return m && semZeros(m[1]) === codigo;
    });
    if (!achado) { res.status(200).json({ atendimento: null }); return; }
    const video = ((achado.conferenceData && achado.conferenceData.entryPoints) || []).find((p) => p.entryPointType === 'video');
    const meet = achado.hangoutLink || (video && video.uri) || null;
    /* título "0158 - Fulano - Mapa Natal Clássico": o que vem depois do nome é o serviço */
    const partes = String(achado.summary || '').split(/\s+[-–—]\s+/).map((x) => x.trim()).filter(Boolean);
    const servico = partes.length >= 3 ? partes.slice(2).join(' - ') : null;
    res.status(200).json({ atendimento: {
      servico,
      inicio: achado.start.dateTime, fim: achado.end && achado.end.dateTime || null, fuso: achado.start.timeZone || 'America/Sao_Paulo',
      meet: meet && /^https:\/\//.test(meet) ? meet : null
    } });
  } catch (e) {
    console.error('meu-atendimento:', e.message);
    res.status(200).json({ atendimento: null });
  }
};
