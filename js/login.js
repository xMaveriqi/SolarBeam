document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");
    const loginButton = document.getElementById("loginButton");
    const loading = document.getElementById("loading");
    const loginMessage = document.getElementById("loginMessage");



    togglePassword.addEventListener("click", () => {
        const type =
            password.getAttribute("type") === "password"
                ? "text"
                : "password";

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


    loginForm.addEventListener("submit", (event) => {

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


        setTimeout(() => {
            stopLoading();

            if (user === "admin" && pass === "123456") {
                showSuccess("Login realizado com sucesso!");
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1200);

            } else {
                showError("Usuário ou senha incorretos.");
            }

        }, 1800);
    });


    username.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            password.focus();
        }
    });


    function startLoading() {
        loginButton.disabled = true;

        loading.classList.add("active");

        loginButton.querySelector("span").textContent =
            "Entrando...";
    }



    function stopLoading() {
        loginButton.disabled = false;

        loading.classList.remove("active");

        loginButton.querySelector("span").textContent =
            "Entrar";
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