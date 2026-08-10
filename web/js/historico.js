document.addEventListener("DOMContentLoaded", () => {
    const corpo = document.getElementById("historyBody");
    const mensagem = document.getElementById("historyMessage");
    const btnRefresh = document.getElementById("refreshHistory");
    const btnExport = document.getElementById("exportHistory");
    let leiturasAtuais = [];

    let dispositivo = solarbeamGetDispositivoAtual();

    prepararDispositivo().then(carregar);
    btnRefresh.addEventListener("click", carregar);
    btnExport.addEventListener("click", exportarCSV);

    async function prepararDispositivo() {
        if (dispositivo) return;

        const resposta = await fetch(`${API_URL}/api/dispositivos`, {
            headers: solarbeamAuthHeaders(),
        });
        const dispositivos = await resposta.json();
        dispositivo = dispositivos.find((item) => Number(item.firmware_configurado) === 1);

        if (dispositivo) {
            solarbeamSetDispositivoAtual(dispositivo);
        }
    }

    async function carregar() {
        corpo.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
        mensagem.textContent = "";

        try {
            if (!dispositivo) {
                corpo.innerHTML = `<tr><td colspan="5">Nenhum ESP configurado para este usuário.</td></tr>`;
                return;
            }

            const url = `${API_URL}/api/historico?limite=30&dispositivo=${dispositivo.id}`;

            const resposta = await fetch(url, { headers: solarbeamAuthHeaders() });
            const dados = await resposta.json();

            if (!resposta.ok) {
                corpo.innerHTML = `<tr><td colspan="5">Nenhum dado disponível.</td></tr>`;
                mensagem.textContent = dados.erro || "Erro ao carregar histórico.";
                mensagem.className = "message error";
                return;
            }

            if (dados.length === 0) {
                leiturasAtuais = [];
                corpo.innerHTML = `<tr><td colspan="5">Nenhuma leitura registrada ainda.</td></tr>`;
                return;
            }

            leiturasAtuais = dados;

            corpo.innerHTML = dados.map((l) => `
                <tr>
                    <td>${l.dataHora}</td>
                    <td>${l.umidade}%</td>
                    <td>${l.nivelAgua}%</td>
                    <td>${l.bateria}V</td>
                    <td><span class="status-pill ${l.bomba ? 'ok' : 'offline'}">${l.bomba ? 'Ligada' : 'Desligada'}</span></td>
                </tr>
            `).join("");

        } catch (err) {
            console.error("Erro ao carregar historico:", err);
            corpo.innerHTML = `<tr><td colspan="5">Erro de conexão.</td></tr>`;
            mensagem.textContent = "Não foi possível conectar ao servidor.";
            mensagem.className = "message error";
        }
    }

    function exportarCSV() {
        if (!leiturasAtuais.length) {
            mensagem.textContent = "Não há leituras para exportar.";
            mensagem.className = "message error";
            return;
        }

        const linhas = [
            ["data_hora", "umidade", "nivel_agua", "bateria", "bomba"],
            ...leiturasAtuais.map((leitura) => [
                leitura.dataHora,
                leitura.umidade,
                leitura.nivelAgua,
                leitura.bateria,
                leitura.bomba ? "ligada" : "desligada",
            ]),
        ];
        const csv = linhas.map((linha) => linha.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(";")).join("\n");
        const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `historico-${dispositivo.codigo || dispositivo.id}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
});
