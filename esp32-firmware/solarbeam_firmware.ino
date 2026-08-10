#include <Preferences.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <DNSServer.h>

const char* API_URL = "https://api-solarbeam.onrender.com";
const char* VERSAO_FIRMWARE = "1.0.0";
const int PINO_UMIDADE = 34;     // sensor de umidade do solo (entrada analogica)
const int PINO_NIVEL_AGUA = 35;  // sensor de nivel de agua (entrada analogica)
const int PINO_BATERIA = 33;     // leitura da tensao da bateria (entrada analogica)
const int PINO_RELE_BOMBA = 26;  // rele que aciona a bomba (saida digital)

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
bool primeiraLeituraPendente = true;

unsigned long inicioTentativaWifi = 0;
const unsigned long TEMPO_LIMITE_RECONEXAO_MS = 60000;

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PINO_RELE_BOMBA, OUTPUT);
  digitalWrite(PINO_RELE_BOMBA, LOW);

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
  if (modoConfigAtivo) {
    dnsServer.processNextRequest();
    servidorConfig.handleClient();
    return;
  }
  if (Serial.available()) {
    String linha = Serial.readStringUntil('\n');
    processarComandoSerial(linha);
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
    if (primeiraLeituraPendente || millis() - ultimoEnvio > INTERVALO_ENVIO_MS) {
      if (enviarLeitura()) {
        ultimoEnvio = millis();
        primeiraLeituraPendente = false;
      }
    }
    verificarComandoPendente();
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

void paginaConfigWifi() {
  String html =
    "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>"
    "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
    "<title>Solar Beam - Configurar WiFi</title>"
    "<style>"
    "body{font-family:Arial,sans-serif;background:#0B1220;color:#E5E7EB;padding:24px;}"
    ".card{max-width:360px;margin:0 auto;background:#111827;border-radius:12px;padding:24px;}"
    "h1{font-size:20px;margin-bottom:4px;color:#22C55E;}"
    "p{font-size:13px;color:#94A3B8;margin-bottom:18px;}"
    "label{font-size:13px;display:block;margin-bottom:6px;}"
    "input,select{width:100%;padding:10px;margin-bottom:14px;border-radius:8px;border:1px solid #374151;background:#1F2937;color:#E5E7EB;box-sizing:border-box;}"
    "button{width:100%;padding:12px;border:none;border-radius:8px;background:#22C55E;color:#0B1220;font-weight:bold;font-size:14px;}"
    "</style></head><body>"
    "<div class='card'>"
    "<h1>Solar Beam</h1>"
    "<p>Escolha o WiFi que o dispositivo deve usar</p>"
    "<form action='/salvar' method='POST'>"
    "<label for='ssid'>Nome da rede (SSID)</label>"
    "<input type='text' id='ssid' name='ssid' required>"
    "<label for='senha'>Senha</label>"
    "<input type='password' id='senha' name='senha'>"
    "<button type='submit'>Salvar e conectar</button>"
    "</form></div></body></html>";

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

bool enviarLeitura() {
  HTTPClient http;
  http.begin(String(API_URL) + "/api/sensores");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["umidade"] = lerUmidade();
  doc["nivelAgua"] = lerNivelAgua();
  doc["bateria"] = lerBateria();
  doc["bomba"] = digitalRead(PINO_RELE_BOMBA) == HIGH;
  doc["codigoDispositivo"] = codigoDispositivo;
  doc["tokenDispositivo"] = tokenDispositivo;
  doc["versaoFirmware"] = VERSAO_FIRMWARE;

  String corpo;
  serializeJson(doc, corpo);

  int codigoResposta = http.POST(corpo);
  Serial.println("Envio de leitura -> HTTP " + String(codigoResposta));

  http.end();
  return codigoResposta >= 200 && codigoResposta < 300;
}

void verificarComandoPendente() {
  HTTPClient http;
  http.begin(String(API_URL) + "/api/comando?codigo=" + codigoDispositivo);

  int codigoResposta = http.GET();
  if (codigoResposta == 200) {
    String resposta = http.getString();

    StaticJsonDocument<256> doc;
    deserializeJson(doc, resposta);

    if (!doc["bomba"].isNull()) {
      bool ligar = doc["bomba"];
      digitalWrite(PINO_RELE_BOMBA, ligar ? HIGH : LOW);
      Serial.println("Comando aplicado: bomba " + String(ligar ? "LIGADA" : "DESLIGADA"));

      int idComando = doc["id"];
      confirmarComandoExecutado(idComando);
    }
  }

  http.end();
}

void confirmarComandoExecutado(int id) {
  HTTPClient http;
  http.begin(String(API_URL) + "/api/comando/" + String(id) + "/concluido");
  http.addHeader("Content-Type", "application/json");
  http.POST("{}");
  http.end();
}
