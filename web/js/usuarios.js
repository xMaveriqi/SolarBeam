document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("novoUsuarioForm");
    const mensagem = document.getElementById("usuarioMensagem");
    const lista = document.getElementById("listaUsuarios");

    carregarUsuarios();

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

            lista.innerHTML = dados.map((u) => `
                <div class="status-item">
                    <span>${u.nome} (${u.email})</span>
                    <b class="${u.role === 'admin' ? 'online' : ''}">${u.role === 'admin' ? 'Admin' : 'Usuário'}</b>
                </div>
            `).join("");

        } catch (err) {
            console.error("Erro ao carregar usuarios:", err);
            lista.innerHTML = `<p style="color:#F87171; font-size:13px;">Não foi possível conectar ao servidor.</p>`;
        }
    }

    function mostrarMensagem(texto, tipo) {
        mensagem.textContent = texto;
        mensagem.className = `simulador-mensagem ${tipo}`;
    }
});
