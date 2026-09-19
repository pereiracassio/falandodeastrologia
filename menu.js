(function () {
  var links = [
    { label: "Início", href: "index.html" },
    { label: "Quem sou eu", href: "sobre.html" },
    { label: "Mentoria em Astrologia Clássica", href: "mentoria.html" },
    { label: "Retificação de Mapa", href: "retificacao.html" },
    { label: "Mapa Natal Clássico", href: "mapa-natal.html" },
    { label: "Revolução Solar", href: "revolucao-solar.html" },
    { label: "Previsões Astrológicas", href: "previsoes-astrologicas.html" },
    { label: "Sinastria Clássica", href: "sinastria.html" },
    { label: "Área do Aluno", href: "aluno.html" }
  ];

  var style = document.createElement("style");
  style.textContent =
    ".sidemenu-toggle{position:fixed;top:14px;left:14px;z-index:1001;width:42px;height:42px;border-radius:8px;border:1px solid #103B70;background:#FFFDF5;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.12)}" +
    ".sidemenu-toggle span,.sidemenu-toggle span::before,.sidemenu-toggle span::after{content:\"\";display:block;width:20px;height:2px;background:#103B70;position:relative}" +
    ".sidemenu-toggle span::before{position:absolute;top:-6px}" +
    ".sidemenu-toggle span::after{position:absolute;top:6px}" +
    ".sidemenu-overlay{position:fixed;inset:0;background:rgba(16,59,112,.45);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:1002}" +
    ".sidemenu-overlay.is-open{opacity:1;pointer-events:auto}" +
    ".sidemenu-panel{position:fixed;top:0;left:0;bottom:0;width:280px;max-width:82vw;background:#FFFDF5;box-shadow:2px 0 16px rgba(0,0,0,.18);transform:translateX(-100%);transition:transform .25s ease;z-index:1003;display:flex;flex-direction:column;padding:18px 0;font-family:system-ui,-apple-system,sans-serif}" +
    ".sidemenu-panel.is-open{transform:translateX(0)}" +
    ".sidemenu-close{align-self:flex-end;margin:0 14px 10px auto;width:32px;height:32px;border:none;background:transparent;font-size:22px;line-height:1;color:#103B70;cursor:pointer}" +
    ".sidemenu-nav{display:flex;flex-direction:column;overflow-y:auto}" +
    ".sidemenu-nav a{padding:14px 22px;color:#103B70;text-decoration:none;font-weight:600;font-size:15px;border-bottom:1px solid rgba(16,59,112,.08)}" +
    ".sidemenu-nav a:hover,.sidemenu-nav a.is-current{color:#C59B27;background:rgba(197,155,39,.08)}" +
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
