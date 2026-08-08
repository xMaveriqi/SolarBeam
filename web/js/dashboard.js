/* ==========================================================
   SOLAR BEAM
   dashboard.js
   Versão 2.0
   Sem simulador fake
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const btnPumpOn = document.getElementById("btnPumpOn");
    const btnPumpOff = document.getElementById("btnPumpOff");
    const btnRefresh = document.getElementById("btnRefresh");
    const btnDevices = document.getElementById("btnDevices");
    const btnHistory = document.getElementById("btnHistory");
    const btnSettings = document.getElementById("btnSettings");

    const soilHumidity = document.getElementById("soilHumidity");
    const temperature = document.getElementById("temperature");
    const battery = document.getElementById("battery");
    const pumpStatus = document.getElementById("pumpStatus");
    const lastUpdate = document.getElementById("lastUpdate");

    const espStatus = document.getElementById("espStatus");
    const wifiStatus = document.getElementById("wifiStatus");
    const solarStatus = document.getElementById("solarStatus");

    const notificationButton = document.getElementById("notificationButton");
    const notificationBadge = document.getElementById("notificationBadge");
    const notificationsPanel = document.getElementById("notificationsPanel");
    const dashboardNotifications = document.getElementById("dashboardNotifications");
    const clearNotifications = document.getElementById("clearNotifications");

    carregarStatus();

    btnPumpOn?.addEventListener("click", () => enviarComando(true));
    btnPumpOff?.addEventListener("click", () => enviarComando(false));
    btnRefresh?.addEventListener("click", carregarStatus);

    btnDevices?.addEventListener("click", () => {
        window.location.href = "dispositivos.html";
    });

    btnHistory?.addEventListener("click", () => {
        window.location.href = "historico.html";
    });

    btnSettings?.addEventListener("click", () => {
        window.location.href = "configuracoes.html";
    });

    notificationButton?.addEventListener("click", () => {
        if (!notificationsPanel) return;

        const isHidden = notificationsPanel.hasAttribute("hidden");

        if (isHidden) {
            notificationsPanel.removeAttribute("hidden");
            notificationButton.setAttribute("aria-expanded", "true");

            notificationsPanel.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        } else {
            notificationsPanel.setAttribute("hidden", "");
            notificationButton.setAttribute("aria-expanded", "false");
        }
    });

    clearNotifications?.addEventListener("click", () => {
        if (!dashboardNotifications) return;

        dashboardNotifications.innerHTML = `
            <div class="empty-notification">
                <i class="fa-regular fa-bell-slash"></i>
                <span>Nenhum alerta no momento.</span>
            </div>
        `;

        atualizarBadge(0);
    });

    async function carregarStatus() {
        if (!btnRefresh) return;

        btnRefresh.disabled = true;
        btnRefresh.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Atualizando...</span>
        `;

        try {
            const resposta = await fetch(`${API_URL}/api/status`, {
                headers: typeof solarbeamAuthHeaders === "function"
                    ? solarbeamAuthHeaders()
                    : {}
            });

            if (resposta.status === 401) {
                tratarSessaoExpirada();
                return;
            }

            if (resposta.status === 404) {
                atualizarInterfaceSemDados();
                adicionarAlerta(
                    "Sem leituras",
                    "Ainda não há uma leitura registrada para o dispositivo.",
                    "warning"
                );
                return;
            }

            if (!resposta.ok) {
                throw new Error("Falha ao buscar status");
            }

            const dados = await resposta.json();

            atualizarInterface(dados);
            analisarAlertas(dados);

        } catch (err) {
            console.error("Erro ao buscar status:", err);

            atualizarStatusSistema(
                espStatus,
                "Offline",
                "offline"
            );

            atualizarStatusSistema(
                wifiStatus,
                "Indisponível",
                "offline"
            );

            adicionarAlerta(
                "Servidor indisponível",
                "Não foi possível atualizar os dados do dispositivo.",
                "error"
            );

        } finally {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = `
                <i class="fa-solid fa-rotate"></i>
                <span>Atualizar Sensores</span>
            `;
        }
    }

    function atualizarInterface(dados) {
        if (soilHumidity) {
            soilHumidity.textContent =
                dados.umidade != null ? `${dados.umidade}%` : "--";
        }

        if (temperature) {
            temperature.textContent =
                dados.temperatura != null ? `${dados.temperatura}°C` : "--";
        }

        if (battery) {
            battery.textContent =
                dados.bateria != null ? `${dados.bateria}V` : "--";
        }

        if (pumpStatus) {
            pumpStatus.textContent =
                dados.bomba ? "Ligada" : "Desligada";
        }

        if (lastUpdate) {
            lastUpdate.textContent =
                dados.ultimaAtualizacao || "--";
        }

        atualizarStatusSistema(espStatus, "Online", "online");

        if (wifiStatus) {
            atualizarStatusSistema(
                wifiStatus,
                dados.wifi === false ? "Desconectado" : "Conectado",
                dados.wifi === false ? "offline" : "online"
            );
        }

        if (solarStatus) {
            atualizarStatusSistema(
                solarStatus,
                dados.energiaSolar === false ? "Inativa" : "Ativa",
                dados.energiaSolar === false ? "warning" : "online"
            );
        }
    }

    function atualizarInterfaceSemDados() {
        if (soilHumidity) soilHumidity.textContent = "--";
        if (temperature) temperature.textContent = "--";
        if (battery) battery.textContent = "--";
        if (pumpStatus) pumpStatus.textContent = "--";
        if (lastUpdate) lastUpdate.textContent = "--";

        atualizarStatusSistema(espStatus, "Sem dados", "warning");
        atualizarStatusSistema(wifiStatus, "Sem dados", "warning");
        atualizarStatusSistema(solarStatus, "Sem dados", "warning");
    }

    function atualizarStatusSistema(element, texto, classe) {
        if (!element) return;

        element.textContent = texto;
        element.classList.remove("online", "offline", "warning");
        element.classList.add(classe);
    }

    async function enviarComando(ligar) {
        const button = ligar ? btnPumpOn : btnPumpOff;

        if (button) {
            button.disabled = true;
        }

        try {
            const resposta = await fetch(`${API_URL}/api/comando`, {
                method: "POST",
                headers: typeof solarbeamAuthHeaders === "function"
                    ? solarbeamAuthHeaders()
                    : { "Content-Type": "application/json" },
                body: JSON.stringify({ bomba: ligar })
            });

            if (resposta.status === 401) {
                tratarSessaoExpirada();
                return;
            }

            const dados = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                throw new Error(dados.erro || "Erro ao enviar comando.");
            }

            adicionarAlerta(
                ligar ? "Bomba ligada" : "Bomba desligada",
                ligar
                    ? "O comando para ligar a bomba foi enviado."
                    : "O comando para desligar a bomba foi enviado.",
                ligar ? "success" : "warning"
            );

            await carregarStatus();

        } catch (err) {
            console.error("Erro ao enviar comando:", err);

            adicionarAlerta(
                "Falha no comando",
                err.message || "Não foi possível enviar o comando.",
                "error"
            );
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function analisarAlertas(dados) {
        // Estes alertas são baseados somente nos dados recebidos.
        // Os limites de bateria/umidade serão tornados configuráveis
        // quando a página de configurações for implementada.

        if (dados.bateria != null && Number(dados.bateria) < 3.6) {
            adicionarAlerta(
                "Bateria baixa",
                `A bateria está em ${dados.bateria}V.`,
                "warning"
            );
        }

        if (dados.bomba === false) {
            adicionarAlerta(
                "Bomba desligada",
                "A bomba do dispositivo está desligada.",
                "warning"
            );
        }
    }

    function adicionarAlerta(titulo, mensagem, tipo = "warning") {
        if (!dashboardNotifications) return;

        const vazio = dashboardNotifications.querySelector(".empty-notification");

        if (vazio) {
            vazio.remove();
        }

        const item = document.createElement("div");
        item.className = `dashboard-notification ${tipo}`;

        const icon =
            tipo === "error"
                ? "fa-triangle-exclamation"
                : tipo === "success"
                    ? "fa-circle-check"
                    : "fa-circle-exclamation";

        item.innerHTML = `
            <div class="notification-icon">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="notification-content">
                <strong>${escaparHTML(titulo)}</strong>
                <span>${escaparHTML(mensagem)}</span>
            </div>
            <button type="button" class="notification-close" aria-label="Fechar">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        item.querySelector(".notification-close")?.addEventListener("click", () => {
            item.remove();

            if (!dashboardNotifications.children.length) {
                dashboardNotifications.innerHTML = `
                    <div class="empty-notification">
                        <i class="fa-regular fa-bell-slash"></i>
                        <span>Nenhum alerta no momento.</span>
                    </div>
                `;
            }

            atualizarBadge(dashboardNotifications.querySelectorAll(".dashboard-notification").length);
        });

        dashboardNotifications.prepend(item);

        const total = dashboardNotifications.querySelectorAll(".dashboard-notification").length;
        atualizarBadge(total);
    }

    function atualizarBadge(total) {
        if (!notificationBadge) return;

        notificationBadge.textContent = String(total);
        notificationBadge.hidden = total === 0;
    }

    function tratarSessaoExpirada() {
        adicionarAlerta(
            "Sessão expirada",
            "Faça login novamente para continuar.",
            "error"
        );

        if (typeof solarbeamLogout === "function") {
            solarbeamLogout();
        } else {
            window.location.href = "index.html";
        }
    }

    function escaparHTML(valor) {
        return String(valor)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
});
