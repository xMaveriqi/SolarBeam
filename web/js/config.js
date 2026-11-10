// Configuracao central da API.
// Em desenvolvimento local, usa o backend na porta 3000.
// Em producao, usa a API hospedada no Render.
const API_URL = (() => {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
        return "http://localhost:3000";
    }
    return "https://api-solarbeam.onrender.com";
})();

window.solarbeamFormatSensor = (valor, casasDecimais = 1, unidade = "") => {
    if (valor == null || valor === "" || !Number.isFinite(Number(valor))) return "--";

    const formatado = new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: casasDecimais,
    }).format(Number(valor));

    return `${formatado}${unidade}`;
};
