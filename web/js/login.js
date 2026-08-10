document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");
    const loginButton = document.getElementById("loginButton");
    const loading = document.getElementById("loading");
    const loginMessage = document.getElementById("loginMessage");

    togglePassword.addEventListener("click", () => {
        const type = password.getAttribute("type") === "password" ? "text" : "password";
        password.setAttribute("type", type);

        const icon = togglePassword.querySelector("i");
        if (type === "password") {
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        } else {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    });

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        loginMessage.textContent = "";
        loginMessage.className = "login-message";

        const user = username.value.trim();
        const pass = password.value.trim();

        if (user === "") {
            showError("Digite seu usuário.");
            username.focus();
            return;
        }

        if (pass === "") {
            showError("Digite sua senha.");
            password.focus();
            return;
        }

        startLoading();

        try {
            const resposta = await fetch(`${API_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario: user, senha: pass }),
            });

            const dados = await resposta.json();

            stopLoading();

            if (!resposta.ok) {
                showError(dados.erro || "Usuário ou senha incorretos.");
                return;
            }

            localStorage.setItem("solarbeam_token", dados.token);
            localStorage.setItem("solarbeam_usuario", user);
            localStorage.setItem("solarbeam_role", dados.role);
            localStorage.setItem("solarbeam_nome", dados.nome || user);
            if (dados.id != null) localStorage.setItem("solarbeam_id", dados.id);

            showSuccess("Login realizado com sucesso!");

            setTimeout(() => {
                window.location.href = dados.role === "admin"
                    ? "dashboard.html"
                    : "dispositivos.html?setup=1";
            }, 800);

        } catch (err) {
            stopLoading();
            showError("Não foi possível conectar ao servidor. Tente novamente.");
            console.error("Erro no login:", err);
        }
    });

    username.addEventListener("keypress", (e) => {
        if (e.key === "Enter") password.focus();
    });

    function startLoading() {
        loginButton.disabled = true;
        loading.classList.add("active");
        loginButton.querySelector("span").textContent = "Entrando...";
    }

    function stopLoading() {
        loginButton.disabled = false;
        loading.classList.remove("active");
        loginButton.querySelector("span").textContent = "Entrar";
    }

    function showError(message) {
        loginMessage.textContent = message;
        loginMessage.classList.add("error");
    }

    function showSuccess(message) {
        loginMessage.textContent = message;
        loginMessage.classList.add("success");
    }
});
