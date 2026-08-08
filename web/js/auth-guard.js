// Inclua este script em qualquer pagina interna que exija login
(function () {
    const token = localStorage.getItem("solarbeam_token");
    if (!token) {
        window.location.href = "index.html";
    }
})();

function solarbeamLogout() {
    localStorage.removeItem("solarbeam_token");
    localStorage.removeItem("solarbeam_usuario");
    localStorage.removeItem("solarbeam_role");
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
