/* ==========================================================
   SOLAR BEAM
   dashboard.js
   Versão 3.0
   Agora exige um dispositivo vinculado antes de mostrar dados
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
    const waterLevel = document.getElementById("waterLevel");
    const batteryAutonomy = document.getElementById("batteryAutonomy");
    const lastUpdate = document.getElementById("lastUpdate");

    const espStatus = document.getElementById("espStatus");
    const wifiStatus = document.getElementById("wifiStatus");
    const solarStatus = document.getElementById("solarStatus");
    const firmwareVersion = document.getElementById("firmwareVersion");
    const adminSystemPanel = document.getElementById("adminSystemPanel");
    const adminMetrics = document.getElementById("adminMetrics");
    const adminSystemList = document.getElementById("adminSystemList");
    const refreshAdminSystems = document.getElementById("refreshAdminSystems");
    const clearDatabase = document.getElementById("clearDatabase");
    const adminSystemMessage = document.getElementById("adminSystemMessage");

    const notificationButton = document.getElementById("notificationButton");
    const notificationBadge = document.getElementById("notificationBadge");
    const notificationsPanel = document.getElementById("notificationsPanel");
    const dashboardNotifications = document.getElementById("dashboardNotifications");
    const clearNotifications = document.getElementById("clearNotifications");
    const systemStatusPill = document.getElementById("systemStatusPill");
    const systemStatusText = document.getElementById("systemStatusText");
    const summarySistema = document.getElementById("summarySistema");
    const summaryBomba = document.getElementById("summaryBomba");
    const summaryBateria = document.getElementById("summaryBateria");
    const summaryAtualizacao = document.getElementById("summaryAtualizacao");

    const semDispositivoPanel = document.getElementById("semDispositivoPanel");
    const dashboardContent = document.getElementById("dashboardContent");
    const dashboardDevicesPanel = document.getElementById("dashboardDevicesPanel");
    const dashboardDevicesList = document.getElementById("dashboardDevicesList");
    const dispositivoSelect = document.getElementById("dispositivoSelect");

    let dispositivoAtual = null; // { id, nome, codigo }
    let bombaPendente = null;
    let ultimaLeituraBombaMs = 0;
    let carregandoStatus = false;
    let timerStatus = null;
    const INTERVALO_STATUS_MS = 15000;

    inicializar();
    iniciarPollingStatus();
    window.addEventListener("beforeunload", pararPollingStatus);

    const isAdmin = localStorage.getItem("solarbeam_role") === "admin";
    if (isAdmin) {
        adminSystemPanel.hidden = false;
        carregarResumoAdmin();
        refreshAdminSystems.addEventListener("click", carregarResumoAdmin);
        clearDatabase.addEventListener("click", limparBanco);
    }

    btnPumpOn?.addEventListener("click", () => enviarComando(true));
    btnPumpOff?.addEventListener("click", () => enviarComando(false));
    btnRefresh?.addEventListener("click", () => carregarStatus());

    btnDevices?.addEventListener("click", () => {
        window.location.href = "dispositivos.html";
    });

    btnHistory?.addEventListener("click", () => {
        window.location.href = "historico.html";
    });

    btnSettings?.addEventListener("click", () => {
        window.location.href = "configuracoes.html";
    });

    dispositivoSelect?.addEventListener("change", () => {
        const escolhido = dispositivosCarregados.find((d) => String(d.id) === dispositivoSelect.value);
        if (escolhido) {
            selecionarDispositivo(escolhido);
            carregarStatus();
        }
    });

    notificationButton?.addEventListener("click", () => {
        if (!notificationsPanel) return;

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

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

    let dispositivosCarregados = [];
    let socketRealtime = null;
    let socketReconnectTimer = null;

    function conectarWebSocket() {
        if (typeof WebSocket === "undefined") return;
        if (socketRealtime && (socketRealtime.readyState === WebSocket.OPEN || socketRealtime.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws`;
        socketRealtime = new WebSocket(wsUrl);

        socketRealtime.addEventListener("open", () => {
            console.info("WebSocket conectado para atualizações ao vivo.");
            if (socketReconnectTimer) {
                window.clearTimeout(socketReconnectTimer);
                socketReconnectTimer = null;
            }
        });

        socketRealtime.addEventListener("message", (evento) => {
            try {
                const mensagem = JSON.parse(evento.data);
                if (mensagem?.type !== "status-update" || !mensagem?.payload) return;

                const payload = mensagem.payload;
                if (!dispositivoAtual || Number(payload.dispositivoId) !== Number(dispositivoAtual.id)) {
                    return;
                }

                atualizarInterface({
                    ...payload,
                    online: payload.online ?? true,
                    wifi: payload.wifi ?? true,
                    energiaSolar: payload.energiaSolar ?? true,
                    ultimaAtualizacao: payload.ultimaAtualizacao || "agora",
                });
            } catch (erro) {
                console.error("Erro ao processar mensagem WebSocket:", erro);
            }
        });

        socketRealtime.addEventListener("close", () => {
            socketRealtime = null;
            if (!document.hidden) {
                socketReconnectTimer = window.setTimeout(() => conectarWebSocket(), 3000);
            }
        });
    }

    async function carregarResumoAdmin() {
        adminSystemMessage.textContent = "Carregando sistemas...";
        try {
            const resposta = await fetch(`${API_URL}/api/admin/resumo`, { headers: solarbeamAuthHeaders() });
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.erro || "Erro ao carregar resumo.");

            adminMetrics.innerHTML = Object.entries({
                Usuários: dados.totais.usuarios,
                ESPs: dados.totais.dispositivos,
                Online: dados.totais.online,
                Offline: dados.totais.offline,
                Leituras: dados.totais.leituras,
                "Comandos pendentes": dados.totais.comandosPendentes,
            }).map(([label, value]) => `<div class="admin-metric"><span>${label}</span><strong>${value}</strong></div>`).join("");

            adminSystemList.innerHTML = dados.dispositivos.length
                ? dados.dispositivos.map((dispositivo) => `<div class="admin-system-row"><div><strong>${escaparHTML(dispositivo.nome)}</strong><small>${escaparHTML(dispositivo.dono || "Sem usuário")} · ${dispositivo.codigo}</small></div><span class="admin-status ${dispositivo.online ? "online" : "offline"}">${dispositivo.online ? "Online" : "Offline"}</span><small>${dispositivo.versao_firmware || "Firmware pendente"}</small></div>`).join("")
                : '<p class="empty-notification">Nenhum ESP cadastrado.</p>';
            adminSystemMessage.textContent = "";
        } catch (error) {
            adminSystemMessage.textContent = error.message;
            adminSystemMessage.className = "message error";
        }
    }

    async function limparBanco() {
        if (!window.confirm("Isso removerá todos os usuários, ESPs, leituras e configurações, preservando apenas sua conta admin. Continuar?")) return;
        const confirmacao = window.prompt("Digite LIMPAR_BANCO para confirmar:");
        if (confirmacao !== "LIMPAR_BANCO") return;
        try {
            clearDatabase.disabled = true;
            const resposta = await fetch(`${API_URL}/api/admin/limpar`, { method: "POST", headers: solarbeamAuthHeaders(), body: JSON.stringify({ confirmacao }) });
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.erro || "Erro ao limpar banco.");
            adminSystemMessage.textContent = dados.mensagem;
            adminSystemMessage.className = "message success";
            await carregarResumoAdmin();
            mostrarSemDispositivo();
        } catch (error) {
            adminSystemMessage.textContent = error.message;
            adminSystemMessage.className = "message error";
        } finally {
            clearDatabase.disabled = false;
        }
    }

    async function inicializar() {
        try {
            const resposta = await fetch(`${API_URL}/api/dispositivos`, {
                headers: typeof solarbeamAuthHeaders === "function" ? solarbeamAuthHeaders() : {}
            });

            if (resposta.status === 401) {
                tratarSessaoExpirada();
                return;
            }

            const dispositivos = await resposta.json().catch(() => []);

            const dispositivosConfigurados = Array.isArray(dispositivos)
                ? dispositivos.filter((dispositivo) => Number(dispositivo.firmware_configurado) === 1)
                : [];

            if (!resposta.ok || dispositivosConfigurados.length === 0) {
                if (localStorage.getItem("solarbeam_role") !== "admin") {
                    window.location.replace("dispositivos.html?setup=1");
                    return;
                }
                mostrarSemDispositivo();
                return;
            }

            dispositivosCarregados = dispositivosConfigurados;
            mostrarConteudo();
            renderizarDispositivos(dispositivosConfigurados);
            popularSeletorDispositivos(dispositivosConfigurados);

            // Tenta reaproveitar o dispositivo salvo anteriormente, se ainda existir
            const salvo = typeof solarbeamGetDispositivoAtual === "function" ? solarbeamGetDispositivoAtual() : null;
            const salvoAindaExiste = salvo && dispositivosConfigurados.some((d) => String(d.id) === String(salvo.id));

            if (dispositivosConfigurados.length === 1) {
                selecionarDispositivo(dispositivosConfigurados[0]);
            } else if (salvoAindaExiste) {
                selecionarDispositivo(dispositivosConfigurados.find((d) => String(d.id) === String(salvo.id)));
            } else {
                selecionarDispositivo(dispositivosConfigurados[0]);
            }

            conectarWebSocket();
            carregarStatus();

        } catch (err) {
            console.error("Erro ao verificar dispositivos:", err);
            mostrarSemDispositivo();
        }
    }

    function mostrarSemDispositivo() {
        if (semDispositivoPanel) semDispositivoPanel.hidden = false;
        if (dashboardContent) dashboardContent.hidden = true;
        if (dashboardDevicesPanel) dashboardDevicesPanel.hidden = true;
    }

    function mostrarConteudo() {
        if (semDispositivoPanel) semDispositivoPanel.hidden = true;
        if (dashboardContent) dashboardContent.hidden = false;
        if (dashboardDevicesPanel) dashboardDevicesPanel.hidden = false;
    }

    function renderizarDispositivos(dispositivos) {
        if (!dashboardDevicesList) return;

        dashboardDevicesList.innerHTML = dispositivos.map((dispositivo) => {
            const status = dispositivo.online ? "Online" : "Offline";
            const classeStatus = dispositivo.online ? "online" : "offline";
            const url = `dispositivo-detalhe.html?id=${encodeURIComponent(dispositivo.id)}&codigo=${encodeURIComponent(dispositivo.codigo)}&nome=${encodeURIComponent(dispositivo.nome)}`;
            return `
                <a class="dashboard-device-item" href="${url}">
                    <span class="dashboard-device-icon"><i class="fa-solid fa-microchip"></i></span>
                    <span class="dashboard-device-info">
                        <strong>${escaparHTML(dispositivo.nome)}</strong>
                        <small>${escaparHTML(dispositivo.codigo)} · ${status}</small>
                    </span>
                    <span class="admin-status ${classeStatus}">${status}</span>
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </a>`;
        }).join("");
    }

    function popularSeletorDispositivos(dispositivos) {
        if (!dispositivoSelect) return;

        if (dispositivos.length <= 1) {
            dispositivoSelect.hidden = true;
            return;
        }

        dispositivoSelect.hidden = false;
        dispositivoSelect.innerHTML = dispositivos.map((d) =>
            `<option value="${d.id}">${d.nome}</option>`
        ).join("");
    }

    function selecionarDispositivo(dispositivo) {
        if (String(dispositivoAtual?.id) !== String(dispositivo.id)) {
            bombaPendente = null;
            ultimaLeituraBombaMs = 0;
        }
        dispositivoAtual = dispositivo;

        if (dispositivoSelect && !dispositivoSelect.hidden) {
            dispositivoSelect.value = String(dispositivo.id);
        }

        if (typeof solarbeamSetDispositivoAtual === "function") {
            solarbeamSetDispositivoAtual(dispositivo);
        }
    }

    function iniciarPollingStatus() {
        pararPollingStatus();
        timerStatus = window.setInterval(() => {
            if (!document.hidden && dispositivoAtual) {
                carregarStatus(true);
            }
        }, INTERVALO_STATUS_MS);
    }

    function pararPollingStatus() {
        if (timerStatus) {
            window.clearInterval(timerStatus);
            timerStatus = null;
        }
    }

    async function carregarStatus(silencioso = false) {
        if (!dispositivoAtual || !btnRefresh || carregandoStatus) return;

        carregandoStatus = true;
        if (!silencioso) {
            btnRefresh.disabled = true;
            btnRefresh.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Atualizando...</span>
            `;
        }

        try {
            const resposta = await fetch(`${API_URL}/api/status?dispositivo=${dispositivoAtual.id}`, {
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
                if (!silencioso) {
                    adicionarAlerta(
                        "Sem leituras",
                        "Ainda não há uma leitura registrada para este dispositivo.",
                        "warning"
                    );
                }
                return;
            }

            if (!resposta.ok) {
                throw new Error("Falha ao buscar status");
            }

            const dados = await resposta.json();

            atualizarInterface(dados);
            if (!silencioso) analisarAlertas(dados);

        } catch (err) {
            console.error("Erro ao buscar status:", err);

            atualizarStatusSistema(
                espStatus,
                "Offline",
                "offline"
            );

            atualizarStatusSistema(
                wifiStatus,
                "Desconectado",
                "offline"
            );

            atualizarStatusSistema(
                solarStatus,
                "Inativa",
                "warning"
            );

            if (!silencioso) {
                adicionarAlerta(
                    "Servidor indisponível",
                    "Não foi possível atualizar os dados do dispositivo.",
                    "error"
                );
            }

        } finally {
            carregandoStatus = false;
            if (!silencioso) {
                btnRefresh.disabled = false;
                btnRefresh.innerHTML = `
                    <i class="fa-solid fa-rotate"></i>
                    <span>Atualizar Sensores</span>
                `;
            }
        }
    }

    function atualizarStatusOperacional(dados) {
        if (!systemStatusPill) return;

        const status = dados?.online === false ? "Offline" : (dados?.wifi === true ? "Online" : "Verificando");
        const classe = dados?.online === false ? "offline" : (dados?.wifi === true ? "online" : "warning");

        if (systemStatusText) {
            systemStatusText.textContent = status;
        }

        systemStatusPill.classList.remove("online", "offline", "warning");
        systemStatusPill.classList.add(classe);

        if (summarySistema) {
            summarySistema.classList.remove("online", "offline", "warning");
            summarySistema.classList.add(classe);
            summarySistema.querySelector("strong").textContent = status;
        }
    }

    function atualizarResumoRapido(dados) {
        if (summaryBomba) {
            const ligada = dados?.bomba === true || dados?.bomba === 1 || dados?.bomba === "true" || dados?.bomba === "1";
            summaryBomba.querySelector("strong").textContent = ligada ? "Ligada" : "Desligada";
            summaryBomba.classList.toggle("on", ligada);
        }

        if (summaryBateria) {
            summaryBateria.querySelector("strong").textContent = dados?.bateria != null ? `${dados.bateria}V` : "--";
        }

        if (summaryAtualizacao) {
            summaryAtualizacao.querySelector("strong").textContent = dados?.ultimaAtualizacao || "--";
        }
    }

    function atualizarInterface(dados) {
        atualizarStatusOperacional(dados);
        atualizarResumoRapido(dados);

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

        if (waterLevel) waterLevel.textContent = dados.nivelAgua != null ? `${dados.nivelAgua}%` : "--";
        if (batteryAutonomy) batteryAutonomy.textContent = dados.autonomiaEstimada || "--";

        const leituraBombaMs = Number(dados.ultimaAtualizacaoMs);
        if (Number.isFinite(leituraBombaMs) && leituraBombaMs > 0) {
            if (bombaPendente && leituraBombaMs > bombaPendente.leituraBaseMs) {
                bombaPendente = null;
            }
            ultimaLeituraBombaMs = Math.max(ultimaLeituraBombaMs, leituraBombaMs);
        }

        if (lastUpdate) {
            lastUpdate.textContent =
                dados.ultimaAtualizacao || "--";
        }

        if (firmwareVersion) firmwareVersion.textContent = dados.versaoFirmware || "--";

        atualizarStatusSistema(
            espStatus,
            dados.online === false ? "Offline" : "Online",
            dados.online === false ? "offline" : "online"
        );

        if (wifiStatus) {
            atualizarStatusSistema(
                wifiStatus,
                dados.wifi === true ? "Conectado" : "Desconectado",
                dados.wifi === true ? "online" : "offline"
            );
        }

        if (solarStatus) {
            atualizarStatusSistema(
                solarStatus,
                dados.energiaSolar === true ? "Ativa" : "Inativa",
                dados.energiaSolar === true ? "online" : "warning"
            );
        }
    }

    function atualizarInterfaceSemDados() {
        if (systemStatusPill) {
            if (systemStatusText) {
                systemStatusText.textContent = "Sem dados";
            }
            systemStatusPill.classList.remove("online", "offline", "warning");
            systemStatusPill.classList.add("warning");
        }

        if (soilHumidity) soilHumidity.textContent = "--";
        if (temperature) temperature.textContent = "--";
        if (battery) battery.textContent = "--";
        if (waterLevel) waterLevel.textContent = "--";
        if (batteryAutonomy) batteryAutonomy.textContent = "--";
        bombaPendente = null;
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
        if (!dispositivoAtual) return;

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
                body: JSON.stringify({ bomba: ligar, dispositivoId: Number(dispositivoAtual.id) })
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
                ligar ? "Comando de ligar enviado" : "Comando de desligar enviado",
                ligar
                    ? "O comando foi colocado na fila e o ESP32 vai aplicá-lo na próxima consulta."
                    : "O comando foi colocado na fila e o ESP32 vai aplicá-lo na próxima consulta.",
                ligar ? "success" : "warning"
            );

            bombaPendente = { ligada: ligar, leituraBaseMs: ultimaLeituraBombaMs };

            // O backend enfileira o comando; o polling atualiza o estado quando
            // o ESP32 enviar uma nova leitura.
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
        // Os limites de bateria/umidade são configuráveis na página de Configurações.

        if (dados.online === false) {
            adicionarAlerta(
                "ESP32 offline",
                "O dispositivo não envia leituras há mais de dois minutos.",
                "error"
            );
        }

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

        const chaveAlerta = `${tipo}:${titulo}:${mensagem}`;
        const jaExiste = [...dashboardNotifications.querySelectorAll(".dashboard-notification")]
            .some((item) => item.dataset.alertaChave === chaveAlerta);

        if (jaExiste) return;

        const vazio = dashboardNotifications.querySelector(".empty-notification");

        if (vazio) {
            vazio.remove();
        }

        const item = document.createElement("div");
        item.className = `dashboard-notification ${tipo}`;
        item.dataset.alertaChave = chaveAlerta;

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

        notificarNavegador(titulo, mensagem, tipo);

        const total = dashboardNotifications.querySelectorAll(".dashboard-notification").length;
        atualizarBadge(total);
    }

    function notificarNavegador(titulo, mensagem, tipo) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;

        const chave = `${titulo}:${mensagem}`;
        if (sessionStorage.getItem(`solarbeam-alerta:${chave}`)) return;
        sessionStorage.setItem(`solarbeam-alerta:${chave}`, "1");

        new Notification(`Solar Beam · ${titulo}`, {
            body: mensagem,
            tag: `solarbeam-${tipo}`,
            icon: "../favicon.ico",
        });
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
