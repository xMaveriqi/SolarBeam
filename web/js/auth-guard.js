(function () {
    const token = localStorage.getItem("solarbeam_token");
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    const paginaAtual = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
    const usuarioNormal = localStorage.getItem("solarbeam_role") !== "admin";
    const paginaDeSetup = paginaAtual === "dispositivos.html";

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

function solarbeamEscapeHTML(valor) {
    const div = document.createElement("div");
    div.textContent = valor == null ? "" : String(valor);
    return div.innerHTML;
}

function solarbeamExigirAdmin() {
    const role = localStorage.getItem("solarbeam_role");
    if (role !== "admin") {
        window.location.href = "dispositivos.html";
    }
}

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

function solarbeamPreencherTopbar() {
    const nome = localStorage.getItem("solarbeam_nome") || localStorage.getItem("solarbeam_usuario") || "Usuário";
    const role = (localStorage.getItem("solarbeam_role") || "").toLowerCase();

    const nomeEl = document.getElementById("loggedUserName");
    const roleEl = document.getElementById("loggedUserRole");

    if (nomeEl) nomeEl.textContent = nome;
    if (roleEl) roleEl.textContent = role === "admin" ? "Administrador" : "Usuário";
}

document.addEventListener("DOMContentLoaded", solarbeamPreencherTopbar);
