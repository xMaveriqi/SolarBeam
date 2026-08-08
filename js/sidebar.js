/* ==========================================================
   SOLAR BEAM
   sidebar.js
   Versão 2.0
========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.getElementById("sidebar");
    const toggleButton = document.getElementById("toggleSidebar");

    if (!sidebar || !toggleButton) {
        console.error("Sidebar ou botão não encontrado.");
        return;
    }

    /* ==========================================
        RESTAURAR ESTADO DA SIDEBAR
    ========================================== */

    const sidebarCollapsed =
        localStorage.getItem("sidebarCollapsed");

    if (sidebarCollapsed === "true") {
        sidebar.classList.add("collapsed");
    }


    /* ==========================================
        BOTÃO DA SIDEBAR
    ========================================== */

    toggleButton.addEventListener("click", (event) => {

        event.stopPropagation();

        /*
         * Desktop:
         * adiciona/remove "collapsed"
         *
         * Mobile:
         * adiciona/remove "open"
         */

        if (window.innerWidth <= 992) {

            sidebar.classList.toggle("open");

        } else {

            sidebar.classList.toggle("collapsed");

            localStorage.setItem(
                "sidebarCollapsed",
                sidebar.classList.contains("collapsed")
            );

        }

    });


    /* ==========================================
        FECHAR SIDEBAR NO MOBILE
    ========================================== */

    document.addEventListener("click", (event) => {

        if (window.innerWidth > 992) {
            return;
        }

        if (
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !toggleButton.contains(event.target)
        ) {

            sidebar.classList.remove("open");

        }

    });


    /* ==========================================
        LINKS DA SIDEBAR
    ========================================== */

    const currentPage =
        window.location.pathname
            .split("/")
            .pop() || "dashboard.html";

    const links =
        document.querySelectorAll(".sidebar nav a");


    links.forEach(link => {

        const href =
            link.getAttribute("href");

        if (href === currentPage) {

            link.parentElement.classList.add("active");

        } else {

            link.parentElement.classList.remove("active");

        }

        /*
         * No celular, fechar a sidebar
         * depois de clicar em uma página.
         */

        link.addEventListener("click", () => {

            if (window.innerWidth <= 992) {

                sidebar.classList.remove("open");

            }

        });

    });


    /* ==========================================
        AJUSTAR AO REDIMENSIONAR A JANELA
    ========================================== */

    window.addEventListener("resize", () => {

        if (window.innerWidth > 992) {

            sidebar.classList.remove("open");

        }

    });

});