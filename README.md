# Solar Beam
Sistema inteligente de irrigação solar com ESP32, API em Node.js e painel web
para monitoramento remoto.

## Equipe

Projeto desenvolvido pelo **Team Solar Beam**, formado por alunos da **ETEC
Zona Leste**, do **2º ano de Desenvolvimento de Sistemas**, período da manhã,
turma **2DSA**:

- Yago Costa
- Luiz Gabriel
- Leonardo Augusto
- Miguel Eduardo
- Pedro Henrique

O Solar Beam acompanha a umidade do solo, o nível do reservatório, a bateria e
o estado da bomba. Cada ESP32 pertence a um usuário e possui um código e um
token próprios, mantendo as leituras e o histórico separados.

## Como funciona

```text
Sensores → ESP32 → API → Banco Turso → Dashboard web
				  ↑                 ↓
			  Comandos da bomba ← Usuário
```

1. O ESP32 lê os sensores e envia os dados para a API.
2. A API valida o código e o token do dispositivo.
3. A leitura é salva vinculada ao ESP correto.
4. O usuário acompanha os dados pela dashboard.
5. Comandos manuais são enviados pela API e consultados pelo ESP32.

## Principais recursos

- Monitoramento da umidade do solo.
- Monitoramento do nível da água.
- Monitoramento da tensão da bateria.
- Controle manual da bomba.
- Configuração de irrigação automática ou manual.
- Histórico separado por dispositivo.
- Exportação do histórico em CSV.
- Alertas de ESP offline, bateria baixa e falhas de comunicação.
- Login com usuários e perfis de administrador.
- Painel administrativo com visão de todos os ESPs.
- Backup dos dados para administradores.
- Provisionamento do ESP32 pelo navegador.
- Gravação de firmware `.bin` via USB usando Web Serial.
- Portal cativo para configurar o Wi-Fi do ESP32.
- Build automático do firmware pelo GitHub Actions.

## Hardware planejado

- ESP32
- Painel solar de 5 V
- Bateria 18650
- Módulo TP4056
- Conversor step-up
- Sensor de umidade do solo
- Sensor de nível da água
- Sensor de corrente, como ACS712 ou INA219
- Sensor de tensão da bateria
- Módulo relé
- Mini bomba de água
- Reservatório e mangueira
- LEDs de indicação opcionais

O firmware atual já trabalha com umidade do solo, nível da água, bateria e
relé da bomba. Sensores de corrente, clima e geração solar detalhada ficam
como extensões planejadas do hardware.

## Dispositivos e firmware

Todos os ESP32 usam o mesmo firmware. O código individual não fica gravado
dentro do `.bin`; ele é enviado depois pela USB e salvo na memória do ESP32.

```text
Firmware compartilhado: solarbeam-firmware-merged.bin

ESP 1: SB-AAAA1111
ESP 2: SB-BBBB2222
ESP 3: SB-CCCC3333
```

### Fluxo de instalação

1. O usuário cadastra um ESP em **Dispositivos**.
2. O site grava o firmware `.bin` pelo USB.
3. O ESP abre a rede `SolarBeam` se ainda não tiver Wi-Fi configurado.
4. O usuário conecta nessa rede e acessa o portal cativo.
5. O portal pode ser aberto automaticamente ou pelo endereço `http://192.168.4.1`.
6. O usuário informa o Wi-Fi residencial.
7. O site envia o código e o token individual do dispositivo.
8. O ESP envia a primeira leitura para a API.
9. O dispositivo é liberado na dashboard.

Se o ESP ficar mais de 60 segundos sem conseguir conectar ao Wi-Fi salvo, ele
abre o portal cativo novamente para permitir a troca de rede.

O arquivo usado no navegador deve ser um binário mesclado com bootloader,
tabela de partições e aplicação. Veja mais detalhes em
[esp32-firmware/README.md](esp32-firmware/README.md).

## Dashboard

A dashboard apresenta o estado do ESP selecionado:

- Umidade do solo.
- Temperatura, quando disponível.
- Bateria.
- Estado da bomba.
- Wi-Fi e comunicação com o ESP.
- Última atualização.
- Versão do firmware.

Administradores também podem acompanhar todos os usuários e dispositivos,
ver ESPs online ou offline, consultar leituras e limpar os dados operacionais
do sistema preservando a própria conta admin.

## Alertas e histórico

O painel pode alertar quando:

- O ESP fica offline.
- A bateria está baixa.
- A bomba está desligada.
- A API não consegue atualizar os dados.

Os alertas aparecem na dashboard e podem gerar notificações do navegador após
a permissão do usuário. O histórico é armazenado no banco Turso e pode ser
filtrado pelo dispositivo e exportado em CSV.

## Estrutura do projeto

```text
SolarBeam/
├── api/                       # Backend Node.js + Express
│   ├── src/controllers/       # Regras da aplicação
│   ├── src/database/          # Inicialização do banco Turso
│   ├── src/middleware/        # Autenticação e permissões
│   ├── src/routes/            # Rotas HTTP da API
│   └── test/                  # Testes de isolamento por dispositivo
├── esp32-firmware/            # Firmware Arduino do ESP32
├── web/                       # Frontend HTML, CSS e JavaScript
└── .github/workflows/         # Build automático do firmware
```

## API

Principais grupos de rotas:

| Rota | Função |
| --- | --- |
| `/api/login` | Login e emissão do token JWT |
| `/api/dispositivos` | Criar e gerenciar ESPs do usuário |
| `/api/sensores` | Receber leituras do ESP32 |
| `/api/status` | Consultar o estado do ESP selecionado |
| `/api/historico` | Consultar leituras por dispositivo |
| `/api/comando` | Enviar comandos para a bomba |
| `/api/config` | Ler e salvar configurações de irrigação |
| `/api/usuarios` | Gerenciar usuários, somente admin |
| `/api/admin/resumo` | Resumo geral dos sistemas, somente admin |
| `/api/admin/limpar` | Limpeza protegida dos dados operacionais |

## Desenvolvimento local

### API

```bash
cd api
npm install
npm test
npm run dev
```

Variáveis necessárias:

```text
PORT
JWT_SECRET
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
SETUP_SECRET
ORIGENS_PERMITIDAS
```

### Frontend

O frontend é estático. Pode ser servido por qualquer servidor local, por
exemplo:

```bash
cd web
python3 -m http.server 5500
```

O Web Serial exige Chrome ou Edge e uma origem segura, como `https` ou
`localhost`.

## Deploy

### Render

Configuração da API:

```text
Root Directory: api
Build Command: npm install
Start Command: npm start
```

Configure no Render as variáveis listadas na seção da API. Em
`ORIGENS_PERMITIDAS`, informe a URL publicada na Netlify.

### Netlify

Configuração do site:

```text
Base directory: web
Build command: vazio
Publish directory: .
Functions directory: vazio
```

A URL da API usada pelo frontend fica em [web/js/config.js](web/js/config.js).

## Firmware automático

O workflow em `.github/workflows/build-firmware.yml` compila o firmware,
gera o arquivo mesclado e calcula o SHA-256.

Para publicar uma versão:

```bash
git add .
git commit -m "Atualizar firmware"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

O GitHub Actions publica o `.bin` e o checksum na release da tag.

## Evolução planejada

- Sensor de corrente e análise detalhada da bomba.
- Monitoramento completo do painel solar e carregamento.
- Dados de clima e previsão de chuva.
- Atualização de firmware com controle de versões.
- Notificações externas por e-mail ou WhatsApp.
- Backup automático do banco.

## Fases do projeto

0. Planejamento e documentação.
1. Montagem do circuito.
2. Programação do ESP32.
3. Comunicação com a API.
4. Desenvolvimento do site.
5. Dashboard.
6. Login e permissões.
7. Monitoramento.
8. Alertas.
9. Testes.
10. Documentação final.
11. Preparação para apresentação.
# Solar Beam

Sistema de irrigacao automatizada com ESP32, API em Node.js e dashboard web.

## Estrutura

```
solarbeam/
├── api/    -> Backend (Node.js + Express + Turso), deploy no Render
└── web/    -> Frontend (HTML/CSS/JS puro), deploy no Netlify
```

## Deploy

**API (Render)**
- Root Directory: `api`
- Build Command: `npm install`
- Start Command: `npm start`
- Variaveis de ambiente: `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SETUP_SECRET`

**Web (Netlify)**
- Base directory: `web`
- Sem build command (site estatico)
- Publish directory: `web`

A URL da API usada pelo frontend fica em `web/js/config.js`.
