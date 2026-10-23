(function () {
  var links = [
    { label: "Início", href: "index.html" },
    { label: "Quem sou eu", href: "sobre.html" },
    { label: "Meu Carrinho", href: "carrinho.html", carrinho: true },
    { label: "Blog", href: "blog.html" },
    { label: "Mentoria em Astrologia Clássica", href: "mentoria.html", sep: true },
    { label: "Alunos", href: "aluno.html" },
    { label: "Retificação de Mapa", href: "retificacao.html", sep: true },
    { label: "Mapa Natal Clássico", href: "mapa-natal.html" },
    { label: "Revolução Solar", href: "revolucao-solar.html" },
    { label: "Previsões Astrológicas", href: "previsoes-astrologicas.html" },
    { label: "Sinastria Clássica", href: "sinastria.html" },
    { label: "Seu espaço", href: "cliente.html" }
  ];

  // quantos serviços tem no carrinho (guardado no navegador, ver carrinho.js; esvazia 30 min depois de ir pro pagamento)
  function contarCarrinho() {
    try {
      var saida = parseInt(localStorage.getItem("fda_carrinho_saida") || "0", 10);
      if (saida && Date.now() - saida > 30 * 60 * 1000) return 0;
      var l = JSON.parse(localStorage.getItem("fda_carrinho") || "[]");
      return Array.isArray(l) ? l.length : 0;
    } catch (e) { return 0; }
  }

  var style = document.createElement("style");
  style.textContent =
    ".sidemenu-toggle{position:fixed;top:14px;left:14px;z-index:1001;width:42px;height:42px;border:0;background:none;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}" +
    ".sidemenu-toggle:hover span,.sidemenu-toggle:hover span::before,.sidemenu-toggle:hover span::after{background:#8f6a24!important}" +
    ".cart-toggle{position:fixed;top:14px;right:14px;z-index:1001;width:42px;height:42px;border:0;background:none;display:flex;align-items:center;justify-content:center;color:#B5852F;text-decoration:none}" +
    ".cart-toggle:hover{color:#8f6a24}" +
    ".cart-toggle svg{width:30px;height:30px}" +
    ".cart-count{position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:#A03E25;color:#fff;font:700 12px/19px sans-serif;text-align:center}" +
    ".sidemenu-toggle span,.sidemenu-toggle span::before,.sidemenu-toggle span::after{content:\"\";display:block;width:24px;height:3px;background:#B5852F;position:relative}" +
    ".sidemenu-toggle span::before{position:absolute;top:-8px}" +
    ".sidemenu-toggle span::after{position:absolute;top:8px}" +
    ".sidemenu-overlay{position:fixed;inset:0;background:rgba(5,9,25,.6);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:1002}" +
    ".sidemenu-overlay.is-open{opacity:1;pointer-events:auto}" +
    ".sidemenu-panel{position:fixed;top:0;left:0;bottom:0;overflow:hidden;width:290px;max-width:84vw;transform:translateX(-100%);transition:transform .25s ease;z-index:1003;display:flex;flex-direction:column;--moldura-m:.28;padding:calc(130px*var(--moldura-m) + 6px) calc(80px*var(--moldura-m) + 8px) calc(130px*var(--moldura-m) + 6px);font-family:'Cinzel',Georgia,serif;border-right:1px solid transparent;" +
      "background:var(--papiro-fundo);" +
      "clip-path:polygon(0 0, calc(100% - 3px) 0, calc(100% - 2px) 2.2%, calc(100% - 1px) 4.3%, calc(100% - 3px) 6.5%, calc(100% - 5px) 8.7%, calc(100% - 0px) 10.9%, calc(100% - 0px) 13.0%, calc(100% - 4px) 15.2%, calc(100% - 0px) 17.4%, calc(100% - 2px) 19.6%, calc(100% - 4px) 21.7%, calc(100% - 0px) 23.9%, calc(100% - 4px) 26.1%, calc(100% - 1px) 28.3%, calc(100% - 0px) 30.4%, calc(100% - 0px) 32.6%, calc(100% - 3px) 34.8%, calc(100% - 3px) 37.0%, calc(100% - 0px) 39.1%, calc(100% - 1px) 41.3%, calc(100% - 0px) 43.5%, calc(100% - 4px) 45.7%, calc(100% - 3px) 47.8%, calc(100% - 0px) 50.0%, calc(100% - 4px) 52.2%, calc(100% - 0px) 54.3%, calc(100% - 1px) 56.5%, calc(100% - 5px) 58.7%, calc(100% - 5px) 60.9%, calc(100% - 4px) 63.0%, calc(100% - 0px) 65.2%, calc(100% - 4px) 67.4%, calc(100% - 4px) 69.6%, calc(100% - 3px) 71.7%, calc(100% - 0px) 73.9%, calc(100% - 1px) 76.1%, calc(100% - 0px) 78.3%, calc(100% - 4px) 80.4%, calc(100% - 1px) 82.6%, calc(100% - 2px) 84.8%, calc(100% - 3px) 87.0%, calc(100% - 1px) 89.1%, calc(100% - 4px) 91.3%, calc(100% - 0px) 93.5%, calc(100% - 4px) 95.7%, calc(100% - 2px) 97.8%, calc(100% - 2px) 100%, 0 100%)}" +
    ".sidemenu-panel.is-open{transform:translateX(0)}" +
    ".sidemenu-close{position:absolute;top:calc(130px*var(--moldura-m) - 10px);right:calc(80px*var(--moldura-m) + 4px);margin:0;width:32px;height:32px;border:none;background:transparent;font-size:24px;line-height:1;color:#1a1410;cursor:pointer}" +
    ".sidemenu-close:hover{color:#1F5FA3}" +
    ".sidemenu-nav{display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;padding-top:26px;flex:1 1 auto;min-height:0}" +
    ".sidemenu-nav a.sem-linha{border-bottom:0}" +
    ".sidemenu-logo{display:block;text-align:center;margin:0;padding:10px 0 14px;border-bottom:2px solid rgba(31,95,163,.75)}.sidemenu-logo img{width:100%;height:auto;display:block}" +
    ".sidemenu-nav a{padding:var(--item-pad,14px) 8px;color:#1a1410;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.4px;border-bottom:1px solid rgba(95,65,30,.75)}" +
    ".sidemenu-nav a.is-sep{margin-top:0;border-top:2px solid #B5852F}" +
    ".sidemenu-nav a:hover{color:#1F5FA3}" +
    ".sidemenu-nav a.is-current{color:#1F5FA3;border-left:3px solid #1F5FA3;padding-left:5px}" +
    "body.sidemenu-lock{overflow:hidden}";
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.className = "sidemenu-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Abrir menu");
  toggle.innerHTML = "<span></span>";

  var overlay = document.createElement("div");
  overlay.className = "sidemenu-overlay";

  var panel = document.createElement("div");
  panel.className = "sidemenu-panel papiro-moldura";

  var closeBtn = document.createElement("button");
  closeBtn.className = "sidemenu-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Fechar menu");
  closeBtn.innerHTML = "&times;";

  var nav = document.createElement("nav");
  nav.className = "sidemenu-nav";

  var currentPage = window.location.pathname.split("/").pop() || "index.html";

  links.forEach(function (link) {
    var a = document.createElement("a");
    a.href = "/" + link.href; /* com a barra no começo, vale também dentro de /blog/ e /assunto/ */
    a.textContent = link.label;
    if (link.carrinho && contarCarrinho() > 0) a.textContent += " (" + contarCarrinho() + ")";
    if (link.sep) { a.classList.add("is-sep"); if (nav.lastChild) nav.lastChild.classList.add("sem-linha"); } /* onde entra a linha ocre, a linha fina de cima sai */
    if (link.href === currentPage) a.classList.add("is-current");
    nav.appendChild(a);
  });

  if (nav.lastChild) nav.lastChild.classList.add("sem-linha");
  panel.appendChild(closeBtn);
  panel.appendChild(nav);

  var cart = document.createElement("a");
  cart.className = "cart-toggle";
  cart.href = "/carrinho.html";
  cart.setAttribute("aria-label", "Meu carrinho");
  cart.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 3h3.2l.7 2.5H22l-2.2 8.2a1.6 1.6 0 0 1-1.5 1.2H8.3l.4 1.6H19v2.2H7.2L4 5.2H1.5z"/><circle cx="9" cy="21" r="1.6"/><circle cx="17.5" cy="21" r="1.6"/></svg>';
  // a página do carrinho chama isto quando a pessoa tira um serviço
  window.atualizarContadorCarrinho = function () {
    var antigo = cart.querySelector(".cart-count");
    if (antigo) cart.removeChild(antigo);
    var q = contarCarrinho();
    if (q > 0) {
      var n = document.createElement("span");
      n.className = "cart-count";
      n.textContent = q;
      cart.appendChild(n);
    }
  };
  window.atualizarContadorCarrinho();

  document.body.appendChild(toggle);
  document.body.appendChild(cart);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  /* a lista cabe sempre na altura que está visível de verdade (medida na hora, não por vh, que no Safari do iPad é maior que a tela) */
  function ajustarEspaco() {
    var itens = nav.querySelectorAll("a"), n = itens.length;
    if (!n) return;
    nav.style.setProperty("--item-pad", "14px");
    var disponivel = nav.clientHeight, ocupado = nav.scrollHeight;
    if (ocupado <= disponivel + 1) return;
    var pad = 14 - (ocupado - disponivel) / (2 * n) - 0.5;
    nav.style.setProperty("--item-pad", Math.max(3, pad).toFixed(1) + "px");
  }
  window.addEventListener("resize", ajustarEspaco);

  function openMenu() {
    ajustarEspaco();
    overlay.classList.add("is-open");
    panel.classList.add("is-open");
    document.body.classList.add("sidemenu-lock");
  }

  function closeMenu() {
    overlay.classList.remove("is-open");
    panel.classList.remove("is-open");
    document.body.classList.remove("sidemenu-lock");
  }

  toggle.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });
})();
