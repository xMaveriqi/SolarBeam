document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("novoDispositivoForm");
    const mensagem = document.getElementById("dispositivoMensagem");
    const lista = document.getElementById("listaDispositivos");
    const codigoBox = document.getElementById("codigoGerado");
    const codigoTexto = document.getElementById("codigoTexto");

    // --- Provisionamento via USB (Web Serial) ---
    const seletor = document.getElementById("seletorDispositivo");
    const btnConectar = document.getElementById("btnConectar");
    const btnEnviarCodigo = document.getElementById("btnEnviarCodigo");
    const btnGravarFirmware = document.getElementById("btnGravarFirmware");
    const arquivoFirmware = document.getElementById("arquivoFirmware");
    const firmwareProgress = document.getElementById("firmwareProgress");
    const apagarConfiguracoes = document.getElementById("apagarConfiguracoes");
    const provisionarMensagem = document.getElementById("provisionarMensagem");
    const log = document.getElementById("serialLog");

    let porta = null;
    let writer = null;
    let reader = null;
    let dispositivosAtuais = [];
    let serialBuffer = "";
    let confirmacaoProvisionamento = null;
    let firmwareGravado = false;

    if (!("serial" in navigator)) {
        provisionarMensagem.textContent = "Seu navegador não suporta Web Serial. Use Google Chrome ou Microsoft Edge no computador.";
        provisionarMensagem.className = "simulador-mensagem error";
        btnConectar.disabled = true;
    }

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
            await carregarDispositivos();

            // Já deixa selecionado no provisionamento para o usuário só conectar o USB
            const criado = dispositivosAtuais.find((dispositivo) => dispositivo.codigo === dados.codigo);
            if (seletor && criado) seletor.value = String(criado.id);

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
                atualizarSeletorProvisionamento([]);
                return;
            }

            atualizarSeletorProvisionamento(dados);
            dispositivosAtuais = dados;

            const usuarioNormal = localStorage.getItem("solarbeam_role") !== "admin";
            const possuiEspConfigurado = dados.some((dispositivo) => Number(dispositivo.firmware_configurado) === 1);
            if (usuarioNormal && possuiEspConfigurado && new URLSearchParams(window.location.search).get("setup") === "1") {
                window.location.replace("dashboard.html");
                return;
            }
            if (usuarioNormal && !possuiEspConfigurado) {
                document.documentElement.classList.add("setup-mode");
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
                            <button data-id="${d.id}" data-nome="${d.nome}" class="btnApagarDispositivo" style="background:none; border:1px solid rgba(248,113,113,0.35); color: #F87171; border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer;">
                                Apagar
                            </button>
                        </div>
                    </div>
                            <span style="font-size: 12px; color: var(--text-secondary);">Código: <code>${d.codigo}</code> · ${d.online ? "Online" : "Offline"} · ${Number(d.firmware_configurado) === 1 ? "Firmware " + (d.versao_firmware || "configurado") : "Firmware pendente"}</span>
                </div>
            `).join("");

            document.querySelectorAll(".btnRenomear").forEach((btn) => {
                btn.addEventListener("click", () => renomearDispositivo(btn.dataset.id));
            });

            document.querySelectorAll(".btnApagarDispositivo").forEach((btn) => {
                btn.addEventListener("click", () => apagarDispositivo(btn.dataset.id, btn.dataset.nome));
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

    async function apagarDispositivo(id, nome) {
        const confirmado = confirm(`Apagar o dispositivo "${nome}"? Essa ação não pode ser desfeita.`);
        if (!confirmado) return;

        try {
            const resposta = await fetch(`${API_URL}/api/dispositivos/${id}`, {
                method: "DELETE",
                headers: solarbeamAuthHeaders(),
            });

            const dados = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                alert(dados.erro || "Erro ao apagar dispositivo.");
                return;
            }

            // Se o dispositivo apagado era o "atual" salvo localmente, limpa
            const atual = typeof solarbeamGetDispositivoAtual === "function" ? solarbeamGetDispositivoAtual() : null;
            if (atual && String(atual.id) === String(id)) {
                localStorage.removeItem("solarbeam_dispositivo_atual");
            }

            carregarDispositivos();

        } catch (err) {
            console.error("Erro ao apagar dispositivo:", err);
            alert("Não foi possível conectar ao servidor.");
        }
    }

    function mostrarMensagem(texto, tipo) {
        mensagem.textContent = texto;
        mensagem.className = `simulador-mensagem ${tipo}`;
    }

    // --- Provisionamento via USB ---

    function atualizarSeletorProvisionamento(dispositivos) {
        if (!seletor) return;

        if (!dispositivos || dispositivos.length === 0) {
            seletor.innerHTML = `<option value="">Nenhum dispositivo cadastrado</option>`;
            return;
        }

        seletor.innerHTML = dispositivos.map((d) =>
            `<option value="${d.id}">${d.nome} (${d.codigo})</option>`
        ).join("");
    }

    btnConectar?.addEventListener("click", conectarSerial);
    btnEnviarCodigo?.addEventListener("click", enviarCodigo);
    btnGravarFirmware?.addEventListener("click", gravarFirmware);

    async function conectarSerial() {
        try {
            porta = await navigator.serial.requestPort();

            escreverLog("Porta USB selecionada.");
            provisionarMensagem.textContent = "Porta selecionada. Grave o firmware ou envie o código.";
            provisionarMensagem.className = "simulador-mensagem success";

            btnGravarFirmware.disabled = !arquivoFirmware.files[0];
            btnEnviarCodigo.disabled = true;
            btnConectar.disabled = true;

        } catch (err) {
            escreverLog("Erro ao conectar: " + err.message);
            provisionarMensagem.textContent = "Não foi possível conectar. Verifique se o ESP32 está plugado e se nenhum outro programa (Arduino IDE, etc) está usando a porta.";
            provisionarMensagem.className = "simulador-mensagem error";
        }
    }

    async function lerSerialContinuamente() {
        const textDecoder = new TextDecoderStream();
        const readableClosed = porta.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    serialBuffer += value;
                    const linhas = serialBuffer.split("\n");
                    serialBuffer = linhas.pop() || "";
                    linhas.forEach(processarRespostaSerial);
                }
            }
        } catch (err) {
            escreverLog("Leitura encerrada: " + err.message);
        }
    }

    async function enviarCodigo() {
        const dispositivo = dispositivosAtuais.find((item) => String(item.id) === seletor.value);
        const codigo = dispositivo?.codigo;

        if (!dispositivo || !codigo) {
            provisionarMensagem.textContent = "Selecione um dispositivo primeiro.";
            provisionarMensagem.className = "simulador-mensagem error";
            return;
        }
        if (!firmwareGravado) {
            provisionarMensagem.textContent = "Grave o firmware antes de enviar o código do dispositivo.";
            provisionarMensagem.className = "simulador-mensagem error";
            return;
        }

        try {
            if (!porta.readable) {
                await porta.open({ baudRate: 115200 });
                lerSerialContinuamente();
            }
            const confirmacao = aguardarConfirmacaoSerial();
            const textEncoder = new TextEncoderStream();
            textEncoder.readable.pipeTo(porta.writable);
            writer = textEncoder.writable.getWriter();

            const comando = JSON.stringify({ comando: "configurar", codigo, token: dispositivo.token_dispositivo || "" }) + "\n";
            await writer.write(comando);
            writer.releaseLock();

            escreverLog("Enviado: " + comando.trim());
            await confirmacao;
            provisionarMensagem.textContent = "ESP confirmado. Aguardando a primeira leitura...";
            provisionarMensagem.className = "simulador-mensagem success";
            await aguardarPrimeiraLeitura(dispositivo.id);

            provisionarMensagem.textContent = `Código ${codigo} confirmado e primeira leitura recebida. Dashboard liberada.`;
            provisionarMensagem.className = "simulador-mensagem success";
            await carregarDispositivos();
            setTimeout(() => window.location.href = "dashboard.html", 700);

        } catch (err) {
            escreverLog("Erro ao enviar: " + err.message);
            provisionarMensagem.textContent = err.message;
            provisionarMensagem.className = "simulador-mensagem error";
        }
    }

    arquivoFirmware?.addEventListener("change", () => {
        btnGravarFirmware.disabled = !porta || !arquivoFirmware.files[0];
    });

    async function gravarFirmware() {
        const arquivo = arquivoFirmware?.files[0];
        if (!porta || !arquivo) {
            provisionarMensagem.textContent = "Selecione o firmware e conecte o ESP32 primeiro.";
            provisionarMensagem.className = "simulador-mensagem error";
            return;
        }

        btnGravarFirmware.disabled = true;
        firmwareProgress.style.width = "0%";
        provisionarMensagem.textContent = "Iniciando gravação. Não desconecte o ESP32.";
        provisionarMensagem.className = "simulador-mensagem warning";

        try {
            const { ESPLoader, Transport } = await import("https://unpkg.com/esptool-js@0.4.0/bundle.js");
            const transport = new Transport(porta, true);
            const terminal = {
                clean() {},
                writeLine(texto) { escreverLog("FLASH: " + texto); },
                write(texto) { escreverLog("FLASH: " + texto); },
            };
            const loader = new ESPLoader({ transport, baudrate: 460800, terminal });
            await loader.main();
            const dados = new Uint8Array(await arquivo.arrayBuffer());
            await loader.writeFlash({
                fileArray: [{ data: dados, address: 0 }],
                flashSize: "keep",
                eraseAll: apagarConfiguracoes.checked,
                compress: true,
                reportProgress(fileIndex, written, total) {
                    firmwareProgress.style.width = `${Math.round((written / total) * 100)}%`;
                },
            });
            await loader.hardReset();
            try { await transport.disconnect(); } catch (error) { /* porta pode ja estar fechada pelo reset */ }
            firmwareGravado = true;
            btnEnviarCodigo.disabled = false;
            provisionarMensagem.textContent = "Firmware gravado. Agora envie o código do dispositivo.";
            provisionarMensagem.className = "simulador-mensagem success";
        } catch (error) {
            provisionarMensagem.textContent = `Falha ao gravar firmware: ${error.message}`;
            provisionarMensagem.className = "simulador-mensagem error";
            escreverLog("Falha no flash: " + error.message);
        } finally {
            btnGravarFirmware.disabled = false;
        }
    }


    function aguardarConfirmacaoSerial() {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                confirmacaoProvisionamento = null;
                reject(new Error("O ESP32 não confirmou o código pela serial."));
            }, 10000);
            confirmacaoProvisionamento = { resolve, reject, timer };
        });
    }

    function processarRespostaSerial(linha) {
        const texto = linha.trim();
        if (!texto) return;
        escreverLog("ESP32: " + texto);

        let resposta;
        try {
            resposta = JSON.parse(texto);
        } catch (error) {
            return;
        }

        if (!confirmacaoProvisionamento) return;
        clearTimeout(confirmacaoProvisionamento.timer);
        const pendente = confirmacaoProvisionamento;
        confirmacaoProvisionamento = null;
        if (resposta.status === "ok") {
            pendente.resolve(resposta);
        } else {
            pendente.reject(new Error(resposta.motivo || "O ESP32 rejeitou o código."));
        }
    }

    async function aguardarPrimeiraLeitura(id) {
        for (let tentativa = 0; tentativa < 15; tentativa += 1) {
            const resposta = await fetch(`${API_URL}/api/dispositivos`, {
                headers: solarbeamAuthHeaders(),
            });
            const dispositivos = await resposta.json();
            const dispositivoAtualizado = dispositivos.find((item) => String(item.id) === String(id));
            if (Number(dispositivoAtualizado?.firmware_configurado) === 1) return;
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        throw new Error("O ESP foi confirmado, mas a API ainda não recebeu a primeira leitura.");
    }

    function escreverLog(texto) {
        if (!log) return;
        const hora = new Date().toLocaleTimeString("pt-BR");
        log.textContent += `[${hora}] ${texto}\n`;
        log.scrollTop = log.scrollHeight;
    }
});
