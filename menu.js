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
    ".sidemenu-toggle{position:fixed;top:14px;left:14px;z-index:1001;width:42px;height:42px;border-radius:10px;border:1px solid rgba(227,196,106,.65);background:rgba(10,19,48,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}" +
    ".sidemenu-toggle:hover{border-color:#E3C46A;background:rgba(10,19,48,.88)}" +
    ".sidemenu-toggle span,.sidemenu-toggle span::before,.sidemenu-toggle span::after{content:\"\";display:block;width:20px;height:2px;background:#f1e6c6;position:relative}" +
    ".sidemenu-toggle span::before{position:absolute;top:-6px}" +
    ".sidemenu-toggle span::after{position:absolute;top:6px}" +
    ".sidemenu-overlay{position:fixed;inset:0;background:rgba(5,9,25,.6);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:1002}" +
    ".sidemenu-overlay.is-open{opacity:1;pointer-events:auto}" +
    ".sidemenu-panel{position:fixed;top:0;left:0;bottom:0;width:290px;max-width:84vw;transform:translateX(-100%);transition:transform .25s ease;z-index:1003;display:flex;flex-direction:column;padding:18px 0;font-family:'Cinzel',Georgia,serif;border-right:1px solid rgba(227,196,106,.45);box-shadow:2px 0 18px rgba(0,0,0,.5);" +
      "background:" +
        "radial-gradient(1.4px 1.4px at 18% 9%,#f6e7b4 55%,transparent 62%)," +
        "radial-gradient(1px 1px at 72% 14%,#fff 55%,transparent 62%)," +
        "radial-gradient(1.6px 1.6px at 40% 24%,#f6e7b4 55%,transparent 62%)," +
        "radial-gradient(1px 1px at 86% 31%,#fff 55%,transparent 62%)," +
        "radial-gradient(1.3px 1.3px at 12% 40%,#fff 55%,transparent 62%)," +
        "radial-gradient(1px 1px at 58% 47%,#f6e7b4 55%,transparent 62%)," +
        "radial-gradient(ellipse 120% 220px at 50% 100%,rgba(232,112,44,.4) 0%,transparent 100%)," +
        "linear-gradient(to top,#3a2f5e 0%,#23305f 14%,#15214a 40%,#0d1738 70%,#070d25 100%)}" +
    ".sidemenu-panel.is-open{transform:translateX(0)}" +
    ".sidemenu-close{align-self:flex-end;margin:0 14px 10px auto;width:32px;height:32px;border:none;background:transparent;font-size:24px;line-height:1;color:#f1e6c6;cursor:pointer}" +
    ".sidemenu-close:hover{color:#E3C46A}" +
    ".sidemenu-nav{display:flex;flex-direction:column;overflow-y:auto}" +
    ".sidemenu-nav a{padding:14px 24px;color:#efe3c2;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.4px;border-bottom:1px solid rgba(227,196,106,.12)}" +
    ".sidemenu-nav a.is-sep{margin-top:14px;border-top:1px solid rgba(227,196,106,.5)}" +
    ".sidemenu-nav a:hover,.sidemenu-nav a.is-current{color:#E3C46A;background:rgba(227,196,106,.08)}" +
    ".sidemenu-nav a.is-current{border-left:3px solid #E3C46A;padding-left:21px}" +
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

  panel.appendChild(closeBtn);
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
