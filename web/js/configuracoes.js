document.addEventListener("DOMContentLoaded", () => {
    const humidityMin = document.getElementById("humidityMin");
    const pumpTime = document.getElementById("pumpTime");
    const mode = document.getElementById("mode");
    const btnSave = document.getElementById("save");
    const mensagem = document.getElementById("message");

    carregar();
    btnSave.addEventListener("click", salvar);

    async function carregar() {
        try {
            const resposta = await fetch(`${API_URL}/api/config`, {
                headers: solarbeamAuthHeaders(),
            });
            const dados = await resposta.json();

            if (!resposta.ok) {
                mensagem.textContent = dados.erro || "Erro ao carregar configurações.";
                mensagem.className = "message error";
                return;
            }

            humidityMin.value = dados.umidadeMinima;
            pumpTime.value = dados.tempoBomba;
            mode.value = dados.modo;

        } catch (err) {
            console.error("Erro ao carregar config:", err);
            mensagem.textContent = "Não foi possível conectar ao servidor.";
            mensagem.className = "message error";
        }
    }

    async function salvar() {
        mensagem.textContent = "";

        const umidadeMinima = parseFloat(humidityMin.value);
        const tempoBomba = parseInt(pumpTime.value, 10);
        const modo = mode.value;

        if (isNaN(umidadeMinima) || isNaN(tempoBomba)) {
            mensagem.textContent = "Preencha os campos corretamente.";
            mensagem.className = "message error";
            return;
        }

        try {
            const resposta = await fetch(`${API_URL}/api/config`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ umidadeMinima, tempoBomba, modo }),
            });

            if (resposta.status === 401) {
                solarbeamLogout();
                return;
            }

            const dados = await resposta.json();

            if (!resposta.ok) {
                mensagem.textContent = dados.erro || "Erro ao salvar.";
                mensagem.className = "message error";
                return;
            }

            mensagem.textContent = "Configurações salvas com sucesso!";
            mensagem.className = "message success";

        } catch (err) {
            console.error("Erro ao salvar config:", err);
            mensagem.textContent = "Não foi possível conectar ao servidor.";
            mensagem.className = "message error";
        }
    }
});
