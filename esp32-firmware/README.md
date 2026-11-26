# Firmware SolarBeam

O botão de gravação do navegador usa `esptool-js` e espera um único arquivo
`.bin` mesclado, contendo bootloader, tabela de partições e aplicação.

Gere esse arquivo depois de compilar o projeto pela Arduino IDE ou PlatformIO.
Com o `esptool.py` instalado, um exemplo de mesclagem para ESP32 é:

```bash
esptool.py --chip esp32 merge_bin \
  -o solarbeamfirmware.bin \
  --flash_mode dio --flash_freq 40m --flash_size 4MB \
  0x1000 build/solarbeam.ino.bootloader.bin \
  0x8000 build/solarbeam.ino.partitions.bin \
  0xe000 build/boot_app0.bin \
  0x10000 build/solarbeam.ino.bin
```

Selecione `solarbeamfirmware.bin` em `Dispositivos`, conecte o ESP32
por USB e clique em `Gravar Firmware`. Depois da gravação, o navegador envia o
código do dispositivo e aguarda a primeira leitura chegar à API.

O flash pelo navegador exige Chrome ou Edge, HTTPS (ou `localhost`) e um ESP32
conectado por USB. O dispositivo deve estar em modo de bootloader quando a
gravação começar; normalmente isso acontece automaticamente, mas algumas
placas exigem segurar `BOOT` durante a conexão.

## Modo automatico

Na tela `Irrigação`, selecione `Automático`, informe a umidade mínima e o tempo
da bomba e salve as configurações. O ESP32 consulta essa configuração a cada
60 segundos. Quando a umidade do solo ficar abaixo do limite, ele liga a bomba
pelo tempo definido e depois desliga. Este firmware não lê nível de água nem
bateria; confirme que há água suficiente antes de usar a irrigação automática,
pois não há proteção contra a bomba funcionar a seco.

Se a configuração não puder ser obtida, o ESP32 permanece em modo manual por
segurança. Com o modo automático ativo, qualquer acionamento da bomba também
fica limitado ao tempo configurado.

Nas releases do projeto, baixe `solarbeamfirmware.bin` e
`solarbeamfirmware.bin.sha256`. O primeiro e o firmware para gravacao; o segundo
permite conferir a integridade do download.

## Configuração do Wi-Fi pelo portal cativo

Depois de gravar o firmware, o ESP32 abre a rede Wi-Fi `SolarBeam` quando não
possui uma rede salva. Conecte o celular ou computador nessa rede; o portal de
configuração deve abrir automaticamente. Se não abrir, acesse:

```text
http://192.168.4.1
```

Informe o SSID e a senha da rede local. Se o ESP32 ficar mais de 60 segundos
sem conseguir conectar ao Wi-Fi salvo, ele abandona a tentativa e abre o mesmo
portal novamente para permitir a troca de rede.