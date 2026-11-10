document.addEventListener("DOMContentLoaded", () => {
	const $ = (id) => document.getElementById(id);
	const dispositivo = solarbeamGetDispositivoAtual();

	if (!dispositivo) {
		window.location.replace("dispositivos");
		return;
	}

	async function load() {
		try {
			const resposta = await fetch(`${API_URL}/api/status?dispositivo=${dispositivo.id}`, {
				headers: solarbeamAuthHeaders(),
			});
			if (resposta.status === 401) return solarbeamLogout();
			const dados = await resposta.json();
			if (!resposta.ok) throw Error(dados.erro || "Não foi possível carregar as leituras.");
			$("humidity").textContent = window.solarbeamFormatSensor(dados.umidade, 1, "%");
			$("temperature").textContent = window.solarbeamFormatSensor(dados.temperatura, 1, "°C");
			$("water").textContent = window.solarbeamFormatSensor(dados.nivelAgua, 1, "%");
			$("voltage").textContent = window.solarbeamFormatSensor(dados.bateria, 2, " V");
			$("autonomy").textContent = dados.autonomiaEstimada || "--";
			$("updated").textContent = dados.ultimaAtualizacao || "--";
			$("message").textContent = "Leitura atualizada.";
			$("message").className = "message success";
		} catch (error) {
			$("message").textContent = error.message;
			$("message").className = "message error";
		}
	}

	$("refresh").onclick = load;
	load();
});