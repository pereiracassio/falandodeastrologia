/* TEMA do painel (Falando de Astrologia e Hellenic Daily) — por aparelho, cada app com o seu.
   Carregado no <head>, antes de qualquer coisa desenhar, pra página já abrir no tema certo (sem piscar o Papiro).
   Papiro = padrão (nenhuma classe). Os outros põem uma classe no <html>: tema-claro, tema-escuro, tema-sulfite (cores em temas.css, superfícies em tema-paginas.css).
   Só entra em páginas do painel, do aluno e do cliente; o site público nunca carrega este arquivo. */
(function () {
  var TEMAS = ['papiro', 'claro', 'escuro', 'sulfite'];
  var DAILY = /\/admin-(agenda|estudos|producao|projetos|financeiro|leitor)\.html$/;
  function app() {
    var c = location.pathname;
    if (DAILY.test(c)) return 'daily';
    if (/\/admin-(site|avisos)\.html$/.test(c)) { try { return sessionStorage.getItem('fda_app') || localStorage.getItem('fda_app_ultimo') || 'falando'; } catch (e) { return 'falando'; } }
    return 'falando';
  }
  function chave(a) { return 'fda_tema_' + (a || app()); }
  function ler(a) { try { var v = localStorage.getItem(chave(a)); return TEMAS.indexOf(v) >= 0 ? v : 'papiro'; } catch (e) { return 'papiro'; } }
  function aplicar(t) {
    var r = document.documentElement;
    TEMAS.forEach(function (x) { r.classList.toggle('tema-' + x, x === t && t !== 'papiro'); });
    r.classList.toggle('tema-papiro', t === 'papiro');
  }
  function gravar(a, t) { try { localStorage.setItem(chave(a), t); } catch (e) { /* sem armazenamento */ } if (a === app()) aplicar(t); }
  aplicar(ler());
  window.FdaTema = { TEMAS: TEMAS, app: app, ler: ler, gravar: gravar, aplicar: aplicar };
})();
