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

    // Desktop: remember the user's choice.
    // Mobile/tablet: also starts collapsed so the sun is always available.
    const saved = localStorage.getItem(KEY);
    setCollapsed(saved === null ? false : saved === "true", false);

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
    sidebar.querySelectorAll(".sidebar-nav a").forEach(link => {
        const href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
        const item = link.closest("li");
        if (item) item.classList.toggle("active", href === current);
    });

    // Admin visibility is based on the role saved by the login flow.
    const role = (localStorage.getItem("solarbeam_role") || "").toLowerCase();
    sidebar.querySelectorAll("[data-admin-only]").forEach(item => {
        item.style.display = role === "admin" ? "" : "none";
    });

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