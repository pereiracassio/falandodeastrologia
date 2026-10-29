// Avisos no celular (Web Push), no próprio Supabase (Edge Function "avisos"), sem Vercel.
// - GET  ?acao=chave : devolve a chave pública dos avisos (o aparelho precisa dela para se cadastrar; não é segredo).
// - POST {id}        : o banco chama isto quando um aviso é gravado em avisos_recebidos; manda o aviso para os aparelhos de quem recebe.
// Só reenvia se o aviso ainda não foi enviado (push_enviado_em vazio), então chamar duas vezes não repete. O resultado fica em avisos_recebidos.push_resultado.
import webpush from "npm:web-push@3.6.7";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONTATO = "mailto:cassiofalandodeastrologia@gmail.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

async function supa(caminho: string, opcoes: any = {}) {
  const resp = await fetch(URL_BASE + caminho, {
    ...opcoes,
    headers: { apikey: CHAVE, ...(CHAVE.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + CHAVE }), "Content-Type": "application/json", ...(opcoes.headers || {}) },
  });
  const texto = await resp.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new Error("Supabase: " + ((dados && (dados.message || dados.error)) || resp.status));
  return dados;
}

// as chaves são criadas uma vez só, na primeira chamada, e ficam na tabela push_chaves (só a chave de serviço lê)
async function chaves() {
  const ler = () => supa("/rest/v1/push_chaves?id=eq.1&select=publica,privada");
  let l = await ler();
  if (!l || !l[0]) {
    const k = webpush.generateVAPIDKeys();
    await supa("/rest/v1/push_chaves?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, publica: k.publicKey, privada: k.privateKey }) });
    l = await ler();
  }
  return { publica: l[0].publica, privada: l[0].privada };
}

async function enviarAviso(id: string) {
  // "reserva" o aviso: só quem conseguir marcar como enviado manda (evita mandar em dobro)
  const r = await supa("/rest/v1/avisos_recebidos?id=eq." + id + "&push_enviado_em=is.null", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ push_enviado_em: new Date().toISOString() }) });
  if (!r || !r[0]) return { ok: true, motivo: "já enviado ou não existe" };
  const a = r[0];
  const email = String(a.email || "").toLowerCase();
  const naoLidos = ((await supa("/rest/v1/avisos_recebidos?select=id&lido=eq.false&email=eq." + encodeURIComponent(email))) || []).length;
  const aparelhos = (await supa("/rest/v1/push_inscricoes?select=endpoint,p256dh,auth&email=eq." + encodeURIComponent(email))) || [];
  let enviados = 0, removidos = 0, falhas = 0, erro = "";
  if (aparelhos.length) {
    const k = await chaves();
    webpush.setVapidDetails(CONTATO, k.publica, k.privada);
    const carga = JSON.stringify({ title: a.titulo, body: a.corpo, url: a.url, contagem: naoLidos });
    for (const s of aparelhos) {
      try {
        // urgência alta: no Android o aviso normal pode esperar o celular "acordar" e chegar minutos depois
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400, urgency: "high" });
        enviados++;
      } catch (e: any) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { removidos++; await supa("/rest/v1/push_inscricoes?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {}); }
        else { falhas++; erro = String((e && e.statusCode) || "") + " " + String((e && (e.body || e.message)) || "").slice(0, 140); }
      }
    }
  }
  const resultado = aparelhos.length ? enviados + " enviado(s), " + removidos + " removido(s), " + falhas + " falha(s)" + (erro ? ": " + erro : "") : "nenhum aparelho com avisos ativados";
  await supa("/rest/v1/avisos_recebidos?id=eq." + id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ push_resultado: resultado }) });
  return { ok: true, enviados, removidos, falhas, resultado };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    const url = new URL(req.url);
    if (req.method === "GET" && url.searchParams.get("acao") === "chave") return json({ chave: (await chaves()).publica });
    if (req.method === "POST") {
      const corpo = await req.json().catch(() => ({}));
      const id = String(corpo.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ erro: "Aviso inválido." }, 400);
      return json(await enviarAviso(id));
    }
    return json({ erro: "Pedido desconhecido." }, 400);
  } catch (e: any) {
    return json({ erro: "Não foi possível enviar o aviso agora.", detalhe: String((e && e.message) || e) }, 500);
  }
});
