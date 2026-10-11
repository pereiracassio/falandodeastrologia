# Notas para trabalhar neste repositório (site Falando de Astrologia)

## Papiro: nunca uma área mais clara ou mais escura que o resto (11/10/2026)

O papiro tem uma parte mais clara e outra mais escura **por natureza** (o degradê da folha). Caixas, cartões, campos e opções **nunca** levam
fundo próprio (nada de `rgba(255,250,232,...)`, branco, bege): quebra a experiência de papiro e o astrólogo já pediu isso várias vezes.
**Qualquer caixa/campo/opção no papiro = `background: transparent` + contorno de 1px em azul egípcio `#1F5FA3`.** Seleção = contorno mais grosso
(3px), não fundo. Título em terracota `#A03E25`, texto em azul-noite `#16233F` (ver o fim do `page.css`).
