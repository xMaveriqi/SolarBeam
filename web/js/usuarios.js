document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("novoUsuarioForm");
    const mensagem = document.getElementById("usuarioMensagem");
    const lista = document.getElementById("listaUsuarios");
    const btnBackup = document.getElementById("btnBackup");

    carregarUsuarios();
    btnBackup?.addEventListener("click", exportarBackup);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const nome = document.getElementById("novoNome").value.trim();
        const usuario = document.getElementById("novoUsuario").value.trim();
        const senha = document.getElementById("novaSenha").value.trim();
        const role = document.getElementById("novoRole").value;

        try {
            const resposta = await fetch(`${API_URL}/api/usuarios`, {
                method: "POST",
                headers: solarbeamAuthHeaders(),
                body: JSON.stringify({ nome, usuario, senha, role }),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarMensagem(dados.erro || "Erro ao criar usuário.", "error");
                return;
            }

            mostrarMensagem(`Usuário "${usuario}" criado com sucesso!`, "success");
            form.reset();
            carregarUsuarios();

        } catch (err) {
            console.error("Erro ao criar usuario:", err);
            mostrarMensagem("Não foi possível conectar ao servidor.", "error");
        }
    });

    async function carregarUsuarios() {
        try {
            const resposta = await fetch(`${API_URL}/api/usuarios`, {
                headers: solarbeamAuthHeaders(),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                lista.innerHTML = `<p style="color:#F87171; font-size:13px;">${dados.erro || "Erro ao carregar usuários."}</p>`;
                return;
            }

            if (dados.length === 0) {
                lista.innerHTML = `<p style="color: var(--text-secondary); font-size: 13px;">Nenhum usuário cadastrado.</p>`;
                return;
            }

            const meuId = typeof solarbeamGetUsuarioId === "function" ? solarbeamGetUsuarioId() : null;

            lista.innerHTML = dados.map((u) => {
                const souEu = meuId != null && Number(meuId) === Number(u.id);
                return `
                <div class="status-item">
                    <span>${u.nome} (${u.email})</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <b class="${u.role === 'admin' ? 'online' : ''}">${u.role === 'admin' ? 'Admin' : 'Usuário'}</b>
                        <button
                            data-id="${u.id}"
                            data-nome="${u.nome}"
                            class="btnApagarUsuario"
                            ${souEu ? "disabled title=\"Você não pode apagar o próprio usuário\"" : ""}
                            style="background:none; border:1px solid rgba(248,113,113,0.35); color:#F87171; border-radius:6px; padding:4px 10px; font-size:12px; cursor:${souEu ? "not-allowed" : "pointer"}; opacity:${souEu ? "0.4" : "1"};">
                            Apagar
                        </button>
                    </div>
                </div>
            `;
            }).join("");

            document.querySelectorAll(".btnApagarUsuario").forEach((btn) => {
                if (btn.disabled) return;
                btn.addEventListener("click", () => apagarUsuario(btn.dataset.id, btn.dataset.nome));
            });

        } catch (err) {
            console.error("Erro ao carregar usuarios:", err);
            lista.innerHTML = `<p style="color:#F87171; font-size:13px;">Não foi possível conectar ao servidor.</p>`;
        }
    }

    async function apagarUsuario(id, nome) {
        const confirmado = confirm(`Apagar o usuário "${nome}"? Essa ação não pode ser desfeita.`);
        if (!confirmado) return;

        try {
            const resposta = await fetch(`${API_URL}/api/usuarios/${id}`, {
                method: "DELETE",
                headers: solarbeamAuthHeaders(),
            });

            const dados = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                alert(dados.erro || "Erro ao apagar usuário.");
                return;
            }

            carregarUsuarios();

        } catch (err) {
            console.error("Erro ao apagar usuario:", err);
            alert("Não foi possível conectar ao servidor.");
        }
    }

    function mostrarMensagem(texto, tipo) {
        mensagem.textContent = texto;
        mensagem.className = `simulador-mensagem ${tipo}`;
    }

    async function exportarBackup() {
        try {
            btnBackup.disabled = true;
            const resposta = await fetch(`${API_URL}/api/backup`, { headers: solarbeamAuthHeaders() });
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.erro || "Erro ao exportar backup.");
            const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `solarbeam-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            mostrarMensagem("Backup exportado com sucesso.", "success");
        } catch (error) {
            mostrarMensagem(error.message, "error");
        } finally {
            btnBackup.disabled = false;
        }
    }
});
