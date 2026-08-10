// Inclua este script em qualquer pagina interna que exija login
(function () {
    const token = localStorage.getItem("solarbeam_token");
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    const paginaAtual = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
    const usuarioNormal = localStorage.getItem("solarbeam_role") !== "admin";
    const paginaDeSetup = paginaAtual === "dispositivos.html";

    if (usuarioNormal && !paginaDeSetup && typeof API_URL !== "undefined") {
        fetch(`${API_URL}/api/dispositivos`, { headers: solarbeamAuthHeaders() })
            .then((resposta) => resposta.ok ? resposta.json() : [])
            .then((dispositivos) => {
                const possuiEspConfigurado = dispositivos.some((dispositivo) => Number(dispositivo.firmware_configurado) === 1);
                if (!possuiEspConfigurado) window.location.replace("dispositivos.html?setup=1");
            })
            .catch(() => {});
    }

    if (usuarioNormal && paginaDeSetup) {
        document.documentElement.classList.add("setup-mode");
    }
})();

function solarbeamLogout() {
    localStorage.removeItem("solarbeam_token");
    localStorage.removeItem("solarbeam_usuario");
    localStorage.removeItem("solarbeam_role");
    localStorage.removeItem("solarbeam_nome");
    localStorage.removeItem("solarbeam_id");
    localStorage.removeItem("solarbeam_dispositivo_atual");
    window.location.href = "index.html";
}

function solarbeamAuthHeaders() {
    const token = localStorage.getItem("solarbeam_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    };
}

// Chame no topo de paginas exclusivas de admin (ex: usuarios.html)
function solarbeamExigirAdmin() {
    const role = localStorage.getItem("solarbeam_role");
    if (role !== "admin") {
        window.location.href = "dispositivos.html";
    }
}

// Guarda/le qual dispositivo o usuario esta olhando (definido ao entrar
// pelo "Ver Dashboard" em Dispositivos). Paginas como Sensores, Irrigação
// e Energia usam isso para saber de qual ESP mostrar dados.
function solarbeamSetDispositivoAtual(dispositivo) {
    localStorage.setItem("solarbeam_dispositivo_atual", JSON.stringify(dispositivo));
}

function solarbeamGetDispositivoAtual() {
    try {
        return JSON.parse(localStorage.getItem("solarbeam_dispositivo_atual"));
    } catch (err) {
        return null;
    }
}

function solarbeamGetUsuarioId() {
    const id = localStorage.getItem("solarbeam_id");
    return id ? Number(id) : null;
}

// Preenche o nome e o cargo do usuário logado no topbar de qualquer página
// que tenha os elementos #loggedUserName / #loggedUserRole.
function solarbeamPreencherTopbar() {
    const nome = localStorage.getItem("solarbeam_nome") || localStorage.getItem("solarbeam_usuario") || "Usuário";
    const role = (localStorage.getItem("solarbeam_role") || "").toLowerCase();

    const nomeEl = document.getElementById("loggedUserName");
    const roleEl = document.getElementById("loggedUserRole");

    if (nomeEl) nomeEl.textContent = nome;
    if (roleEl) roleEl.textContent = role === "admin" ? "Administrador" : "Usuário";
}

document.addEventListener("DOMContentLoaded", solarbeamPreencherTopbar);
