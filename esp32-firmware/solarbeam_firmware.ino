/*
  SolarBeam - Firmware v1.2.2

  O QUE MUDOU EM RELACAO A v1.2.0
  -------------------------------
   - Rele agora comandado por transistor TIP122 (GPIO27 -> 1k -> Base; Coletor -> IN do modulo;
     Emissor -> GND). A logica ficou "HIGH = rele armado": RELE_ATIVO_EM_LOW = false e
     RELE_MODO_DRENO_ABERTO = false.
   - escreverRele(): pinMode(OUTPUT) agora vem ANTES do digitalWrite.
   - tratarPortal(): WiFi.disconnect() antes de WiFi.begin(), corrige o erro
     "wifi:sta is connecting, cannot set config".

  O QUE MUDOU EM RELACAO A v1.1.1 (v1.2.0)
  ----------------------------------------
  RELE
   - Rele agora nasce DESLIGADO (primeira instrucao do setup) e ha modo "dreno aberto"
     (RELE_MODO_DRENO_ABERTO) para modulos de rele 5V comandados por 3.3V do ESP32:
     nesses modulos, HIGH de 3.3V muitas vezes NAO desliga o rele.
   - Tempo maximo de seguranca da bomba (funciona sempre, com ou sem Wi-Fi/API).
   - Irrigacao automatica tem pausa entre ciclos e confirma 3 leituras secas seguidas.
  API / REDE
   - Uma unica funcao de requisicao, com timeouts maiores (Render free "dorme" e demora
     ~30-60 s para acordar) e recuo progressivo apos falhas (nao martela a API).
   - Wi-Fi que cai NAO prende mais o aparelho no portal: ele continua tentando reconectar
     e fecha o portal sozinho quando a rede volta.
   - Irrigacao automatica continua funcionando sem Wi-Fi (config fica salva na flash).
  COMANDOS
   - Le o comando em varios formatos (true/false, 1/0, "ligar"/"desligar", aninhado em
     "comando"), ids numericos ou texto, e nao reaplica o mesmo comando duas vezes.
  SENSORES
   - Leituras analogicas com media de 16 amostras; bateria com ADC calibrado.
   - DHT11: leitura unica (temp+umidade) e retentativas de verdade (a v1.1.1 repetia a
     leitura em 300 ms, mas a biblioteca devolvia o erro em cache).
   - Novos comandos seriais: {"comando":"status"} e {"comando":"bomba","ligar":true/false}
*/

#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <DHT.h>

// ============================================================
// CONFIGURACAO
// ============================================================
const char* API_URL = "https://api-solarbeam.onrender.com";
const char* VERSAO_FIRMWARE = "1.2.2";

const int PINO_UMIDADE = 34;     // sensor de umidade do solo (entrada analogica)
const int PINO_NIVEL_AGUA = 35;  // sensor de nivel de agua (entrada analogica)
const int PINO_BATERIA = 33;     // leitura da tensao da bateria (entrada analogica)
const int PINO_RELE_BOMBA = 27;  // rele que aciona a bomba (saida digital)
const int PINO_DHT11 = 26;       // sensor de temperatura/umidade do ar (dados digitais)

// --- Rele ---------------------------------------------------
// true  = modulo liga com o pino em LOW (a maioria dos modulos com optoacoplador)
// false = modulo liga com o pino em HIGH
// COM O TRANSISTOR TIP122 (GPIO -> 1k -> Base; Coletor -> IN do modulo; Emissor -> GND)
// A LOGICA INVERTE: HIGH ARMA O RELE. POR ISSO AQUI FICA false.
// SE "LIGAR" E "DESLIGAR" ESTIVEREM INVERTIDOS, TROQUE ESTE VALOR.
const bool RELE_ATIVO_EM_LOW = false;

// Modo para modulo ligado DIRETO no GPIO (sem transistor), alimentado em 5V com sinal de 3.3V:
// o HIGH de 3.3V pode nao desligar o rele. Neste modo, para DESLIGAR o pino vira entrada
// (alta impedancia) e o proprio modulo puxa a entrada para cima. So vale quando
// RELE_ATIVO_EM_LOW = true. Com o TIP122 deixe false.
const bool RELE_MODO_DRENO_ABERTO = false;

// --- Calibracao dos sensores --------------------------------
const int UMIDADE_ADC_SECO = 4095;     // leitura bruta com o sensor no ar/solo seco
const int UMIDADE_ADC_MOLHADO = 1200;  // leitura bruta com o sensor na agua/solo encharcado
const float DIVISOR_BATERIA = 2.0;     // divisor resistivo 1:1 => tensao real = leitura x 2
const float NIVEL_AGUA_MINIMO = 5.0;   // % abaixo do qual a bomba nao pode ligar (modo automatico)

// --- Tempos -------------------------------------------------
const unsigned long INTERVALO_ENVIO_MS = 60000;               // envio de leituras
const unsigned long INTERVALO_COMANDO_MS = 5000;              // consulta de comandos
const unsigned long INTERVALO_CONFIG_MS = 60000;              // atualizacao de configuracao
const unsigned long INTERVALO_CONFIG_SEM_CFG_MS = 10000;      // idem, enquanto nao ha config
const unsigned long INTERVALO_AUTOMATICO_MS = 2000;           // avaliacao da irrigacao automatica
const int LEITURAS_SECO_PARA_LIGAR = 3;                       // leituras secas seguidas p/ ligar
const unsigned long ATRASO_INICIAL_AUTOMATICO_MS = 15000;     // espera apos ligar a placa
const unsigned long PAUSA_ENTRE_IRRIGACOES_MS = 300000;       // 5 min p/ a agua chegar no sensor
const unsigned long TEMPO_MAXIMO_BOMBA_MS = 1800000;          // seguranca: 30 min
const unsigned long BLOQUEIO_APOS_COMANDO_MANUAL_MS = 300000; // evita religar logo apos desligamento manual

const uint32_t TIMEOUT_CONEXAO_MS = 15000;
const uint32_t TIMEOUT_RESPOSTA_MS = 25000;
const unsigned long TEMPO_PORTAL_SEM_WIFI_MS = 60000;         // sem Wi-Fi por 60 s => abre portal
const unsigned long INTERVALO_RECONEXAO_WIFI_MS = 15000;

#define TIPO_DHT DHT11
DHT dht(PINO_DHT11, TIPO_DHT);

const char* AP_NOME = "SolarBeam";
const IPAddress AP_IP(192, 168, 4, 1);

// ============================================================
// ESTADO
// ============================================================
DNSServer dnsServer;
WebServer servidorConfig(80);
Preferences preferencias;
WiFiClientSecure clienteTLS;

bool modoConfigAtivo = false;
bool rotasPortalRegistradas = false;

String codigoDispositivo = "";
String tokenDispositivo = "";
String wifiSSIDSalvo = "";
String wifiSenhaSalva = "";

// Wi-Fi
unsigned long inicioQuedaWifi = 0;
unsigned long ultimaTentativaWifi = 0;

// API
unsigned long proximaTentativaApi = 0;
int falhasApi = 0;
unsigned long ultimoEnvio = 0;
unsigned long ultimaVerificacaoComando = 0;
unsigned long ultimaAtualizacaoConfig = 0;
bool primeiraLeituraPendente = true;
bool primeiraConfigPendente = true;
int ultimoIdComando = 0;

// Bomba / irrigacao
bool estadoBomba = false;
unsigned long inicioBombaMs = 0;
unsigned long ultimoFimIrrigacao = 0;
unsigned long ultimaAvaliacaoAutomatica = 0;
int contagemSeco = 0;
unsigned long bloqueioAutomaticoAte = 0;

// Configuracao vinda da API (fica salva na flash)
bool configuracaoDisponivel = false;
float umidadeMinima = 30.0;
unsigned long tempoBombaMs = 10000;
String modoOperacao = "manual";
int versaoConfiguracao = -1;

// ============================================================
// PROTOTIPOS
// ============================================================
void escreverRele(bool ligado);
void definirBomba(bool ligada);
bool bombaLigada();
void iniciarPortalConfig();
void encerrarPortalConfig();

// ============================================================
// SETUP / LOOP
// ============================================================
void setup() {
  // 1) RELE PRIMEIRO: garante bomba desligada o mais cedo possivel.
  escreverRele(false);
  estadoBomba = false;

  Serial.begin(115200);
  Serial.setTimeout(100);
  delay(300);
  Serial.println();
  Serial.println("SolarBeam firmware " + String(VERSAO_FIRMWARE));

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  dht.begin();

  preferencias.begin("solarbeam", false);
  codigoDispositivo = preferencias.getString("codigo", "");
  tokenDispositivo = preferencias.getString("token", "");
  wifiSSIDSalvo = preferencias.getString("wifi_ssid", "");
  wifiSenhaSalva = preferencias.getString("wifi_pass", "");

  configuracaoDisponivel = preferencias.getBool("cfg_ok", false);
  if (configuracaoDisponivel) {
    umidadeMinima = preferencias.getFloat("um_min", 30.0);
    tempoBombaMs = preferencias.getULong("tempo_ms", 10000);
    modoOperacao = preferencias.getString("modo", "manual");
    versaoConfiguracao = preferencias.getInt("cfg_ver", -1);
  }

  if (codigoDispositivo == "") {
    Serial.println("AGUARDANDO_GRAVACAO");
    Serial.println("Nenhum codigo salvo. Conecte pela pagina dispositivos");
  } else {
    Serial.println("Dispositivo ja conectado: " + codigoDispositivo);
  }

  WiFi.persistent(false);
  if (wifiSSIDSalvo == "") {
    iniciarPortalConfig();
  } else if (!conectarWiFi()) {
    iniciarPortalConfig();
  }
}

void loop() {
  lerSerial();

  // Estas duas rodam SEMPRE, independente de Wi-Fi, API ou portal.
  verificarSegurancaBomba();
  executarIrrigacaoAutomatica();

  if (modoConfigAtivo) {
    tratarPortal();
    delay(5);
    return;
  }

  if (!gerenciarWiFi()) {
    delay(50);
    return;
  }

  if (codigoDispositivo != "") {
    // 1) Comandos primeiro: sao o que o usuario espera ver reagir.
    if (apiLiberada() && millis() - ultimaVerificacaoComando >= INTERVALO_COMANDO_MS) {
      ultimaVerificacaoComando = millis();
      bool comandoAplicado = verificarComandoPendente();
      if (comandoAplicado) return;
    }

    // 2) Configuracao.
    unsigned long intervaloConfig = configuracaoDisponivel ? INTERVALO_CONFIG_MS : INTERVALO_CONFIG_SEM_CFG_MS;
    if (apiLiberada() && (primeiraConfigPendente || millis() - ultimaAtualizacaoConfig >= intervaloConfig)) {
      primeiraConfigPendente = false;
      ultimaAtualizacaoConfig = millis();
      atualizarConfiguracao();
    }

    // 3) Telemetria.
    if (apiLiberada() && (primeiraLeituraPendente || millis() - ultimoEnvio >= INTERVALO_ENVIO_MS)) {
      if (enviarLeitura()) {
        ultimoEnvio = millis();
        primeiraLeituraPendente = false;
      }
    }
  }

  delay(10);
}

// ============================================================
// RELE / BOMBA
// ============================================================
void escreverRele(bool ligado) {
  if (RELE_ATIVO_EM_LOW && RELE_MODO_DRENO_ABERTO) {
    if (ligado) {
      pinMode(PINO_RELE_BOMBA, OUTPUT);
      digitalWrite(PINO_RELE_BOMBA, LOW);
    } else {
      pinMode(PINO_RELE_BOMBA, INPUT);      // solto: o modulo puxa para cima => desligado
    }
  } else {
    bool nivelAtivo = RELE_ATIVO_EM_LOW ? LOW : HIGH;
    bool nivelInativo = RELE_ATIVO_EM_LOW ? HIGH : LOW;
    pinMode(PINO_RELE_BOMBA, OUTPUT);
    digitalWrite(PINO_RELE_BOMBA, ligado ? nivelAtivo : nivelInativo);
  }
}

void definirBomba(bool ligada) {
  if (ligada && !estadoBomba) inicioBombaMs = millis();
  if (!ligada && estadoBomba) ultimoFimIrrigacao = millis();
  escreverRele(ligada);
  estadoBomba = ligada;
}

bool bombaLigada() {
  return estadoBomba;
}

// Desliga a bomba se ficar ligada por tempo demais (qualquer modo, com ou sem rede).
void verificarSegurancaBomba() {
  if (!bombaLigada()) return;
  unsigned long limite = TEMPO_MAXIMO_BOMBA_MS;
  if (tempoBombaMs + 5000UL > limite) limite = tempoBombaMs + 5000UL;
  if (millis() - inicioBombaMs >= limite) {
    definirBomba(false);
    Serial.println("SEGURANCA: bomba desligada por tempo maximo de funcionamento.");
  }
}

void executarIrrigacaoAutomatica() {
  if (!configuracaoDisponivel || modoOperacao != "automatico") {
    contagemSeco = 0;
    return;
  }

  unsigned long agora = millis();
  if (bloqueioAutomaticoAte != 0 && (long)(agora - bloqueioAutomaticoAte) < 0) {
    contagemSeco = 0;
    return;
  }
  if (agora < ATRASO_INICIAL_AUTOMATICO_MS) return;
  if (agora - ultimaAvaliacaoAutomatica < INTERVALO_AUTOMATICO_MS) return;
  ultimaAvaliacaoAutomatica = agora;

  float umidade = lerUmidade();
  float nivelAgua = lerNivelAgua();

  if (bombaLigada()) {
    if (nivelAgua <= NIVEL_AGUA_MINIMO || agora - inicioBombaMs >= tempoBombaMs) {
      definirBomba(false);
      Serial.println(nivelAgua <= NIVEL_AGUA_MINIMO ? "Bomba desligada: nivel de agua baixo." :
        "Bomba desligada: tempo automatico concluido.");
    }
    return;
  }

  bool pausaCumprida = (ultimoFimIrrigacao == 0) || (agora - ultimoFimIrrigacao >= PAUSA_ENTRE_IRRIGACOES_MS);
  if (pausaCumprida && umidade < umidadeMinima && nivelAgua > NIVEL_AGUA_MINIMO) {
    contagemSeco++;
    if (contagemSeco >= LEITURAS_SECO_PARA_LIGAR) {
      contagemSeco = 0;
      definirBomba(true);
      Serial.println("Irrigacao automatica iniciada (umidade " + String(umidade, 1) + "%).");
    }
  } else {
    contagemSeco = 0;
  }
}

// ============================================================
// SENSORES
// ============================================================
int lerAnalogicoMedio(int pino) {
  long soma = 0;
  for (int i = 0; i < 16; i++) {
    soma += analogRead(pino);
    delayMicroseconds(100);
  }
  return (int)(soma / 16);
}

float mapearFloat(float x, float inMin, float inMax, float outMin, float outMax) {
  return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

float lerUmidade() {
  int bruto = lerAnalogicoMedio(PINO_UMIDADE);
  float percentual = mapearFloat(bruto, UMIDADE_ADC_SECO, UMIDADE_ADC_MOLHADO, 0.0, 100.0);
  return constrain(percentual, 0.0f, 100.0f);
}

float lerNivelAgua() {
  int bruto = lerAnalogicoMedio(PINO_NIVEL_AGUA);
  float percentual = mapearFloat(bruto, 0, 4095, 0.0, 100.0);
  return constrain(percentual, 0.0f, 100.0f);
}

float lerBateria() {
  uint32_t soma = 0;
  for (int i = 0; i < 16; i++) {
    soma += analogReadMilliVolts(PINO_BATERIA);
    delayMicroseconds(100);
  }
  return (soma / 16.0f) / 1000.0f * DIVISOR_BATERIA;
}

// Le temperatura e umidade do ar numa unica leitura.
// force=true ignora o cache da biblioteca (que guardava a falha por 2 s).
bool lerDHT(float &temperatura, float &umidadeAr) {
  for (int tentativa = 1; tentativa <= 3; tentativa++) {
    float h = dht.readHumidity(true);
    float t = dht.readTemperature();   // usa o resultado da leitura acima
    if (!isnan(h) && !isnan(t)) {
      umidadeAr = h;
      temperatura = t;
      return true;
    }
    Serial.println("Falha ao ler DHT11 (tentativa " + String(tentativa) + "/3). Verifique fio de dados e pull-up de 10k.");
    delay(1500);
  }
  return false;
}

// ============================================================
// REDE / API
// ============================================================
String urlEncode(const String& s) {
  const char* hex = "0123456789ABCDEF";
  String r;
  r.reserve(s.length() * 3);
  for (size_t i = 0; i < s.length(); i++) {
    uint8_t c = (uint8_t)s[i];
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      r += (char)c;
    } else {
      r += '%';
      r += hex[(c >> 4) & 0x0F];
      r += hex[c & 0x0F];
    }
  }
  return r;
}

String trecho(const String& s) {
  if (s.length() > 120) return s.substring(0, 120) + "...";
  return s;
}

bool podeLogar(unsigned long &ultimo, unsigned long intervalo) {
  unsigned long agora = millis();
  if (ultimo == 0 || agora - ultimo >= intervalo) {
    ultimo = agora;
    return true;
  }
  return false;
}

bool apiLiberada() {
  return (long)(millis() - proximaTentativaApi) >= 0;
}

void registrarSucessoApi() {
  if (falhasApi > 0) Serial.println("API respondendo novamente.");
  falhasApi = 0;
  proximaTentativaApi = 0;
}

void registrarFalhaApi() {
  if (falhasApi < 250) falhasApi++;
  int deslocamento = falhasApi - 1;
  if (deslocamento > 4) deslocamento = 4;
  unsigned long espera = 5000UL << deslocamento;   // 5, 10, 20, 40, 80 s...
  if (espera > 60000UL) espera = 60000UL;          // ...limitado a 60 s
  proximaTentativaApi = millis() + espera;
  Serial.println("API indisponivel (falha " + String(falhasApi) + "). Nova tentativa em " + String(espera / 1000) + " s.");

  if (falhasApi == 15) {
    Serial.println("Muitas falhas seguidas. Reiniciando o Wi-Fi...");
    WiFi.disconnect();
    WiFi.begin(wifiSSIDSalvo.c_str(), wifiSenhaSalva.c_str());
  }
  if (falhasApi >= 60) {
    Serial.println("API fora do ar ha muito tempo. Reiniciando o dispositivo...");
    delay(200);
    ESP.restart();
  }
}

// 4xx significa que a API respondeu (problema de dados/credencial), nao e falha de rede.
bool falhaDeRede(int codigo) {
  return codigo <= 0 || codigo >= 500;
}

void logErroApi(const char* contexto, int codigo, const String& resposta) {
  if (codigo <= 0) {
    Serial.println(String(contexto) + " -> erro de conexao (" + String(codigo) + "): " + resposta);
  } else if (codigo == 401 || codigo == 403) {
    Serial.println(String(contexto) + " -> HTTP " + String(codigo) +
      " (codigo/token recusados: regrave o dispositivo pela pagina Dispositivos): " + trecho(resposta));
  } else {
    Serial.println(String(contexto) + " -> HTTP " + String(codigo) + ": " + trecho(resposta));
  }
}

// Requisicao unica para toda a API.
int chamarApi(bool post, const String& caminho, const String& corpo, String& resposta) {
  resposta = "";
  clienteTLS.stop();
  clienteTLS.setInsecure();

  HTTPClient http;
  http.setConnectTimeout(TIMEOUT_CONEXAO_MS);
  http.setTimeout(TIMEOUT_RESPOSTA_MS);
  http.setReuse(false);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  if (!http.begin(clienteTLS, String(API_URL) + caminho)) {
    resposta = "http.begin falhou";
    return -100;
  }
  http.addHeader("Accept", "application/json");

  int codigo;
  if (post) {
    http.addHeader("Content-Type", "application/json");
    codigo = http.POST(corpo);
  } else {
    codigo = http.GET();
  }

  if (codigo > 0) resposta = http.getString();
  else resposta = http.errorToString(codigo);

  http.end();
  clienteTLS.stop();
  return codigo;
}

void atualizarConfiguracao() {
  String resposta;
  String caminho = "/api/config/dispositivo?codigo=" + urlEncode(codigoDispositivo) +
    "&tokenDispositivo=" + urlEncode(tokenDispositivo);
  int codigo = chamarApi(false, caminho, "", resposta);

  if (falhaDeRede(codigo)) {
    registrarFalhaApi();
    logErroApi("Configuracao", codigo, resposta);
    return;
  }
  registrarSucessoApi();
  if (codigo != 200) {
    logErroApi("Configuracao", codigo, resposta);
    return;
  }

  StaticJsonDocument<512> doc;
  DeserializationError erro = deserializeJson(doc, resposta);
  if (erro) {
    Serial.println("Configuracao invalida (" + String(erro.c_str()) + "): " + trecho(resposta));
    return;
  }

  String modoRecebido = doc["modo"] | "";
  modoRecebido.trim();
  modoRecebido.toLowerCase();
  String novoModo;
  if (modoRecebido.startsWith("auto")) novoModo = "automatico";
  else if (modoRecebido == "manual") novoModo = "manual";
  else {
    Serial.println("Configuracao com modo desconhecido: " + trecho(resposta));
    return;
  }

  float novaUmidade = constrain((float)(doc["umidadeMinima"] | 30.0), 0.0f, 100.0f);
  int segundos = doc["tempoBomba"] | 10;
  unsigned long novoTempo = (unsigned long)constrain(segundos, 1, 3600) * 1000UL;
  int novaVersao = doc["versao"] | -1;

  bool mudou = !configuracaoDisponivel || novoModo != modoOperacao ||
               novaUmidade != umidadeMinima || novoTempo != tempoBombaMs ||
               novaVersao != versaoConfiguracao;

  // Um novo salvamento em automatico tambem retoma a automacao se o modo ja era automatico.
  if (novoModo == "automatico" && novaVersao != versaoConfiguracao) bloqueioAutomaticoAte = 0;

  modoOperacao = novoModo;
  umidadeMinima = novaUmidade;
  tempoBombaMs = novoTempo;
  versaoConfiguracao = novaVersao;
  configuracaoDisponivel = true;

  if (mudou) {
    preferencias.putString("modo", modoOperacao);
    preferencias.putFloat("um_min", umidadeMinima);
    preferencias.putULong("tempo_ms", tempoBombaMs);
    preferencias.putInt("cfg_ver", versaoConfiguracao);
    preferencias.putBool("cfg_ok", true);
    Serial.println("Configuracao atualizada: modo " + modoOperacao + ", umidade minima " +
      String(umidadeMinima, 0) + "%, bomba " + String(tempoBombaMs / 1000) + " s");
  }
}

bool enviarLeitura() {
  float temperatura = NAN;
  float umidadeAr = NAN;
  bool dhtOk = lerDHT(temperatura, umidadeAr);

  float umidadeSolo = lerUmidade();
  float nivelAgua = lerNivelAgua();
  float bateria = lerBateria();

  StaticJsonDocument<384> doc;
  doc["umidade"] = umidadeSolo;
  doc["nivelAgua"] = nivelAgua;
  doc["bateria"] = bateria;
  doc["bomba"] = bombaLigada();
  if (dhtOk) {
    doc["temperatura"] = temperatura;
    doc["umidadeAr"] = umidadeAr;
  }
  doc["codigoDispositivo"] = codigoDispositivo;
  doc["tokenDispositivo"] = tokenDispositivo;
  doc["versaoFirmware"] = VERSAO_FIRMWARE;

  String corpo;
  serializeJson(doc, corpo);

  Serial.println("Leitura: solo " + String(umidadeSolo, 1) + "% | agua " + String(nivelAgua, 1) +
    "% | bateria " + String(bateria, 2) + " V | bomba " + String(bombaLigada() ? "ON" : "OFF") +
    (dhtOk ? " | ar " + String(temperatura, 1) + " C / " + String(umidadeAr, 0) + "%" : String(" | DHT sem leitura")));

  String resposta;
  int codigo = chamarApi(true, "/api/sensores", corpo, resposta);
  Serial.println("Envio de leitura -> HTTP " + String(codigo));

  if (falhaDeRede(codigo)) {
    registrarFalhaApi();
    logErroApi("Envio de leitura", codigo, resposta);
    return false;
  }
  registrarSucessoApi();
  if (codigo < 200 || codigo >= 300) {
    logErroApi("Envio de leitura", codigo, resposta);
  }
  return true;   // 4xx: a API respondeu; tenta de novo no proximo intervalo, sem martelar
}

// ---------- Comandos ----------

// Aceita true/false, 1/0 e textos como "ligar", "desligar", "on", "off".
bool interpretarLigar(JsonVariant v, bool &ligar) {
  if (v.isNull()) return false;
  if (v.is<bool>()) {
    ligar = v.as<bool>();
    return true;
  }
  if (v.is<int>()) {
    ligar = v.as<int>() != 0;
    return true;
  }
  if (v.is<const char*>()) {
    String s = v.as<String>();
    s.trim();
    s.toLowerCase();
    if (s == "ligar" || s == "ligado" || s == "ligada" || s == "on" || s == "true" || s == "1") {
      ligar = true;
      return true;
    }
    if (s == "desligar" || s == "desligado" || s == "desligada" || s == "off" || s == "false" || s == "0") {
      ligar = false;
      return true;
    }
  }
  return false;
}

int extrairId(JsonVariant v) {
  if (v.isNull()) return 0;
  if (v.is<int>()) return v.as<int>();
  if (v.is<const char*>()) return atoi(v.as<const char*>());
  return 0;
}

void aplicarComandoBomba(bool ligar) {
  definirBomba(ligar);
  contagemSeco = 0;
  bloqueioAutomaticoAte = ligar ? 0 : millis() + BLOQUEIO_APOS_COMANDO_MANUAL_MS;
  Serial.println("Comando aplicado: bomba " + String(ligar ? "LIGADA" : "DESLIGADA"));
}

bool confirmarComandoExecutado(int id) {
  StaticJsonDocument<128> doc;
  doc["tokenDispositivo"] = tokenDispositivo;
  String corpo;
  serializeJson(doc, corpo);

  String resposta;
  int codigo = chamarApi(true, "/api/comando/" + String(id) + "/concluido", corpo, resposta);
  Serial.println("Confirmacao do comando " + String(id) + " -> HTTP " + String(codigo));

  if (falhaDeRede(codigo)) {
    registrarFalhaApi();
    logErroApi("Confirmacao do comando", codigo, resposta);
    return false;
  }
  registrarSucessoApi();
  if (codigo < 200 || codigo >= 300) {
    logErroApi("Confirmacao do comando", codigo, resposta);
    return false;
  }
  return true;
}

bool verificarComandoPendente() {
  static unsigned long ultimoLogHttp = 0;
  static unsigned long ultimoLogFormato = 0;

  String resposta;
  String caminho = "/api/comando?codigo=" + urlEncode(codigoDispositivo) +
    "&tokenDispositivo=" + urlEncode(tokenDispositivo);
  int codigo = chamarApi(false, caminho, "", resposta);

  if (falhaDeRede(codigo)) {
    registrarFalhaApi();
    logErroApi("Consulta de comando", codigo, resposta);
    return false;
  }
  registrarSucessoApi();

  if (codigo != 200) {
    if (podeLogar(ultimoLogHttp, 30000)) logErroApi("Consulta de comando", codigo, resposta);
    return false;
  }

  resposta.trim();
  if (resposta.length() == 0 || resposta == "null" || resposta == "{}" || resposta == "[]") return false;

  StaticJsonDocument<512> doc;
  DeserializationError erro = deserializeJson(doc, resposta);
  if (erro) {
    Serial.println("Resposta de comando invalida (" + String(erro.c_str()) + "): " + trecho(resposta));
    return false;
  }

  bool ligar = false;
  bool achou = interpretarLigar(doc["bomba"], ligar) ||
               interpretarLigar(doc["comando"]["bomba"], ligar) ||
               interpretarLigar(doc["acao"], ligar) ||
               interpretarLigar(doc["estado"], ligar) ||
               interpretarLigar(doc["comando"], ligar);

  if (!achou) {
    // Nenhum comando reconhecido (ex.: {"comando":null}). Mostra a resposta de vez em quando
    // para facilitar o diagnostico caso o formato da API seja outro.
    if (podeLogar(ultimoLogFormato, 60000)) {
      Serial.println("Consulta de comando: nenhum comando de bomba reconhecido em: " + trecho(resposta));
    }
    return false;
  }

  int id = extrairId(doc["id"]);
  if (id == 0) id = extrairId(doc["comando"]["id"]);

  if (id != 0 && id == ultimoIdComando) {
    // Ja executado, mas a confirmacao anterior nao chegou: reenvia so a confirmacao.
    confirmarComandoExecutado(id);
    return false;
  }

  aplicarComandoBomba(ligar);

  if (id != 0) {
    ultimoIdComando = id;
    confirmarComandoExecutado(id);
  } else {
    Serial.println("Aviso: comando sem id; nao foi possivel confirmar na API.");
  }
  return true;
}

// ============================================================
// WI-FI
// ============================================================
bool conectarWiFi() {
  Serial.println("Conectando ao WiFi '" + wifiSSIDSalvo + "'...");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(wifiSSIDSalvo.c_str(), wifiSenhaSalva.c_str());

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
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

// Retorna true se ha Wi-Fi. Se cair, tenta reconectar sem parar; abre o portal
// apos um tempo (para trocar a rede), mas o portal tambem continua tentando reconectar.
bool gerenciarWiFi() {
  unsigned long agora = millis();

  if (WiFi.status() == WL_CONNECTED) {
    if (inicioQuedaWifi != 0) {
      Serial.println("WiFi reconectado. IP: " + WiFi.localIP().toString());
      inicioQuedaWifi = 0;
    }
    return true;
  }

  if (inicioQuedaWifi == 0) {
    inicioQuedaWifi = agora;
    ultimaTentativaWifi = agora;
    Serial.println("WiFi caiu. Tentando reconectar...");
    WiFi.disconnect();
    WiFi.begin(wifiSSIDSalvo.c_str(), wifiSenhaSalva.c_str());
    return false;
  }

  if (agora - ultimaTentativaWifi >= INTERVALO_RECONEXAO_WIFI_MS) {
    ultimaTentativaWifi = agora;
    WiFi.disconnect();
    WiFi.begin(wifiSSIDSalvo.c_str(), wifiSenhaSalva.c_str());
  }

  if (agora - inicioQuedaWifi >= TEMPO_PORTAL_SEM_WIFI_MS) {
    Serial.println("Muito tempo sem WiFi. Abrindo o portal de configuracao (continua tentando reconectar)...");
    iniciarPortalConfig();
  }
  return false;
}

// ============================================================
// PORTAL CATIVO
// ============================================================
void iniciarPortalConfig() {
  if (modoConfigAtivo) return;

  modoConfigAtivo = true;
  ultimaTentativaWifi = millis();

  // AP + STA: o portal fica no ar e o aparelho ainda pode reconectar na rede salva.
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_NOME);

  dnsServer.start(53, "*", AP_IP);

  if (!rotasPortalRegistradas) {
    rotasPortalRegistradas = true;
    servidorConfig.on("/", HTTP_GET, paginaConfigWifi);
    servidorConfig.on("/generate_204", HTTP_GET, paginaConfigWifi);        // Android
    servidorConfig.on("/hotspot-detect.html", HTTP_GET, paginaConfigWifi); // iOS/macOS
    servidorConfig.on("/connecttest.txt", HTTP_GET, paginaConfigWifi);     // Windows
    servidorConfig.on("/ncsi.txt", HTTP_GET, paginaConfigWifi);            // Windows
    servidorConfig.on("/salvar", HTTP_POST, salvarConfigWifi);
    servidorConfig.onNotFound(paginaConfigWifi);
  }
  servidorConfig.begin();

  Serial.println("PORTAL_CAPTIVO_ATIVO");
  Serial.println("Conecte-se na rede WiFi '" + String(AP_NOME) + "'");
  Serial.println("O portal sera aberto automaticamente; se necessario acesse http://192.168.4.1");
}

void encerrarPortalConfig() {
  Serial.println("WiFi conectado. Encerrando o portal de configuracao. IP: " + WiFi.localIP().toString());
  servidorConfig.stop();
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  modoConfigAtivo = false;
  inicioQuedaWifi = 0;
  falhasApi = 0;
  proximaTentativaApi = 0;
}

void tratarPortal() {
  dnsServer.processNextRequest();
  servidorConfig.handleClient();

  if (wifiSSIDSalvo == "") return;   // primeira configuracao: fica no portal ate salvar a rede

  if (WiFi.status() == WL_CONNECTED) {
    encerrarPortalConfig();
    return;
  }

  // Tenta reconectar na rede salva, sem atrapalhar quem esta usando o portal.
  unsigned long agora = millis();
  if (agora - ultimaTentativaWifi >= 20000 && WiFi.softAPgetStationNum() == 0) {
    ultimaTentativaWifi = agora;
    WiFi.disconnect();   // evita "wifi:sta is connecting, cannot set config"
    WiFi.begin(wifiSSIDSalvo.c_str(), wifiSenhaSalva.c_str());
  }
}

String gerarListaWiFiHtml() {
  String opcoes = "<option value=''>Selecione a rede...</option>";
  int numeroRedes = WiFi.scanNetworks(false, true);

  if (numeroRedes <= 0) {
    return opcoes;
  }

  for (int i = 0; i < numeroRedes; i++) {
    String ssid = WiFi.SSID(i);
    ssid.replace("&", "&amp;");
    ssid.replace("\"", "&quot;");
    ssid.replace("'", "&#39;");
    ssid.replace("<", "&lt;");
    ssid.replace(">", "&gt;");
    opcoes += "<option value='" + ssid + "'>" + ssid + "</option>";
  }
  WiFi.scanDelete();

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

// ============================================================
// SERIAL (provisionamento pela pagina Dispositivos + diagnostico)
// ============================================================
void lerSerial() {
  if (Serial.available()) {
    String linha = Serial.readStringUntil('\n');
    processarComandoSerial(linha);
  }
}

void imprimirStatus() {
  Serial.println("--- STATUS ---");
  Serial.println("Firmware: " + String(VERSAO_FIRMWARE));
  Serial.println("Dispositivo: " + (codigoDispositivo == "" ? String("(nao provisionado)") : codigoDispositivo));
  Serial.println("WiFi: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() + " (RSSI " + String(WiFi.RSSI()) + ")" : String("desconectado")) +
    (modoConfigAtivo ? " | portal ativo" : ""));
  Serial.println("API: " + String(falhasApi == 0 ? "ok" : "falhas seguidas = " + String(falhasApi)));
  Serial.println("Modo: " + modoOperacao + (configuracaoDisponivel ? "" : " (sem config da API)") +
    String(bombaDesligadaManualmente ? " | automatico suspenso (desligada manualmente)" : ""));
  Serial.println("Bomba: " + String(bombaLigada() ? "LIGADA" : "DESLIGADA"));
  Serial.println("Solo: " + String(lerUmidade(), 1) + "% (bruto " + String(lerAnalogicoMedio(PINO_UMIDADE)) + ")");
  Serial.println("Agua: " + String(lerNivelAgua(), 1) + "% (bruto " + String(lerAnalogicoMedio(PINO_NIVEL_AGUA)) + ")");
  Serial.println("Bateria: " + String(lerBateria(), 2) + " V");
  Serial.println("Heap livre: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("--------------");
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

    // Recomeca do zero: sincroniza logo, sem esperar recuo de falhas antigas.
    falhasApi = 0;
    proximaTentativaApi = 0;
    ultimoIdComando = 0;
    primeiraConfigPendente = true;
    primeiraLeituraPendente = true;

    Serial.println("{\"status\":\"ok\",\"mensagem\":\"Dispositivo provisionado como " + codigoDispositivo + "\"}");
  } else if (comando == "configurar_wifi") {
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
  } else if (comando == "bomba") {
    // Teste de bancada do rele: {"comando":"bomba","ligar":true}
    bool ligar = doc["ligar"] | false;
    definirBomba(ligar);
    Serial.println("{\"status\":\"ok\",\"bomba\":" + String(ligar ? "true" : "false") + "}");
  } else if (comando == "status") {
    imprimirStatus();
  } else {
    Serial.println("Comando serial desconhecido.");
  }
}
