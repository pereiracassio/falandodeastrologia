// Apostila do curso para o aluno ler no visualizador do site, no próprio Supabase (Edge Function), sem Vercel.
// GET ?id=ARQUIVO_DO_DRIVE   (Authorization: Bearer <login do aluno>)  ->  o PDF, repassado do Drive do administrador. Nada é guardado.
// Só entrega se o login é de um aluno matriculado num curso que tem esse arquivo como apostila de um módulo JÁ LIBERADO para ele.
// Segredos da função (Edge Functions -> Secrets): GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (os mesmos da conexão do Drive; o segredo também abre o token guardado).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o próprio Supabase já põe. "Verify JWT" fica DESLIGADO (a função confere o login sozinha).

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const ANON = "sb_publishable_p9Un5Po0_3kriGmSwOXIFQ_K8BCMLtt"; // a mesma chave pública que o site já usa
const ORIGENS = ["https://falandodeastrologia.com.br", "https://www.falandodeastrologia.com.br"];
const ID_OK = /^[\w-]{10,}$/;

async function supa(caminho: string) {
  const resp = await fetch(URL_BASE + caminho, { headers: { apikey: CHAVE, ...(CHAVE.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + CHAVE }) } });
  if (!resp.ok) throw new Error("Supabase " + resp.status);
  return resp.json();
}

// o token do Drive fica cifrado em drive_conexao (AES-256-GCM, chave = sha256 de 'falandodeastrologia-drive|' + segredo do cliente Google)
async function decifrar(base64: string) {
  const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const chaveBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("falandodeastrologia-drive|" + CLIENT_SECRET));
  const chave = await crypto.subtle.importKey("raw", chaveBytes, "AES-GCM", false, ["decrypt"]);
  const cifrado = new Uint8Array(buf.length - 12);
  cifrado.set(buf.subarray(28), 0); cifrado.set(buf.subarray(12, 28), buf.length - 28); // o WebCrypto espera o texto cifrado seguido da etiqueta
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12), tagLength: 128 }, chave, cifrado);
  return new TextDecoder().decode(claro);
}
let tokenEmMemoria: { valor: string; expira: number } | null = null;
async function tokenDoDrive() {
  if (tokenEmMemoria && tokenEmMemoria.expira - 60000 > Date.now()) return tokenEmMemoria.valor;
  const l = await supa("/rest/v1/drive_conexao?id=eq.1&select=refresh_token_cifrado");
  if (!l || !l[0]) throw new Error("drive desconectado");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "refresh_token", refresh_token: await decifrar(l[0].refresh_token_cifrado) }),
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
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!jwt) return json({ erro: "sem login" }, 401);
    if (!ID_OK.test(id)) return json({ erro: "arquivo inválido" }, 400);
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ erro: "faltam os segredos GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na função" }, 500);
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
