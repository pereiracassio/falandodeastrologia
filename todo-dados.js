/* Fontes de dados do To do do CADERNO (admin-caderno.html). CÓPIA das funções do To do da Agenda (admin-agenda.html: itensDaProducao,
   itensDeProjetosEEstudos, itensDeAulasEstudo, itensDoCurso, itensDePassos, codigosDosAtendimentos, aniversários e a hora de Júpiter).
   Mexeu numa regra do To do da Agenda? Mexa aqui também (ou una as duas num arquivo só). Sem desenho: só devolve os itens. */
window.TodoDados = function (ctx) {
  var P = ctx.P, C = ctx.C, el = ctx.el, HP = ctx.HP, FdaTema = ctx.FdaTema, LAT = ctx.lat, LON = ctx.lon, DIA = 86400000, aniversarios = [];
  function p2(n) { return String(n).padStart(2, '0'); }
  function loc(ms) { return new Date(ms + HP.FUSO); }
  function isoDia(ms) { var d = loc(ms); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
  function doIso(dia, hora) { var a = dia.split('-'), h = (hora || '00:00').split(':'); return Date.UTC(+a[0], +a[1] - 1, +a[2], +h[0], +h[1]) - HP.FUSO; }
    var ETV = [['roteiro_ok', 'Roteiro'], ['gravado', 'Gravação'], ['editado', 'Edição grossa'], ['edicao_fina', 'Edição fina'], ['capa', 'Capa'], ['seo_ok', 'SEO'], ['no_ar', 'Membros'], ['publico_ok', 'Público'], ['cortes_feitos', 'Cortes'], ['blog_ok', 'Blog']];
    var ETC = [['legenda_ok', 'Legenda'], ['seo_ok', 'SEO'], ['shorts', 'YouTube Shorts'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']];
    function carregarAniversarios() {
      var pega = function (tabela, tipo, tabCod, colCod) {
        return Promise.all([
          C.from(tabela).select('id,nome,whatsapp,nascimento,email').not('nascimento', 'is', null).then(function (r) { return r.data || []; }, function () { return []; }),
          C.from(tabCod).select(colCod + ',codigo').then(function (r) { return r.data || []; }, function () { return []; })
        ]).then(function (r) { var cods = {}; r[1].forEach(function (c) { cods[c[colCod]] = c.codigo; }); return r[0].map(function (x) { x.tipo = tipo; x.codigo = cods[x.id] || ''; return x; }); });
      };
      return Promise.all([pega('clientes', 'cliente', 'cliente_codigos', 'cliente_id'), pega('alunos', 'aluno', 'aluno_codigos', 'aluno_id')]).then(function (r) { var vistos = {}; /* a mesma pessoa em clientes e em alunos conta uma vez só (pelo e-mail; sem e-mail, pelo nome e a data) */
        aniversarios = r[0].concat(r[1]).filter(function (x) {
          if (!/^\d{4}-\d{2}-\d{2}/.test(x.nascimento || '')) return false;
          var k = x.email ? String(x.email).toLowerCase() : String(x.nome).toLowerCase() + '|' + x.nascimento;
          if (vistos[k]) { if (!vistos[k].whatsapp && x.whatsapp) vistos[k].whatsapp = x.whatsapp; if (!vistos[k].codigo && x.codigo) vistos[k].codigo = x.codigo; return false; }
          vistos[k] = x; return true;
        }); }, function () { aniversarios = []; });
    }
    function aniversariosEntre(de, ate) {
      var saida = [], a0 = +isoDia(de).slice(0, 4), a1 = +isoDia(ate).slice(0, 4);
      aniversarios.forEach(function (p) {
        var m = +p.nascimento.slice(5, 7), d = +p.nascimento.slice(8, 10), ano0 = +p.nascimento.slice(0, 4);
        for (var y = a0; y <= a1; y++) {
          var bi = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0, dd = (m === 2 && d === 29 && !bi) ? 28 : d, iso = y + '-' + p2(m) + '-' + p2(dd), ini = doIso(iso);
          if (ini < de || ini >= ate) continue;
          saida.push({ id: 'aniv-' + p.nome + y, calId: '', calNome: 'Aniversários', titulo: 'Aniversário de ' + (p.codigo ? p.codigo + ' · ' : '') + p.nome, curto: (p.codigo ? p.codigo + ' · ' : '') + p.nome, ini: ini, fim: ini + DIA, diaTodo: true, meet: '', local: '', descricao: '', convRaw: [], convidados: [], recorrenteId: '', recorrencia: null, livre: true, visib: 'default', corId: '', cor: FdaTema.cor('terracota'), calCor: '', lembPadrao: true, lembretes: [], padraoAgenda: [], ocupa: false, editavel: false, aniversario: { nome: p.nome, whatsapp: p.whatsapp || '', idade: y - ano0, tipo: p.tipo } });
        }
      });
      return saida;
    }
    function segmentosDoDia(iso) {
      var d0 = doIso(iso), d1 = d0 + DIA;
      return HP.horasEntre(d0, d1, LAT, LON).map(function (h) { return { ini: Math.max(h.ini, d0), fim: Math.min(h.fim, d1), planeta: h.planeta, noite: h.noite }; }).filter(function (s) { return s.fim > s.ini; });
    }
    function horaJupiter(iso, alvoMin, manha, escolha) {
      /* a hora que ele escolheu na Produção (hora_jupiter) vale sempre: é o índice entre as horas de Júpiter do dia planetário, igual à Agenda */
      if (escolha != null) {
        var pa = iso.split('-'), hs = HP.horasDoDia(+pa[0], +pa[1], +pa[2], LAT, LON).filter(function (h) { return h.planeta === 'Júpiter'; });
        if (hs.length) return hs[Math.min(escolha, hs.length - 1)].ini;
      }
      var js =segmentosDoDia(iso).filter(function (s) { return s.planeta === 'Júpiter'; }).map(function (s) { return { ini: s.ini, mi: (s.ini - doIso(iso)) / 60000 }; });
      if (manha) { var m = js.filter(function (j) { return j.mi < 720; }); if (m.length) js = m; }
      if (!js.length) return doIso(iso, p2(Math.floor(alvoMin / 60)) + ':' + p2(alvoMin % 60));
      js.sort(function (a, b) { return Math.abs(a.mi - alvoMin) - Math.abs(b.mi - alvoMin); });
      return js[0].ini;
    }
    function barrasDe(item, etapas, criado, fim) {
      if (etapas === ETV) etapas = ETV.filter(function (e) { return e[0] !== 'publico_ok' || (item.acesso || 'publico') !== 'membros'; }); /* Público só no vídeo público */
      var feita = function (k) { return k === 'capa' ? !!item.capa_url : k === 'publico_ok' ? !!(item.no_ar && item.data_publico && String(item.data_publico).slice(0, 10) <= new Date().toLocaleDateString('sv-SE')) : !!item[k]; };
      var seg = el('div', { style: 'display:flex;flex-wrap:nowrap;border:1px solid var(--azul-egipcio-claro);margin:8px 0 0;overflow-x:auto;overflow-y:hidden' }, etapas.map(function (e, i) {
        return el('span', { text: e[1], class: feita(e[0]) ? 'preench' : '', style: 'flex:1 1 auto;white-space:nowrap;text-align:center;font-size:11px;padding:6px 6px;' + (i ? 'border-left:1px solid var(--azul-egipcio-claro);' : '') + (feita(e[0]) ? 'background:var(--azul-egipcio-claro);color:var(--vazado,#F3E3B8)' : 'color:var(--terracota)') });
      }));
      return [seg, criado && fim ? P.barraTempoDias(String(criado).slice(0, 10), fim) : null].filter(Boolean);
    }
    function itensDaProducao() {
      return Promise.all([C.from('prod_series').select('id,nome'), C.from('prod_videos').select('id,serie_id,numero,titulo,acesso,data_publico,data_postar,data_gravar,no_ar,data_cortes,data_blog,capa_url,criado_em,roteiro_ok,gravado,editado,edicao_fina,seo_ok,cortes_feitos,blog_ok,publico_ok,datas_etapas,hora_jupiter'), C.from('prod_cortes').select('id,video_id,ordem,titulo,data,hora_jupiter,shorts,instagram,tiktok,criado_em,corte_ok,legenda_ok,seo_ok')]).then(function (r) {
        var series = r[0].data || [], videos = r[1].data || [], cortes = r[2].data || [], saida = [];
        var link = function (v, corte) { return 'admin-producao.html#aba=series&serie=' + encodeURIComponent(v.serie_id || 'soltos') + '&video=' + encodeURIComponent(v.id) + (corte ? '&vt=corte&corte=' + encodeURIComponent(corte) : ''); };
        videos.forEach(function (v) {
          /* cada etapa pode ter a sua data; o vídeo aparece na data da PRIMEIRA etapa que ainda falta e tem data (roteiro, gravar, edições, SEO). Só depois de feita ela, vem a próxima */
          if (!v.no_ar) {
            var dtv = v.datas_etapas || {}, pend = [['roteiro_ok', 'fazer o roteiro', dtv.roteiro_ok], ['gravado', 'gravar', v.data_gravar], ['editado', 'edição grossa', dtv.editado], ['edicao_fina', 'edição fina', dtv.edicao_fina], ['seo_ok', 'fazer o SEO', dtv.seo_ok]]
              .filter(function (e) { return !v[e[0]] && e[2]; })[0];
            if (pend) { saida.push({ ord: v.numero || 0, quando: doIso(pend[2]), diaTodo: true, titulo: (v.numero ? v.numero + '. ' : '') + (v.titulo || 'sem título'), sub: pend[1], subOcre: true, url: link(v), cor: FdaTema.cor('azul-egipcio-escuro'), capa: v.capa_url || '', bsp: ['v', v, v.criado_em, pend[2]] }); return; }
          }
          /* já no YouTube, mas ainda falta fazer os cortes e depois colocar no blog: fica na lista, sem data enquanto ele não puser a data limite */
          if (v.no_ar && !(v.cortes_feitos && v.blog_ok)) {
            var faltaCortes = !v.cortes_feitos, dl = (faltaCortes ? v.data_cortes : v.data_blog) || '';
            saida.push({ ord: v.numero || 0, quando: dl ? doIso(dl) : Infinity, diaTodo: true, semData: !dl, titulo: (v.numero ? v.numero + '. ' : '') + (v.titulo || 'sem título'), sub: faltaCortes ? 'fazer os cortes' : 'colocar no blog', subOcre: true, url: link(v), cor: FdaTema.cor('azul-egipcio-escuro'), capa: v.capa_url || '', bsp: ['v', v, v.criado_em, dl] });
            return;
          }
          var d = ((v.acesso === 'membros' ? '' : v.data_publico) || v.data_postar || ''); if (v.no_ar || !d) return;
          var nome = (v.numero ? v.numero + '. ' : '') + (v.titulo || 'sem título');
          saida.push({ ord: v.numero || 0, quando: horaJupiter(d, 16 * 60, false, v.hora_jupiter), diaTodo: false, titulo: nome, sub: 'colocar no YouTube · Júpiter', subOcre: true, url: link(v), cor: FdaTema.cor('azul-egipcio-escuro'), capa: v.capa_url || '', bsp: ['v', v, v.criado_em, d] });
        });
        cortes.forEach(function (c) {
          var v = videos.filter(function (x) { return x.id === c.video_id; })[0]; if (!v || !c.data || (c.shorts && c.instagram && c.tiktok)) return;
          var falta = [c.shorts ? '' : 'Shorts', c.instagram ? '' : 'Instagram', c.tiktok ? '' : 'TikTok'].filter(Boolean).join(', ');
          saida.push({ quando: horaJupiter(c.data, 9 * 60, true, c.hora_jupiter), diaTodo: false, titulo: (c.titulo || 'Corte ' + c.ordem) + (v.numero ? ' · ' + v.numero : ''), sub: 'postar: ' + falta + ' · Júpiter', subOcre: true, url: link(v, c.id), cor: FdaTema.cor('azul-egipcio-escuro'), bsp: ['c', c, c.criado_em, c.data] });
        });
        return saida;
      }, function () { return []; });
    }
    function itensDeProjetosEEstudos() {
      return Promise.all([C.from('projetos').select('id,nome,data_fim').not('data_fim', 'is', null), C.from('projeto_passos').select('projeto_id,feito'), C.from('estudos').select('id,nome,data_fim,encerrado').not('data_fim', 'is', null)]).then(function (r) {
        var passos = r[1].data || [], saida = [];
        (r[0].data || []).forEach(function (p) {
          var meus = passos.filter(function (x) { return x.projeto_id === p.id; }), feitos = meus.filter(function (x) { return x.feito; }).length;
          if (meus.length && feitos === meus.length) return;
          saida.push({ quando: doIso(p.data_fim), diaTodo: true, titulo: p.nome, sub: 'projeto · ' + feitos + '/' + meus.length + ' passos', url: 'admin-projetos.html', cor: FdaTema.cor('terracota') });
        });
        (r[2].data || []).forEach(function (e) {
          if (e.encerrado) return;
          saida.push({ quando: doIso(e.data_fim), diaTodo: true, titulo: e.nome, sub: 'estudo · data final', url: 'admin-estudos.html', cor: FdaTema.cor('terracota') });
        });
        return saida;
      }, function () { return []; });
    }
    function itensDeAulasEstudo() {
      var pega = function (t, c) { return C.from(t).select(c).then(function (r) { return r.data || []; }, function () { return []; }); };
      return Promise.all([pega('estudos', 'id,nome,encerrado,data_fim,estudo_pai_id'), pega('estudo_aulas', 'id,estudo_id,data,materia,titulo'), pega('estudo_questoes', 'id,aula_id,tipo'), pega('estudo_respostas', 'questao_id,opcao,texto')]).then(function (r) {
        var nomes = {}, resp = {}, falta = {}, saida = [];
        /* estudo SEM data final (ou dentro de um grande sem data final) é "no meu tempo": as aulas dele não entram no To do */
        var porId = {}; r[0].forEach(function (e) { porId[e.id] = e; });
        var temPrazo = function (e) { var n = 0; while (e && n++ < 20) { if (e.data_fim) return true; e = porId[e.estudo_pai_id]; } return false; };
        r[0].forEach(function (e) { if (!e.encerrado && temPrazo(e)) nomes[e.id] = e.nome; });
        r[3].forEach(function (x) { resp[x.questao_id] = x; });
        r[2].forEach(function (q) { var x = resp[q.id], feita = q.tipo === 'multipla' ? !!(x && x.opcao != null) : !!(x && x.texto); if (!feita) falta[q.aula_id] = true; });
        r[1].forEach(function (a) {
          if (!nomes[a.estudo_id] || !a.data || !falta[a.id]) return; /* só estudo aberto com prazo e aula com questão por responder */
          saida.push({ quando: doIso(String(a.data).slice(0, 10)), diaTodo: true, titulo: a.titulo, sub: a.materia + ' · ' + nomes[a.estudo_id], subOcre: true, url: 'admin-estudos.html#aula=' + encodeURIComponent(a.id) + '&estudo=' + encodeURIComponent(a.estudo_id), cor: FdaTema.cor('azul-egipcio-escuro') });
        });
        return saida;
      }, function () { return []; });
    }
    function itensDoCurso() {
      var pega = function (t, c) { return C.from(t).select(c).then(function (r) { return r.data || []; }, function () { return []; }); };
      return Promise.all([pega('cursos', 'id,titulo,construindo,etapas'), pega('curso_modulos', 'id,curso_id,ordem,titulo,apostila_ok,data_apostila'), pega('curso_aulas', 'id,modulo_id,ordem,titulo,gravacao,edicao_grossa,edicao_fina,capa,video_codigo,datas_etapas,tipo')]).then(function (r) {
        var NOMES = { gravacao: 'gravar', edicao_grossa: 'edição grossa', edicao_fina: 'edição fina', capa: 'fazer a capa', upload: 'colocar o vídeo' }, ORDEM = ['gravacao', 'edicao_grossa', 'edicao_fina', 'capa', 'upload'], saida = [];
        var cursos = {}; r[0].forEach(function (c) { if (c.construindo !== false) cursos[c.id] = c; });
        var mods = {}; r[1].forEach(function (m) { if (cursos[m.curso_id]) mods[m.id] = m; });
        r[1].forEach(function (m) {
          if (!mods[m.id] || m.apostila_ok || !m.data_apostila) return;
          saida.push({ quando: doIso(String(m.data_apostila).slice(0, 10)), diaTodo: true, titulo: 'Apostila: ' + (m.ordem === 0 ? '' : 'módulo ' + m.ordem + ' · ') + m.titulo, sub: cursos[m.curso_id].titulo, subOcre: true, url: 'admin-curso.html#modulo=' + encodeURIComponent(m.id), cor: FdaTema.cor('azul-egipcio-escuro') });
        });
        r[2].forEach(function (a) {
          var m = mods[a.modulo_id]; if (!m || a.tipo === 'ao_vivo') return;
          var ativas = Array.isArray(cursos[m.curso_id].etapas) && cursos[m.curso_id].etapas.length ? cursos[m.curso_id].etapas : ORDEM, dt = a.datas_etapas || {};
          var pend = ORDEM.filter(function (k) { return ativas.indexOf(k) >= 0 && !(k === 'upload' ? a.video_codigo : a[k]); })[0];
          if (!pend || !dt[pend]) return;
          saida.push({ quando: doIso(String(dt[pend]).slice(0, 10)), diaTodo: true, titulo: a.titulo, sub: NOMES[pend] + ' · ' + cursos[m.curso_id].titulo, subOcre: true, url: 'admin-curso.html#aula=' + encodeURIComponent(a.id), cor: FdaTema.cor('azul-egipcio-escuro') });
        });
        return saida;
      }, function () { return []; });
    }
    function itensDePassos() {
      var pega = function (q) { return q.then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; }); };
      return Promise.all([
        pega(C.from('projeto_passos').select('id,titulo,data,feito,projeto_id').not('data', 'is', null).eq('feito', false)), pega(C.from('projetos').select('id,nome')),
        pega(C.from('aluno_trilha_passos').select('titulo,data,feito,trilha_id,tipo,item_id,atividade_id,lido_em,link').or('data.not.is.null,atividade_id.not.is.null').eq('feito', false)),
        pega(C.from('aluno_trilhas').select('id,nome,aluno_id')), pega(C.from('alunos').select('id,nome')), pega(C.from('aluno_codigos').select('aluno_id,codigo')),
        C.from('atividades').select('id,corrigida_em,enviada_em,antiga,somente_leitura,rascunho').then(function (r) { return r.error ? C.from('atividades').select('id,corrigida_em,enviada_em,antiga').then(function (r2) { return r2.error ? [] : (r2.data || []); }) : (r.data || []); }, function () { return []; })
      ]).then(function (r) {
        var saida = [], porId = function (l, id) { return l.filter(function (x) { return x.id === id; })[0]; };
        r[0].forEach(function (x) { var p = porId(r[1], x.projeto_id); saida.push({ passoId: x.id, quando: doIso(x.data), diaTodo: true, titulo: x.titulo, sub: 'projeto · ' + (p ? p.nome : ''), url: 'admin-projetos.html#projeto=' + encodeURIComponent(x.projeto_id), cor: FdaTema.cor('terracota') }); });
        r[2].forEach(function (x) {
          /* a parte DELE acabou quando o item foi ligado (material, gravação ou atividade disponível para o aluno) */
          if ((x.tipo === 'material' || x.tipo === 'gravacao') && (x.item_id || x.lido_em)) return;
          if (x.link && (!x.tipo || x.tipo === 'comum')) return; /* já passei o link (ex.: dos fatos da vida): agora é com o aluno */
          var quandoPasso = x.data, tituloPasso = x.titulo;
          if (x.tipo === 'atividade' && x.atividade_id) { /* atividade ligada: só volta ao To do para CORRIGIR, no dia em que o aluno enviou (atrasa se não corrigir) */
            var at = porId(r[6], x.atividade_id); if (!at || !at.enviada_em || at.corrigida_em || at.antiga || at.somente_leitura || at.rascunho) return; /* antiga/já feita/rascunho nunca entram para corrigir */
            quandoPasso = new Date(at.enviada_em).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); tituloPasso = 'Corrigir: ' + x.titulo;
          }
          if (!quandoPasso) return;
          var t = porId(r[3], x.trilha_id); if (!t) return; var al = porId(r[4], t.aluno_id), c = r[5].filter(function (y) { return y.aluno_id === t.aluno_id; })[0];
          saida.push({ quando: doIso(quandoPasso), diaTodo: true, titulo: tituloPasso, sub: 'trilha ' + t.nome + ' · ' + (c && c.codigo ? c.codigo + ' · ' : '') + (al ? al.nome : ''), url: 'admin-alunos.html#aluno=' + encodeURIComponent(t.aluno_id) + '&aba=trilha', cor: FdaTema.cor('terracota') });
        });
        return saida;
      });
    }
    function codigosDosAtendimentos() {
      var pega = function (q) { return q.then(function (r) { return r.data || []; }, function () { return []; }); };
      return Promise.all([pega(C.from('cliente_codigos').select('cliente_id,codigo')), pega(C.from('aluno_codigos').select('aluno_id,codigo')),
        pega(C.from('entregas').select('cliente_id,data,criado_em').not('gravacao_link', 'is', null).order('criado_em', { ascending: false }).limit(1000)),
        pega(C.from('itens').select('aluno_id,data,criado_em').eq('bloco', 'gravacoes').order('criado_em', { ascending: false }).limit(1000))]).then(function (r) {
        var mapa = {}, gravs = {};
        r[0].forEach(function (c) { if (c.codigo) mapa[String(parseInt(c.codigo, 10))] = { chave: 'c|' + c.cliente_id, url: 'admin-clientes.html#cliente=' + encodeURIComponent(c.cliente_id) + '&aba=servicos' }; });
        r[1].forEach(function (c) { if (c.codigo) mapa[String(parseInt(c.codigo, 10))] = { chave: 'a|' + c.aluno_id, url: 'admin-alunos.html#aluno=' + encodeURIComponent(c.aluno_id) + '&aba=gravacoes' }; });
        r[2].forEach(function (g) { (gravs['c|' + g.cliente_id] = gravs['c|' + g.cliente_id] || []).push({ t: Date.parse(g.criado_em), dia: g.data ? String(g.data).slice(0, 10) : '' }); });
        r[3].forEach(function (g) { (gravs['a|' + g.aluno_id] = gravs['a|' + g.aluno_id] || []).push({ t: Date.parse(g.criado_em), dia: g.data ? String(g.data).slice(0, 10) : '' }); });
        return { mapa: mapa, gravs: gravs };
      });
    }
  /* junta o que a Agenda junta: compromissos, aniversários, atendimentos sem gravação e tudo o que vem das fontes acima */
  function montarItens(r, de, ate, agora) {
    var dados = { fora: [], feitos: r[1] || {}, falhas: r[0].falhas || [], tarefas: r[5] }, atendidos = [];
    var meiaNoiteDe = function (ms) { return doIso(isoDia(ms), '00:00'); };
    r[0].concat(aniversariosEntre(de, ate)).forEach(function (e) {
      if (/holiday|addressbook#contacts/.test(e.calId || '')) return;
      var mg = !e.aniversario && !e.diaTodo && e.fim <= agora && /^\s*(\d{3,6})(?!\d)/.exec(e.titulo || ''), dono = mg && r[6].mapa[String(parseInt(mg[1], 10))];
      if (dono) { atendidos.push({ e: e, dono: dono }); return; }
      if (e.livre && !e.aniversario) return;
      if (!e.aniversario && e.fim <= agora) return;
      dados.fora.push({ quando: e.ini, diaTodo: e.diaTodo, titulo: e.titulo, sub: e.aniversario ? 'aniversário · mandar a mensagem' : e.calNome, chave: e.aniversario ? 'a|' + e.id + '|' + e.ini : '', evento: e, cor: e.aniversario ? 'var(--terracota)' : (e.cor || FdaTema.cor('ocre')) });
    });
    var usadas = {};
    atendidos.sort(function (p, q) { return p.e.ini - q.e.ini; }).forEach(function (a) {
      var lista = (r[6].gravs[a.dono.chave] || []).slice().sort(function (p, q) { return p.t - q.t; }), dia0 = isoDia(a.e.ini), achou = -1;
      for (var k = 0; k < lista.length; k++) { if (!usadas[a.dono.chave + k] && (lista[k].t >= a.e.ini || (lista[k].dia && lista[k].dia >= dia0))) { achou = k; break; } }
      if (achou >= 0) { usadas[a.dono.chave + achou] = 1; return; }
      var diaSeguinte = meiaNoiteDe(a.e.fim - 1) + DIA;
      if (agora < diaSeguinte) return;
      dados.fora.push({ quando: diaSeguinte, diaTodo: true, titulo: 'Disponibilizar a gravação', sub: String(a.e.titulo).replace(/^\s*\d{3,6}\s*[-–:·]?\s*/, ''), chave: 'g|' + a.e.id + '|' + a.e.ini, url: a.dono.url, cor: FdaTema.cor('azul-egipcio-escuro') });
    });
    dados.fora = dados.fora.concat(r[2], r[3], r[4]);
    return dados;
  }
  return { carregarAniversarios: carregarAniversarios, itensDaProducao: itensDaProducao, itensDeProjetosEEstudos: itensDeProjetosEEstudos, itensDeAulasEstudo: itensDeAulasEstudo, itensDoCurso: itensDoCurso, itensDePassos: itensDePassos,
    codigosDosAtendimentos: codigosDosAtendimentos, aniversariosEntre: aniversariosEntre, montarItens: montarItens, barrasDe: barrasDe, ETV: ETV, ETC: ETC, setLugar: function (la, lo) { LAT = la; LON = lo; } };
};
