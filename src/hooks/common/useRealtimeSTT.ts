import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/useStore';
import { getElectronApiUrl } from '@/config/electronConfig';
import { bytesToBase64 } from '@/utils/bytesToBase64';

interface RealtimeSTTState {
  isListening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  isConnecting: boolean;
}

interface UseRealtimeSTTReturn extends RealtimeSTTState {
  startListening: (lang?: string) => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
}

const WORKLET_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 16000;
    this._buffer = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const float32 = input[0];
      const targetLen = Math.floor(float32.length / this._ratio);
      const int16 = new Int16Array(targetLen);
      for (let i = 0; i < targetLen; i++) {
        const srcIdx = Math.floor(i * this._ratio);
        const s = Math.max(-1, Math.min(1, float32[srcIdx]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(int16.buffer);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCaptureProcessor);
`;

let eventIdCounter = 0;
const nextEventId = () => `event_${++eventIdCounter}`;

export const useRealtimeSTT = (): UseRealtimeSTTReturn => {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const getWsUrl = useCallback(async () => {
    const token = useStore.getState().token;
    // base: '/api'（Web / Electron dev）或 'http://localhost:<port>/api'（Electron 生产）
    const base = await getElectronApiUrl();
    if (base.startsWith('http')) {
      // 后端实时 STT 端点统一为 /api/v1/ai/stt-realtime
      return `${base.replace(/^http/, 'ws')}/v1/ai/stt-realtime?token=${token}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/v1/ai/stt-realtime?token=${token}`;
  }, []);

  const cleanup = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((err) => { console.error(err); });
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  const startListening = useCallback(async (lang: string = 'zh') => {
    setError(null);
    setInterimTranscript('');
    setFinalTranscript('');
    setIsConnecting(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = mediaStream;

      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      const audioContext = new AudioContext({ sampleRate: 48000 });
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(mediaStream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-capture');
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      workletNodeRef.current = workletNode;

      const wsUrl = await getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsListening(true);

        ws.send(JSON.stringify({
          event_id: nextEventId(),
          type: 'session.update',
          session: {
            input_audio_format: 'pcm',
            sample_rate: 16000,
            input_audio_transcription: { language: lang },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.0,
              silence_duration_ms: 400,
            },
          },
        }));

        workletNode.port.onmessage = (e: MessageEvent) => {
          if (ws.readyState === WebSocket.OPEN) {
            const pcmBuffer = e.data as ArrayBuffer;
            const base64 = bytesToBase64(new Uint8Array(pcmBuffer));
            ws.send(JSON.stringify({
              event_id: nextEventId(),
              type: 'input_audio_buffer.append',
              audio: base64,
            }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'conversation.item.input_audio_transcription.text':
              setInterimTranscript((data.text || '') + (data.stash || ''));
              break;
            case 'conversation.item.input_audio_transcription.completed':
              if (data.transcript) {
                setFinalTranscript(prev => prev + (prev ? ' ' : '') + data.transcript);
                setInterimTranscript('');
              }
              break;
            case 'session.finished':
              setIsListening(false);
              cleanup();
              break;
            case 'error':
              setError(data.error?.message || t('errors.realtimeSTT.recognitionError'));
              setIsListening(false);
              cleanup();
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setError(t('errors.realtimeSTT.websocketError'));
        setIsConnecting(false);
        setIsListening(false);
        cleanup();
      };

      ws.onclose = () => {
        setIsListening(false);
        setIsConnecting(false);
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.realtimeSTT.startFailed');
      setError(message);
      setIsConnecting(false);
      cleanup();
    }
  }, [getWsUrl, cleanup, t]);

  const stopListening = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event_id: nextEventId(),
        type: 'session.finish',
      }));
    }
    setIsListening(false);
    setTimeout(() => cleanup(), 2000);
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    setInterimTranscript('');
    setFinalTranscript('');
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    isConnecting,
    startListening,
    stopListening,
    resetTranscript,
  };
};
