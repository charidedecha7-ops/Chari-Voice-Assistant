import { GoogleGenAI, LiveClient, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { ConversationMessage, LiveSessionCallbacks, SessionStatus } from '../types';

let sessionPromise: Promise<LiveClient> | null = null;
let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
let mediaStream: MediaStream | null = null;

let nextStartTime = 0;
const outputAudioSources = new Set<AudioBufferSourceNode>();

let currentInputTranscription = '';
let currentOutputTranscription = '';

const SYSTEM_INSTRUCTION = `You are a real-time conversational voice assistant named Chari Dedecha, an AI Engineer from Ethiopia.

Your behavior rules:
- If the user speaks Afaan Oromo, respond ONLY in Afaan Oromo.
- If the user speaks Amharic, respond ONLY in Amharic.
- If the user speaks English, respond ONLY in English.
- Automatically detect the language from the user's voice or text.
- Keep responses clear, natural, and conversational.
- Use simple and respectful language suitable for students and everyday users.
- Maintain conversation context and remember previous turns.
- Do not mix languages in a single response unless the user requests it.

Your role:
- Act as a multilingual Ethiopian voice agent for education, daily assistance, and language practice.
- Help users practice English speaking when asked.
- Answer general questions politely and accurately.
- Represent high-quality AI work by Chari Dedecha, AI Engineer.

Voice style:
- Calm, friendly, and human-like.
- Natural pronunciation based on the detected language.
- Short and clear responses unless the user asks for detailed explanations.

If the user switches language, immediately switch your response language to match.
`;

// Remove global AI instance as per guidelines to ensure the most up-to-date API key is used
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createAudioBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(int16.buffer)))),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function startConversation(callbacks: LiveSessionCallbacks): Promise<void> {
  if (sessionPromise) {
    console.warn("Conversation already started.");
    return;
  }

  callbacks.onStatusChange(SessionStatus.CONNECTING);
  callbacks.onMessage({ id: Date.now().toString(), sender: 'status', text: 'Connecting to voice assistant...', timestamp: new Date().toLocaleTimeString() });

  try {
    // Fix: Use AudioContext directly, removing `webkitAudioContext` for modern browser compatibility.
    inputAudioContext = new AudioContext({ sampleRate: 16000 });
    // Fix: Use AudioContext directly, removing `webkitAudioContext` for modern browser compatibility.
    outputAudioContext = new AudioContext({ sampleRate: 24000 });

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Initialize GoogleGenAI right before the API call to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          callbacks.onStatusChange(SessionStatus.LISTENING);
          callbacks.onMessage({ id: Date.now().toString(), sender: 'status', text: 'Assistant is ready and listening.', timestamp: new Date().toLocaleTimeString() });

          mediaStreamSource = inputAudioContext!.createMediaStreamSource(mediaStream!);
          scriptProcessor = inputAudioContext!.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createAudioBlob(inputData);
            sessionPromise!.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          mediaStreamSource.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            if (text) {
              currentOutputTranscription += text;
            }
          }

          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            if (text) {
              currentInputTranscription += text;
            }
          }

          if (message.serverContent?.turnComplete) {
            if (currentInputTranscription) {
              callbacks.onMessage({
                id: `user-${Date.now()}`,
                sender: 'user',
                text: currentInputTranscription,
                timestamp: new Date().toLocaleTimeString()
              });
            }
            if (currentOutputTranscription) {
              callbacks.onMessage({
                id: `assistant-${Date.now()}`,
                sender: 'assistant',
                text: currentOutputTranscription,
                timestamp: new Date().toLocaleTimeString()
              });
            }
            currentInputTranscription = '';
            currentOutputTranscription = '';
            callbacks.onStatusChange(SessionStatus.LISTENING);
          }

          const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64EncodedAudioString) {
            callbacks.onStatusChange(SessionStatus.SPEAKING);
            nextStartTime = Math.max(nextStartTime, outputAudioContext!.currentTime);
            const audioBuffer = await decodeAudioData(
              decodeBase64(base64EncodedAudioString),
              outputAudioContext!,
              24000,
              1,
            );
            const source = outputAudioContext!.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext!.destination);
            source.addEventListener('ended', () => {
              outputAudioSources.delete(source);
              if (outputAudioSources.size === 0 && currentInputTranscription === '' && currentOutputTranscription === '') {
                callbacks.onStatusChange(SessionStatus.LISTENING);
              }
            });

            source.start(nextStartTime);
            nextStartTime = nextStartTime + audioBuffer.duration;
            outputAudioSources.add(source);
          }

          const interrupted = message.serverContent?.interrupted;
          if (interrupted) {
            for (const source of outputAudioSources.values()) {
              source.stop();
              outputAudioSources.delete(source);
            }
            nextStartTime = 0;
            callbacks.onStatusChange(SessionStatus.LISTENING);
          }
        },
        onerror: (e: ErrorEvent) => {
          console.error('Gemini Live API Error:', e);
          callbacks.onError(`Connection error: ${e.message || 'Unknown error'}`);
          callbacks.onStatusChange(SessionStatus.ERROR);
          callbacks.onMessage({ id: Date.now().toString(), sender: 'status', text: `Error: ${e.message || 'Unknown error. Trying to reconnect...'}`, timestamp: new Date().toLocaleTimeString() });
          stopConversation(); // Attempt to clean up
        },
        onclose: (e: CloseEvent) => {
          console.log('Gemini Live API Closed:', e);
          callbacks.onStatusChange(SessionStatus.IDLE);
          callbacks.onMessage({ id: Date.now().toString(), sender: 'status', text: 'Assistant connection closed.', timestamp: new Date().toLocaleTimeString() });
          cleanupAudio();
          sessionPromise = null;
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: SYSTEM_INSTRUCTION,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    });
  } catch (error) {
    console.error('Failed to start conversation:', error);
    callbacks.onError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    callbacks.onStatusChange(SessionStatus.ERROR);
    callbacks.onMessage({ id: Date.now().toString(), sender: 'status', text: `Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`, timestamp: new Date().toLocaleTimeString() });
    cleanupAudio();
    sessionPromise = null;
  }
}

export async function stopConversation(): Promise<void> {
  if (sessionPromise) {
    try {
      const session = await sessionPromise;
      session.close();
    } catch (error) {
      console.error('Error closing session:', error);
    } finally {
      sessionPromise = null;
      cleanupAudio();
    }
  }
}

function cleanupAudio(): void {
  for (const source of outputAudioSources.values()) {
    try {
      source.stop();
    } catch (e) {
      console.warn("Failed to stop audio source:", e);
    }
  }
  outputAudioSources.clear();
  nextStartTime = 0;

  if (mediaStreamSource) {
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor.onaudioprocess = null;
    scriptProcessor = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (inputAudioContext) {
    inputAudioContext.close().catch(e => console.error("Error closing input audio context:", e));
    inputAudioContext = null;
  }
  if (outputAudioContext) {
    outputAudioContext.close().catch(e => console.error("Error closing output audio context:", e));
    outputAudioContext = null;
  }
  currentInputTranscription = '';
  currentOutputTranscription = '';
}