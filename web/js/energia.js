document.addEventListener("DOMContentLoaded", () => {
    const battery = document.getElementById("battery");
    const batteryBar = document.getElementById("batteryBar");
    const batteryMessage = document.getElementById("batteryMessage");
    const solar = document.getElementById("solar");
    const updated = document.getElementById("updated");

    const dispositivo = solarbeamGetDispositivoAtual();
    const TENSAO_MAXIMA = 4.2; // referencia tipica de bateria Li-ion 18650 cheia
    const TENSAO_MINIMA = 3.0; // referencia tipica de bateria descarregada

    carregar();

    if (!dispositivo) {
        window.location.replace("dispositivos.html");
        return;
    }

    async function carregar() {
        try {
            const url = `${API_URL}/api/status?dispositivo=${dispositivo.id}`;

            const resposta = await fetch(url, { headers: solarbeamAuthHeaders() });

            if (resposta.status === 404) {
                batteryMessage.textContent = "Nenhuma leitura registrada ainda.";
                batteryMessage.className = "message error";
                return;
            }

            if (!resposta.ok) throw new Error("Falha ao buscar status");

            const dados = await resposta.json();

            battery.textContent = `${dados.bateria}V`;
            updated.textContent = dados.ultimaAtualizacao;
            solar.textContent = "Não disponível"; // painel solar ainda nao tem sensor proprio

            const percentual = Math.max(0, Math.min(100,
                ((dados.bateria - TENSAO_MINIMA) / (TENSAO_MAXIMA - TENSAO_MINIMA)) * 100
            ));
            batteryBar.style.width = `${percentual.toFixed(0)}%`;

        } catch (err) {
            console.error("Erro ao buscar energia:", err);
            batteryMessage.textContent = "Não foi possível conectar ao servidor.";
            batteryMessage.className = "message error";
        }
    }
});
