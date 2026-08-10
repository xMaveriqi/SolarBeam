document.addEventListener("DOMContentLoaded", () => {
    const get = (id) => document.getElementById(id);
    const dispositivo = solarbeamGetDispositivoAtual();

    if (!dispositivo) {
        window.location.replace("dispositivos.html");
        return;
    }

    async function command(bomba) {
        try {
            const resposta = await fetch(`${API_URL}/api/comando`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ bomba, dispositivoId: Number(dispositivo.id) }),
            });
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw Error(dados.erro || "Falha ao enviar comando.");
            get("pumpMessage").textContent = dados.mensagem || "Comando enviado.";
            get("pumpMessage").className = "message success";
        } catch (error) {
            get("pumpMessage").textContent = error.message;
            get("pumpMessage").className = "message error";
        }
    }

    async function load() {
        try {
            const resposta = await fetch(`${API_URL}/api/config`, { headers: solarbeamAuthHeaders() });
            const dados = await resposta.json();
            if (!resposta.ok) throw Error(dados.erro || "Falha ao carregar configuração.");
            get("humidityMin").value = dados.umidadeMinima;
            get("pumpTime").value = dados.tempoBomba;
            get("mode").value = dados.modo;
        } catch (error) {
            get("configMessage").textContent = error.message;
            get("configMessage").className = "message error";
        }
    }

    async function save() {
        try {
            const resposta = await fetch(`${API_URL}/api/config`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({
                    umidadeMinima: Number(get("humidityMin").value),
                    tempoBomba: Number(get("pumpTime").value),
                    modo: get("mode").value,
                }),
            });
            const dados = await resposta.json();
            if (!resposta.ok) throw Error(dados.erro || "Falha ao salvar.");
            get("configMessage").textContent = dados.mensagem || "Salvo com sucesso.";
            get("configMessage").className = "message success";
        } catch (error) {
            get("configMessage").textContent = error.message;
            get("configMessage").className = "message error";
        }
    }

    get("pumpOn").onclick = () => command(true);
    get("pumpOff").onclick = () => command(false);
    get("saveConfig").onclick = save;
    load();
});