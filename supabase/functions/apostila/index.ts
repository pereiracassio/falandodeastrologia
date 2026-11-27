// Apostila do curso para o aluno ler no visualizador do site, no próprio Supabase (Edge Function), sem Vercel.
// GET ?id=ARQUIVO_DO_DRIVE   (Authorization: Bearer <login do aluno>)  ->  o PDF, repassado do Drive do administrador. Nada é guardado.
// Só entrega se o login é de um aluno matriculado num curso que tem esse arquivo como apostila de um módulo JÁ LIBERADO para ele.
// Segredo da função (Edge Functions -> Secrets): GOOGLE_SERVICE_ACCOUNT_JSON (o arquivo da conta de serviço do Google). As apostilas precisam estar compartilhadas com o e-mail dessa conta (só ver).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o próprio Supabase já põe. "Verify JWT" fica DESLIGADO (a função confere o login sozinha).

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONTA_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
const ANON = "sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt"; // a mesma chave pública que o site já usa
const ORIGENS = ["https://falandodeastrologia.com.br", "https://www.falandodeastrologia.com.br"];
const ID_OK = /^[\w-]{10,}$/;

async function supa(caminho: string) {
  const resp = await fetch(URL_BASE + caminho, { headers: { apikey: CHAVE, ...(CHAVE.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + CHAVE }) } });
  if (!resp.ok) throw new Error("Supabase " + resp.status);
  return resp.json();
}

// conta de serviço do Google: assina um pedido (JWT RS256) com a chave privada e troca por uma chave de acesso de 1 hora
function lerConta(): { client_email: string; private_key: string } {
  let o: any = null;
  try { o = JSON.parse(CONTA_JSON); } catch (_) { /* colado com quebras de linha: lê na marra */ }
  if (!o || !o.client_email || !o.private_key) {
    const e = /"client_email"\s*:\s*"([^"]+)"/.exec(CONTA_JSON);
    const k = /"private_key"\s*:\s*"([\s\S]*?-----END PRIVATE KEY-----(?:\\n|\n)?)"/.exec(CONTA_JSON);
    if (e && k) o = { client_email: e[1], private_key: k[1] };
  }
  if (!o || !o.client_email || !o.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ausente ou mal colado");
  return { client_email: o.client_email, private_key: String(o.private_key).replace(/\\n/g, "\n") };
}
const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
async function assinarJwt(conta: { client_email: string; private_key: string }) {
  const pem = conta.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const chave = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const enc = new TextEncoder(), agora = Math.floor(Date.now() / 1000);
  const corpo = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))) + "." +
    b64url(enc.encode(JSON.stringify({ iss: conta.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 })));
  return corpo + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, enc.encode(corpo)));
}
let tokenEmMemoria: { valor: string; expira: number } | null = null;
async function tokenDoDrive() {
  if (tokenEmMemoria && tokenEmMemoria.expira - 60000 > Date.now()) return tokenEmMemoria.valor;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await assinarJwt(lerConta()) }),
  });
  const d = await resp.json();
  if (!resp.ok) throw new Error("google: " + (d.error_description || d.error || resp.status));
  tokenEmMemoria = { valor: d.access_token, expira: Date.now() + Number(d.expires_in || 3600) * 1000 };
  return tokenEmMemoria.valor;
}

async function emailDoLogin(jwt: string) {
  const resp = await fetch(URL_BASE + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + jwt } });
  if (!resp.ok) return "";
  const u = await resp.json();
  return String(u.email || "").toLowerCase();
}
// matriculado, e a apostila é de um módulo que já está liberado para ele
async function podeVer(email: string, id: string) {
  if (!email) return false;
  const mods = await supa("/rest/v1/curso_modulos?select=curso_id,ordem&apostila_drive_id=eq." + encodeURIComponent(id));
  if (!mods.length) return false;
  const mats = await supa("/rest/v1/curso_matriculas?select=email,curso_id,modulo_liberado&email=ilike." + encodeURIComponent(email));
  return mods.some((m: any) => mats.some((t: any) => String(t.email).toLowerCase() === email && t.curso_id === m.curso_id && m.ordem <= t.modulo_liberado));
}

Deno.serve(async (req) => {
  const origem = req.headers.get("origin") || "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Length", "Cache-Control": "private, no-store",
    ...(ORIGENS.includes(origem) ? { "Access-Control-Allow-Origin": origem } : {}),
  };
  const json = (corpo: unknown, status: number) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    // ?acao=conferir : diz só se os dois segredos estão certos (nada de dado, ninguém precisa de login para isso)
    if (new URL(req.url).searchParams.get("acao") === "conferir") {
      if (!CONTA_JSON) return json({ ok: false, erro: "falta o segredo GOOGLE_SERVICE_ACCOUNT_JSON" }, 200);
      try { await tokenDoDrive(); } catch (e) { return json({ ok: false, erro: (e as Error).message }, 200); }
      return json({ ok: true, mensagem: "a conta de serviço está certa" }, 200);
    }
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!jwt) return json({ erro: "sem login" }, 401);
    if (!ID_OK.test(id)) return json({ erro: "arquivo inválido" }, 400);
    if (!CONTA_JSON) return json({ erro: "falta o segredo GOOGLE_SERVICE_ACCOUNT_JSON na função" }, 500);
    const email = await emailDoLogin(jwt);
    if (!email) return json({ erro: "sem login" }, 401);
    if (!(await podeVer(email, id))) return json({ erro: "sem acesso" }, 403);
    const token = await tokenDoDrive();
    const meta = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?fields=mimeType&supportsAllDrives=true", { headers: { Authorization: "Bearer " + token } });
    if (!meta.ok) return json({ erro: "drive " + meta.status }, meta.status === 404 ? 404 : 502);
    if ((await meta.json()).mimeType !== "application/pdf") return json({ erro: "não é PDF" }, 415);
    const arq = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?alt=media&supportsAllDrives=true", { headers: { Authorization: "Bearer " + token } });
    if (!arq.ok || !arq.body) return json({ erro: "drive " + arq.status }, 502);
    const cab: Record<string, string> = { ...cors, "Content-Type": "application/pdf" };
    const tam = arq.headers.get("content-length"); if (tam) cab["Content-Length"] = tam;
    return new Response(arq.body, { status: 200, headers: cab });
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
