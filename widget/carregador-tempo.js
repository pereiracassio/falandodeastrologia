// Cole este texto no Scriptable (novo script, nome: Horas e Tempo). O widget em si fica no site e atualiza sozinho.
const SITE = 'https://falandodeastrologia.com.br';
const fm = FileManager.local();
const caminho = fm.joinPath(fm.cacheDirectory(), 'fda-tempo-widget.js');
let codigo;
try { codigo = await new Request(SITE + '/widget/tempo.js').loadString(); fm.writeString(caminho, codigo); }
catch (e) { if (!fm.fileExists(caminho)) throw e; codigo = fm.readString(caminho); }
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(codigo)();
