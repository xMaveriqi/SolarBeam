document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("novoDispositivoForm");
    const mensagem = document.getElementById("dispositivoMensagem");
    const lista = document.getElementById("listaDispositivos");
    const codigoBox = document.getElementById("codigoGerado");
    const codigoTexto = document.getElementById("codigoTexto");

    carregarDispositivos();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const nome = document.getElementById("nomeDispositivo").value.trim();

        try {
            const resposta = await fetch(`${API_URL}/api/dispositivos`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ nome }),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarMensagem(dados.erro || "Erro ao adicionar dispositivo.", "error");
                return;
            }

            mostrarMensagem("Dispositivo adicionado com sucesso!", "success");
            codigoTexto.textContent = dados.codigo;
            codigoBox.style.display = "block";
            form.reset();
            carregarDispositivos();

        } catch (err) {
            console.error("Erro ao criar dispositivo:", err);
            mostrarMensagem("Não foi possível conectar ao servidor.", "error");
        }
    });

    async function carregarDispositivos() {
        try {
            const resposta = await fetch(`${API_URL}/api/dispositivos`, {
                headers: solarbeamAuthHeaders(),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                lista.innerHTML = `<p style="color:#F87171; font-size:13px;">${dados.erro || "Erro ao carregar dispositivos."}</p>`;
                return;
            }

            if (dados.length === 0) {
                lista.innerHTML = `
                    <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 10px;">
                        Você ainda não tem nenhum ESP conectado. Adicione o primeiro ao lado para começar.
                    </p>`;
                return;
            }

            lista.innerHTML = dados.map((d) => `
                <div class="status-item" style="align-items:flex-start; flex-direction:column; gap:6px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <b style="color: var(--text-primary);" id="nomeDisp-${d.id}">${d.nome}</b>
                        <div style="display:flex; gap:8px;">
                            <a href="dispositivo-detalhe.html?id=${d.id}&codigo=${d.codigo}&nome=${encodeURIComponent(d.nome)}" style="background:none; border:1px solid rgba(34,197,94,0.3); color: var(--solar-green); border-radius:6px; padding:4px 10px; font-size:12px; text-decoration:none;">
                                Ver Dashboard
                            </a>
                            <button data-id="${d.id}" class="btnRenomear" style="background:none; border:1px solid rgba(255,255,255,0.1); color: var(--text-secondary); border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer;">
                                Renomear
                            </button>
                        </div>
                    </div>
                    <span style="font-size: 12px; color: var(--text-secondary);">Código: <code>${d.codigo}</code></span>
                </div>
            `).join("");

            document.querySelectorAll(".btnRenomear").forEach((btn) => {
                btn.addEventListener("click", () => renomearDispositivo(btn.dataset.id));
            });

        } catch (err) {
            console.error("Erro ao carregar dispositivos:", err);
            lista.innerHTML = `<p style="color:#F87171; font-size:13px;">Não foi possível conectar ao servidor.</p>`;
        }
    }

    async function renomearDispositivo(id) {
        const novoNome = prompt("Novo nome para o dispositivo:");
        if (!novoNome || !novoNome.trim()) return;

        try {
            const resposta = await fetch(`${API_URL}/api/dispositivos/${id}`, {
                method: "PATCH",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ nome: novoNome.trim() }),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                alert(dados.erro || "Erro ao renomear.");
                return;
            }

            carregarDispositivos();

        } catch (err) {
            console.error("Erro ao renomear dispositivo:", err);
            alert("Não foi possível conectar ao servidor.");
        }
    }

    function mostrarMensagem(texto, tipo) {
        mensagem.textContent = texto;
        mensagem.className = `simulador-mensagem ${tipo}`;
    }
});
