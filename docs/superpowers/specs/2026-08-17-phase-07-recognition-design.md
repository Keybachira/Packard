# Phase 07 — Reconhecimento de Música (Escuta Contínua)

**Status**: Approved  
**Date**: 2026-08-17  

## Resumo

Implementar um modo de escuta contínua que capture áudio do microfone padrão, calcule fingerprint em tempo real, compare com a biblioteca local e, ao reconhecer com confiança suficiente, exiba um toast com a opção de adicionar a faixa à biblioteca.

---

## 1. Experiência do Usuário

- Um botão flutuante (ícone de microfone) fica no canto inferior direito da barra principal, ao lado do mini‑player.
- Quando o app não está escutando, o botão mostra “Iniciar escuta”.
- Ao clicar:
  - Se não estiver escutando → iniciar captura contínua do microfone, mudar o ícone para “Parar escuta” e exibir uma forma de onda simples (amplitude) logo acima do botão.
  - Se estiver escutando → parar a captura, voltar ao estado inicial e limpar a forma de onda.
- Enquanto estiver escutando, a cada ~200 ms a forma de onda é atualizada com amostras mono dos últimos 10 ms (média absoluta).
- Quando um reconhecimento com confiança ≥ 0,12 ocorrer (e tiver passado o cooldown de 15 s desde o último reconhecimento bem‑sucedido da mesma faixa):
  - Um toast aparece na parte inferior da tela com:
    - Título da faixa
    - Artista
    - Confiança (ex: “87% match”)
    - Duas ações: **Adicionar à biblioteca** e **Ignorar**
  - Clicar em **Adicionar à biblioteca** insere a faixa na biblioteca (se ainda não existir) e exibe um toast de sucesso.
  - Clicar em **Ignorar** apenas desaparece o toast.
- O toast some automaticamente após 6 s se nenhuma ação for tomada.
- Cada tentativa (sucesso ou falha) é gravada no arquivo de histórico `recognition.json` (padrão já existente em `AppState.recognition_history`).

---

## 2. Arquitetura do Backend (Rust)

### 2.1 Novos campos em `AppState` (`src-tauri/src/lib.rs`)

```rust
pub struct AppState {
    // ...existing fields...
    /// Flag indicando se a escuta contínua está ativa.
    recognition_listening: Mutex<bool>,
    /// Ring buffer compartilhado entre a thread de captura e o processador.
    /// Tipo: Vec<f32> (mono) com tamanho fixo = sample_rate * BUFFER_SECONDS.
    recognition_buffer: Mutex<Vec<f32>>,
    /// Controle de cooldown por faixa (track_id -> Instant do último match).
    recognition_cooldown: Mutex<HashMap<String, Instant>>,
}
```

### 2.2 Thread de captura (`src-tauri/src/platform/capture.rs`)

- Novo módulo que oferece função `start_capture(sample_rate: u32) -> Result<(StreamHandle, Arc<Mutex<Vec<f32>>)>, String>` usando o crate `cpal`.
- Seleciona o dispositivo de entrada padrão (`default_input_device`).
- Configura stream com formato `f32`, mono, taxa como fornecida.
- Cada amostra recebida é pushada no `recognition_buffer` (implementado como ring buffer simples: se o vetor ultrapassar o tamanho máximo, remover do início).
- A thread retorna um `StreamHandle` que permite parar a captura posteriormente.

### 2.3 Loop de processamento (dentro de `lib.rs` ou novo módulo `recognition_worker.rs`)

Quando o comando `start_recognition` é chamado:

1. Se já estiver escutando, retornar ok (ou erro? melhor retornar ok já ativo).
2. Obter taxa de amostragem do dispositivo (pode fixar 44 100 Hz ou usar a do dispositivo; vamos usar a do dispositivo lida pelo `cpal` ao iniciar a captura).
3. Criar/obter o `recognition_buffer` (tamanho = sample_rate * 12 segundos).
4. Iniciar a thread de captura via `platform::capture::start_capture`.
5. Criar uma tarefa assíncrona (`tokio::spawn`) que, a cada 1 s:
    - Clona o conteúdo atual do buffer (últimos N amostras onde N = sample_rate * 12).
    - Calcula o fingerprint usando a função pura existente `fingerprint(samples, sample_rate)`.
    - Compara com o cache `AppState.fingerprints` (HashMap<String, Fingerprint>) usando a função pura `best_match`.
    - Se `best_match` retornar `Some((track_id, score))` com `score >= MATCH_THRESHOLD`:
        - Verificar cooldown: consultar `recognition_cooldown` para esse `track_id`. Se houver registro e `Instant::now() - last < COOLDOWN` (15 s), ignorar.
        - Senão:
            - Atualizar cooldown para esse `track_id` com `Instant::now()`.
            - Buscar a faixa na biblioteca (`music::MusicEngine::library`) para obter título e artista.
            - Criar um `RecognitionEntry`:
                ```rust
                RecognitionEntry {
                    id: Uuid::new_v4().to_string(),
                    timestamp_ms: Utc::now().timestamp_millis() as u64,
                    matched_track_id: Some(track_id.clone()),
                    title: Some(title),
                    artist: Some(artist),
                    confidence: score,
                }
                ```
            - Persistir o entry chamando `RecognitionPersist::save(&app)?` (besteffort, log error).
            - Enviar evento via `RemoteHub`:
                ```rust
                state.remote.publish(RemoteEvent::Recognition(entry.clone()));
                ```
    - Se não houver match ou score baixo, ainda registrar uma entrada de falha:
        ```rust
        RecognitionEntry {
            id: Uuid::new_v4().to_string(),
            timestamp_ms: Utc::now().timestamp_millis() as u64,
            matched_track_id: None,
            title: None,
            artist: None,
            confidence: score, // ou 0.0? deixar score para análise
        }
        ```
      e persistir da mesma forma (sem enviar evento).
6. O loop continua até que o comando `stop_recognition` seja chamado, momento em que:
    - A flag de escuta é setada para false.
    - A thread de captura é parada (dropping the StreamHandle).
    - O task de processamento é cancelado (usando um `AbortHandle`).

### 2.4 Novos comandos Tauri

```rust
#[tauri::command]
fn start_recognition(state: State<AppState>) -> Result<(), String>;

#[tauri::command]
fn stop_recognition(state: State<AppState>) -> Result<(), String>;

#[tauri::command]
fn get_recognition_waveform(state: State<AppState>) -> Result<Vec<f32>, String>;
    // retorna amostras mono dos últimos ~10 ms, valor absoluto médio por amostra
    // (tamanho fixo, ex: 80 amostras para suavizar desenho)

#[tauri::command]
fn add_track_to_library(state: State<AppState>, track_id: String) -> Result<Option<Track>, String>;
    // Insere a faixa na biblioteca se ainda não existir.
    // Retorna Some(track) se inserida, None se já existir.
    // Usa lógica existente de MusicEngine::add_track ou equivalente.
```

### 2.5 Evento de Reconhecimento

- Adicionar variante ao enum `RemoteEvent` em `src-tauri/src/remote/protocol.rs`:
  ```rust
  pub enum RemoteEvent {
      // ...existing...
      Recognition(RecognitionEntry),
  }
  ```
- Em `src-tauri/src/remote/hub.rs`, garantir que o método `publish` lida com o novo tipo (já genérico sobre `RemoteEvent`).

### 2.6 Persistência

- Reutilizar `RecognitionPersist` já existente (`src-tauri/src/recognition.rs`).
- Cada entrada (sucesso ou falha) é adicionada ao vetor `history` e salva no disco via `RecognitionPersist::save`.
- Load já ocorre na inicialização de `AppState` (linha ~59).

---

## 3. Frontend (React/TypeScript)

### 3.1 deviceApi.ts (`src/lib/deviceApi.ts`)

Adicionar exportações:

```typescript
export async function startRecognition(): Promise<void> {
  return invoke("start_recognition");
}
export async function stopRecognition(): Promise<void> {
  return invoke("stop_recognition");
}
export async function getRecognitionWaveform(): Promise<number[]> {
  return invoke<number[]>("get_recognition_waveform");
}
export async function addTrackToLibrary(trackId: string): Promise<Track | null> {
  return invoke<Track | null>("add_track_to_library", { trackId });
}
```

### 3.2 AppStore.tsx (`src/context/AppStore.tsx`)

Adicionar ao estado e handlers:

```typescript
  // Reconhecimento
  recognitionListening: boolean;
  recognitionWaveform: number[]; // para desenho da forma de onda
  lastRecognition: {
    trackId?: string;
    title?: string;
    artist?: string;
    confidence?: number;
  } | null;
  startRecognition: () => Promise<void>;
  stopRecognition: () => Promise<void>;
  getRecognitionWaveform: () => Promise<number[]>;
  addTrackToLibrary: (trackId: string) => Promise<Track | null>;
  // listener para evento de reconhecimento
  onRecognized: (cb: (entry: RecognitionEntry) => void) => void;
```

Inicialização:
```typescript
  const [recognitionListening, setRecognitionListening] = useState(false);
  const [recognitionWaveform, setRecognitionWaveform] = useState<number[]>([]);
  const [lastRecognition, setLastRecognition] = useState<...>(null);
```

Handlers:
```typescript
  const startRecognition = useCallback(async () => {
    try {
      await api.startRecognition();
      setRecognitionListening(true);
    } catch (e) {
      notify(`Falha ao iniciar reconhecimento: ${e}`, "error");
    }
  }, [notify]);

  const stopRecognition = useCallback(async () => {
    try {
      await api.stopRecognition();
      setRecognitionListening(false);
      setRecognitionWaveform([]);
    } catch (e) {
      notify(`Falha ao parar reconhecimento: ${e}`, "error");
    }
  }, [notify]);

  const getRecognitionWaveform = useCallback(async () => {
    try {
      const wf = await api.getRecognitionWaveform();
      setRecognitionWaveform(wf);
    } catch (e) {
      // ignore errors during listening; they will be handled elsewhere
    }
  }, []);

  const addTrackToLibrary = useCallback(async (trackId: string) => {
    try {
      const track = await api.addTrackToLibrary(trackId);
      if (track) {
        notify(`Faixa "${track.title}" adicionada à biblioteca`, "success");
      } else {
        notify(`Faixa já existente na biblioteca`, "info");
      }
      return track;
    } catch (e) {
      notify(`Falha ao adicionar à biblioteca: ${e}`, "error");
      return null;
    }
  }, [notify]);

  // Listener de evento de reconhecimento (similar a onAnalyzer)
  const onRecognized = useCallback((cb: (entry: RecognitionEntry) => void) => {
    // Implementar usando RemoteHub ou criar wrapper em deviceApi.ts
    // Por enquanto, vamos assumir que deviceApi.ts terá um método
    // `onRecognized(callback)` que faz inscrição no hub.
  }, []);
```

Adicionar ao objeto store retornado.

### 3.3 Botão flutuante

Novo componente `src/components/RecognitionButton.tsx`:

```tsx
import { useApp } from "../context/AppStore";
import { useEffect, useRef, useState } from "react";
import { IconMicrophone, IconMicrophoneOff } from "../icons";

export default function RecognitionButton() {
  const {
    recognitionListening,
    startRecognition,
    stopRecognition,
    recognitionWaveform,
    lastRecognition,
    addTrackToLibrary,
  } = useApp();
  const [waveform, setWaveform] = useState<number[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (recognitionListening) {
      const loop = async () => {
        const wf = await api.getRecognitionWaveform();
        setWaveform(wf);
        animationRef.current = requestAnimationFrame(loop);
      };
      loop();
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setWaveform([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognitionListening]);

  // Listener para evento de reconhecimento (usar deviceApi.onRecognized)
  useEffect(() => {
    const handler = (entry: any) => {
      // entry vem do RemoteHub como RecognitionEntry
      // Exibir toast
      const message = `${entry.title ?? "Desconhecido"} - ${entry.artist ?? "Desconhecido"}`;
      const confidence = Math.round((entry.confidence ?? 0) * 100);
      // Usar AppStore.notify via contexto (precisamos de acesso ao notify)
      // Vamos usar um Ref para acessar notify do AppStore.
    };
    // Implementar inscrição via deviceApi.onRecognized (a criar)
    return () => {
      // dessinscrever
    };
  }, []); // preencher depois

  const handleClick = async () => {
    if (recognitionListening) {
      await stopRecognition();
    } else {
      await startRecognition();
    }
  };

  // Renderização da forma de onda simples (canvas)
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
      <div
        ref={canvasRef}
        style={{
          width: 120,
          height: 30,
          background: "rgba(0,0,0,0.4)",
          borderRadius: 4,
          marginBottom: 8,
        }}
      >
        {/* Desenhar waveform aqui usando canvas 2D */}
      </div>
      <button
        onClick={handleClick}
        style={{
          padding: "8px 16px",
          borderRadius: 4,
          background: recognitionListening ? "var(--accentColor)" : "var(--surface)",
          color: recognitionListening ? "var(--background)" : "var(--text)",
          border: "none",
          cursor: "pointer",
        }}
      >
        {recognitionListening ? (
          <IconMicrophoneOff size={20} />
        ) : (
          <IconMicrophone size={20} />
        )}
        {recognitionListening && <span style={{ marginLeft: 6 }}>Parar escuta</span>}
        {!recognitionListening && <span style={{ marginLeft: 6 }}>Iniciar escuta</span>}
      </button>
      {lastRecognition && (
        <div style={{ marginTop: 8, textAlign: "center", color: "var(--text-dim)" }}>
          {lastRecognition.title} – {lastRecognition.artist}
          <br />
          <small>{Math.round((lastRecognition.confidence ?? 0) * 100)}% match</small>
          <button
            onClick={() => addTrackToLibrary(lastRecognition.trackId ?? "")}
            style={{
              marginTop: 4,
              padding: "4px 8px",
              fontSize: "12px",
              background: "var(--accentColor)",
              color: "var(--background)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Adicionar à biblioteca
          </button>
          <button
            onClick={() => setLastRecognition(null)}
            style={{
              marginTop: 4,
              marginLeft: 6,
              padding: "4px 8px",
              fontSize: "12px",
              background: "var(--surface-elevated)",
              color: "var(--text)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Ignorar
          </button>
        </div>
      )}
    </div>
  );
}
```

### 3.4 Registro do botão no App

Adicionar `<RecognitionButton />` dentro de `src/App.tsx` (ou em um layer fixo).

### 3.5 Estrutura de ondas (canvas)

Dentro do componente, usar `useRef<HTMLCanvasElement>` e desenhar no `useEffect` que responde a mudanças em `waveform`:
- Limpar canvas.
- Desenhar linha conectando pontos onde x = i / (waveform.length-1) * width, y = height/2 * (1 - waveform[i]) (já que waveform[i] ∈ [0,1]).
- Cor da linha: `var(--accentColor)`.

---

## 4. Testes

### 4.1 Rust
- Manter testes existentes em `recognition.rs`.
- Adicionar teste de integração que:
  1. Inicia o app com estado limpo.
  2. Chama `start_recognition`.
  3. Envia amostras de áudio conhecidas (geradas a partir de uma faixa da biblioteca de demo) ao ring buffer via função de teste exposta apenas em `#[cfg(test)]`.
  4. Aguarda evento de reconhecimento e verifica se o track correto foi identificado.
  5. Verifica que o `RecognitionPersist` contém a entrada.
  6. Testa cooldown: segundo match imediato da mesma faixa deve ser ignorado.
- Testar os novos comandos Tauri (`start_recognition`, `stop_recognition`, `get_recognition_waveform`, `add_track_to_library`) usando o harness de teste do Tauri.

### 4.2 Frontend
- Testes unitários do componente `RecognitionButton` com Vitest + React Testing Library:
  - Garantir que o botão alterna estados corretamente.
  - Mock das chamadas à API (`startRecognition`, `stopRecognition`, `getRecognitionWaveform`).
  - Verificar que a forma de onda é solicitada enquanto escutando.
- Testes de toast e interação com botões (Adicionar/Ignorar) usando mock do `notify` e `addTrackToLibrary`.

---

## 5. Segurança e Privacidade

- O áudio do microfone nunca é gravado em disco; apenas permanece na memória (ring buffer).
- O fingerprint é derivado apenas de características espectrais e não pode ser revertido para áudio original.
- O histórico de reconhecimento (`recognition.json`) contém apenas metadados (título, artista, confiança, timestamp) e nenhum áudio bruto.
- O usuário pode desativar a escuta a qualquer momento via o botão.

---

## 6. Considerações de Performance

- A thread de captura consome pouca CPU (apenas leitura do dispositivo).
- O processamento a cada 1 s envolve FFT de ~12 s de áudio (44 100 * 12 ≈ 529k amostras). Isso pode ser pesado; podemos reduzir a janela de análise para 5 s ou diminuir a taxa de amostragem para 22 050 Hz (o algoritmo de fingerprint já trabalha com frequências até 5 kHz). Decisão final será tomada em fase de implementação; por enquanto mantemos 12 s como buffer, mas o cálculo do fingerprint pode ser feito sobre amostras downsampled para 22 050 Hz internamente (mantendo a mesma resolução de frequência até 5 kHz). Isso reduz carga CPU em ~2×.
- O ring buffer é implementado como `Vec<f32>` com índices de cabeça/caixa para evitar alocações a cada amostra.
- O uso de `tokio::time::interval` garante que o processamento não bloqueie a thread principal.

---

## 7. Próximos Passos

Após a aprovação deste spec, será gerado um plano de implementação via a skill `writing-plans`, que listará as tarefas em ordem, os arquivos a criar/modificar e os testes a escrever.

--- 

*Espec escrito e pronto para revisão.*