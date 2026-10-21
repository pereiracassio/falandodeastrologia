/* Cria o acesso (login) no Supabase para um e-mail, já confirmado e sem senha: a pessoa entra depois com o Google (o mesmo Gmail).
   Só o servidor faz isso (chave de serviço). Devolve true se criou e false se o acesso já existia. */
const { supa } = require('./_drive');

async function criarAcesso(email, nome) {
  try {
    await supa('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, email_confirm: true, user_metadata: { nome: nome || '' } }) });
    return true;
  } catch (e) {
    if (/already|registered|exists|duplicate/i.test(String(e.message))) return false;
    throw e;
  }
}
module.exports = { criarAcesso };
