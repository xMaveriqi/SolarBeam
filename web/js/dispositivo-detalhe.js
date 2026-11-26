document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const dispositivoId = params.get("id");
    const dispositivoCodigo = params.get("codigo");
    const dispositivoNome = params.get("nome");

    if (!dispositivoId) {
        window.location.href = "dispositivos.html";
        return;
    }

    document.getElementById("tituloDispositivo").textContent = dispositivoNome || "Dispositivo";
    solarbeamSetDispositivoAtual({ id: dispositivoId, codigo: dispositivoCodigo, nome: dispositivoNome });
    document.getElementById("codigoTopbar").textContent = dispositivoCodigo || "--";

    const soilHumidity = document.getElementById("soilHumidity");
    const umidadeAr = document.getElementById("umidadeAr");
    const pumpStatus = document.getElementById("pumpStatus");
    const lastUpdate = document.getElementById("lastUpdate");
    const btnRefresh = document.getElementById("btnRefresh");

    const leituraMensagem = document.getElementById("leituraMensagem");

    carregarStatus();

    document.getElementById("btnPumpOn").addEventListener("click", () => enviarComando(true));
    document.getElementById("btnPumpOff").addEventListener("click", () => enviarComando(false));
    btnRefresh.addEventListener("click", carregarStatus);


    async function carregarStatus() {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...`;

        try {
            const resposta = await fetch(`${API_URL}/api/status?dispositivo=${dispositivoId}`, {
                headers: solarbeamAuthHeaders(),
            });

            if (resposta.status === 404) {
                leituraMensagem.textContent = "Aguardando a primeira leitura do ESP32.";
                leituraMensagem.hidden = false;
                return;
            }

            if (!resposta.ok) throw new Error("Falha ao buscar status");

            const dados = await resposta.json();
            leituraMensagem.hidden = true;

            soilHumidity.textContent = window.solarbeamFormatSensor(dados.umidade, 1, "%");
            if (umidadeAr) umidadeAr.textContent = window.solarbeamFormatSensor(dados.umidadeAr, 1, "%");
            pumpStatus.textContent = dados.bomba ? "Ligada" : "Desligada";
            lastUpdate.textContent = dados.ultimaAtualizacao;

        } catch (err) {
            console.error("Erro ao buscar status:", err);
            leituraMensagem.textContent = "Não foi possível atualizar as leituras. Tente novamente.";
            leituraMensagem.hidden = false;
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

            alert(ligar ? "Comando para ligar a bomba enviado ao ESP32!" : "Comando para desligar a bomba enviado ao ESP32!");
            if (pumpStatus) pumpStatus.textContent = ligar ? "Comando enviado" : "Comando enviado";
            window.setTimeout(() => carregarStatus(), 6500);

        } catch (err) {
            console.error("Erro ao enviar comando:", err);
            alert("Não foi possível conectar ao servidor.");
        } finally {
            botoes.forEach((botao) => { botao.disabled = false; });
        }
    }

});
