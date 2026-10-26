/* Hora planetária (horas desiguais: 12 do dia, do nascer ao pôr do sol, e 12 da noite, do pôr ao nascer seguinte).
   Ordem caldeia: Saturno, Júpiter, Marte, Sol, Vênus, Mercúrio, Lua; a primeira hora do dia é do regente do dia da semana.
   Nascer e pôr do sol: algoritmo do "Almanac for Computers" (erro de um ou dois minutos). Horário de Brasília (UTC-3, sem verão desde 2019).
   Usado pela aba Agenda (admin-agenda.html); roda também em Node (module.exports) para teste. */
(function (raiz) {
  var CALDEIA = ['Saturno', 'Júpiter', 'Marte', 'Sol', 'Vênus', 'Mercúrio', 'Lua'];
  var REGENTE_DO_DIA = ['Sol', 'Lua', 'Marte', 'Mercúrio', 'Júpiter', 'Vênus', 'Saturno']; // domingo a sábado
  var FUSO = -3 * 3600000;
  var rad = Math.PI / 180;

  /* dia local (ano, mês 1-12, dia) -> meia-noite local em ms (instante absoluto) */
  function meiaNoite(a, m, d) { return Date.UTC(a, m - 1, d) - FUSO; }

  function sol(a, m, d, lat, lon, nascer) {
    var N = Math.round((Date.UTC(a, m - 1, d) - Date.UTC(a, 0, 0)) / 86400000);
    var lonH = lon / 15, t = N + ((nascer ? 6 : 18) - lonH) / 24;
    var M = 0.9856 * t - 3.289;
    var L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
    L = ((L % 360) + 360) % 360;
    var RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * Math.sin(L * rad), cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null;
    var H = (nascer ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
    var T = H + RA - 0.06571 * t - 6.622;
    var UT = (((T - lonH) % 24) + 24) % 24;
    return Date.UTC(a, m - 1, d) + UT * 3600000;
  }

  function diaSeguinte(a, m, d) { var x = new Date(Date.UTC(a, m - 1, d + 1)); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; }

  /* as 24 horas planetárias que COMEÇAM no nascer do sol do dia local (a, m, d): [{ ini, fim, planeta, noite }] (ms) */
  function horasDoDia(a, m, d, lat, lon) {
    var s = diaSeguinte(a, m, d);
    var n0 = sol(a, m, d, lat, lon, true), p0 = sol(a, m, d, lat, lon, false), n1 = sol(s[0], s[1], s[2], lat, lon, true);
    // o instante local do nascer pode cair no dia UTC errado perto da meia-noite; aqui (Brasil) nunca acontece, mas confere
    if (n0 == null || p0 == null || n1 == null) return [];
    if (p0 < n0) p0 += 86400000;
    if (n1 < p0) n1 += 86400000;
    var dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    var inicio = CALDEIA.indexOf(REGENTE_DO_DIA[dow]), saida = [];
    for (var i = 0; i < 24; i++) {
      var dia = i < 12, a0 = dia ? n0 : p0, tam = ((dia ? p0 : n1) - a0) / 12, k = dia ? i : i - 12;
      saida.push({ ini: a0 + k * tam, fim: a0 + (k + 1) * tam, planeta: CALDEIA[(inicio + i) % 7], noite: !dia });
    }
    return saida;
  }

  /* todas as horas planetárias que tocam o intervalo [de, ate] (ms): junta o dia anterior, o do próprio dia e o seguinte */
  function horasEntre(de, ate, lat, lon) {
    var loc = new Date(de + FUSO), todas = [];
    for (var k = -1; k <= Math.ceil((ate - de) / 86400000) + 1; k++) {
      var x = new Date(Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate() + k));
      todas = todas.concat(horasDoDia(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), lat, lon));
    }
    return todas.filter(function (h) { return h.fim > de && h.ini < ate; }).sort(function (p, q) { return p.ini - q.ini; });
  }

  var api = { CALDEIA: CALDEIA, FUSO: FUSO, meiaNoite: meiaNoite, horasDoDia: horasDoDia, horasEntre: horasEntre, nascerEPor: function (a, m, d, lat, lon) { return { nascer: sol(a, m, d, lat, lon, true), por: sol(a, m, d, lat, lon, false) }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.horaPlanetaria = api;
})(this);
