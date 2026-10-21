/* Cria o acesso (login) no Supabase para um e-mail, já confirmado e sem senha: a pessoa entra depois com o Google (o mesmo Gmail).
   Só o servidor faz isso (chave de serviço). Devolve true se criou e false se o acesso já existia. */
const { SUPABASE_URL, env } = require('./_drive');

async function criarAcesso(email, nome) {
  const chave = env('SUPABASE_SERVICE_ROLE_KEY');
  const resp = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: chave, ...(chave.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + chave }), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { nome: nome || '' } })
  });
  if (resp.ok) return true;
  let d = {}; try { d = await resp.json(); } catch (e) { /* sem corpo */ }
  const texto = String(d.error_code || '') + ' ' + String(d.msg || d.message || d.error_description || d.error || '');
  // o acesso desse e-mail já existe (ex.: a pessoa entrou com o Google quando o cadastro estava aberto): está certo, só falta a ficha
  if (/email_exists|already|registered|exists|duplicate/i.test(texto)) return false;
  throw new Error('Supabase ' + resp.status + (texto.trim() ? ': ' + texto.trim() : ''));
}
module.exports = { criarAcesso };
