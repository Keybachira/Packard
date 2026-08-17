# Packard SoundCore

> **FEEL EVERY FREQUENCY.**

**Packard SoundCore** é um centro de controle de áudio profissional para Windows, desenvolvido para oferecer controle avançado sobre dispositivos de áudio, reprodução de música, equalização, análise em tempo real, perfis sonoros, reconhecimento de músicas e processamento de áudio.

O objetivo é transformar o computador em um verdadeiro **Audio Control Center**, unindo uma interface moderna com um núcleo nativo de alto desempenho.

**Estado atual:** player de música, equalizador de 10 bandas com presets, troca de dispositivo, analisador em tempo real e **controle remoto via celular** (PWA na mesma rede) já estão implementados e funcionais.

---

## Visão

O Packard SoundCore não é apenas um equalizador.

Ele foi projetado para centralizar toda a experiência de áudio do computador:

```text
                    PACKARD SOUNDCORE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
        PLAYER           AUDIO LAB        DEVICES
          │                │                │
          │                ├── Equalizer   ├── USB
          │                ├── Bass       ├── Bluetooth
          │                ├── Compressor  ├── DAC
          │                ├── Limiter     └── Soundbar
          │                └── Spatial
          │
          ├── Biblioteca
          ├── Playlists
          └── Reconhecimento
                           │
                           ▼
                    AUDIO ENGINE
                           │
                           ▼
                       WINDOWS
                           │
                           ▼
                     AUDIO DEVICE
```

---

# Remote Control (MVP — implementado)

O SoundCore expõe um **controle remoto via celular** na mesma rede local. O app desktop sobe um servidor HTTP + WebSocket (axum), exibe um **QR Code** que aponte o celular para a PWA em `remote-app/dist`, e envia snapshots de estado em tempo real.

Acesso:

```text
SoundCore (desktop)
    ↓ gera QR Code (URL local + token)
Servidor local (HTTP + WebSocket, porta 38741–38751)
    ↓
Celular na mesma LAN
    ↓ abre a PWA (remote-app/dist)
Controle total: player, volume, EQ, dispositivos, analisador
```

## Abas do controle remoto

| Aba          | Funcionalidades                                              |
| ------------ | ------------------------------------------------------------ |
| Player       | Play/pause, anterior/próxima, progresso, volume, mute        |
| Equalizador  | 10 bandas (32 Hz–16 kHz, −12..+12 dB) e presets              |
| Dispositivos | Lista dispositivos e alterna o ativo (exclusivo)             |
| Analisador   | Espectro ao vivo de 48 bandas (verde→azul), feed por WebSocket |

## Protocolo (WebSocket, JSON)

* Comandos: `cmd.player.play/pause/next/previous`, `cmd.volume.set/mute/unmute`, `cmd.eq.set` `{ gains }`, `cmd.preset.apply` `{ name }`, `cmd.device.set` `{ deviceId }`, `cmd.system.ping`, `cmd.state.request`
* Eventos: `event.paired`, `state.snapshot`, `state.playback`, `state.volume`, `state.muted`, `state.analyzer` `{ bins }`, `system.disconnect`, `error`
* Presets de EQ: `FLAT`, `CINEMA`, `MUSIC`, `GAME`
* `state.analyzer` emite 48 bins (0..1) a cada ~150 ms, apenas com clientes conectados
* Snapshot inclui `eq { gains, preset, supportsEq }` e `devices [{ id, name, connection, connected, active }]`

A definição completa vive em `src-tauri/src/remote/protocol.rs`.

---

# Principais funcionalidades

## Music Player

Um reprodutor de música integrado ao sistema.

* Reprodução de músicas locais
* Play / Pause
* Próxima / anterior
* Controle de volume
* Fila de reprodução
* Reprodução aleatória
* Repeat
* Favoritos
* Playlists
* Histórico
* Capas dos álbuns
* Informações da música
* Mini-player
* Atalhos de teclado
* Visualizador sincronizado com o áudio

---

## Biblioteca

Gerenciamento da coleção musical do utilizador.

### Organização

* Artistas
* Álbuns
* Músicas
* Gêneros
* Favoritos
* Recentemente reproduzidas
* Adicionadas recentemente

### Futuramente

* Scan automático de pastas
* Detecção de metadados
* Organização automática
* Normalização de capas
* Pesquisa avançada

---

# Reconhecimento de música

O SoundCore terá uma área dedicada para identificar músicas.

Fluxo:

```text
Microfone
   ↓
Captura de áudio
   ↓
Audio Fingerprint
   ↓
Serviço de reconhecimento
   ↓
Identificação
   ↓
Resultado
```

O resultado poderá apresentar:

* Nome da música
* Artista
* Álbum
* Capa
* Gênero
* Ano
* Duração
* Histórico de reconhecimento

Também será possível adicionar uma música reconhecida diretamente à biblioteca.

---

# Audio Lab

O centro de processamento e personalização de áudio.

## Equalizador (implementado)

Equalizador gráfico de **10 bandas** (32 Hz–16 kHz, faixa −12..+12 dB) com presets, disponível tanto no desktop quanto no controle remoto via celular.

```text
32Hz
64Hz
125Hz
250Hz
500Hz
1KHz
2KHz
4KHz
8KHz
16KHz
```

Presets disponíveis:

* FLAT
* CINEMA
* MUSIC
* GAME

Controles planejados:

* Gain
* Preamp
* Bass
* Treble
* Balance

---

## Processamento

O Audio Lab poderá oferecer:

* Bass Boost
* Loudness
* Compressor
* Limiter
* Gain
* Stereo Width
* Spatial Audio
* Crossfeed
* Noise Reduction
* Dynamic Range
* Clarity Enhancement

O processamento pesado deverá ser executado no **núcleo nativo**, evitando depender exclusivamente do JavaScript.

---

# Real-Time Analyzer

Visualização do áudio em tempo real.

### Modos

* Spectrum (implementado — 48 bandas no desktop e no controle remoto)
* Waveform
* Frequency Analyzer
* Peak Meter
* RMS
* LUFS
* Stereo Field

Exemplo:

```text
20Hz                         20KHz

▂▃▅▆▇████▇▆▅▃▂▁▂▃▅▆▇██▆▃▂
```

O analisador será alimentado pelo Audio Engine.

---

# Auto Calibration

Sistema de calibração automática do áudio.

O utilizador poderá iniciar uma análise utilizando um microfone.

```text
Microfone
    ↓
Sinais de teste
    ↓
Medição
    ↓
Análise de frequência
    ↓
Detecção de problemas
    ↓
Correções recomendadas
    ↓
Perfil de calibração
```

O sistema poderá detectar:

* Desequilíbrio estéreo
* Frequências excessivas
* Frequências reduzidas
* Ressonâncias
* Problemas de ganho
* Diferenças entre canais

Depois da análise:

```text
Room Profile

82Hz
-3.2 dB

250Hz
+1.4 dB

2KHz
-1.1 dB

Stereo Balance
+0.8 dB

[ APLICAR CALIBRAÇÃO ]
```

---

# Device Center

Gerenciamento dos dispositivos de áudio conectados ao computador.

**Implementado:** enumeração de dispositivos (USB/Bluetooth), lista com estado de conexão e **troca de dispositivo ativo** — disponível tanto no desktop quanto no controle remoto via celular.

Suporte planejado:

* Soundbars
* Headphones
* Headsets
* DACs
* Interfaces de áudio
* Microfones
* Placas de som
* Dispositivos compatíveis com APIs do fabricante

Exemplo:

```text
PACKARD SOUNDBAR X1

● Conectado

Interface:
USB

Sample Rate:
48 kHz

Bit Depth:
24-bit
```

---

# Perfis de áudio

O utilizador poderá criar perfis personalizados.

### Gaming

```text
Bass       +2 dB
Mid        +1 dB
Treble     +4 dB
Spatial    ON
Clarity    +2 dB
```

### Music

```text
Bass       +3 dB
Mid        +1 dB
Treble     +2 dB
Loudness   ON
```

### Cinema

```text
Bass       +5 dB
Dialogue   +4 dB
Surround   ON
Loudness   ON
```

Os perfis poderão ser aplicados manualmente ou automaticamente.

---

# Application Profiles

Uma funcionalidade avançada permitirá associar configurações a aplicações específicas.

Exemplo:

```text
Spotify.exe
    ↓
Music Profile

VALORANT.exe
    ↓
FPS Profile

Chrome.exe
    ↓
Normal Profile

VLC.exe
    ↓
Cinema Profile
```

O SoundCore poderá detectar a aplicação ativa e aplicar automaticamente o perfil correspondente.

---

# Dashboard

A página inicial deverá funcionar como centro de controle.

Elementos principais:

* Dispositivo ativo
* Volume Master
* Real-Time Analyzer
* Equalizador
* Perfil ativo
* Auto Calibration
* Reconhecimento de música
* Atalhos rápidos
* Dispositivos disponíveis
* Mini-player

---

# Design System

O Packard SoundCore utiliza uma linguagem visual inspirada em equipamentos profissionais de áudio combinados com software moderno.

## Direção visual

* Dark UI
* Premium
* Minimalista
* Futurista
* Audio-tech
* Alto contraste
* Microinterações
* Animações suaves
* Glass / subtle surfaces
* Neon accents
* Informações densas sem parecer confuso

---

## Paleta

```text
Background
#050607

Surface
#0B0F10

Surface Elevated
#121719

Border
#1C2425

Primary
#39FF6A

Text
#F5F7F6

Secondary Text
#8B9491
```

O verde representa o sinal de áudio e será utilizado principalmente em:

* controles ativos
* indicadores
* gráficos
* botões principais
* estados conectados
* progress bars
* equalizador

---

# Navegação

A aplicação está organizada da seguinte forma:

```text
Packard SoundCore

├──  Dashboard
├──  Player
├──  Biblioteca
├──  Audio Lab
├──  Dispositivos
├──  Analisador
├──  Perfis
├──  Perfis de App
├──  Calibração
├──  Controle Remoto
└──  Configurações
```

O **Music Player** permanece disponível globalmente através de um player persistente na parte inferior da aplicação.

---

# Arquitetura

A aplicação será dividida em duas camadas principais:

```text
┌───────────────────────────────────────┐
│             FRONTEND                  │
│                                       │
│ React + TypeScript + Vite             │
│                                       │
│ UI / Pages / Components / State       │
└───────────────────┬───────────────────┘
                    │
              Tauri Commands
                    │
┌───────────────────▼───────────────────┐
│              CORE                     │
│                                       │
│ Rust                                  │
│                                       │
│ Audio Engine                          │
│ Device Engine                         │
│ DSP                                   │
│ Windows Integration                   │
│ Storage                               │
└───────────────────┬───────────────────┘
                    │
             Native Windows
                    │
┌───────────────────▼───────────────────┐
│             HARDWARE                  │
│                                       │
│ Soundbar / DAC / Headphones / USB     │
└───────────────────────────────────────┘
```

---

# Frontend

O frontend é responsável pela interface e experiência do utilizador.

### Tecnologias

* React
* TypeScript
* Vite
* Tailwind CSS
* Fontsource (Manrope, Roboto, Space Grotesk)

---

# Backend / Native Core

O núcleo da aplicação é desenvolvido em Rust.

Responsabilidades:

* Comunicação com dispositivos
* Integração com Windows
* Audio Engine
* DSP
* Equalização
* Análise
* Configurações
* Persistência
* Comunicação USB
* Bluetooth
* Comandos Tauri
* Servidor local de controle remoto (HTTP + WebSocket)

---

# Audio Engine

O Audio Engine será responsável pelo caminho de processamento.

```text
Audio Source
     ↓
Input
     ↓
Preamp
     ↓
Equalizer
     ↓
Bass / Treble
     ↓
Compressor
     ↓
Limiter
     ↓
Spatial Processing
     ↓
Analyzer
     ↓
Output
```

O design deverá permitir adicionar novos módulos de processamento no futuro.

---

# Windows Integration

O Packard SoundCore será inicialmente focado em Windows.

Integrações planejadas:

* Windows Audio APIs
* WASAPI
* Device Enumeration
* Volume Control
* Audio Sessions
* Process Detection
* USB Devices
* Bluetooth Devices

---

# Estrutura do projeto

```text
packard-soundcore/
│
├── src/
│   │
│   ├── components/
│   │   ├── DeviceManager.tsx
│   │   ├── Equalizer.tsx
│   │   ├── EqBand.tsx
│   │   ├── PlayerBar.tsx
│   │   ├── RemoteControlPanel.tsx
│   │   ├── SpectrumAnalyzer.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── PlayerPage.tsx
│   │   ├── LibraryPage.tsx
│   │   ├── AudioLabPage.tsx
│   │   ├── AnalyzerPage.tsx
│   │   ├── DevicesPage.tsx
│   │   ├── RemotePage.tsx
│   │   ├── ProfilesPage.tsx
│   │   ├── AppProfilesPage.tsx
│   │   ├── CalibrationPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── lib/
│   ├── types/
│   ├── context/
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/
│   │
│   ├── src/
│   │   ├── audio/
│   │   │   ├── mod.rs
│   │   │   ├── equalizer.rs
│   │   │   ├── compressor.rs
│   │   │   └── limiter.rs
│   │   │
│   │   ├── hardware/
│   │   │   ├── mod.rs
│   │   │   ├── devices.rs
│   │   │   ├── usb.rs
│   │   │   └── bluetooth.rs
│   │   │
│   │   ├── platform/
│   │   │
│   │   ├── remote/
│   │   │   ├── mod.rs
│   │   │   ├── protocol.rs
│   │   │   ├── server.rs
│   │   │   ├── hub.rs
│   │   │   ├── session.rs
│   │   │   ├── snapshot.rs
│   │   │   └── lanip.rs
│   │   │
│   │   └── lib.rs
│   │
│   ├── capabilities/
│   └── Cargo.toml
│
├── remote-app/
│   └── dist/                    # PWA do controle remoto (HTML/CSS/JS puro)
│
├── docs/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

# Stack

| Área                | Tecnologia                    |
| ------------------- | ----------------------------- |
| Desktop             | Tauri 2                       |
| Frontend            | React                         |
| Linguagem           | TypeScript                    |
| Build               | Vite                          |
| Core                | Rust                          |
| Estilo              | Tailwind CSS 4                |
| Áudio               | cpal / rodio / rustfft        |
| Metadados           | lofty                         |
| Windows API         | windows-rs (WASAPI)           |
| Remote Control      | axum / tokio / WebSocket      |
| QR Code             | qrcode (SVG)                  |
| Database            | SQLite                        |
| Audio API           | WASAPI / Windows APIs         |
| Hardware            | USB / Bluetooth / Native APIs |

---

# Instalação

## Pré-requisitos

Instalar:

* Node.js ou Bun
* Rust
* Cargo
* Visual Studio Build Tools
* WebView2
* VS Code

Extensões recomendadas:

* Tauri
* rust-analyzer
* ESLint
* Prettier

---

## Instalar dependências

```bash
bun install
```

ou:

```bash
npm install
```

---

# Desenvolvimento

Iniciar o frontend:

```bash
npm run dev
```

Iniciar o aplicativo Tauri:

```bash
npm run tauri dev
```

O **controle remoto** abre no celular: gere o QR Code na página *Controle Remoto* do app desktop e escaneie com o celular (mesma rede). A PWA fica em `remote-app/dist`, servida pelo próprio app.

---

# Build

Criar a aplicação de produção:

```bash
npm run tauri build
```

O Tauri irá gerar os artefatos de distribuição para Windows.

---

# Segurança

O SoundCore deverá seguir o princípio de menor privilégio.

O frontend não deverá acessar diretamente recursos nativos.

Fluxo:

```text
React
 ↓
Tauri Command
 ↓
Rust
 ↓
Native API
```

As capacidades do Tauri deverão ser configuradas explicitamente.

Nenhuma API nativa deverá ser exposta desnecessariamente ao frontend.

---

# Princípios de desenvolvimento

## 1. UI não controla hardware diretamente

Nunca:

```text
React → USB
```

Sempre:

```text
React
 ↓
Tauri
 ↓
Rust
 ↓
Hardware
```

---

## 2. DSP não deve ficar preso ao React

O frontend apenas controla parâmetros:

```text
Bass = +3dB
```

O processamento real acontece no Audio Engine.

---

## 3. Componentes reutilizáveis

Evitar componentes gigantes.

Preferir:

```text
AudioSlider
VolumeControl
EqualizerBand
DeviceCard
ProfileCard
SpectrumAnalyzer
PlayerControls
```

em vez de criar toda a interface dentro de uma única página.

---

## 4. Features isoladas

Cada funcionalidade deverá possuir sua própria estrutura:

```text
features/
├── player/
├── recognition/
├── audio-lab/
├── devices/
└── profiles/
```

Isso facilita manutenção e evolução.

---

#  Roadmap

## Phase 01 — Foundation

* [x] Configurar Tauri
* [x] Configurar React + TypeScript
* [x] Criar Design System
* [x] Criar Sidebar
* [x] Criar Router
* [x] Criar Dashboard
* [x] Criar sistema de temas
* [x] Criar stores
* [x] Criar camada de Tauri Commands

---

## Phase 02 — Device Engine

* [x] Detectar dispositivos de áudio
* [x] Listar dispositivos
* [x] Detectar dispositivo padrão
* [x] Ler informações do dispositivo
* [x] Controle de volume
* [x] Mute
* [x] Device switching
* [ ] Device monitoring

---

## Phase 03 — Music Player

* [x] Player
* [x] Biblioteca
* [ ] Playlists
* [ ] Fila
* [ ] Histórico
* [ ] Favoritos
* [ ] Metadados
* [ ] Capas
* [ ] Mini-player

---

## Phase 04 — Audio Lab

* [x] Equalizador (10 bandas)
* [ ] Preamp
* [x] Bass
* [x] Treble
* [ ] Compressor
* [ ] Limiter
* [ ] Loudness
* [ ] Spatial Audio
* [ ] Stereo Width
* [x] Presets (FLAT/CINEMA/MUSIC/GAME)

---

## Phase 05 — Analyzer

* [x] Spectrum (48 bandas, desktop + remote)
* [ ] Waveform
* [ ] Peak Meter
* [ ] RMS
* [ ] LUFS
* [ ] Stereo Analyzer
* [ ] Clipping Detection

---

## Phase 06 — Smart Audio

* [ ] Auto Calibration
* [ ] Room Profile
* [ ] Automatic EQ
* [ ] Application Profiles
* [ ] Automatic profile switching
* [ ] Audio optimization

---

## Phase 07 — Recognition

* [ ] Microphone capture
* [ ] Audio fingerprint
* [ ] Music recognition
* [ ] Recognition history
* [ ] Add recognized music to library

---

## Phase 08 — Hardware

* [ ] USB communication
* [ ] HID support
* [ ] Bluetooth communication
* [ ] Manufacturer APIs
* [ ] DSP communication
* [ ] Advanced device controls

---

# Arquitetura futura

O projeto deverá estar preparado para evoluir para:

```text
Packard SoundCore
│
├── Music Engine
├── Audio Engine
├── DSP Engine
├── Device Engine
├── Recognition Engine
├── Calibration Engine
├── Profile Engine
└── Windows Integration
```

Cada engine deverá possuir responsabilidades independentes.

---

# Objetivo final

O objetivo do Packard SoundCore é criar uma experiência onde o utilizador possa controlar **tudo relacionado ao áudio do seu computador em um único lugar**.

Desde:

> "Quero ouvir uma música."

até:

> "Quero calibrar minha soundbar, criar um perfil para jogos, analisar o espectro, controlar meu DAC e aplicar processamento DSP personalizado."

Tudo deverá acontecer dentro do mesmo aplicativo.

---

#  Product Vision

**Packard SoundCore**

### Feel every frequency.

Um sistema de áudio moderno para quem quer mais do que simplesmente aumentar ou diminuir o volume.

**Control. Analyze. Optimize. Listen.**

---

##  License

Este projeto é proprietário da **Aquiles_bachira : Keybachira**.

Todos os direitos reservados.
