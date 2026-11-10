/* Guarda da tipografia (06/11/2026). Rodar: node verificar-tipografia.js
   A fonte de cada texto é decidida SÓ em tipografia.css (papéis: Cinzel / Architects Daughter maiúscula / Architects Daughter normal).
   Este script falha se achar Cinzel, fonte-titulo ou "Architects" escritos solto numa página ou script que não esteja na lista de exceções.
   Texto novo: use a classe do papel (rotulo-grupo, proj-titulo, rotulo-fixo...), nunca font-family no estilo. */
const fs = require('fs'), path = require('path');
const EXCECOES = {
  'tipografia.css': 'a regra em si',
  'capa.js': 'imagem da capa desenhada em canvas', 'capa.html': 'idem',
  'caderno.js': 'PDF do caderno (jsPDF)', 'caderno-estudos.js': 'PDF do caderno de estudos (jsPDF)',
  'admin-financeiro.html': 'PDF e gráficos SVG do Financeiro',
  'portal.js': 'janelas (alert/confirm/prompt) e sanfona, componentes com CSS próprio',
  'menu.js': 'menu lateral, componente com CSS próprio', 'conversa.js': 'balões das Dúvidas, componente com CSS próprio',
  'admin-producao.html': 'teleprompter e etapas (já cobertos por classe; fonte do prompter)',
  'caderno-financeiro.js': 'PDF e gráficos SVG do Financeiro (cópia)',
  'caderno-agenda.js': 'cópia da Agenda (mesmas exceções)',
  'caderno-producao.js': 'cópia da Produção (mesmas exceções: teleprompter, avisos)',
  'carrinho.html': 'checkout', 'horario-confirmado.html': 'checkout', 'agenda.html': 'agendamento público',
  'privacidade.html': 'política', 'aluno.html': 'link "Tire suas dúvidas"', 'admin-projetos.html': '.proj-grupo (coberto por tipografia.css)',
  'blog.css': 'estilos do blog', 'home.css': 'home', 'page.css': 'estilos de página', 'portal.css': 'estilos do portal',
  'style.css': 'estilos antigos'
};
const ERRO = /Cinzel|fonte-titulo|Architects/;
let achou = 0;
const ign = new Set(['node_modules', '.git', 'fonts', 'docs', 'api', 'estudo-pages', 'widget', 'img']);
(function ler(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f); const st = fs.statSync(p);
    if (st.isDirectory()) { if (!ign.has(f)) ler(p); continue; }
    if (!/\.(html|js)$/.test(f) || f === 'verificar-tipografia.js' || EXCECOES[f]) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (/fonts\.googleapis|Importação da fonte/.test(l)) return;
      if (ERRO.test(l)) { achou++; console.log(p + ':' + (i + 1) + '  ' + l.trim().slice(0, 140)); }
    });
  }
})('.');
console.log(achou ? '\n' + achou + ' lugar(es) com fonte solta. Use a classe do papel em tipografia.css.' : 'Tipografia OK: nenhuma fonte solta.');
process.exit(achou ? 1 : 0);
