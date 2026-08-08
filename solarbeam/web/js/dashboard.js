document.addEventListener("DOMContentLoaded", () => {

    const btnPumpOn = document.getElementById("btnPumpOn");
    const btnPumpOff = document.getElementById("btnPumpOff");
    const btnRefresh = document.getElementById("btnRefresh");
    const btnSettings = document.getElementById("btnSettings");
    const soilHumidity = document.getElementById("soilHumidity");
    const temperature = document.getElementById("temperature");
    const battery = document.getElementById("battery");
    const pumpStatus = document.getElementById("pumpStatus");
    const lastUpdate = document.getElementById("lastUpdate");

    const simuladorForm = document.getElementById("simuladorForm");
    const simuladorMensagem = document.getElementById("simuladorMensagem");

    carregarStatus();

    btnPumpOn.addEventListener("click", () => enviarComando(true));
    btnPumpOff.addEventListener("click", () => enviarComando(false));
    btnRefresh.addEventListener("click", carregarStatus);
    btnSettings.addEventListener("click", () => {
        window.location.href = "configuracoes.html";
    });

    if (simuladorForm) {
        simuladorForm.addEventListener("submit", enviarLeituraSimulada);
    }

    async function carregarStatus() {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...`;

        try {
            const resposta = await fetch(`${API_URL}/api/status`);

            if (resposta.status === 404) {
                mostrarMensagemSimulador("Nenhuma leitura no banco ainda. Use o simulador abaixo para gerar uma.", "warning");
                return;
            }

            if (!resposta.ok) {
                throw new Error("Falha ao buscar status");
            }

            const dados = await resposta.json();

            soilHumidity.textContent = `${dados.umidade}%`;
            temperature.textContent = "--°C"; // sensor de temperatura ainda nao implementado no ESP32
            battery.textContent = `${dados.bateria}V`;
            pumpStatus.textContent = dados.bomba ? "Ligada" : "Desligada";
            lastUpdate.textContent = dados.ultimaAtualizacao;

        } catch (err) {
            console.error("Erro ao buscar status:", err);
            alert("Não foi possível conectar à API. Ela pode estar 'acordando' (Render free) — tente de novo em alguns segundos.");
        } finally {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = `<i class="fa-solid fa-rotate"></i> Atualizar Sensores`;
        }
    }

    async function enviarComando(ligar) {
        try {
            const resposta = await fetch(`${API_URL}/api/comando`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ bomba: ligar }),
            });

            if (resposta.status === 401) {
                alert("Sessão expirada. Faça login novamente.");
                solarbeamLogout();
                return;
            }

            const dados = await resposta.json();

            if (!resposta.ok) {
                alert(dados.erro || "Erro ao enviar comando.");
                return;
            }

            alert(ligar ? "Comando para ligar a bomba enviado!" : "Comando para desligar a bomba enviado!");

        } catch (err) {
            console.error("Erro ao enviar comando:", err);
            alert("Não foi possível conectar ao servidor.");
        }
    }

    async function enviarLeituraSimulada(event) {
        event.preventDefault();

        const umidade = parseFloat(document.getElementById("simUmidade").value);
        const nivelAgua = parseFloat(document.getElementById("simNivelAgua").value);
        const bateria = parseFloat(document.getElementById("simBateria").value);
        const bomba = document.getElementById("simBomba").value === "true";

        try {
            const resposta = await fetch(`${API_URL}/api/sensores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ umidade, nivelAgua, bateria, bomba }),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarMensagemSimulador(dados.erro || "Erro ao enviar leitura.", "error");
                return;
            }

            mostrarMensagemSimulador("Leitura simulada enviada com sucesso!", "success");
            carregarStatus();

        } catch (err) {
            console.error("Erro ao enviar leitura simulada:", err);
            mostrarMensagemSimulador("Não foi possível conectar ao servidor.", "error");
        }
    }

    function mostrarMensagemSimulador(texto, tipo) {
        if (!simuladorMensagem) return;
        simuladorMensagem.textContent = texto;
        simuladorMensagem.className = `simulador-mensagem ${tipo}`;
    }
});
