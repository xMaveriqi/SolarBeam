document.addEventListener("DOMContentLoaded", () => {

    const btnPumpOn = document.getElementById("btnPumpOn");
    const btnPumpOff = document.getElementById("btnPumpOff");
    const btnRefresh = document.getElementById("btnRefresh");
    const btnSettings = document.getElementById("btnSettings");
    const soilHumidity = document.getElementById("soilHumidity");
    const temperature = document.getElementById("temperature");
    const battery = document.getElementById("battery");
    const pumpStatus = document.getElementById("pumpStatus");
    const lastUpdate = document.getElementById("lastUpdate");

    let sensorData = {
        humidity: 65,
        temperature: 27,
        battery: 92,
        pump: true
    };

    updateDashboard();

    btnPumpOn.addEventListener("click", turnPumpOn);
    btnPumpOff.addEventListener("click", turnPumpOff);
    btnRefresh.addEventListener("click", refreshSensors);
    btnSettings.addEventListener("click", openSettings);

    function updateDashboard(){
        soilHumidity.textContent = sensorData.humidity + "%";

        temperature.textContent = sensorData.temperature + "°C";

        battery.textContent = sensorData.battery + "%";

        pumpStatus.textContent = sensorData.pump ? "Ligada" : "Desligada";

        updateTime();
    }

    function updateTime(){
        const now = new Date();
        lastUpdate.textContent = now.toLocaleTimeString("pt-BR");
    }

    function turnPumpOn() {
        if (sensorData.pump) {
            showNotification("A bomba já está ligada.","warning");

            return;
        }
        sensorData.pump = true;

        updateDashboard();

        showNotification("Bomba ligada com sucesso!","success");
    }

    function turnPumpOff() {
        if (!sensorData.pump) {
            showNotification("A bomba já está desligada.","warning");

            return;
        }
        sensorData.pump = false;

        updateDashboard();

        showNotification("Bomba desligada.","success");
    }

    function refreshSensors() {
        btnRefresh.disabled = true;

        btnRefresh.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Atualizando...
        `;

        setTimeout(() => {
            sensorData.humidity = random(45, 90);

            sensorData.temperature = random(20, 35);

            sensorData.battery = random(60, 100);

            updateDashboard();

            btnRefresh.disabled = false;

            btnRefresh.innerHTML = `
                <i class="fa-solid fa-rotate"></i>
                Atualizar Sensores
            `;

            showNotification(
                "Sensores atualizados!",
                "success"
            );

        }, 1500);
    }

    function openSettings() {
        window.location.href ="configuracoes.html";
    }

    function random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function showNotification(message, type) {
        console.log(`[${type}] ${message}`);

        // Futuramente vamos trocar por um sistema visual de notificações (toast).

        alert(message);
    }

    setInterval(() => {
        updateTime();

        /*
        Exemplo para implementar futuramente:

        fetch("/api/sensores")
            .then(response => response.json())
            .then(data => {

                sensorData = data;

                updateDashboard();

            })
            .catch(error => {

                console.error(error);

            });
        */

    }, 30000);

    /*
        Quando integrarmos o Node.js + SQLite,
        chamaremos aqui uma função como:

        loadDashboard();

        Essa função fará:

        - Buscar sensores
        - Buscar status da bomba
        - Buscar nível da bateria
        - Buscar dados do ESP32
    */
});