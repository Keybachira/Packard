# TRANSPORTE FUTURO — Reconhecimento real de conexões + CSS Modules

Date: 2026-08-17
Status: Approved

## Resumo

A página **Dispositivos** hoje exibe um painel "TRANSPORTE FUTURO" com 7 chips
passivos (USB, Bluetooth, HDMI, DACs, Fones de Ouvido, Microfones, Interfaces de
Áudio). O objetivo é fazer o app **reconhecer de verdade** esses tipos de
conexão: expandir o modelo de conexões no backend Rust, enumerar microfones via
WASAPI, mostrar os 7 transportes como cards vivos (com contagem real de
dispositivos detectados e filtro da lista) e migrar a página para o padrão
**CSS puro + CSS Modules** (o resto do app continua com Tailwind por enquanto).

## 1. Backend Rust — `ConnectionType` expandido

Arquivo: `src-tauri/src/hardware/mod.rs`

O enum passa de 3 para 8 variantes:

```
Usb | Bluetooth | Hdmi | Dac | Headphones | Microphone | AudioInterface | None
```

- Atualizar `Display` para `usb`, `bluetooth`, `hdmi`, `dac`, `headphones`,
  `microphone`, `audio_interface`, `none`.
- Trocar a serialização para `serde(rename_all = "snake_case")`: produz os mesmos
  valores atuais (`usb`, `bluetooth`, `none`) para as variantes de palavra única
  E gera `audio_interface` para `AudioInterface` (com `lowercase` sairia
  `audiointerface`, o que quebraria o protocolo). `Display` e `serde` devem
  emitir strings idênticas — o remote WebSocket usa `connection.to_string()`.
- `None` permanece para o demo offline (`seed_demo`).
- O remote WebSocket usa `dev.connection.to_string()` (`remote/snapshot.rs`),
  então o protocolo recebe os novos valores automaticamente.

## 2. Backend Rust — heurística e microfones no WASAPI

Arquivo: `src-tauri/src/platform/wasapi.rs`

### 2.1 `guess_connection(name)` expandida

Classificação por palavra-chave no nome (minúsculo):

| palavra-chave | ConnectionType |
| --- | --- |
| `bluetooth`, `hands-free` | `Bluetooth` |
| `hdmi` | `Hdmi` |
| `dac` | `Dac` |
| `headphone`, `headset`, `earbud`, `ear` | `Headphones` |
| `interface` | `AudioInterface` |
| senão | `Usb` |

`microphone`/`mic`/`array` são tratados na enumeração de captura (2.2), não aqui.

### 2.2 Enumeração de capture endpoints (microfones)

Novo método (ex.: `enumerate_capture_endpoints`) que enumera fluxo `eCapture`,
`DEVICE_STATE_ACTIVE`, e lê nome/volume/mute do mesmo jeito dos render
endpoints. Microfones entram na lista com `supports_eq: false` e `connection =
Microphone` (heurística por nome: `microphone`, `mic`, `array` → Microphone;
`interface` → AudioInterface; senão Usb).

### 2.3 Integração em `list_devices`

`list_devices` (`src-tauri/src/lib.rs`) passa a fazer merge de render + capture
antes do `registry.sync_from`. `seed_demo` continua valendo apenas se a lista
combinada estiver vazia.

## 3. Frontend — tipos e ícones

### 3.1 `src/types/audio.ts`

```
export type ConnectionType =
  | "usb" | "bluetooth" | "hdmi" | "dac"
  | "headphones" | "microphone" | "audio_interface" | "none";
```

### 3.2 `src/components/icons.tsx`

Novos ícones SVG inline (mesmo estilo dos existentes):

- `IconHdmi`
- `IconDac`
- `IconMicrophone`
- `IconAudioInterface`

Reutilizar `IconHeadphones`, `IconUsb`, `IconBluetooth` (já existem).

### 3.3 Mapa de conexão → ícone

Criar o mapa em `src/components/icons.tsx` (exportar `iconForConnection` que
retorna o componente de ícone), já que `DeviceManager`, `HomePage` e
`DevicesPage` importam ícones de lá:

```
usb → IconUsb
bluetooth → IconBluetooth
hdmi → IconHdmi
dac → IconDac
headphones → IconHeadphones
microphone → IconMicrophone
audio_interface → IconAudioInterface
none → IconSpeaker (fallback)
```

Substituir os ternários `connection === "usb" ? Usb : Bluetooth` em
`DeviceManager.tsx` e `HomePage.tsx` pelo mapa.

## 4. DevicesPage — hub TRANSPORTE FUTURO + CSS Modules

### 4.1 Hub de transportes

O painel "TRANSPORTE FUTURO" vira um grid de 7 cards, um por tipo:

- Ícone do tipo
- Nome (USB, Bluetooth, HDMI, DACs, Fones de Ouvido, Microfones, Interfaces de Áudio)
- Estado real derivado de `devices`: `N detectado(s)` quando houver dispositivos
  daquele tipo; `conectado` quando o selecionado for desse tipo; `—` quando nenhum.
- Clicar no card **filtra o `DeviceManager`** à esquerda por aquele tipo
  (estado local `transportFilter: ConnectionType | null`; clique novamente
  remove o filtro).

### 4.2 CSS Modules

- Criar `src/pages/DevicesPage.module.css` com as classes scoped da página.
- Remover classes Tailwind/globais usadas exclusivamente nesta página e usar as
  variáveis já existentes (`--panel`, `--border-soft`, `--text*`, `--accent*`,
  `--ease-flb`).
- O restante do app continua com Tailwind (migração incremental).

## 5. Impactos colaterais

- `AppStore.tsx` (linha ~331): `api.connectDevice(id, "usb")` passa a enviar
  `selected.connection` real (ou o tipo do device sendo selecionado).
- `connect_device` no Rust já aceita `ConnectionType` por argumento — sem mudança
  de assinatura.
- `HomePage.tsx` (status do device e mini-lista) passa a usar o mapa de ícones.
- `DeviceManager.tsx` usa o mapa de ícones. O filtro é aplicado **pela página**
  antes de passar a lista — `DevicesPage` passa `filteredDevices` (lista já
  filtrada por `transportFilter`) para `DeviceManager`; o componente não conhece
  filtro.

## Fora de escopo (YAGNI)

- Não criar backend USB/HID real (`hardware/usb.rs`) nem Bluetooth A2DP
  (`hardware/bluetooth.rs`) — são stubs que permanecem stubs.
- Não migrar outras páginas para CSS Modules.
- Não alterar o protocolo de áudio/processamento DSP.

## Verificação

- `cargo check`/`cargo build` no `src-tauri` (tipos novos no enum e WASAPI).
- `cargo test` — testes existentes de remote/snapshot devem passar.
- `npm run build` (TS: tipos novos, mapa de ícones, CSS Modules).
- Ajustar o spec de testes se o suite cobrir `guess_connection` (hoje não há
  teste unitário — opcional adicionar um com nomes de exemplo).