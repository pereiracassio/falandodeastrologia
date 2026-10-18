# Notas para trabalhar neste repositório (site Falando de Astrologia)

## Papiro: nunca uma área mais clara ou mais escura que o resto (11/10/2026)

**O site Falando de Astrologia usa o MESMO papiro e as MESMAS regras de papiro do Astro Hellenic** (`papiro.css`, `page.css`; as regras do Astro Hellenic valem aqui). Não é uma regra "só de lá".

O papiro tem uma parte mais clara e outra mais escura **por natureza** (o degradê da folha). Caixas, cartões, campos e opções **nunca** levam
fundo próprio (nada de `rgba(255,250,232,...)`, branco, bege): quebra a experiência de papiro e o astrólogo já pediu isso várias vezes.
**Qualquer caixa/campo/opção no papiro = `background: transparent` + contorno de 1px em azul egípcio `#1F5FA3`.** Seleção = contorno mais grosso
(3px), não fundo. Título em terracota `#A03E25`, texto em azul-noite `#16233F` (ver o fim do `page.css`).

## Google Drive e cliente automático (17/10/2026)

**Servidor na Vercel** (projeto `falandodeastrologia`, `https://falandodeastrologia.vercel.app`; o site em si continua no GitHub Pages). Variáveis em Production: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_CHAVE`. Mexeu em variável = precisa de redeploy.
- `api/drive.js`: conexão PERMANENTE com o Drive do administrador (refresh token cifrado na tabela `drive_conexao`, só a chave de serviço lê). O site pede a chave de 1 hora por `?acao=token`, sem janela do Google. O app do Google precisa ficar **em produção** (em teste o token vence em 7 dias). Peças comuns em `api/_drive.js`.
- `api/novo-cliente.js`: recebe o webhook do Astro Hellenic (Configurações → Captação → URL do webhook, com `?chave=WEBHOOK_CHAVE`) e cria o cliente, o código e a pasta `código - nome` no Drive, compartilhada com o e-mail dele. Só cria o que falta (pode chegar duas vezes).
- Tabelas novas: `aluno_codigos`, `drive_pastas` (`base_clientes`, `base_alunos`, `cliente:<id>`, `aluno:<id>`), `drive_conexao`. **Neste Supabase o `service_role` NÃO tem permissão automática nas tabelas criadas no SQL Editor: sempre rodar `grant ... to service_role`** (foi o erro "permission denied").
- `portal.js`: lista de pastas e arquivos do Drive feita no site (a janela Google Picker travava no iPad: `home.css` tem `body>*{position:relative}`, que quebra janelas soltas no body). Escopo `drive` (completo) de propósito: precisa criar dentro de pasta escolhida e compartilhar. A pasta-mãe é configuração da lista (`cartaoPastaBase`); cada aluno/cliente liga uma pasta existente ou cria uma nova.
- **Código do cliente** nasce no Astro Hellenic (função `registrar_cliente_formulario`): último código da pasta **Clientes** + 1. Já houve bug pegando o máximo de TODAS as pastas (veio 2026); corrigido. Sinastria chega como "0157 A": o servidor usa só "0157".
- Servidor não consegue ser testado de dentro do Claude Code (rede bloqueada): testar com simulação em Node e pedir o teste real ao administrador. Erro 500 do `api/drive` mostra o motivo (`detalhe`) no cartão Google Drive.

## Estudos e apostilas: sempre no padrão `estudo-pages/` (17/10/2026)

Todo estudo novo (Artefatos) sai como `.docx` A4 editável no Pages + PDF, no padrão de `estudo-pages/` (ler o `LEIA-ME.md` e usar `gerar.js`/`numeros.py`).
Regras do astrólogo: página 1 = título centralizado, sem rodapé; índice na página 2; rodapé "Falando de Astrologia Helenística" + número do índice em diante; frase de abertura do capítulo em negrito e não gigante; nunca refazer/mandar arquivo novo sem ele pedir.

## Caderno de estudos do aluno em PDF (18/10/2026)

Botão "Baixar meu caderno" na aba Atividades da página do aluno (`caderno.js`, só aparece se há atividades). O PDF é montado no navegador com jsPDF: capa fixa no código (`capa.js`, opção `aluno` = nome do aluno em azul acima do logo; título "Caderno de Estudos", subtítulo "Acompanhamento Prático de Astrologia", "Mentoria em Astrologia Clássica") + todas as atividades em ordem de data (perguntas, respostas, correções), fundo branco, no visual do documento A4 dos estudos (`estudo-pages/`). A capa NÃO entra na contagem: página 1 = folha de rosto (só o título), página 2 = índice (só o título das atividades, com número de página; duas passadas pra os números saírem certos), atividades depois. Capa e folha de rosto sem rodapé. Fontes em `fonts/` (Cinzel e Carlito, subconjunto latino, licença OFL), baixadas só na hora de gerar. Papiro só na capa (ruim de imprimir nas outras páginas).
