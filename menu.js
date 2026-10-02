(function () {
  var links = [
    { label: "Início", href: "index.html" },
    { label: "Quem sou eu", href: "sobre.html" },
    { label: "Mentoria em Astrologia Clássica", href: "mentoria.html", sep: true },
    { label: "Retificação de Mapa", href: "retificacao.html" },
    { label: "Mapa Natal Clássico", href: "mapa-natal.html", sep: true },
    { label: "Revolução Solar", href: "revolucao-solar.html" },
    { label: "Previsões Astrológicas", href: "previsoes-astrologicas.html" },
    { label: "Sinastria Clássica", href: "sinastria.html" },
    { label: "Área do Aluno", href: "aluno.html", sep: true }
  ];

  var style = document.createElement("style");
  style.textContent =
    ".sidemenu-toggle{position:fixed;top:14px;left:14px;z-index:1001;width:42px;height:42px;border-radius:10px;border:1px solid rgba(181,133,47,.65);background:rgba(10,19,48,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}" +
    ".sidemenu-toggle:hover{border-color:#B5852F;background:rgba(10,19,48,.88)}" +
    ".sidemenu-toggle span,.sidemenu-toggle span::before,.sidemenu-toggle span::after{content:\"\";display:block;width:20px;height:2px;background:#f1e6c6;position:relative}" +
    ".sidemenu-toggle span::before{position:absolute;top:-6px}" +
    ".sidemenu-toggle span::after{position:absolute;top:6px}" +
    ".sidemenu-overlay{position:fixed;inset:0;background:rgba(5,9,25,.6);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:1002}" +
    ".sidemenu-overlay.is-open{opacity:1;pointer-events:auto}" +
    ".sidemenu-panel{position:fixed;top:0;left:0;bottom:0;width:290px;max-width:84vw;transform:translateX(-100%);transition:transform .25s ease;z-index:1003;display:flex;flex-direction:column;padding:10px 0 18px;font-family:'Cinzel',Georgia,serif;border-right:1px solid transparent;" +
      "background:" +
        "radial-gradient(ellipse at 50% 50%,transparent 60%,rgba(80,48,20,.25) 100%)," +
        "radial-gradient(ellipse at 15% 6%,rgba(240,222,180,.5) 0%,transparent 40%)," +
        "repeating-linear-gradient(0deg,rgba(95,65,30,.10) 0px,rgba(95,65,30,.10) 1px,transparent 1px,transparent 5px)," +
        "repeating-linear-gradient(90deg,rgba(110,78,40,.07) 0px,rgba(110,78,40,.07) 2px,transparent 2px,transparent 25px)," +
        "linear-gradient(180deg,#d6bd92 0%,#c8a878 55%,#b98f5f 100%);" +
      "clip-path:polygon(0 0, calc(100% - 3px) 0, calc(100% - 2px) 2.2%, calc(100% - 1px) 4.3%, calc(100% - 3px) 6.5%, calc(100% - 5px) 8.7%, calc(100% - 0px) 10.9%, calc(100% - 0px) 13.0%, calc(100% - 4px) 15.2%, calc(100% - 0px) 17.4%, calc(100% - 2px) 19.6%, calc(100% - 4px) 21.7%, calc(100% - 0px) 23.9%, calc(100% - 4px) 26.1%, calc(100% - 1px) 28.3%, calc(100% - 0px) 30.4%, calc(100% - 0px) 32.6%, calc(100% - 3px) 34.8%, calc(100% - 3px) 37.0%, calc(100% - 0px) 39.1%, calc(100% - 1px) 41.3%, calc(100% - 0px) 43.5%, calc(100% - 4px) 45.7%, calc(100% - 3px) 47.8%, calc(100% - 0px) 50.0%, calc(100% - 4px) 52.2%, calc(100% - 0px) 54.3%, calc(100% - 1px) 56.5%, calc(100% - 5px) 58.7%, calc(100% - 5px) 60.9%, calc(100% - 4px) 63.0%, calc(100% - 0px) 65.2%, calc(100% - 4px) 67.4%, calc(100% - 4px) 69.6%, calc(100% - 3px) 71.7%, calc(100% - 0px) 73.9%, calc(100% - 1px) 76.1%, calc(100% - 0px) 78.3%, calc(100% - 4px) 80.4%, calc(100% - 1px) 82.6%, calc(100% - 2px) 84.8%, calc(100% - 3px) 87.0%, calc(100% - 1px) 89.1%, calc(100% - 4px) 91.3%, calc(100% - 0px) 93.5%, calc(100% - 4px) 95.7%, calc(100% - 2px) 97.8%, calc(100% - 2px) 100%, 0 100%)}" +
    ".sidemenu-panel.is-open{transform:translateX(0)}" +
    ".sidemenu-close{align-self:flex-end;margin:0 12px 0 auto;width:32px;height:32px;border:none;background:transparent;font-size:24px;line-height:1;color:#1a1410;cursor:pointer}" +
    ".sidemenu-close:hover{color:#1F5FA3}" +
    ".sidemenu-nav{display:flex;flex-direction:column;overflow-y:auto}" +
    ".sidemenu-logo{display:block;text-align:center;margin:0 16px;padding:0 0 14px;border-bottom:1px solid rgba(31,95,163,.55)}.sidemenu-logo img{width:100%;height:auto;display:block}" +
    ".sidemenu-nav a{padding:14px 24px;color:#1a1410;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.4px;border-bottom:1px solid rgba(95,65,30,.4)}" +
    ".sidemenu-nav a.is-sep{margin-top:14px;border-top:1px solid #B5852F}" +
    ".sidemenu-nav a:hover{color:#1F5FA3}" +
    ".sidemenu-nav a.is-current{color:#1F5FA3;border-left:3px solid #1F5FA3;padding-left:21px}" +
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
  panel.className = "sidemenu-panel";

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
    a.href = link.href;
    a.textContent = link.label;
    if (link.sep) a.classList.add("is-sep");
    if (link.href === currentPage) a.classList.add("is-current");
    nav.appendChild(a);
  });

  var logo = document.createElement("a");
  logo.className = "sidemenu-logo";
  logo.href = "index.html";
  logo.innerHTML = '<img src="img/logo-menu.svg" alt="Falando de Astrologia Helenística" width="1140" height="340">';

  panel.appendChild(closeBtn);
  panel.appendChild(logo);
  panel.appendChild(nav);

  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  function openMenu() {
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
