# SoundCore Remote — Design (MVP)

Data: 2026-08-15
Status: Proposto (aguardando revisão)

## 1. Objetivo

Permitir controlar o Packard SoundCore desktop a partir de um celular, sem app nativo, usando um
QR Code gerado pelo próprio desktop. O celular abre uma Web App/PWA local servida pelo SoundCore e
controla áudio em tempo real via WebSocket.

**Escopo desta iteração: MVP.** Fica de fora: EQ no remote, perfis, troca de dispositivo, analyzer,
múltiplos remotes avançado, gestos e hotspot (v2).

## 2. Arquitetura

Tudo roda dentro do processo do SoundCore desktop:

```
src-tauri/src/remote/
  ├── mod.rs          → módulo + registro no setup
  ├── session.rs      → token, sessão, expiração
  ├── server.rs       → axum: HTTP /remote + WS /ws
  ├── hub.rs          → broadcast de estado p/ remotes conectados
  ├── protocol.rs     → enum RemoteMessage (serde) — fonte da verdade
  └── lanip.rs        → descoberta do IP LAN

remote-app/           → segundo projeto Vite (React + TS + Tailwind v4)
  └── dist/           → PWA estática servida pelo axum em /remote

src/pages/RemotePage.tsx   → nova seção no sidebar ("Controle Remoto")
```

O servidor `axum` sobe junto com o app (setup do Tauri), escuta em `0.0.0.0:<porta>` e entrega a PWA.

### 2.1 Fluxo de primeiro uso

```
Usuário abre SoundCore
  → servidor remote inicia (IP LAN + porta + sessão)
  → QR aparece na seção "Controle Remoto"
  → celular escaneia o QR
  → browser abre http://<ip-lan>:<porta>/remote?t=TOKEN
  → token validado (HTTP e WS)
  → WebSocket conecta
  → Remote recebe snapshot de estado
  → controle pronto
```

## 3. Stack

| Camada          | Tecnologia                                   |
|-----------------|----------------------------------------------|
| Desktop         | Tauri v2 + React + TypeScript (existente)     |
| Servidor local  | Rust: `axum` + `tokio` + `tokio-tungstenite` + `tower-http` |
| QR Code         | Rust: crate `qrcode` (SVG)                    |
| IP LAN          | Rust: crate `local-ip-address`                |
| Remote (PWA)    | React + TypeScript + Tailwind v4 (segundo build Vite) |

Sem backend externo. Sem Firebase/Supabase/nuvem/login/contas.

## 4. Sessão e pairing (token-only)

- **Geração**: `rand` (CSPRNG) gera token de 32 hex; sessão `{ token, createdAt, expiresAt }` com **TTL de 10 minutos**.
- **"Gerar novo QR"** invalida a sessão anterior e cria outra (QR antigo deixa de funcionar).
- **URL do QR**: `http://<ip-lan>:<porta>/remote?t=<token>`.
- **Validação em 2 pontos**:
  1. `GET /remote` sem token válido → página 403 "Sessão expirada".
  2. Handshake do WS envia `t=TOKEN`; servidor valida e rejeita/cierra se inválido.
- **Limites (constantes no MVP)**: máx. **3 remotes conectados**, TTL 10 min, porta 38741 com
  fallback na faixa `[38741..38751]` se ocupada.

## 5. Protocolo WebSocket

Envelope único JSON, tipado no Rust via serde.

### Mobile → Desktop (comandos)

```ts
{ type: "cmd.volume.set", value: number }
{ type: "cmd.volume.increment" }
{ type: "cmd.volume.decrement" }
{ type: "cmd.volume.mute" }
{ type: "cmd.volume.unmute" }
{ type: "cmd.player.play" }
{ type: "cmd.player.pause" }
{ type: "cmd.player.next" }
{ type: "cmd.player.previous" }
{ type: "cmd.system.ping" }
{ type: "cmd.state.request" }   // pede snapshot completo
```

### Desktop → Mobile (estado/eventos)

```ts
{ type: "state.snapshot", state: SoundCoreState }   // envio inicial + a pedido
{ type: "state.volume", value: number }
{ type: "state.muted", value: boolean }
{ type: "state.playback", playback: PlaybackState }
{ type: "event.paired", remoteId: string }
{ type: "error", message: string }
```

- Mensagens desconhecidas → `{ type: "error" }` (nunca quebra a conexão).
- `SoundCoreState` é a **visão mínima** de volume, mute, playback e dispositivo, derivada do `AppState`
  existente (sem analyzer no MVP):

```ts
interface SoundCoreState {
  device: { id: string; name: string; connected: boolean } | null;
  volume: number;          // 0..100
  muted: boolean;
  playback: {
    playing: boolean;
    title: string | null;
    artist: string | null;
    album: string | null;
    positionSecs: number;
    durationSecs: number;
  };
  activeProfile: string | null;
}
```

## 6. Ponte de eventos Desktop ⇄ Remote

- Os comandos Tauri que mutam estado (`set_volume`, `set_mute`, player…) são refatorados em funções
  reutilizáveis; a mutation passa a **notificar o `hub`**, que faz broadcast para todos os remotes.
- Assim: mexeu no volume pelo desktop → celular atualiza sozinho, e vice-versa (mesmo caminho de escrita).
- Posição do player: tick de **1s via broadcast só quando reproduzindo** (para o seek bar do celular).

## 7. Servidor Rust (implementação)

**Novas dependências em `Cargo.toml`:** `axum`, `tokio` (features `rt-multi-thread`, `net`, `sync`,
`macros`, `time`), `tokio-tungstenite`, `tower-http` (serve estático), `qrcode`, `rand`,
`local-ip-address`.

**Inicialização** (no `setup` do Tauri):
1. Descobre IP LAN (`local-ip-address`; se falhar, mostra aviso no desktop e desabilita o QR).
2. Tenta bind `0.0.0.0:38741`, depois 38742…38751 (primeira porta livre).
3. Gera sessão inicial (token + TTL).
4. Sobe o servidor axum numa task `tokio::spawn`.

**Rotas do axum:**
- `GET /remote` → serve a PWA; valida `?t=` e retorna 403 se inválido.
- `GET /ws` → handshake com `?t=TOKEN`; valida e mantém a conexão.
- `GET /api/health` → `{ ok: true, name: "Packard SoundCore" }`.

**Resolução do `remote-app/dist`:** em dev, o axum serve da pasta `../remote-app/dist` (caminho
relativo ao `src-tauri`); no build final, a pasta é incluída como recurso Tauri
(`bundle.resources`) e o caminho é resolvido via `app.path().resource_dir()`. Assim o binário final
embute a PWA e não depende do source.

**Borda do hub (estado compartilhado):**

```rust
struct RemoteHub {
  session: Mutex<Session>,
  clients: Mutex<Vec<Client>>,                  // max 3
  tx: broadcast::Sender<RemoteMessage>,         // desktop → mobile
}
```

O `hub` é guardado no `AppState` (Arc). Os comandos Tauri mutantes chamam `hub.broadcast(snapshot)` após
alterar o estado — mesmo caminho usado pelo WS.

**Refactor:** funções hoje em linha no `lib.rs` (`set_volume`, `set_mute`, toggle playback, etc.) viram
funções reutilizáveis (`set_volume_impl(state, ...)`) chamadas tanto pelo comando Tauri quanto pelo
handler do WS.

## 8. UI Desktop — nova seção "Controle Remoto" (`RemotePage.tsx`)

- Nova entrada no sidebar (`SectionId = "remote"`, label **"Controle Remoto"**).
- Tela premium glass (consistente com o resto): QR (SVG do Rust, recolorido com accent esmeralda via CSS),
  URL + IP:porta, badge de expiração, botão **[ Gerar novo QR ]**, e lista de remotes conectados com
  **[ Desconectar todos ]**.
- Dados vêm de novos comandos Tauri: `get_remote_state()`, `regenerate_remote_session()`,
  `disconnect_all_remotes()`.
- Eventos Tauri (`remote::connected`, `remote::disconnected`) atualizam a lista em tempo real.

## 9. Remote App (`remote-app/`)

Segundo projeto Vite (React 19 + TS + Tailwind v4, mesmo visual glass/esmeralda).

```
remote-app/
  ├── pages/Home.tsx        → volume + mute + playback + status
  ├── ws/client.ts          → conexão + reconexão automática (backoff)
  ├── ws/types.ts           → DTOs espelhando protocol.rs
  ├── store/useRemote.ts    → estado reativo (snapshot + patches)
  ├── components/VolumeKnob, TransportBar, StatusBar
  ├── pwa/manifest.ts       → manifest + service worker
  └── styles/               → tailwind + glass
```

**MVP = 1 tela (Home):** volume (toque vertical, sem gesto), mute, play/pause/next/previous, indicador
de perfil ativo (somente leitura), status de conexão. Sem EQ/profiles no remote nesta fase.

## 10. PWA

- `manifest.json`: nome "SoundCore", ícone, `display: standalone`, tema/bg dark.
- Service worker básico: cache de app-shell para abrir offline após a primeira visita (ainda precisa de
  LAN para falar com o PC).
- "Adicionar à tela inicial" funciona nativamente em Android/iOS.

## 11. Erros e casos de borda

- Porta ocupada → fallback automático na faixa; QR reflete a porta real.
- Sem IP LAN → desktop avisa "Conecte-se a uma rede" e esconde o QR.
- Sessão expirada → QR some da tela e mostra "Gerar novo QR".
- Celular com token inválido/vencido → 403 na página.
- Queda de rede → reconexão automática com backoff no remote-app (mesma sessão enquanto valer).
- **Segurança**: bind `0.0.0.0` é necessário para o celular acessar, mas token com TTL curto + limite de
  3 remotes + "Desconectar todos" mantém a superfície controlada. Firewall do Windows pode pedir
  permissão na primeira execução (documentar no spec de implementação).

## 12. Testes

- **Rust**: testes unitários de `protocol.rs` (serde round-trip), `session.rs`
  (validação/expiração/limite), e do hub (broadcast).
- **Build/typecheck**: `cargo check` no `src-tauri`, `npm run build` na raiz e no `remote-app`.
- **Manual (critério de aceite do MVP)**: desktop gera QR → celular mesmo Wi-Fi escaneia → página abre →
  volume/mute/playback controlam o PC em tempo real → mexer no desktop reflete no celular →
  "Desconectar todos" derruba o remote.

## 13. Critérios de aceite (checklist MVP)

- [ ] QR Code aparece na seção "Controle Remoto".
- [ ] Servidor HTTP local responde `/remote` e `/api/health`.
- [ ] WebSocket `/ws` conecta com token válido e rejeita inválido/vencido.
- [ ] Pairing token-only (sem código de 6 dígitos).
- [ ] Volume e mute controlados pelo celular refletem no sistema/PC.
- [ ] Playback (play/pause/next/previous) controlado pelo celular.
- [ ] Estado sincronizado: mudanças no desktop refletem no celular (e vice-versa).
- [ ] PWA instalável ("Adicionar à tela inicial").
- [ ] "Desconectar todos" derruba os remotes.
- [ ] Máximo de 3 remotes conectados.
- [ ] Builds passam (`cargo check`, `npm run build` raiz e `remote-app`).
