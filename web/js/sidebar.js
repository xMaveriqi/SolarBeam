document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("toggleSidebar");
    if (!sidebar || !toggle) return;

    const KEY = "solarbeam_sidebar_collapsed";

    function setCollapsed(collapsed, save = true) {
        sidebar.classList.toggle("collapsed", collapsed);
        sidebar.classList.toggle("open", !collapsed);
        toggle.setAttribute("aria-expanded", String(!collapsed));
        if (save) localStorage.setItem(KEY, String(collapsed));
    }

    // Em telas compactas a sidebar começa fechada para não ocupar
    // espaço do conteúdo. O usuário pode abri-la pelo botão do sol.
    // Em desktop, a preferência salva continua sendo respeitada.
    const saved = localStorage.getItem(KEY);
    const compactScreen = window.innerWidth <= 1200;
    const initialCollapsed = compactScreen
        ? true
        : (saved === null ? false : saved === "true");

    setCollapsed(initialCollapsed, false);

    // Se a janela mudar de desktop para tablet/celular, fecha a sidebar
    // para preservar a largura útil da página.
    let wasCompact = compactScreen;
    window.addEventListener("resize", () => {
        const nowCompact = window.innerWidth <= 1200;
        if (nowCompact && !wasCompact) {
            setCollapsed(true, false);
        }
        wasCompact = nowCompact;
    });

    toggle.addEventListener("click", (event) => {
        event.preventDefault();
        const collapsed = !sidebar.classList.contains("collapsed");
        setCollapsed(collapsed);
    });

    // The logo name itself returns to Dashboard.
    const logoName = sidebar.querySelector(".logo-name");
    if (logoName) {
        logoName.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    }

    // Mark current page.
    const current = (location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
    const currentSection = current === "dispositivo-detalhe.html" ? "dispositivos.html" : current;
    sidebar.querySelectorAll(".sidebar-nav a").forEach(link => {
        const href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
        const item = link.closest("li");
        if (item) item.classList.toggle("active", href === currentSection);
    });

    // Admin visibility is based on the role saved by the login flow.
    const role = (localStorage.getItem("solarbeam_role") || "").toLowerCase();
    sidebar.querySelectorAll("[data-admin-only]").forEach(item => {
        item.style.display = role === "admin" ? "" : "none";
    });

    // Sensores, Irrigação e Energia só aparecem após configuração do firmware.
    const linksDeDispositivo = new Set(["sensores.html", "irrigacao.html", "energia.html"]);
    const roleAtual = (localStorage.getItem("solarbeam_role") || "").toLowerCase();
    if (roleAtual !== "admin" && typeof API_URL !== "undefined" && typeof solarbeamAuthHeaders === "function") {
        fetch(`${API_URL}/api/dispositivos`, { headers: solarbeamAuthHeaders() })
            .then((resposta) => resposta.ok ? resposta.json() : [])
            .then((dispositivos) => {
                const configurado = dispositivos.some((d) => Number(d.firmware_configurado) === 1);
                sidebar.querySelectorAll(".sidebar-nav a").forEach((link) => {
                    const href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
                    if (linksDeDispositivo.has(href)) {
                        const item = link.closest("li");
                        if (item) item.hidden = !configurado;
                    }
                });
            }).catch(() => {
                sidebar.querySelectorAll(".sidebar-nav a").forEach((link) => {
                    const href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
                    if (linksDeDispositivo.has(href) && link.closest("li")) link.closest("li").hidden = true;
                });
            });
    }

    // Logout must clear the local session instead of merely navigating.
    const logout = document.getElementById("logoutLink");
    if (logout) {
        logout.addEventListener("click", (event) => {
            event.preventDefault();
            if (typeof solarbeamLogout === "function") {
                solarbeamLogout();
            } else {
                localStorage.removeItem("solarbeam_token");
                localStorage.removeItem("solarbeam_usuario");
                localStorage.removeItem("solarbeam_role");
                window.location.href = "index.html";
            }
        });
    }

    // Escape collapses the menu, but it stays visible as the narrow icon rail.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setCollapsed(true);
    });
});