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

## Blog do site (19/10/2026)

Substitui o Blogger (`blog.falandodeastrologia.com.br`, aposentado; as 3 postagens boas foram refeitas aqui e o Blogger redireciona por `<script>location.replace(...)</script>` no HTML de cada postagem antiga).

**Como funciona (leia antes de mexer):**
- Postagens na tabela `blog_posts` do Supabase (`slug`, `titulo`, `assunto`, `resumo`, `corpo`, `imagem_url`, `video_url`, `publicado`, `publicado_em`...). Leitura pública só das publicadas; escrita só `sou_admin()`. Imagens no bucket `site` (`blog-<timestamp>.jpg`).
- Painel: `admin-blog.html` (botão **Blog** no `navAdmin`, `portal.js`). O astrólogo só digita título, assunto, resumo (opcional), imagem, texto e link do YouTube. **Texto = parágrafos separados por linha em branco; `## ` no começo da linha = subtítulo** (botão "Subtítulo"). Nada digitado vira HTML (sempre `textContent`/`esc`).
- Páginas **estáticas** geradas por `api/blog-publicar.js` + `api/_blog.js` (Vercel): `blog/<slug>.html` por postagem, `assunto/<slug>.html` por assunto, `sitemap.xml` e `robots.txt`, num ÚNICO commit na `main` via API do GitHub (`GITHUB_TOKEN` na Vercel, token fine-grained só com Contents: Read and write neste repositório, sem expiração). Só o administrador chama (valida o login com `sou_admin`). Páginas de postagem despublicada/excluída saem sozinhas. Se nada mudou, não faz commit.
- Por que estático e não só `postagem.html?p=`: Google lê melhor, e o servidor da Vercel está em outro domínio (`vercel.app`), então as páginas TÊM de morar no GitHub Pages (`falandodeastrologia.com.br`). `blog.html` (lista de assuntos) e `postagem.html` (leitor direto do Supabase) são dinâmicos; `blog.js` é a parte comum (`PAGINAS_PROPRIAS = true`).
- `404.html`: se `/blog/<slug>.html` ainda não existe (postagem nova antes de atualizar as páginas), redireciona para `postagem.html?p=<slug>`.
- Fim de cada postagem: vídeo do YouTube (toca ali e tem link "Assistir no YouTube"; conta como visualização), Instagram e TikTok (mesmos ícones da home, **sem WhatsApp**), botões Serviços e Mentoria (`FIM_HTML` em `api/_blog.js`).
- Um assunto por postagem (decisão do astrólogo). O mesmo nome com grafia diferente (maiúscula/acento) vira o mesmo assunto (`slugDe`).

**Armadilhas já vividas — não repetir:**
1. **Salvar NÃO pode republicar o site.** Cada commit na `main` faz o GitHub Pages republicar tudo, e durante isso (e com muitas publicações na mesma hora, o GitHub limita e atrasa) o site dá **404 em tudo menos na home**. Aconteceu duas vezes em 19/10. Por isso a geração das páginas é só no botão **Atualizar as páginas do blog**, tocado UMA vez ao terminar. Nunca ligar isso de novo a cada salvamento, e nunca mandar várias publicações seguidas.
2. Não refazer ("re-run") uma publicação antiga do Pages: a refeita ficou parada na fila e pode publicar uma versão velha por cima da nova.
3. Mexeu em `blog.css`/`blog.js`: bumpar o `?v=` em `blog.html`, `postagem.html`, `404.html` e em `api/_blog.js` (as páginas geradas usam `blog.css?v=N`) e pedir ao astrólogo para tocar em "Atualizar as páginas do blog" (as páginas já geradas guardam o `?v=` antigo). Depois de publicar, o navegador pode mostrar a versão guardada: testar em aba anônima.
4. O token do GitHub nunca vai para a conversa nem para o repositório; o formulário do GitHub no iPad trava com data de expiração "Custom" muito distante — usar "No expiration".
5. Datas do Supabase vêm como timestamp completo: usar `.slice(0, 10)` antes de `P.dataBR`.
6. Google Search Console: o site `falandodeastrologia.com.br` já foi adicionado (propriedade de domínio, verificada automaticamente) e o `https://falandodeastrologia.com.br/sitemap.xml` foi enviado (precisa do endereço inteiro). Postagem nova entra no mapa sozinha quando as páginas são atualizadas.

## Estética única do site: tudo igual, nada de Frankenstein (21/10/2026)

O astrólogo reclamou várias vezes: cada lugar do site ficava de um jeito. **É uma experiência só. Antes de mexer ou criar qualquer peça, conferir contra esta lista.**
- **Todo papiro leva moldura com meandro em cima e embaixo** (`papiro-moldura` ou `folha-pagina`, em `papiro.css`): páginas, a barra do topo, cartões de assunto/texto, banners. Papiro sem moldura = erro.
- **Céu só na home, na home do blog e nas páginas de assunto.** Todo o resto (serviços, mentoria, Quem sou eu, textos do blog) é papiro inteiro, sem céu, sem borda rasgada, sem cabeçalho escuro (`pagina-papiro`, `page.css`).
- **Cabeçalho das páginas de papiro:** logo do menu lateral (`img/logo-menu.svg`) + retângulo de três botões (Alunos, Serviços, Blog) + linha azul, tudo dentro do papiro. Nas homes: logo grande + barra de papiro (botões, redes, frase de boas-vindas). **Os botões são sempre esses três, na mesma ordem**; o da página onde a pessoa está fica ocre.
- **Nada de canto arredondado** (retângulos, botões, imagens, vídeos). Retângulos de botão: só contorno azul egípcio (`#1034A6`), sem fundo, texto terracota.
- **Menu lateral e carrinho** nas páginas de papiro: peças pequenas, só contorno, **dentro da moldura**, sem ficar em cima dela nem do texto; o texto tem margem para eles.
- **Texto justificado**, subtítulos terracota **sem linha embaixo** (igual ao blog). No computador a coluna do texto vai de ponta a ponta e a letra cresce com a tela (mesma proporção do celular); nada de coluna estreita no meio.
- **Nomes:** "Alunos" (antes Portal do Aluno / Área do Aluno) e "Pós-atendimento" (antes Área do Cliente; nos avisos, escrever "na página de Pós-atendimento do site", porque só o nome não explica que é um lugar). O nome "Blog" não aparece como título na home do blog.
- **Linguagem acolhedora**, sem "diagnóstico", sem travessão, sem tom de exigência. PDFs entregues junto com a gravação são sempre só material técnico, **sem interpretação** (a interpretação é a consulta gravada).
- Publicar na `main` só quando ele pedir. Mexeu em `blog.css`/`blog.js`/`api/_blog.js`: bumpar `?v=` e pedir para tocar em "Atualizar as páginas do blog" **uma vez** (as páginas geradas guardam o cabeçalho antigo).
- **Mostrar com imagem, não com artefato nem descrição:** ele quer ver o resultado (print do Playwright pelo `SendUserFile`) e não gosta de texto que descreve o que a imagem já mostra. Ainda não tratado nesse padrão: a página de Alunos (`aluno.html`) e o Pós-atendimento (`cliente.html`).

## Acesso do aluno: criado pelo painel, nunca pelo aluno (21/10/2026)
A tela Alunos (`aluno.html`) **não tem e não pode ter lugar para criar conta** (só entrar: Google, e-mail e senha, "Esqueci minha senha"). Quem cria o acesso é o astrólogo, em `admin-alunos.html` → Novo aluno → Adicionar: o painel chama `api/criar-acesso.js` (Vercel, só `sou_admin`, usa `SUPABASE_SERVICE_ROLE_KEY`, cria o usuário já confirmado, sem senha) e depois grava a ficha em `alunos`. Nunca mais mandar o astrólogo criar usuário no Supabase à mão. Servidor não se testa daqui: foi simulado em Node; o teste real é dele.
- **Nunca cortar palavra com hífen** (`hyphens:none` nas páginas de papiro) e **botão sempre numa linha só** (a letra diminui para caber, `white-space:nowrap`). Dúvida no WhatsApp = frase em azul-noite + só o ícone da home, nunca botão verde. Investimento e avisos soltos no papiro: nada de quadro dentro de quadro.

## Botões do site: regra única (21/10/2026) — vale para TODA página nova
- **Botão importante** (Adicionar ao Carrinho, Ir para o Pagamento, Entrar, Enviar aplicação, Serviços/Mentoria no fim do texto...): **preenchido de terracota `#A03E25`, texto no tom claro do papiro `#F3E3B8`, canto reto** (hover `#7d2f1a`). O texto claro faz o "vazado"; se ficar ruim de ler, usar branco. Tudo em `page.css` (`.pagina-papiro`) e `carrinho.html`.
- **Botão secundário** (Voltar, Sair, Cancelar, Trocar senha): só contorno azul egípcio `#1034A6`, sem fundo, canto reto.
- **WhatsApp é SEMPRE o ícone da home** (`img/rede-whatsapp.svg`, classe `.icone-whats`), com no máximo uma frase em azul-noite em cima ("Se tiver alguma dúvida, pode chamar no WhatsApp."). **Nunca** botão ou quadradinho escrito "Falar no WhatsApp".
- **Exceções por cor de marca, sempre de canto reto:** "Entrar no encontro (Google Meet)" é OCRE (`.portal-btn-meet`, cor do Meet) e os botões de AVISAR no WhatsApp dentro do portal (aluno avisa o Cássio, Cássio avisa o aluno, aplicação enviada) são VERDES (`.portal-btn-whats`). Não são "botões importantes" e **nunca** viram terracota.
- Botão sempre numa linha só; nunca hífen cortando palavra; nunca canto arredondado; nunca quadro dentro de quadro.
- **Pouco vermelho:** terracota só nos botões realmente importantes (carrinho, pagamento, entrar, enviar). Abas do portal em azul, **a selecionada em ocre**. Botões dentro de listas (Assistir, Abrir, Baixar) são secundários (contorno azul).
