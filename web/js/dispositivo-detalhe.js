document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const dispositivoId = params.get("id");
    const dispositivoCodigo = params.get("codigo");
    let dispositivoToken = params.get("token");
    const dispositivoNome = params.get("nome");

    if (!dispositivoId) {
        window.location.href = "dispositivos.html";
        return;
    }

    document.getElementById("tituloDispositivo").textContent = dispositivoNome || "Dispositivo";
    solarbeamSetDispositivoAtual({ id: dispositivoId, codigo: dispositivoCodigo, nome: dispositivoNome });
    document.getElementById("codigoTopbar").textContent = dispositivoCodigo || "--";

    const soilHumidity = document.getElementById("soilHumidity");
    const nivelAgua = document.getElementById("nivelAgua");
    const temperaturaAr = document.getElementById("temperaturaAr");
    const umidadeAr = document.getElementById("umidadeAr");
    const battery = document.getElementById("battery");
    const batteryAutonomy = document.getElementById("batteryAutonomy");
    const pumpStatus = document.getElementById("pumpStatus");
    const lastUpdate = document.getElementById("lastUpdate");
    const btnRefresh = document.getElementById("btnRefresh");

    carregarStatus();

    document.getElementById("btnPumpOn").addEventListener("click", () => enviarComando(true));
    document.getElementById("btnPumpOff").addEventListener("click", () => enviarComando(false));
    btnRefresh.addEventListener("click", carregarStatus);

    document.getElementById("simuladorForm").addEventListener("submit", enviarLeituraSimulada);

    async function carregarStatus() {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...`;

        try {
            const resposta = await fetch(`${API_URL}/api/status?dispositivo=${dispositivoId}`, {
                headers: solarbeamAuthHeaders(),
            });

            if (resposta.status === 404) {
                mostrarMensagemSimulador("Nenhuma leitura para este dispositivo ainda. Use o simulador abaixo.", "warning");
                return;
            }

            if (!resposta.ok) throw new Error("Falha ao buscar status");

            const dados = await resposta.json();

            soilHumidity.textContent = `${dados.umidade}%`;
            nivelAgua.textContent = `${dados.nivelAgua}%`;
            if (temperaturaAr) temperaturaAr.textContent = dados.temperatura != null ? `${dados.temperatura}°C` : "--°C";
            if (umidadeAr) umidadeAr.textContent = dados.umidadeAr != null ? `${dados.umidadeAr}%` : "--%";
            battery.textContent = `${dados.bateria}V`;
            if (batteryAutonomy) batteryAutonomy.textContent = dados.autonomiaEstimada || "--";
            pumpStatus.textContent = dados.bomba ? "Ligada" : "Desligada";
            lastUpdate.textContent = dados.ultimaAtualizacao;

        } catch (err) {
            console.error("Erro ao buscar status:", err);
        } finally {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = `<i class="fa-solid fa-rotate"></i> Atualizar`;
        }
    }

    async function enviarComando(ligar) {
        const botoes = [document.getElementById("btnPumpOn"), document.getElementById("btnPumpOff")].filter(Boolean);
        botoes.forEach((botao) => { botao.disabled = true; });
        try {
            const resposta = await fetch(`${API_URL}/api/comando`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ bomba: ligar, dispositivoId: Number(dispositivoId) }),
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
            if (pumpStatus) pumpStatus.textContent = ligar ? "Ligada" : "Desligada";

        } catch (err) {
            console.error("Erro ao enviar comando:", err);
            alert("Não foi possível conectar ao servidor.");
        } finally {
            botoes.forEach((botao) => { botao.disabled = false; });
        }
    }

    async function enviarLeituraSimulada(event) {
        event.preventDefault();

        const umidade = parseFloat(document.getElementById("simUmidade").value);
        const nivelAguaValor = parseFloat(document.getElementById("simNivelAgua").value);
        const bateria = parseFloat(document.getElementById("simBateria").value);
        const bomba = document.getElementById("simBomba").value === "true";

        if (!dispositivoToken) {
            const dispositivosResposta = await fetch(`${API_URL}/api/dispositivos`, {
                headers: solarbeamAuthHeaders(),
            });
            const dispositivos = await dispositivosResposta.json();
            dispositivoToken = dispositivos.find((item) => String(item.id) === String(dispositivoId))?.token_dispositivo;
        }

        try {
            const resposta = await fetch(`${API_URL}/api/sensores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    umidade,
                    nivelAgua: nivelAguaValor,
                    bateria,
                    bomba,
                    codigoDispositivo: dispositivoCodigo,
                    tokenDispositivo: dispositivoToken,
                }),
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
        const el = document.getElementById("simuladorMensagem");
        el.textContent = texto;
        el.className = `simulador-mensagem ${tipo}`;
    }
});
