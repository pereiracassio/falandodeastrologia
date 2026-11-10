/* ESTUDOS do CADERNO (admin-caderno.html): o código COMPLETO da tela de Estudos (admin-estudos.html), encaixado nas duas páginas do caderno.
   Primeira página: as próximas aulas à esquerda e os estudos à direita. Um estudo: nome, barras, datas, apostila, importar aulas, estudo menor, mover, caderno em PDF,
   enviar resultado, encerrar e apagar à esquerda; as aulas à direita. Uma aula: a explicação à esquerda e as questões (com o quadro da conta, a correção na hora, a
   resolução e o "por que errei") à direita. CÓPIA da tela de antes: mexeu lá, mexa aqui (ou una as duas). */
window.EstudosCaderno = function (ctx) {
    var P = ctx.P, el = P.el, C = ctx.C, app = ctx.app; function noop() {}
    var nomeAdmin = '', nomeCurto = '';
    if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    function limpar() { app.textContent = ''; }
    function hojeISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function diaCurto(iso) { var p = String(iso).slice(0, 10).split('-'); return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1]; }

    function textoFormatado(txt) {
      var caixa = el('div'), atual = [];
      var fechar = function () {
        if (!atual.length) return;
        var p = el('p', { text: atual.join('\n') }); p.style.cssText = 'white-space:pre-line;margin:0 0 10px'; caixa.appendChild(p); atual = [];
      };
      String(txt || '').split('\n').forEach(function (linha) {
        if (/^##\s+/.test(linha)) {
          fechar();
          var h = el('h3', { text: linha.replace(/^##\s+/, '') }); h.style.cssText = 'color:var(--terracota);margin:18px 0 6px'; caixa.appendChild(h);
        } else if (!linha.trim()) fechar();
        else atual.push(linha);
      });
      fechar();
      return caixa;
    }
    function botaoOpcao(texto, marcada, aoClicar) {
      var b = el('button', { type: 'button', text: texto, 'aria-pressed': marcada ? 'true' : 'false' });
      b.style.cssText = 'display:block;width:100%;text-align:left;background:transparent;color:var(--preto-tinta);font:inherit;font-size:16px;cursor:pointer;border-radius:0;margin:0 0 8px;' +
        (marcada ? 'border:3px solid var(--azul-egipcio-claro);padding:10px 12px' : 'border:1px solid var(--azul-egipcio-claro);padding:12px');
      if (aoClicar) b.addEventListener('click', aoClicar); else b.style.cursor = 'default';
      return b;
    }

    /* ---------- estudos: cada um tem as suas aulas, a barra de progresso da semana e, se tiver data final, a barra do tempo ---------- */
    var estudos = [], aberto = null, verEncerrado = null; /* aberto = id do estudo ativo na tela, ou 'encerrados' */
    function corDoTempo(f) { /* azul no começo, ocre na metade, terracota no fim (a mesma dos Projetos e da Produção) */
      var A = [31, 95, 163], O = [181, 133, 47], T = [160, 62, 37];
      var de = f < 0.5 ? A : O, para = f < 0.5 ? O : T, t = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5;
      return 'rgb(' + de.map(function (c, k) { return Math.round(c + (para[k] - c) * t); }).join(',') + ')';
    }
    /* estudo dentro de estudo: o grande soma as aulas dos menores (e dos menores dos menores) */
    function filhosDe(id) { return estudos.filter(function (e) { return e.estudo_pai_id === id; }); }
    function arvoreDe(e) { var r = [e]; filhosDe(e.id).forEach(function (f) { r = r.concat(arvoreDe(f)); }); return r; }
    function raizDe(id) { var q = estudos.filter(function (x) { return x.id === id; })[0]; while (q && q.estudo_pai_id) { var pai = q.estudo_pai_id; q = estudos.filter(function (x) { return x.id === pai; })[0]; } return q; }
    function carregarEstudos() {
      return C.from('estudos').select('*').order('criado_em').then(function (r) {
        if (r.error) return r.error;
        estudos = r.data || []; return null;
      });
    }
    function novoEstudo() {
      var nome = (prompt('Nome do estudo') || '').trim();
      if (!nome) return;
      C.from('estudos').insert({ nome: nome, data_inicio: hojeISO(), por_semana: false }).select('id').then(function (r) {
        if (r.error || !r.data || !r.data[0]) { alert('Não foi possível criar (já existe um estudo com esse nome?).'); return; }
        aberto = r.data[0].id; verEncerrado = null; carregarEstudos().then(function () { ctx.entrar(desenhar); });
      });
    }

    /* ---------- as duas páginas: (próximas aulas · estudos) → (o estudo · as aulas dele) → (a aula · as questões dela) ---------- */
    function lista(aviso) { /* atualiza no lugar (depois de salvar, importar, encerrar...) */
      if (typeof aviso !== 'string') aviso = '';
      return carregarEstudos().then(function (erro) {
        if (erro) { ctx.esq.textContent = ''; ctx.esq.appendChild(el('p', { class: 'portal-msg erro', text: P.traduzErro(erro.message) })); return; }
        return desenhar(aviso);
      });
    }
    function desenhar(aviso) {
      if (typeof aviso !== 'string') aviso = '';
      if (aulaAberta) return desenharAula();
      var esq = ctx.esq, dir = ctx.dir; esq.textContent = ''; dir.textContent = '';
      var raizes = estudos.filter(function (e) { return !e.estudo_pai_id; }), ativos = raizes.filter(function (e) { return !e.encerrado; }), enc = raizes.filter(function (e) { return e.encerrado; });
      var rzAberto = aberto && aberto !== 'encerrados' ? raizDe(aberto) : null;
      if (aberto && aberto !== 'encerrados' && !rzAberto) aberto = null;
      if (verEncerrado && !(raizDe(verEncerrado) && raizDe(verEncerrado).encerrado)) verEncerrado = null;
      if (aviso) { var av = el('p', { class: 'portal-msg' }); esq.appendChild(av); P.mensagem(av, aviso, 'ok'); }
      var oculto = el('div');
      function partir(est, encerrado) {
        ctx.rotulos('estudo', 'aulas');
        if (!est.estudo_pai_id) esq.appendChild(P.botaoVoltar(function () { if (ctx.voltar()) return; if (encerrado) { verEncerrado = null; } else aberto = null; desenhar(); }));
        return mostrarEstudo(est, oculto, encerrado).then(function () { [].slice.call(oculto.children).forEach(function (f) { (f.getAttribute && f.getAttribute('data-lado') === 'd' ? dir : esq).appendChild(f); }); });
      }
      if (aberto === 'encerrados' && verEncerrado) return partir(estudos.filter(function (e) { return e.id === verEncerrado; })[0], true);
      if (aberto && aberto !== 'encerrados') return partir(estudos.filter(function (e) { return e.id === aberto; })[0], false);
      if (aberto === 'encerrados') {
        ctx.rotulos('encerrados', 'estudos'); esq.appendChild(P.botaoVoltar(function () { if (ctx.voltar()) return; aberto = null; desenhar(); }));
        var cx = el('div', { class: 'portal-cartao' }); dir.appendChild(cx);
        enc.forEach(function (e) {
          var l = el('div', { class: 'portal-item', role: 'button', tabindex: '0' }, [el('div', {}, [el('strong', { class: 'portal-item-titulo', text: e.nome }), el('div', { class: 'portal-item-data', text: P.dataBR(e.data_inicio) + (e.encerrado_em ? ' a ' + P.dataBR(e.encerrado_em) : '') })])]);
          l.style.cssText = 'padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--azul-egipcio-claro,#1F5FA3) 70%,transparent);cursor:pointer';
          l.addEventListener('click', function () { verEncerrado = e.id; ctx.entrar(desenhar); }); cx.appendChild(l);
        });
        return;
      }
      /* primeira página: as próximas aulas de todos os estudos abertos (esquerda) e a lista dos estudos (direita) */
      ctx.rotulos('próximas', 'estudos');
      esq.appendChild(el('p', { class: 'proj-grupo', text: 'Próximas aulas' }));
      var abertos = {}; ativos.forEach(function (e) { arvoreDe(e).forEach(function (x) { abertos[x.id] = true; }); });
      var novo = el('button', { type: 'button', class: 'portal-btn', text: '+ Novo estudo' }); novo.addEventListener('click', novoEstudo);
      dir.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 12px' }, [novo]));
      var lc = el('div', { class: 'portal-cartao' }); dir.appendChild(lc);
      if (!ativos.length) lc.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhum estudo ainda.' }));
      Promise.all([C.from('estudo_aulas').select('id,estudo_id,data,materia,titulo').order('data'), C.from('estudo_questoes').select('id,aula_id,tipo,correta'), C.from('estudo_respostas').select('questao_id,opcao,texto')]).then(function (rs) {
        var resp = {}, prog = {}; (rs[2].data || []).forEach(function (x) { resp[x.questao_id] = x; });
        (rs[1].data || []).forEach(function (q) { var p = prog[q.aula_id] = prog[q.aula_id] || { total: 0, feitas: 0 }, r = resp[q.id]; p.total++; if (q.tipo === 'multipla' ? (r && r.opcao != null) : (r && r.texto)) p.feitas++; });
        var todasAulas = rs[0].data || [], concl = function (a) { var p = prog[a.id]; return !!p && p.total > 0 && p.feitas === p.total; };
        var prox = todasAulas.filter(function (a) { return abertos[a.estudo_id] && !concl(a); }).slice(0, 12);
        if (!prox.length) esq.appendChild(el('p', { class: 'portal-vazio', text: 'Nenhuma aula para fazer.' }));
        prox.forEach(function (a) {
          var dono = estudos.filter(function (e) { return e.id === a.estudo_id; })[0], p = prog[a.id] || { total: 0, feitas: 0 };
          var l = el('div', { class: 'portal-item', role: 'button', tabindex: '0' }, [el('div', {}, [el('strong', { class: 'portal-item-titulo', text: a.titulo }), el('div', { class: 'portal-item-data', text: diaCurto(a.data) + ' · ' + a.materia + ' · ' + (p.total ? p.feitas + ' de ' + p.total + ' respondidas' : 'sem questões') + (dono ? ' · ' + dono.nome : '') })])]);
          l.style.cssText = 'padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--azul-egipcio-claro,#1F5FA3) 70%,transparent);cursor:pointer';
          l.addEventListener('click', function () { aberto = a.estudo_id; aula(a.id); }); esq.appendChild(l);
        });
        var cont = function (e) { var ids = {}; arvoreDe(e).forEach(function (x) { ids[x.id] = true; }); var l = todasAulas.filter(function (a) { return ids[a.estudo_id]; }); return { total: l.length, ok: l.filter(concl).length }; };
        function linhaEstudo(e) {
          var c = cont(e), l = el('div', { class: 'portal-item', role: 'button', tabindex: '0' }, [el('strong', { class: 'portal-item-titulo', text: e.nome }), P.barraLinha(c.total ? Math.floor(c.ok * 100 / c.total) : 0, null, c.ok + '/' + c.total)]);
          if (e.data_fim) { var tm = P.barraTempoDias(e.data_inicio, e.data_fim); if (tm) l.appendChild(tm); }
          l.style.cssText = 'padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--azul-egipcio-claro,#1F5FA3) 70%,transparent);cursor:pointer';
          l.addEventListener('click', function () { aberto = e.id; ctx.entrar(desenhar); }); return l;
        }
        ativos.forEach(function (e) { lc.appendChild(linhaEstudo(e)); });
        if (enc.length) { var ve = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', style: 'margin-top:14px', text: 'Encerrados (' + enc.length + ')' }); ve.addEventListener('click', function () { aberto = 'encerrados'; ctx.entrar(desenhar); }); dir.appendChild(ve); }
      });
    }

    /* o estudo aberto: nome, barra da semana, barra do tempo (se tiver data final), datas, aulas e os botões do fim */
    /* ---------- apostila do estudo: PDF do Drive, aberto no leitor (as marcações e a página ficam em leitor_livros, as mesmas da aba Leitor) ---------- */
    function abrirApostila(est, aviso) {
      C.from('leitor_livros').upsert({ drive_id: est.apostila_drive_id, nome: est.apostila_nome || 'Apostila' }, { onConflict: 'drive_id' }).select().single().then(function (x) {
        if (x.error) { P.mensagem(aviso, P.traduzErro(x.error.message), 'erro'); return; }
        var livro = x.data;
        Leitor.abrir({
          nome: livro.nome,
          pagina: livro.pagina || 1,
          voltar: function () {},
          obterPdf: function (progresso) {
            return P.tokenGoogle().then(function (token) {
              return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(livro.drive_id) + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
            }).then(function (r) {
              if (!r.ok) throw new Error(r.status === 404 ? 'sumiu' : 'drive');
              var total = Number(r.headers.get('Content-Length')) || 0;
              if (!r.body || !r.body.getReader) return r.arrayBuffer();
              var leitor = r.body.getReader(), partes = [], lido = 0;
              return (function passo() {
                return leitor.read().then(function (y) {
                  if (y.done) { var tudo = new Uint8Array(lido), o = 0; partes.forEach(function (p) { tudo.set(p, o); o += p.length; }); return tudo.buffer; }
                  partes.push(y.value); lido += y.value.length;
                  progresso(total ? Math.round(lido / total * 100) + '%' : Math.round(lido / 1048576) + ' MB');
                  return passo();
                });
              })();
            });
          },
          carregarTracos: function (pg) {
            return C.from('leitor_tracos').select('tracos').eq('livro_id', livro.id).eq('pagina', pg).maybeSingle().then(function (r) { return r.data ? (r.data.tracos || []) : null; });
          },
          salvarTracos: function (pg, tracos) {
            var q = tracos.length
              ? C.from('leitor_tracos').upsert({ livro_id: livro.id, pagina: pg, tracos: tracos, atualizado_em: new Date().toISOString() }, { onConflict: 'livro_id,pagina' })
              : C.from('leitor_tracos').delete().eq('livro_id', livro.id).eq('pagina', pg);
            return q.then(function (r) { if (r.error) throw r.error; });
          },
          salvarPagina: function (pg, total) {
            C.from('leitor_livros').update({ pagina: pg, total: total, atualizado_em: new Date().toISOString() }).eq('id', livro.id).then(function () {});
          }
        });
      });
    }
    /* a pasta "Estudos" no Drive: na primeira vez acha (ou cria) e guarda em drive_pastas ('base_estudos'); depois o seletor já abre dentro dela */
    function garantirPastaEstudos() {
      return C.from('drive_pastas').select('pasta_id').eq('chave', 'base_estudos').maybeSingle().then(function (r) {
        if (r.data && r.data.pasta_id) return r.data.pasta_id;
        return P.tokenGoogle().then(function (token) {
          var cab = { 'Authorization': 'Bearer ' + token };
          var q = "name='Estudos' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false";
          return fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true', { headers: cab })
            .then(function (x) { return x.ok ? x.json() : { files: [] }; })
            .then(function (j) {
              if (j.files && j.files[0]) return j.files[0].id;
              return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Estudos', mimeType: 'application/vnd.google-apps.folder' }) })
                .then(function (x) { if (!x.ok) throw new Error('criar'); return x.json(); }).then(function (p) { return p.id; });
            });
        }).then(function (id) {
          return C.from('drive_pastas').upsert({ chave: 'base_estudos', pasta_id: id }, { onConflict: 'chave' }).then(function () { return id; });
        });
      });
    }
    function linhaApostila(est, encerrado) {
      var caixa = el('div', { style: 'display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:10px 0 4px' });
      var aviso = el('p', { class: 'portal-msg', style: 'margin:0' });
      var desenhar = function () {
        caixa.textContent = '';
        caixa.appendChild(el('span', { class: 'rotulo-fixo', text: 'Apostila' }));
        var mini = function (t, aoClicar) { var b = el('button', { type: 'button', class: 'proj-mini botao-fixo', text: t }); b.style.cssText = 'background:transparent;border:0;padding:2px 4px;font-size:13px;color:var(--preto-tinta);opacity:.6;cursor:pointer;text-decoration:underline'; b.addEventListener('click', aoClicar); return b; };
        var escolher = function () {
          garantirPastaEstudos().catch(function () { return null; }).then(function () { P.escolherDoDrive(function (url, id, token) {
            if (/\/folders\//.test(url)) { P.mensagem(aviso, 'Escolha um arquivo PDF, não uma pasta.', 'erro'); return; }
            fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=name,mimeType&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } })
              .then(function (r) { if (!r.ok) throw new Error('drive'); return r.json(); })
              .then(function (f) {
                if (f.mimeType !== 'application/pdf') { P.mensagem(aviso, 'Esse arquivo não é um PDF.', 'erro'); return; }
                var nome = String(f.name).replace(/\.pdf$/i, '');
                return C.from('estudos').update({ apostila_drive_id: id, apostila_nome: nome }).eq('id', est.id).then(function (r) {
                  if (r.error) throw r.error;
                  est.apostila_drive_id = id; est.apostila_nome = nome; aviso.textContent = ''; desenhar();
                });
              }).catch(function (e) { P.mensagem(aviso, e && e.message === 'drive' ? 'Não consegui ler esse arquivo no Drive.' : P.traduzErro((e && e.message) || ''), 'erro'); });
          }, function (t) { P.mensagem(aviso, t, 'erro'); }, false, 'base_estudos'); });
        };
        if (est.apostila_drive_id) {
          var abrir = el('button', { type: 'button', class: 'prod-titulo', text: est.apostila_nome || 'Apostila' });
          abrir.style.cssText = 'background:transparent;border:0;padding:0;margin:0;font:inherit;font-size:17px;color:var(--terracota);cursor:pointer;text-align:left;text-decoration:underline';
          abrir.addEventListener('click', function () { abrirApostila(est, aviso); });
          caixa.appendChild(abrir);
          if (!encerrado) {
            caixa.appendChild(mini('Trocar', escolher));
            var tirar = P.botaoApagar('Tirar');
            tirar.addEventListener('click', function () {
              C.from('estudos').update({ apostila_drive_id: null, apostila_nome: null }).eq('id', est.id).then(function (r) {
                if (r.error) { P.mensagem(aviso, P.traduzErro(r.error.message), 'erro'); return; }
                est.apostila_drive_id = null; est.apostila_nome = null; desenhar();
              });
            });
            caixa.appendChild(tirar);
          }
        } else if (!encerrado) caixa.appendChild(mini('Escolher no Drive', escolher));
        caixa.appendChild(aviso);
      };
      desenhar();
      return caixa;
    }

    function mostrarEstudo(est, corpo, encerrado) {
      corpo.appendChild(el('p', { class: 'portal-vazio', text: 'Carregando...' }));
      var arv = arvoreDe(est).map(function (x) { return x.id; });
      return Promise.all([
        C.from('estudo_aulas').select('id,estudo_id,data,materia,titulo').in('estudo_id', arv).order('data').order('criado_em'),
        C.from('estudo_questoes').select('id,aula_id,tipo,correta'),
        C.from('estudo_respostas').select('questao_id,opcao,texto')
      ]).then(function (rs) {
        corpo.textContent = '';
        var erro = rs[0].error || rs[1].error || rs[2].error;
        if (erro) { corpo.appendChild(el('p', { class: 'portal-msg erro', text: P.traduzErro(erro.message) })); return; }
        var todas = rs[0].data || [], aulas = todas.filter(function (a) { return a.estudo_id === est.id; }), resp = {}, ids = {};
        var tudo = todas;
        todas.forEach(function (a) { ids[a.id] = true; });
        (rs[2].data || []).forEach(function (x) { resp[x.questao_id] = x; });
        var prog = {};
        (rs[1].data || []).forEach(function (q) {
          if (!ids[q.aula_id]) return;
          var p = prog[q.aula_id] = prog[q.aula_id] || { total: 0, feitas: 0, certas: 0, multiplas: 0 };
          var r = resp[q.id]; p.total++;
          if (q.tipo === 'multipla') { p.multiplas++; if (r && r.opcao != null) { p.feitas++; if (r.opcao === q.correta) p.certas++; } }
          else if (r && r.texto) p.feitas++;
        });
        var hoje = hojeISO();
        var linhaDe = function (a) {
          var p = prog[a.id] || { total: 0, feitas: 0, certas: 0, multiplas: 0 };
          var info = p.total ? p.feitas + ' de ' + p.total + ' respondidas' + (p.multiplas ? ' · ' + p.certas + ' certas' : '') : 'sem questões';
          /* a linha inteira abre a aula: nada de botão no canto */
          var l = el('div', { class: 'portal-item', role: 'button', tabindex: '0' }, [
            el('div', {}, [el('strong', { class: 'portal-item-titulo', text: a.titulo }), el('div', { class: 'portal-item-data', text: diaCurto(a.data) + ' · ' + a.materia + ' · ' + info })])]);
          l.style.cssText = 'padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--azul-egipcio-claro,#1F5FA3) 70%,transparent);cursor:pointer;-webkit-tap-highlight-color:transparent';
          l.addEventListener('click', function () { aula(a.id); });
          l.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aula(a.id); } });
          return l;
        };
        var dia = function (a) { return String(a.data).slice(0, 10); };
        var concluida = function (x) { var p = prog[x.id]; return !!p && p.total > 0 && p.feitas === p.total; };

        /* cartão do estudo: nome; barra de progresso da SEMANA (segunda a domingo; sábado e domingo mostram a semana que vem); barra do TEMPO se tiver data final */
        var cartao = el('div', { class: 'portal-cartao' });
        var renomear = el('button', { type: 'button', class: 'botao-fixo', text: 'Renomear' });
        renomear.style.cssText = 'background:none;border:0;padding:0;color:var(--azul-egipcio-escuro);font:inherit;font-size:13px;font-weight:700;cursor:pointer;display:' + (encerrado ? 'none' : 'inline');
        renomear.addEventListener('click', function () {
          var n = (prompt('Nome do estudo', est.nome) || '').trim();
          if (!n || n === est.nome) return;
          C.from('estudos').update({ nome: n }).eq('id', est.id).then(function (r) { if (r.error) alert('Não foi possível salvar.'); else lista(); });
        });
        cartao.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:12px' }, [el('h2', { text: est.nome, style: 'margin:0' }), renomear]));
        cartao.appendChild(linhaApostila(est, encerrado));
        var base = new Date(hoje + 'T12:00:00'), dow = base.getDay();
        base.setDate(base.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow));
        var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
        var segunda = iso(base); base.setDate(base.getDate() + 6); var domingo = iso(base);
        var nTodas = tudo.length, nOk = tudo.filter(concluida).length;
        if (nTodas) cartao.appendChild(P.barraLinha(Math.round(nOk * 100 / nTodas), null, nOk + '/' + nTodas));
        var daSemana = est.por_semana ? tudo.filter(function (a) { return dia(a) >= segunda && dia(a) <= domingo; }) : [];
        if (daSemana.length) {
          var nFeitas = daSemana.filter(concluida).length, pct = Math.round(nFeitas * 100 / daSemana.length);
          cartao.appendChild(el('p', { class: 'portal-item-data rotulo-fixo', style: 'margin:10px 0 0', text: 'Semana de ' + diaCurto(daSemana[0].data) + ' a ' + diaCurto(daSemana[daSemana.length - 1].data) }));
          cartao.appendChild(P.barraLinha(pct, null, nFeitas + '/' + daSemana.length));
        }
        if (est.data_fim) cartao.appendChild(P.barraTempoDias(est.data_inicio, est.data_fim));
        /* início e data final (opcional): grava sozinho a cada mudança, sem redesenhar; a tela só se atualiza quando o campo perde o foco (redesenhar no meio fechava o calendário) */
        if (!encerrado) {
          var campoData = function (rotulo, coluna, id, opcional) {
            var inp = el('input', { type: 'date', id: id, style: 'width:auto' }); inp.value = est[coluna] || '';
            var sujo = false;
            inp.addEventListener('change', function () {
              if (!inp.value && !opcional) return;
              var o = {}; o[coluna] = inp.value || null;
              C.from('estudos').update(o).eq('id', est.id).then(function (r) { if (r.error) alert('Não foi possível salvar a data.'); else { est[coluna] = inp.value || null; sujo = true; } });
            });
            inp.addEventListener('blur', function () { setTimeout(function () { if (sujo) { sujo = false; lista(); } }, 300); });
            var tirar = null;
            if (opcional && est[coluna]) { tirar = P.botaoApagar('Tirar a data'); tirar.addEventListener('click', function () { C.from('estudos').update(o2(coluna)).eq('id', est.id).then(function () { lista(); }); }); }
            return P.colunaData(inp, rotulo, tirar);
          };
          var o2 = function (c) { var o = {}; o[c] = null; return o; };
          cartao.appendChild(P.linhaDatas([campoData('Início', 'data_inicio', 'estIni', false), campoData('Data final (opcional)', 'data_fim', 'estFim', true)]));
          var cxSemana = el('input', { type: 'checkbox', class: 'caixinha', id: 'estSemana' }); cxSemana.checked = !!est.por_semana;
          cxSemana.addEventListener('change', function () {
            C.from('estudos').update({ por_semana: cxSemana.checked }).eq('id', est.id).then(function (r) { if (r.error) alert('Não foi possível salvar.'); else { est.por_semana = cxSemana.checked; lista(); } });
          });
          cartao.appendChild(el('label', { for: 'estSemana', style: 'display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer' }, [cxSemana, el('span', { text: 'Dividir por semanas' })]));
        }
        var voltarPai = function () { if (ctx.voltar()) return; if (encerrado) verEncerrado = est.estudo_pai_id; else aberto = est.estudo_pai_id; desenhar(); };
        if (est.estudo_pai_id && !encerrado) corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin:0 0 10px' }, [P.botaoVoltar(voltarPai)]));
        corpo.appendChild(cartao);

        /* estudos menores: uma linha cada, com a barra deles (as aulas deles e as dos que estão dentro); tocar abre */
        var menores = filhosDe(est.id);
        if (menores.length) {
          var cm = el('div', { class: 'portal-cartao' });
          menores.forEach(function (m) {
            var ar = arvoreDe(m).map(function (x) { return x.id; }), aulasM = tudo.filter(function (a) { return ar.indexOf(a.estudo_id) >= 0; });
            var ok = aulasM.filter(concluida).length, linhaM = el('div', { class: 'portal-item', role: 'button', tabindex: '0' }, [el('strong', { class: 'portal-item-titulo', text: m.nome }), P.barraLinha(aulasM.length ? Math.round(ok * 100 / aulasM.length) : 0, null, ok + '/' + aulasM.length)]);
            if (m.data_fim) { var tm = P.barraTempoDias(m.data_inicio, m.data_fim); if (tm) linhaM.appendChild(tm); }
            linhaM.style.cssText = 'padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--azul-egipcio-claro,#1F5FA3) 70%,transparent);cursor:pointer;-webkit-tap-highlight-color:transparent';
            var abrirM = function () { if (encerrado) verEncerrado = m.id; else aberto = m.id; ctx.entrar(desenhar); };
            linhaM.addEventListener('click', abrirM);
            linhaM.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirM(); } });
            cm.appendChild(linhaM);
          });
          cm.lastChild.style.borderBottom = '0';
          cm.setAttribute('data-lado', 'd'); corpo.appendChild(cm);
        }
        if (!aulas.length && !menores.length) { var vz = el('div', { class: 'portal-cartao' }, [el('p', { class: 'portal-vazio', text: 'Nenhuma aula ainda.' })]); vz.setAttribute('data-lado', 'd'); corpo.appendChild(vz); }
        /* a lista: o que falta fazer, na ordem das datas; uma linha grossa; e, mais apagado, o que já foi feito (o mais recente primeiro) */
        var faltam = aulas.filter(function (x) { return !concluida(x); }), feitas = aulas.filter(concluida).reverse();
        if (faltam.length) {
          var cf = el('div', { class: 'portal-cartao' });
          faltam.forEach(function (x) { cf.appendChild(linhaDe(x)); });
          cf.lastChild.style.borderBottom = '0';
          cf.setAttribute('data-lado', 'd'); corpo.appendChild(cf);
        }
        if (feitas.length) {
          var hr5 = el('hr', { style: 'border:0;border-top:5px solid var(--azul-egipcio-claro);margin:22px 0 14px' }); hr5.setAttribute('data-lado', 'd'); corpo.appendChild(hr5);
          var cd = el('div', { class: 'portal-cartao', style: 'opacity:.5' });
          feitas.forEach(function (x) { cd.appendChild(linhaDe(x)); });
          cd.lastChild.style.borderBottom = '0';
          cd.setAttribute('data-lado', 'd'); corpo.appendChild(cd);
        }
        var imp = null, arq = null, sub = null, mover = null, msg = null, areaMover = null;
        if (!encerrado) {
          imp = el('button', { type: 'button', class: 'portal-btn', text: 'Importar aulas' });
          arq = el('input', { type: 'file', accept: '.json,application/json' }); arq.style.display = 'none';
          imp.addEventListener('click', function () { arq.click(); });
          msg = el('p', { class: 'portal-msg' });
          arq.addEventListener('change', function () {
            if (!arq.files || !arq.files[0]) return;
            imp.disabled = true; P.mensagem(msg, 'Importando...');
            arq.files[0].text().then(importar).then(function (n) { lista('Pronto! ' + n + (n === 1 ? ' aula importada.' : ' aulas importadas.')); })
              .catch(function (e) { imp.disabled = false; P.mensagem(msg, 'Não consegui importar: ' + (e && e.message ? e.message : e), 'erro'); });
          });
          sub = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: '+ Estudo menor' });
          sub.addEventListener('click', function () {
            var nome = (prompt('Nome do estudo menor') || '').trim();
            if (!nome) return;
            C.from('estudos').insert({ nome: nome, data_inicio: hojeISO(), por_semana: false, estudo_pai_id: est.id }).select('id').then(function (r) {
              if (r.error || !r.data || !r.data[0]) { alert('Não foi possível criar (já existe um estudo com esse nome?).'); return; }
              aberto = r.data[0].id; carregarEstudos().then(function () { ctx.entrar(desenhar); });
            });
          });
          mover = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Colocar dentro de outro estudo' });
          areaMover = el('div', { class: 'barra-ocre' });
          mover.addEventListener('click', function () {
            if (areaMover.firstChild) return;
            var proibidos = {}; arvoreDe(est).forEach(function (x) { proibidos[x.id] = true; });
            var sel = el('select', { id: 'estPai' }), porId = {};
            sel.appendChild(el('option', { value: '', text: 'Nenhum (estudo solto)' }));
            (function listar(lista, nivel) { lista.forEach(function (x) { if (proibidos[x.id] || x.encerrado) return; porId[String(x.id)] = x; sel.appendChild(el('option', { value: String(x.id), text: new Array(nivel + 1).join('— ') + x.nome })); listar(filhosDe(x.id), nivel + 1); }); })(estudos.filter(function (x) { return !x.estudo_pai_id; }), 0);
            sel.value = est.estudo_pai_id ? String(est.estudo_pai_id) : '';
            var colocar = el('button', { type: 'submit', class: 'portal-btn', text: 'Colocar' }), cancelar = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Cancelar' }), msgM = el('p', { class: 'portal-msg' });
            cancelar.addEventListener('click', function () { areaMover.textContent = ''; });
            var fm = el('form', { class: 'portal-cartao' }, [el('label', { for: 'estPai', text: 'Dentro de' }), sel, msgM, el('div', { class: 'portal-acoes' }, [colocar, cancelar])]);
            fm.addEventListener('submit', function (ev) {
              ev.preventDefault();
              var novoPai = sel.value ? porId[sel.value] : null;
              if ((novoPai ? novoPai.id : null) === (est.estudo_pai_id || null)) { areaMover.textContent = ''; return; }
              colocar.disabled = true;
              C.from('estudos').update({ estudo_pai_id: novoPai ? novoPai.id : null }).eq('id', est.id).then(function (r) {
                if (r.error) { colocar.disabled = false; P.mensagem(msgM, P.traduzErro(r.error.message), 'erro'); } else lista();
              });
            });
            areaMover.appendChild(fm);
          });
        }
        /* no fim das lições: gera o caderno em PDF e abre para ver */
        var cad = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Gerar meu caderno' });
        var msgCad = el('p', { class: 'portal-msg' });
        cad.addEventListener('click', function () { /* a aba do PDF precisa abrir já no toque: nada assíncrono antes */
          cad.disabled = true;
          window.cadernoEstudos.gerar(nomeCurto, function (t, tipo) { P.mensagem(msgCad, t, tipo); }, est).then(function () { cad.disabled = false; });
        });

        /* resultado para o Claude: copia o texto (é só colar na conversa); se o aparelho não deixar copiar, baixa como arquivo */
        var env = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Enviar resultado' });
        var msgEnv = el('p', { class: 'portal-msg' });
        env.addEventListener('click', function () {
          env.disabled = true; P.mensagem(msgEnv, 'Juntando o seu resultado...', 'ok');
          montarResultado(est).then(function (txt) {
            var baixar = function () {
              var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'resultado-estudos.json';
              document.body.appendChild(a); a.click(); a.remove();
              P.mensagem(msgEnv, 'Baixei o arquivo resultado-estudos.json. Mande para o Claude na conversa.', 'ok');
            };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { P.mensagem(msgEnv, 'Copiado! Agora é só colar na conversa com o Claude.', 'ok'); }, baixar);
            else baixar();
          }).catch(function (e) { P.mensagem(msgEnv, 'Não consegui juntar o resultado: ' + (e && e.message ? e.message : e), 'erro'); }).then(function () { env.disabled = false; });
        });

        /* encerrar (ou reabrir) o estudo */
        var enc = P.botaoApagar(encerrado ? 'Reabrir estudo' : 'Encerrar estudo');
        enc.addEventListener('click', function () {
          if (!encerrado && !confirm('Encerrar o estudo "' + est.nome + '"? Ele vai para Encerrados e dá para reabrir.')) return;
          var o = encerrado ? { encerrado: false, encerrado_em: null } : { encerrado: true, encerrado_em: hojeISO() };
          C.from('estudos').update(o).eq('id', est.id).then(function (r) {
            if (r.error) { alert('Não foi possível salvar.'); return; }
            if (encerrado) { aberto = est.id; verEncerrado = null; } else aberto = null;
            lista();
          });
        });
        /* um bloco só: o que se usa sempre (Importar aulas) em destaque; o resto, em uma linha só, discreto */
        if (imp) corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:24px' }, [imp, arq]));
        var outros = [];
        if (sub) outros.push(sub);
        if (mover) outros.push(mover);
        outros.push(cad, env);
        corpo.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:' + (imp ? '14' : '24') + 'px;flex-wrap:wrap;gap:10px 28px' }, outros));
        if (areaMover) corpo.appendChild(areaMover);
        if (msg) corpo.appendChild(msg);
        corpo.appendChild(msgCad);
        corpo.appendChild(msgEnv);
        var apagar = P.botaoApagar('Apagar este estudo');
        apagar.addEventListener('click', function () {
          if (!confirm('Apagar o estudo "' + est.nome + '" com todas as aulas, respostas e desenhos?' + (filhosDe(est.id).length ? ' Os estudos menores dentro dele ficam soltos.' : '') + ' Não dá para desfazer.')) return;
          C.from('estudos').delete().eq('id', est.id).then(function (d) { if (d.error) alert('Não foi possível apagar.'); else { aberto = est.estudo_pai_id || null; verEncerrado = encerrado ? (est.estudo_pai_id || null) : null; lista(); } });
        });
        if (est.estudo_pai_id && !encerrado) P.voltarNoFim(corpo, voltarPai);
        corpo.appendChild(el('div', { style: 'margin:56px 0 8px;display:flex;justify-content:center;gap:40px;flex-wrap:wrap' }, est.estudo_pai_id ? [apagar] : [enc, apagar]));
      });
    }

    /* ---------- resultado da semana: texto compacto para colar na conversa com o Claude (acertos, erros, motivos e o que já está dominado) ---------- */
    function montarResultado(est) {
      return Promise.all([
        C.from('estudo_aulas').select('id,codigo,data,materia,titulo').eq('estudo_id', est.id).order('data'),
        C.from('estudo_questoes').select('aula_id,ordem,tipo,enunciado,opcoes,correta,id').order('ordem'),
        C.from('estudo_respostas').select('*')
      ]).then(function (rs) {
        var erro = rs[0].error || rs[1].error || rs[2].error; if (erro) throw erro;
        var resp = {}; rs[2].data.forEach(function (x) { resp[x.questao_id] = x; });
        var letra = function (k) { return k == null ? null : String.fromCharCode(65 + k); };
        var aulas = [], porMateria = {};
        rs[0].data.forEach(function (a) {
          var qs = rs[1].data.filter(function (q) { return q.aula_id === a.id; });
          var feitas = qs.filter(function (q) { var r = resp[q.id]; return r && (r.opcao != null || (r.texto && r.texto.trim())); });
          if (!feitas.length) return; /* aula que nem começou fica de fora */
          var linhas = qs.map(function (q) {
            var r = resp[q.id] || {}, x = { n: q.ordem + 1, tipo: q.tipo, pergunta: String(q.enunciado).replace(/\s+/g, ' ').slice(0, 110) };
            if (q.tipo === 'multipla') {
              if (r.opcao == null) { x.resposta = null; return x; }
              x.resposta = letra(r.opcao); x.certa = letra(q.correta); x.acertou = r.opcao === q.correta;
              if (!x.acertou && r.motivo) x.motivo = r.motivo; /* atencao | conceito | conta */
              x.fez_conta_a_mao = !!r.desenho;
            } else { x.texto = r.texto ? String(r.texto).slice(0, 400) : null; }
            return x;
          });
          var m = porMateria[a.materia] = porMateria[a.materia] || { acertos: 0, respondidas: 0 };
          linhas.forEach(function (x) { if (x.tipo === 'multipla' && x.resposta) { m.respondidas++; if (x.acertou) m.acertos++; } });
          aulas.push({ data: a.data, materia: a.materia, aula: a.titulo, concluida: feitas.length === qs.length, questoes: linhas });
        });
        return JSON.stringify({ resultado_estudos: { estudo: est.nome, gerado_em: hojeISO(), por_materia: porMateria, aulas: aulas } });
      });
    }

    /* ---------- importar o arquivo de aulas (.json) ---------- */
    function importar(texto) {
      var d; try { d = JSON.parse(texto); } catch (e) { throw new Error('o arquivo não está no formato certo.'); }
      var aulas = d && d.aulas; if (!Array.isArray(aulas) || !aulas.length) throw new Error('não achei aulas no arquivo.');
      aulas.forEach(function (a, i) {
        if (!a.codigo || !a.data || !a.materia || !a.titulo) throw new Error('a aula ' + (i + 1) + ' está incompleta (código, data, matéria e título).');
        (a.questoes || []).forEach(function (q, k) {
          if (!q.enunciado || (q.tipo !== 'multipla' && q.tipo !== 'dissertativa')) throw new Error('a questão ' + (k + 1) + ' da aula "' + a.titulo + '" está incompleta.');
          if (q.tipo === 'multipla' && (!Array.isArray(q.opcoes) || q.opcoes.length < 2 || typeof q.correta !== 'number')) throw new Error('a questão ' + (k + 1) + ' da aula "' + a.titulo + '" precisa de alternativas e da certa.');
        });
      });
      /* o estudo das aulas: o do arquivo (criado se ainda não existe) ou, sem isso, o que está aberto na tela */
      var pedido = d.estudo && d.estudo.nome ? String(d.estudo.nome).trim() : '';
      var alvo = pedido ? (estudos.filter(function (e) { return e.nome.toLowerCase() === pedido.toLowerCase(); })[0] || null) : (estudos.filter(function (e) { return e.id === aberto; })[0] || null);
      if (!alvo && !pedido) throw new Error('abra um estudo antes de importar.');
      var obter = alvo ? Promise.resolve({ data: [alvo] }) : C.from('estudos').insert({ nome: pedido, data_inicio: d.estudo.inicio || hojeISO(), data_fim: d.estudo.fim || null }).select('*');
      return obter.then(function (re) {
        if (re.error || !re.data || !re.data[0]) throw new Error('não consegui criar o estudo "' + pedido + '".');
        var est = re.data[0]; aberto = est.id; verEncerrado = null;
        var linhas = aulas.map(function (a) { return { estudo_id: est.id, codigo: a.codigo, data: a.data, materia: a.materia, titulo: a.titulo, explicacao: a.explicacao || null }; });
        return importarLinhas(linhas, aulas).then(function (n) {
          /* aulas que o arquivo SUBSTITUI: saem do estudo, com as questões e respostas delas (nunca as que vêm no próprio arquivo) */
          var novas = {}; aulas.forEach(function (x) { novas[x.codigo] = true; });
          var apagar = (Array.isArray(d.apagar) ? d.apagar : []).filter(function (c) { return typeof c === 'string' && !novas[c]; });
          if (!apagar.length) return n;
          return C.from('estudo_aulas').delete().eq('estudo_id', est.id).in('codigo', apagar).then(function (rd) { if (rd.error) throw new Error(P.traduzErro(rd.error.message)); return n; });
        });
      });
    }
    function importarLinhas(linhas, aulas) {
      return C.from('estudo_aulas').upsert(linhas, { onConflict: 'codigo' }).select('id,codigo').then(function (r) {
        if (r.error) throw new Error(P.traduzErro(r.error.message));
        var idDe = {}; r.data.forEach(function (x) { idDe[x.codigo] = x.id; });
        var qs = [], limpezas = [];
        aulas.forEach(function (a) {
          var id = idDe[a.codigo], n = (a.questoes || []).length;
          (a.questoes || []).forEach(function (q, k) {
            qs.push({ aula_id: id, ordem: k, tipo: q.tipo, enunciado: q.enunciado, opcoes: q.tipo === 'multipla' ? q.opcoes : null, correta: q.tipo === 'multipla' ? q.correta : null, resolucao: q.resolucao || null, espaco_conta: !!q.espaco_conta, imagem: q.imagem || null });
          });
          limpezas.push(C.from('estudo_questoes').delete().eq('aula_id', id).gte('ordem', n)); /* sobrou questão antiga que saiu do arquivo */
        });
        return (qs.length ? C.from('estudo_questoes').upsert(qs, { onConflict: 'aula_id,ordem' }) : Promise.resolve({})).then(function (rq) {
          if (rq.error) throw new Error(P.traduzErro(rq.error.message));
          return Promise.all(limpezas);
        }).then(function () { return aulas.length; });
      });
    }

    /* ---------- uma aula ---------- */
    var aulaAberta = null;
    function aula(id) { aulaAberta = id; ctx.entrar(desenharAula); }
    function desenharAula() {
      var esq = ctx.esq, dir = ctx.dir, id = aulaAberta; esq.textContent = ''; dir.textContent = ''; ctx.rotulos('aula', 'questões');
      var vb = P.botaoVoltar(function () { if (ctx.voltar()) return; aulaAberta = null; desenhar(); }); esq.appendChild(vb);
      var carr = el('p', { class: 'portal-vazio', text: 'Carregando...' }); esq.appendChild(carr);
      return Promise.all([
        C.from('estudo_aulas').select('*').eq('id', id).maybeSingle(),
        C.from('estudo_questoes').select('*').eq('aula_id', id).order('ordem')
      ]).then(function (rs) {
        carr.remove(); var a = rs[0].data;
        if (rs[0].error || rs[1].error || !a) { esq.appendChild(el('p', { class: 'portal-msg erro', text: 'Não achei essa aula.' })); return; }
        var qs = rs[1].data || [];
        return C.from('estudo_respostas').select('*').in('questao_id', qs.length ? qs.map(function (q) { return q.id; }) : ['00000000-0000-0000-0000-000000000000']).then(function (rr) {
          var resp = {}; (rr.data || []).forEach(function (x) { resp[x.questao_id] = x; });
          var cab = el('div', { class: 'portal-cartao' }, [el('h2', { text: a.titulo }), el('p', { class: 'portal-item-data', text: diaCurto(a.data) + ' · ' + a.materia })]);
          var dAula = el('input', { type: 'date' }); dAula.value = String(a.data || '').slice(0, 10);
          dAula.addEventListener('change', function () { if (dAula.value) C.from('estudo_aulas').update({ data: dAula.value }).eq('id', id).then(function (r) { if (r.error) alert('Não consegui salvar a data.'); }); });
          cab.appendChild(P.colunaData(dAula, 'Fazer em'));
          if (a.explicacao) cab.appendChild(textoFormatado(a.explicacao));
          esq.appendChild(cab);
          if (!qs.length) dir.appendChild(el('p', { class: 'portal-vazio', text: 'Sem questões.' }));
          qs.forEach(function (q, i) { dir.appendChild(cartaoQuestao(q, i, resp[q.id])); });
        });
      });
    }

    /* quadro para fazer a conta à mão (Apple Pencil, dedo ou mouse): o que foi escrito fica guardado como imagem e volta igual em qualquer aparelho */
    function quadroConta(q, resposta) {
      var ALTURA = 240, PASSO = 200;
      var caixa = el('div', { style: 'margin:10px 0 14px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none' });
      caixa.appendChild(el('p', { class: 'portal-item-data rotulo-fixo', text: 'Espaço para a conta' }));
      var cv = el('canvas'); cv.style.cssText = 'display:block;width:100%;height:' + ALTURA + 'px;border:1px solid var(--azul-egipcio-claro);background:transparent;touch-action:none;cursor:crosshair;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent';
      caixa.appendChild(cv);
      var g = cv.getContext('2d'), dpr = Math.max(1, window.devicePixelRatio || 1);
      var larg = 0, alt = ALTURA, borracha = false, desfazer = [], desenhando = false, ultimo = null, espera = null;
      var dimensionar = function (h) { larg = cv.clientWidth || 300; alt = h; cv.width = Math.round(larg * dpr); cv.height = Math.round(alt * dpr); cv.style.height = alt + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round'; };
      var guardar = function () {
        clearTimeout(espera);
        espera = setTimeout(function () {
          var vazio = !g.getImageData(0, 0, cv.width, cv.height).data.some(function (v, i) { return i % 4 === 3 && v; });
          C.from('estudo_respostas').upsert({ questao_id: q.id, desenho: vazio ? null : cv.toDataURL('image/png'), atualizado_em: new Date().toISOString() }, { onConflict: 'questao_id' }).then(function (x) { aviso.textContent = x.error ? P.traduzErro(x.error.message) : ''; });
        }, 900);
      };
      var instantaneo = function () { desfazer.push(g.getImageData(0, 0, cv.width, cv.height)); if (desfazer.length > 15) desfazer.shift(); };
      var ponto = function (e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (larg / r.width), y: (e.clientY - r.top) * (alt / r.height), p: e.pressure }; };
      var traco = function (a, b, e) {
        g.save();
        g.globalCompositeOperation = borracha ? 'destination-out' : 'source-over';
        g.strokeStyle = FdaTema.cor('preto-tinta');
        g.lineWidth = borracha ? 22 : (e.pointerType === 'pen' && b.p ? 1.4 + b.p * 2.6 : 2.4);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.restore();
      };
      /* rejeição da palma: com a caneta (Apple Pencil) em uso, o dedo e a mão apoiada não escrevem; encostos largos também são ignorados */
      var temCaneta = false, canetaNaTela = false;
      var ignorar = function (e) {
        if (e.pointerType === 'pen') { temCaneta = true; return false; }
        if (e.pointerType === 'touch') return temCaneta || canetaNaTela || (e.width > 28 || e.height > 28);
        return false;
      };
      cv.addEventListener('pointerover', function (e) { if (e.pointerType === 'pen') temCaneta = true; });
      cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (ignorar(e)) return;
        if (e.pointerType === 'pen') canetaNaTela = true;
        try { cv.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
        instantaneo(); desenhando = true; ultimo = ponto(e); traco(ultimo, { x: ultimo.x + 0.01, y: ultimo.y + 0.01, p: ultimo.p }, e);
      });
      cv.addEventListener('pointermove', function (e) {
        if (!desenhando) return; e.preventDefault();
        if (ignorar(e)) return;
        var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
        evs.forEach(function (ev) { var p = ponto(ev); traco(ultimo, p, e); ultimo = p; });
      });
      var fim = function (e) { if (e && e.pointerType === 'pen') canetaNaTela = false; if (!desenhando) return; if (e && e.pointerType === 'touch' && (temCaneta || canetaNaTela)) return; desenhando = false; guardar(); };
      cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);

      var botao = function (texto, aoClicar) { var b = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: texto }); b.addEventListener('click', aoClicar); return b; };
      var bCaneta = botao('Caneta', function () { borracha = false; marcar(); }), bBorracha = botao('Borracha', function () { borracha = true; marcar(); });
      var marcar = function () { [[bCaneta, !borracha], [bBorracha, borracha]].forEach(function (p) { p[0].style.border = p[1] ? '3px solid var(--azul-egipcio-claro)' : ''; }); };
      marcar();
      var bDesfazer = botao('Desfazer', function () { var s = desfazer.pop(); if (s) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(s, 0, 0); g.restore(); guardar(); } });
      var bMais = botao('Mais espaço', function () {
        var antes = cv.toDataURL('image/png'), im = new Image();
        im.onload = function () { dimensionar(alt + PASSO); g.drawImage(im, 0, 0, larg, im.height / dpr); guardar(); };
        im.src = antes;
      });
      var bLimpar = P.botaoApagar('Limpar');
      bLimpar.addEventListener('click', function () { if (!confirm('Limpar o espaço da conta? Não dá para desfazer.')) return; desfazer = []; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.restore(); guardar(); });
      var aviso = el('p', { class: 'portal-msg' });
      caixa.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:8px;align-items:center' }, [bCaneta, bBorracha, bDesfazer, bMais, bLimpar]));
      caixa.appendChild(aviso);

      /* carrega o que já estava escrito (a altura cresce se o desenho for maior que o espaço padrão) */
      var carregar = function () {
        dimensionar(ALTURA);
        if (!resposta.desenho) return;
        var im = new Image();
        im.onload = function () {
          var h = Math.max(ALTURA, Math.ceil(im.height * (larg / (im.width / dpr)) / dpr)); /* mesma proporção, na largura de agora */
          dimensionar(h); g.drawImage(im, 0, 0, larg, im.height * (larg / im.width));
        };
        im.src = resposta.desenho;
      };
      var esperar = new MutationObserver(function () { if (cv.isConnected) { esperar.disconnect(); carregar(); } });
      esperar.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { if (cv.isConnected && !larg) { esperar.disconnect(); carregar(); } }, 0);
      return caixa;
    }


    /* depois de errar: por que errei? (a resposta vai no resultado da semana, para o Claude saber se o problema é a matéria ou a atenção) */
    var MOTIVOS = [['atencao', 'Li errado ou me distraí'], ['conceito', 'Não entendi o conceito'], ['conta', 'Errei a conta']];
    function motivoErro(q, resposta) {
      var caixa = el('div', { style: 'margin:6px 0 8px' });
      caixa.appendChild(el('p', { class: 'portal-item-data rotulo-fixo', text: 'Por que errei?' }));
      var desenhar = function () {
        while (caixa.childNodes.length > 1) caixa.removeChild(caixa.lastChild);
        MOTIVOS.forEach(function (m) {
          var marcado = resposta.motivo === m[0];
          var b = el('button', { type: 'button', text: m[1], 'aria-pressed': marcado ? 'true' : 'false' });
          b.style.cssText = 'display:inline-block;background:transparent;color:var(--preto-tinta);font:inherit;font-size:14px;cursor:pointer;border-radius:0;margin:0 8px 8px 0;' + (marcado ? 'border:3px solid var(--azul-egipcio-claro);padding:6px 10px' : 'border:1px solid var(--azul-egipcio-claro);padding:8px 12px');
          b.addEventListener('click', function () {
            var novo = marcado ? null : m[0], antigo = resposta.motivo; resposta.motivo = novo; desenhar();
            C.from('estudo_respostas').upsert({ questao_id: q.id, motivo: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'questao_id' }).then(function (x) {
              if (x.error) { resposta.motivo = antigo; desenhar(); caixa.appendChild(el('p', { class: 'portal-msg erro', text: P.traduzErro(x.error.message) })); }
            });
          });
          caixa.appendChild(b);
        });
      };
      desenhar();
      return caixa;
    }

    function cartaoQuestao(q, i, r) {
      var cartao = el('div', { class: 'portal-cartao' });
      var enun = el('p', { text: (i + 1) + '. ' + q.enunciado }); enun.style.cssText = 'white-space:pre-line;font-weight:700;color:var(--preto-tinta)';
      cartao.appendChild(enun);
      if (q.imagem) { var fig = el('img', { src: q.imagem, alt: 'Figura da questão' }); fig.style.cssText = 'display:block;max-width:100%;height:auto;margin:10px 0 12px;border:1px solid var(--azul-egipcio-claro)'; cartao.appendChild(fig); }
      var resposta = r || { questao_id: q.id, opcao: null, texto: '' };
      if (q.espaco_conta) cartao.appendChild(quadroConta(q, resposta));
      var area = el('div'); cartao.appendChild(area);
      var resol = el('div'); cartao.appendChild(resol);
      var mostrarResolucao = function () {
        resol.textContent = '';
        if (!q.resolucao) return;
        var t = textoFormatado(q.resolucao); t.style.marginTop = '8px';
        resol.appendChild(el('p', { class: 'portal-item-data rotulo-fixo', text: 'Resolução' })); resol.appendChild(t);
      };
      if (q.tipo === 'multipla') {
        var desenhar = function () {
          area.textContent = ''; resol.textContent = '';
          var respondida = resposta.opcao != null;
          (q.opcoes || []).forEach(function (op, k) {
            var marca = '';
            if (respondida && k === q.correta) marca = '  ✓ certa';
            else if (respondida && k === resposta.opcao) marca = '  ← sua resposta';
            area.appendChild(botaoOpcao(String.fromCharCode(65 + k) + ') ' + op + marca, respondida && (k === resposta.opcao || k === q.correta), respondida ? null : function () {
              resposta.opcao = k;
              C.from('estudo_respostas').upsert({ questao_id: q.id, opcao: k, atualizado_em: new Date().toISOString() }, { onConflict: 'questao_id' }).then(function (x) {
                if (x.error) { resposta.opcao = null; area.appendChild(el('p', { class: 'portal-msg erro', text: P.traduzErro(x.error.message) })); return; }
                desenhar();
              });
            }));
          });
          if (respondida) {
            area.appendChild(el('p', { class: 'portal-item-data', text: resposta.opcao === q.correta ? 'Certo!' : 'Não foi dessa vez. A certa é a letra ' + String.fromCharCode(65 + q.correta) + '.' }));
            if (resposta.opcao !== q.correta) area.appendChild(motivoErro(q, resposta));
            mostrarResolucao();
            var refazer = P.botaoApagar('Refazer');
            refazer.addEventListener('click', function () {
              C.from('estudo_respostas').upsert({ questao_id: q.id, opcao: null, motivo: null, atualizado_em: new Date().toISOString() }, { onConflict: 'questao_id' }).then(function () { resposta.opcao = null; resposta.motivo = null; desenhar(); });
            });
            area.appendChild(refazer);
          }
        };
        desenhar();
      } else {
        var t = P.escritaLivre(el('textarea', { rows: '4', placeholder: 'Escreva a sua resposta' }));
        t.value = resposta.texto || '';
        var estado = el('p', { class: 'portal-item-data', text: '' });
        var espera = null;
        var salvar = function () {
          C.from('estudo_respostas').upsert({ questao_id: q.id, texto: t.value || null, atualizado_em: new Date().toISOString() }, { onConflict: 'questao_id' }).then(function (x) {
            estado.textContent = x.error ? P.traduzErro(x.error.message) : 'Salvo.';
          });
        };
        t.addEventListener('input', function () { estado.textContent = ''; clearTimeout(espera); espera = setTimeout(salvar, 900); });
        t.addEventListener('blur', function () { if (espera) { clearTimeout(espera); espera = null; salvar(); } });
        area.appendChild(t); area.appendChild(estado);
        if (q.resolucao) {
          var ver = el('button', { type: 'button', class: 'portal-btn portal-btn-sec', text: 'Ver resolução' });
          ver.addEventListener('click', function () { if (resol.firstChild) { resol.textContent = ''; ver.textContent = 'Ver resolução'; } else { mostrarResolucao(); ver.textContent = 'Esconder resolução'; } });
          area.appendChild(el('div', { class: 'portal-acoes', style: 'margin-top:8px' }, [ver]));
        }
      }
      return cartao;
    }

    return {
      carregar: function () { return carregarEstudos().then(function (erro) { if (erro) throw erro; }); }, desenhar: desenhar,
      ir: function (a, v, au) { aberto = a || null; verEncerrado = v || null; aulaAberta = au || null; },
      estado: function () { return { aberto: aberto, ver: verEncerrado, aula: aulaAberta }; }
    };
};
