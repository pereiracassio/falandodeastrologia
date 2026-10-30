// Cole este texto no Scriptable (novo script, nome: Agenda). O widget em si fica no site e atualiza sozinho.
const SITE = 'https://falandodeastrologia.com.br';
const fm = FileManager.local();
const caminho = fm.joinPath(fm.cacheDirectory(), 'fda-agenda-widget.js');
let codigo;
try { codigo = await new Request(SITE + '/widget/agenda.js').loadString(); fm.writeString(caminho, codigo); }
catch (e) { if (!fm.fileExists(caminho)) throw e; codigo = fm.readString(caminho); }
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(codigo)();
