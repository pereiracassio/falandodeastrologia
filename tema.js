/* TEMA do painel (Falando de Astrologia e Hellenic Daily) — por aparelho, cada app com o seu.
   Carregado no <head>, antes de qualquer coisa desenhar, pra página já abrir no tema certo (sem piscar o Papiro).
   Papiro = padrão (nenhuma classe). Os outros põem uma classe no <html>: tema-claro, tema-escuro, tema-sulfite (cores em temas.css, superfícies em tema-paginas.css).
   Só entra em páginas do painel, do aluno e do cliente; o site público nunca carrega este arquivo. */
(function () {
  var TEMAS = ['papiro', 'claro', 'escuro', 'sulfite', 'automatico'];
  var DAILY = /\/admin-(agenda|estudos|producao|projetos|financeiro|leitor)\.html$/;
  function app() {
    var c = location.pathname;
    if (DAILY.test(c)) return 'daily';
    if (/\/admin-(site|avisos)\.html$/.test(c)) { try { return sessionStorage.getItem('fda_app') || localStorage.getItem('fda_app_ultimo') || 'falando'; } catch (e) { return 'falando'; } }
    return 'falando';
  }
  function chave(a) { return 'fda_tema_' + (a || app()); }
  function ler(a) { try { var v = localStorage.getItem(chave(a)); return TEMAS.indexOf(v) >= 0 ? v : 'papiro'; } catch (e) { return 'papiro'; } }
  var escuroDoAparelho = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null, atual = 'papiro';
  /* Automático: só escolhe entre Claro e Escuro, de acordo com o aparelho (nunca Papiro nem Sulfite) */
  function efetivo(t) { return t === 'automatico' ? (escuroDoAparelho && escuroDoAparelho.matches ? 'escuro' : 'claro') : t; }
  function aplicar(t) {
    atual = t; var e = efetivo(t), r = document.documentElement;
    ['papiro', 'claro', 'escuro', 'sulfite'].forEach(function (x) { r.classList.toggle('tema-' + x, x === e && e !== 'papiro'); });
    r.classList.toggle('tema-papiro', e === 'papiro');
  }
  if (escuroDoAparelho) {
    var mudou = function () { if (atual === 'automatico') aplicar('automatico'); };
    if (escuroDoAparelho.addEventListener) escuroDoAparelho.addEventListener('change', mudou); else if (escuroDoAparelho.addListener) escuroDoAparelho.addListener(mudou);
  }
  function gravar(a, t) { try { localStorage.setItem(chave(a), t); } catch (e) { /* sem armazenamento */ } if (a === app()) aplicar(t); }
  var PADRAO = { 'azul-egipcio-escuro': '#1034A6', 'azul-egipcio-claro': '#1F5FA3', terracota: '#A03E25', ocre: '#B5852F', 'preto-tinta': '#16233F', 'fundo-creme': '#FFFDF5' };
  /* a cor de agora do tema, pra quem precisa do valor em si (desenho, cálculo de contraste) e não de var() */
  function cor(nome) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue('--' + nome).trim(); if (v) return v; } catch (e) { /* sem estilo */ }
    return PADRAO[nome];
  }
  aplicar(ler());
  window.FdaTema = { cor: cor, TEMAS: TEMAS, app: app, ler: ler, gravar: gravar, aplicar: aplicar };
})();
