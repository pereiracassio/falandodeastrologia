// Carrinho do site: guardado no navegador de quem compra (localStorage, chave "fda_carrinho").
// Serviço novo = uma entrada em CARRINHO_SERVICOS (e o botão "Adicionar ao carrinho" na página dele).
(function () {
  var CHAVE = "fda_carrinho";
  var DESCONTO_CENTAVOS = 1100; // R$ 11,00 a partir do 2º serviço

  var CARRINHO_SERVICOS = {
    "mapa-natal":    { titulo: "Mapa Natal Clássico", centavos: 33500, agenda: true, fixo: "https://checkout.infinitepay.io/cassiopereira_/Lr5VzNU3g9" },
    "sinastria":     { titulo: "Sinastria Clássica", centavos: 34800, agenda: true, fixo: "https://checkout.infinitepay.io/cassiopereira_/3juXjWqoYg" },
    "previsoes":     { titulo: "Previsões Astrológicas", centavos: 33500, agenda: true, fixo: "https://checkout.infinitepay.io/cassiopereira_/cM91wDKb7t" },
    "revolucao-solar": { titulo: "Revolução Solar Clássica e Profecção Anual", centavos: 33500, agenda: true, fixo: "https://checkout.infinitepay.io/cassiopereira_/6I2u5POpKN" },
    // Retificação: não aparece no site, só entra no carrinho pelo link que o astrólogo manda
    "retificacao-avulsa": { titulo: "Retificação de Mapa Avulsa", centavos: 33500, agenda: false, restrito: true },
    "retificacao-combo":  { titulo: "Combo: Retificação + Mapa Natal Clássico", centavos: 59900, agenda: true, restrito: true },
    // TESTE (24/10/2026): serviço de R$ 1,00 que não é nenhum serviço de verdade. Só pelo link ?add=servico-teste. REMOVER depois de testar.
    "servico-teste":      { titulo: "Serviço teste", centavos: 100, agenda: false, restrito: true }
  };
  // Mapa Natal + Retificação avulsa no mesmo carrinho viram o combo
  var CARRINHO_RETIFICACAO_MAPA = ["mapa-natal", "retificacao-avulsa"];

  var CHAVE_SAIDA = "fda_carrinho_saida"; // quando a pessoa foi pro pagamento: 30 min depois o carrinho se esvazia sozinho
  function marcarSaida() { try { localStorage.setItem(CHAVE_SAIDA, String(Date.now())); } catch (e) {} }
  function ler() {
    try {
      var saida = parseInt(localStorage.getItem(CHAVE_SAIDA) || "0", 10);
      if (saida && Date.now() - saida > 30 * 60 * 1000) { localStorage.removeItem(CHAVE); localStorage.removeItem(CHAVE_SAIDA); return []; }
      var l = JSON.parse(localStorage.getItem(CHAVE) || "[]");
      if (!Array.isArray(l)) return [];
      return l.filter(function (k, i) { return CARRINHO_SERVICOS[k] && l.indexOf(k) === i; });
    } catch (e) { return []; }
  }
  function gravar(lista) {
    try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { /* sem armazenamento: o carrinho vale só nesta página */ }
    window.__carrinhoMemoria = lista;
  }
  function itens() {
    var lista = ler();
    if (!lista.length && window.__carrinhoMemoria) lista = window.__carrinhoMemoria.slice();
    return lista;
  }
  // Devolve { ok, aviso }. Aplica a regra do combo.
  function adicionar(chave) {
    if (!CARRINHO_SERVICOS[chave]) return { ok: false, aviso: "Serviço não encontrado." };
    var lista = itens();
    if (lista.indexOf(chave) >= 0) return { ok: true, aviso: "Este serviço já está no carrinho." };
    if (lista.indexOf("retificacao-combo") >= 0 && (chave === "mapa-natal" || chave === "retificacao-avulsa")) {
      return { ok: true, aviso: "O combo já inclui isso." };
    }
    if (CARRINHO_RETIFICACAO_MAPA.indexOf(chave) >= 0) {
      var outro = chave === "mapa-natal" ? "retificacao-avulsa" : "mapa-natal";
      if (lista.indexOf(outro) >= 0) {
        lista = lista.filter(function (k) { return k !== outro; });
        lista.push("retificacao-combo");
        gravar(lista);
        return { ok: true, aviso: "Retificação + Mapa Natal viraram o Combo, que sai mais barato." };
      }
    }
    if (chave === "retificacao-combo") {
      lista = lista.filter(function (k) { return k !== "mapa-natal" && k !== "retificacao-avulsa"; });
    }
    lista.push(chave);
    gravar(lista);
    return { ok: true, aviso: "" };
  }
  function remover(chave) { gravar(itens().filter(function (k) { return k !== chave; })); }
  function limpar() { gravar([]); }

  // Itens com o preço final de cada um (centavos). Desconto de R$ 11 do 2º serviço em diante.
  function resumo() {
    // o mais barato fica em primeiro (sem desconto); os demais levam o desconto (no total dá o mesmo, qualquer que seja a ordem)
    var lista = itens().sort(function (a, b) { return CARRINHO_SERVICOS[a].centavos - CARRINHO_SERVICOS[b].centavos; });
    var total = 0, totalCheio = 0, ordem = 0;
    var linhas = lista.map(function (k) {
      var s = CARRINHO_SERVICOS[k];
      var desc = (ordem > 0 && !s.semDesconto) ? DESCONTO_CENTAVOS : 0;
      ordem++;
      totalCheio += s.centavos;
      total += s.centavos - desc;
      return { chave: k, titulo: s.titulo, cheio: s.centavos, desconto: desc, final: s.centavos - desc, agenda: s.agenda, fixo: s.fixo || null };
    });
    return { linhas: linhas, total: total, totalCheio: totalCheio, desconto: totalCheio - total };
  }
  function reais(centavos) {
    return "R$ " + (centavos / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+,)/g, ".");
  }

  window.Carrinho = { servicos: CARRINHO_SERVICOS, itens: itens, adicionar: adicionar, remover: remover, limpar: limpar, marcarSaida: marcarSaida, resumo: resumo, reais: reais, desconto: DESCONTO_CENTAVOS };
})();
