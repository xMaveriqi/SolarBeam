document.addEventListener("DOMContentLoaded", () => {
	const $ = (id) => document.getElementById(id);
	const dispositivo = solarbeamGetDispositivoAtual();

	if (!dispositivo) {
		window.location.replace("dispositivos.html");
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
			$("humidity").textContent = dados.umidade != null ? `${dados.umidade}%` : "--";
			$("temperature").textContent = dados.temperatura != null ? `${dados.temperatura}°C` : "--";
			$("water").textContent = dados.nivelAgua != null ? dados.nivelAgua : "--";
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