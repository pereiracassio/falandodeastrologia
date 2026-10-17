# Padrão dos estudos (Word/Pages, A4)

Todo estudo novo do astrólogo sai neste padrão: `.docx` A4 editável no Pages (+ PDF de conferência), gerado por `gerar.js`.

**Visual:** Cinzel (títulos, terracota `A03E25`; subtítulos azul `1F5FA3`) e Calibri (texto, azul-noite `16233F`), margens 2,5 cm.
- Página 1: só o título da apostila, centralizado na página (parágrafos vazios acima, nunca espaçamento grande), SEM rodapé e SEM número.
- Página 2: Índice (linha pontilhada + número da página de cada capítulo).
- Do índice em diante: rodapé "Falando de Astrologia Helenística" + número da página (a página 1 é a do título, o índice é a 2). Nunca o título da apostila no rodapé.
- Primeira frase de cada capítulo: negrito, um pouco maior (estilo `Abertura`), nunca gigante.
- Estilos nomeados (Texto, Abertura, Heading 1-3, Índice 1...), tudo editável no Pages. Entregar `.docx` + PDF, uma vez, sem refazer arquivo sem ser pedido.

**Como gerar** (pasta de trabalho com `conteudo.json`):
1. `conteudo.json` = lista de blocos `{k:'h',level:1|2}` (o 1º é o título), `p`, `ul`, `ol`, `table` (ver o parser de exemplo no histórico; runs `{t,b,i,h}`).
2. Fontes Cinzel instaladas (`~/.fonts/Cinzel-*.ttf`, do pacote npm `@fontsource/cinzel`) e Carlito no lugar do Calibri.
3. `node gerar.js x.docx` → converter em PDF (LibreOffice) → `python3 numeros.py x.pdf` (grava `numeros.json` com as páginas dos capítulos) → `node gerar.js final.docx` → PDF de novo e conferir que `numeros.json` não muda.
4. Sempre `lineRule: AUTO` no espaçamento (sem isso o LibreOffice lê "exato" e sobrepõe linhas).
