#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <DHT.h>

const char* API_URL = "https://api-solarbeam.onrender.com";
const char* VERSAO_FIRMWARE = "1.1.1";
const int PINO_UMIDADE = 34;     // sensor de umidade do solo (entrada analogica)
const int PINO_NIVEL_AGUA = 35;  // sensor de nivel de agua (entrada analogica)
const int PINO_BATERIA = 33;     // leitura da tensao da bateria (entrada analogica)
const int PINO_RELE_BOMBA = 27;  // rele que aciona a bomba (saida digital)
const int PINO_DHT11 = 26;       // sensor de temperatura/umidade do ar (dados digitais)
const bool RELE_ATIVO_EM_LOW = true;

#define TIPO_DHT DHT11
DHT dht(PINO_DHT11, TIPO_DHT);

const bool RELE_BOMBA_LIGADO = RELE_ATIVO_EM_LOW ? LOW : HIGH;
const bool RELE_BOMBA_DESLIGADO = RELE_ATIVO_EM_LOW ? HIGH : LOW;

const char* AP_NOME = "SolarBeam";
const IPAddress AP_IP(192, 168, 4, 1);
DNSServer dnsServer;
WebServer servidorConfig(80);
Preferences preferencias;
bool modoConfigAtivo = false;

String codigoDispositivo = "";
String tokenDispositivo = "";
String wifiSSIDSalvo = "";
String wifiSenhaSalva = "";

unsigned long ultimoEnvio = 0;
const unsigned long INTERVALO_ENVIO_MS = 60000;
unsigned long ultimaVerificacaoComando = 0;
const unsigned long INTERVALO_VERIFICACAO_COMANDO_MS = 5000;
unsigned long ultimaAtualizacaoConfig = 0;
const unsigned long INTERVALO_CONFIG_MS = 60000;
unsigned long inicioIrrigacaoAutomatica = 0;

// NOVO: em vez de um bloqueio por tempo (60s), usamos uma flag persistente.
// Assim que o usuario manda "desligar" pelo painel, o modo automatico fica
// suspenso ate que um novo comando manual de "ligar" seja recebido.
bool bombaDesligadaManualmente = false;

bool configuracaoDisponivel = false;
float umidadeMinima = 30.0;
unsigned long tempoBombaMs = 10000;
String modoOperacao = "manual";
bool primeiraLeituraPendente = true;
bool estadoBomba = false;

unsigned long inicioTentativaWifi = 0;
const unsigned long TEMPO_LIMITE_RECONEXAO_MS = 60000;

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PINO_RELE_BOMBA, OUTPUT);
  definirBomba(false);

  dht.begin();

  preferencias.begin("solarbeam", false);
  codigoDispositivo = preferencias.getString("codigo", "");
  tokenDispositivo = preferencias.getString("token", "");
  wifiSSIDSalvo = preferencias.getString("wifi_ssid", "");
  wifiSenhaSalva = preferencias.getString("wifi_pass", "");

  if (codigoDispositivo == "") {
    Serial.println("AGUARDANDO_GRAVACAO");
    Serial.println("Nenhum codigo salvo. Conecte pela pagina dispositivos");
  } else {
    Serial.println("Dispositivo ja conectado: " + codigoDispositivo);
  }

  if (wifiSSIDSalvo == "") {
    iniciarPortalConfig();
  } else {
    if (!conectarWiFi()) {
      iniciarPortalConfig();
    }
  }
}

void loop() {
  // O comando "configurar" (provisionamento pela pagina Dispositivos) precisa
  // ser lido mesmo com o portal cativo de WiFi ativo, senao ele e perdido
  // logo apos gravar o firmware (quando ainda nao ha WiFi salvo).
  if (Serial.available()) {
    String linha = Serial.readStringUntil('\n');
    processarComandoSerial(linha);
  }

  if (modoConfigAtivo) {
    dnsServer.processNextRequest();
    servidorConfig.handleClient();
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    if (inicioTentativaWifi == 0) {
      inicioTentativaWifi = millis();
      WiFi.reconnect();
    } else if (millis() - inicioTentativaWifi > TEMPO_LIMITE_RECONEXAO_MS) {
      Serial.println("Muito tempo sem WiFi. Reabrindo o portal de configuracao...");
      iniciarPortalConfig();
    }
    return;
  }

  inicioTentativaWifi = 0;

  if (codigoDispositivo != "") {
    if (!configuracaoDisponivel || millis() - ultimaAtualizacaoConfig > INTERVALO_CONFIG_MS) {
      atualizarConfiguracao();
      ultimaAtualizacaoConfig = millis();
    }
    if (primeiraLeituraPendente || millis() - ultimoEnvio > INTERVALO_ENVIO_MS) {
      if (enviarLeitura()) {
        ultimoEnvio = millis();
        primeiraLeituraPendente = false;
      }
    }
    if (millis() - ultimaVerificacaoComando > INTERVALO_VERIFICACAO_COMANDO_MS) {
      bool comandoAplicado = verificarComandoPendente();
      ultimaVerificacaoComando = millis();
      if (comandoAplicado) return;
    }
    executarIrrigacaoAutomatica();
  }
}
void iniciarPortalConfig() {
  if (modoConfigAtivo) return;

  modoConfigAtivo = true;
  inicioTentativaWifi = 0;

  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_NOME);

  dnsServer.start(53, "*", AP_IP);

  servidorConfig.on("/", HTTP_GET, paginaConfigWifi);
  servidorConfig.on("/generate_204", HTTP_GET, paginaConfigWifi);       // Android
  servidorConfig.on("/hotspot-detect.html", HTTP_GET, paginaConfigWifi); // iOS/macOS
  servidorConfig.on("/connecttest.txt", HTTP_GET, paginaConfigWifi);    // Windows
  servidorConfig.on("/ncsi.txt", HTTP_GET, paginaConfigWifi);           // Windows
  servidorConfig.on("/salvar", HTTP_POST, salvarConfigWifi);
  servidorConfig.onNotFound(paginaConfigWifi);
  servidorConfig.begin();

  Serial.println("PORTAL_CAPTIVO_ATIVO");
  Serial.println("Conecte-se na rede WiFi '" + String(AP_NOME) + "'");
  Serial.println("O portal sera aberto automaticamente; se necessario acesse http://192.168.4.1");
}

String gerarListaWiFiHtml() {
  String opcoes = "<option value=''>Selecione a rede...</option>";
  int numeroRedes = WiFi.scanNetworks(false, true);

  if (numeroRedes == 0) {
    return opcoes;
  }

  for (int i = 0; i < numeroRedes; i++) {
    String ssid = WiFi.SSID(i);
    ssid.replace("&", "&amp;");
    ssid.replace("\"", "&quot;");
    ssid.replace("<", "&lt;");
    ssid.replace(">", "&gt;");
    opcoes += "<option value='" + ssid + "'>" + ssid + "</option>";
  }

  return opcoes;
}

void paginaConfigWifi() {
  String redesDisponiveis = gerarListaWiFiHtml();

  String html =
    "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>"
    "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
    "<title>Solar Beam - Configurar WiFi</title>"
    "<style>"
    "*{box-sizing:border-box;}"
    "body{margin:0;font-family:Arial,sans-serif;background:linear-gradient(180deg,#0B1220,#111827);color:#E5E7EB;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:18px;}"
    ".card{width:min(100%, 380px);background:rgba(17,24,39,.95);border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:22px 18px 18px;box-shadow:0 16px 40px rgba(0,0,0,.35);}"
    "h1{margin:0 0 8px;font-size:28px;color:#22C55E;text-align:center;}"
    "p{margin:0 0 18px;font-size:14px;color:#94A3B8;text-align:center;line-height:1.4;}"
    "label{display:block;font-size:13px;margin-bottom:7px;color:#E2E8F0;}"
    "input,select{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #374151;background:#0F172A;color:#E5E7EB;font-size:15px;outline:none;}"
    "input:focus,select:focus{border-color:#22C55E;box-shadow:0 0 0 2px rgba(34,197,94,0.18);}"
    ".field{position:relative;margin-bottom:14px;}"
    ".field button{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#94A3B8;font-size:12px;font-weight:bold;padding:6px 8px;border-radius:8px;cursor:pointer;}"
    ".field button:active{background:rgba(148,163,184,.08);}"
    "button[type='submit']{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(180deg,#22C55E,#16A34A);color:#0B1220;font-weight:bold;font-size:15px;cursor:pointer;margin-top:8px;}"
    ".helper{font-size:11px;color:#9CA3AF;margin:-6px 0 14px;line-height:1.4;}"
    "@media (max-width: 420px){body{padding:12px;} .card{padding:18px 14px 14px;}}"
    "</style></head><body>"
    "<div class='card'>"
    "<h1>Solar Beam</h1>"
    "<p>Selecione a rede Wi‑Fi da sua casa ou do seu celular</p>"
    "<form action='/salvar' method='POST'>"
    "<label for='ssid'>Rede Wi‑Fi</label>"
    "<div class='field'>"
    "<input type='text' id='ssid' name='ssid' list='redes-wifi' placeholder='Digite ou escolha a rede' required>"
    "</div>"
    "<datalist id='redes-wifi'>" + redesDisponiveis + "</datalist>"
    "<div class='helper'>Se a rede não aparecer, digite o nome manualmente.</div>"
    "<label for='senha'>Senha</label>"
    "<div class='field'>"
    "<input type='password' id='senha' name='senha' placeholder='Digite a senha da rede'>"
    "<button type='button' id='toggleSenha'>MOSTRAR</button>"
    "</div>"
    "<button type='submit'>Salvar e conectar</button>"
    "</form></div>"
    "<script>"
    "const senhaInput = document.getElementById('senha');"
    "const toggleSenha = document.getElementById('toggleSenha');"
    "const ssidInput = document.getElementById('ssid');"
    "toggleSenha.addEventListener('click', function(){"
    "  const isPassword = senhaInput.type === 'password';"
    "  senhaInput.type = isPassword ? 'text' : 'password';"
    "  toggleSenha.textContent = isPassword ? 'OCULTAR' : 'MOSTRAR';"
    "});"
    "if (ssidInput && ssidInput.list && ssidInput.list.options.length > 1) {"
    "  ssidInput.addEventListener('focus', function(){"
    "    if (!ssidInput.value) ssidInput.click();"
    "  });"
    "}"
    "</script></body></html>";

  servidorConfig.send(200, "text/html", html);
}

void salvarConfigWifi() {
  String ssid = servidorConfig.arg("ssid");
  String senha = servidorConfig.arg("senha");

  if (ssid == "") {
    servidorConfig.send(400, "text/plain", "Nome da rede e obrigatorio.");
    return;
  }

  preferencias.putString("wifi_ssid", ssid);
  preferencias.putString("wifi_pass", senha);

  servidorConfig.send(200, "text/html",
    "<html><body style='font-family:Arial;background:#0B1220;color:#E5E7EB;padding:24px;text-align:center;'>"
    "<h2 style='color:#22C55E;'>Configuracao salva!</h2>"
    "<p>O dispositivo vai reiniciar e tentar se conectar na rede informada.</p>"
    "</body></html>");

  delay(1500);
  ESP.restart();
}

bool conectarWiFi() {
  Serial.println("Conectando ao WiFi '" + wifiSSIDSalvo + "'...");
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSIDSalvo.c_str(), wifiSenhaSalva.c_str());

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado! IP: " + WiFi.localIP().toString());
    return true;
  }

  Serial.println("\nFalha ao conectar no WiFi salvo.");
  return false;
}

void processarComandoSerial(String linha) {
  linha.trim();
  if (linha == "") return;

  StaticJsonDocument<256> doc;
  DeserializationError erro = deserializeJson(doc, linha);

  if (erro) {
    Serial.println("Comando serial invalido (nao e JSON valido).");
    return;
  }

  String comando = doc["comando"] | "";

  if (comando == "configurar") {
    String novoCodigo = doc["codigo"] | "";
    String novoToken = doc["token"] | "";
    if (novoCodigo == "") {
      Serial.println("{\"status\":\"erro\",\"motivo\":\"codigo vazio\"}");
      return;
    }

    codigoDispositivo = novoCodigo;
    tokenDispositivo = novoToken;
    preferencias.putString("codigo", codigoDispositivo);
    preferencias.putString("token", tokenDispositivo);

    Serial.println("{\"status\":\"ok\",\"mensagem\":\"Dispositivo provisionado como " + codigoDispositivo + "\"}");
  }

  if (comando == "configurar_wifi") {
    String novoSSID = doc["ssid"] | "";
    String novaSenha = doc["senha"] | "";
    if (novoSSID == "") {
      Serial.println("{\"status\":\"erro\",\"motivo\":\"ssid vazio\"}");
      return;
    }
    preferencias.putString("wifi_ssid", novoSSID);
    preferencias.putString("wifi_pass", novaSenha);
    Serial.println("{\"status\":\"ok\",\"mensagem\":\"Wi-Fi salvo\"}");
    delay(500);
    ESP.restart();
  }
}

float lerUmidade() {
  int bruto = analogRead(PINO_UMIDADE);
  float percentual = map(bruto, 4095, 1200, 0, 100);
  return constrain(percentual, 0, 100);
}

float lerNivelAgua() {
  int bruto = analogRead(PINO_NIVEL_AGUA);
  float percentual = map(bruto, 0, 4095, 0, 100);
  return constrain(percentual, 0, 100);
}

float lerBateria() {
  int bruto = analogRead(PINO_BATERIA);
  float tensao = (bruto / 4095.0) * 3.3 * 2; // exemplo com divisor 1:1
  return tensao;
}

void definirBomba(bool ligada) {
  bool nivelAtivo = RELE_ATIVO_EM_LOW ? LOW : HIGH;
  bool nivelInativo = RELE_ATIVO_EM_LOW ? HIGH : LOW;
  digitalWrite(PINO_RELE_BOMBA, ligada ? nivelAtivo : nivelInativo);
  estadoBomba = ligada;
}

bool bombaLigada() {
  return estadoBomba;
}

void atualizarConfiguracao() {
  WiFiClientSecure cliente;
  cliente.setInsecure();
  HTTPClient http;
  http.setTimeout(15000);
  String url = String(API_URL) + "/api/config/dispositivo?codigo=" + codigoDispositivo +
    "&tokenDispositivo=" + tokenDispositivo;
  http.begin(cliente, url);

  int codigoResposta = http.GET();
  if (codigoResposta == 200) {
    StaticJsonDocument<256> doc;
    DeserializationError erro = deserializeJson(doc, http.getString());
    if (!erro && (doc["modo"] == "automatico" || doc["modo"] == "manual")) {
      umidadeMinima = constrain((float)(doc["umidadeMinima"] | 30.0), 0.0, 100.0);
      int segundos = doc["tempoBomba"] | 10;
      tempoBombaMs = (unsigned long)constrain(segundos, 1, 3600) * 1000UL;
      modoOperacao = doc["modo"].as<String>();
      configuracaoDisponivel = true;
      Serial.println("Configuracao atualizada: modo " + modoOperacao);
    }
  } else if (codigoResposta > 0) {
    Serial.println("Configuração -> HTTP " + String(codigoResposta) + ": " + http.getString());
  } else {
    Serial.println("Erro HTTPS ao buscar configuracao: " + http.errorToString(codigoResposta));
  }
  http.end();
}

void executarIrrigacaoAutomatica() {
  // Se o modo nao e automatico, ou se o usuario mandou "desligar" manualmente
  // pelo painel, a irrigacao automatica fica suspensa ate um novo comando
  // manual de "ligar" ser recebido (ver verificarComandoPendente()).
  if (!configuracaoDisponivel || modoOperacao != "automatico" || bombaDesligadaManualmente) {
    inicioIrrigacaoAutomatica = 0;
    return;
  }

  float umidade = lerUmidade();
  float nivelAgua = lerNivelAgua();

  if (bombaLigada()) {
    if (inicioIrrigacaoAutomatica == 0) inicioIrrigacaoAutomatica = millis();
    if (nivelAgua <= 5.0 || millis() - inicioIrrigacaoAutomatica >= tempoBombaMs) {
      definirBomba(false);
      inicioIrrigacaoAutomatica = 0;
      Serial.println(nivelAgua <= 5.0 ? "Bomba desligada: nivel de agua baixo." :
        "Bomba desligada: tempo automatico concluido.");
    }
    return;
  }

  if (umidade < umidadeMinima && nivelAgua > 5.0) {
    definirBomba(true);
    inicioIrrigacaoAutomatica = millis();
    Serial.println("Irrigacao automatica iniciada.");
  }
}

float lerTemperatura() {
  for (int tentativa = 1; tentativa <= 3; tentativa++) {
    float temperatura = dht.readTemperature();
    if (!isnan(temperatura)) return temperatura;
    Serial.println("Falha ao ler temperatura do DHT11 (tentativa " + String(tentativa) + "/3).");
    delay(300);
  }
  return NAN;
}

float lerUmidadeAr() {
  for (int tentativa = 1; tentativa <= 3; tentativa++) {
    float umidadeAr = dht.readHumidity();
    if (!isnan(umidadeAr)) return umidadeAr;
    Serial.println("Falha ao ler umidade do ar do DHT11 (tentativa " + String(tentativa) + "/3).");
    delay(300);
  }
  return NAN;
}

bool enviarLeitura() {
  WiFiClientSecure cliente;
  cliente.setInsecure();
  HTTPClient http;
  http.setTimeout(15000);
  http.begin(cliente, String(API_URL) + "/api/sensores");
  http.addHeader("Content-Type", "application/json");

  float temperatura = lerTemperatura();
  float umidadeAr = lerUmidadeAr();

  StaticJsonDocument<320> doc;
  doc["umidade"] = lerUmidade();
  doc["nivelAgua"] = lerNivelAgua();
  doc["bateria"] = lerBateria();
  doc["bomba"] = bombaLigada();
  if (!isnan(temperatura)) {
    doc["temperatura"] = temperatura;
  }
  if (!isnan(umidadeAr)) {
    doc["umidadeAr"] = umidadeAr;
  }
  doc["codigoDispositivo"] = codigoDispositivo;
  doc["tokenDispositivo"] = tokenDispositivo;
  doc["versaoFirmware"] = VERSAO_FIRMWARE;

  String corpo;
  serializeJson(doc, corpo);

  int codigoResposta = http.POST(corpo);
  Serial.println("Envio de leitura -> HTTP " + String(codigoResposta));
  if (codigoResposta <= 0) {
    Serial.println("Erro HTTPS ao enviar leitura: " + http.errorToString(codigoResposta));
  } else if (codigoResposta < 200 || codigoResposta >= 300) {
    Serial.println("Resposta da API: " + http.getString());
  }

  http.end();
  return codigoResposta >= 200 && codigoResposta < 300;
}

bool verificarComandoPendente() {
  WiFiClientSecure cliente;
  cliente.setInsecure();
  HTTPClient http;
  http.setTimeout(15000);
  http.begin(cliente, String(API_URL) + "/api/comando?codigo=" + codigoDispositivo + "&tokenDispositivo=" + tokenDispositivo);

  int codigoResposta = http.GET();
  if (codigoResposta == 200) {
    String resposta = http.getString();

    StaticJsonDocument<256> doc;
    DeserializationError erro = deserializeJson(doc, resposta);
    if (erro) {
      Serial.println("Resposta de comando invalida: " + resposta);
      http.end();
      return false;
    }

    if (doc["bomba"].is<bool>()) {
      bool ligar = doc["bomba"].as<bool>();
      definirBomba(ligar);
      Serial.println("Comando aplicado: bomba " + String(ligar ? "LIGADA" : "DESLIGADA"));

      // NOVO: em vez de um bloqueio temporario, marcamos a flag persistente.
      // "Ligar" manualmente reativa o modo automatico; "desligar" o suspende
      // ate o proximo comando manual de "ligar".
      bombaDesligadaManualmente = !ligar;
      inicioIrrigacaoAutomatica = ligar ? millis() : 0;

      int idComando = doc["id"];
      confirmarComandoExecutado(idComando);
      http.end();
      return true;
    }
  } else if (codigoResposta <= 0) {
    Serial.println("Erro HTTPS ao consultar comando: " + http.errorToString(codigoResposta));
  } else {
    Serial.println("Consulta de comando -> HTTP " + String(codigoResposta) + ": " + http.getString());
  }

  http.end();
  return false;
}

void confirmarComandoExecutado(int id) {
  WiFiClientSecure cliente;
  cliente.setInsecure();
  HTTPClient http;
  http.setTimeout(15000);
  http.begin(cliente, String(API_URL) + "/api/comando/" + String(id) + "/concluido");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["tokenDispositivo"] = tokenDispositivo;
  String corpo;
  serializeJson(doc, corpo);

  int codigoResposta = http.POST(corpo);
  Serial.println("Confirmacao do comando " + String(id) + " -> HTTP " + String(codigoResposta));
  if (codigoResposta <= 0) {
    Serial.println("Erro HTTPS ao confirmar comando: " + http.errorToString(codigoResposta));
  }

  http.end();
}