export type WhiteNoiseType =
  | 'rain'
  | 'thunder'
  | 'ocean'
  | 'stream'
  | 'wind'
  | 'forest'
  | 'fire'
  | 'cafe'
  | 'library'
  | 'night'
  | 'train'
  | 'airplane'
  | 'singing_bowl'
  | 'wind_chime'
  | 'breathing'
  | 'white_noise'
  | 'pink_noise'
  | 'brown_noise';

export type NoiseCategory = 'nature' | 'environment' | 'meditation';

export interface NoiseOption {
  id: WhiteNoiseType;
  label: string;
  icon: string;
  category: NoiseCategory;
}

export interface NoiseConfig {
  type: WhiteNoiseType;
  volume: number;
}

export interface NoisePreset {
  id: string;
  name: string;
  noises: NoiseConfig[];
  isBuiltIn: boolean;
}

export interface NoiseTrack {
  nodes: AudioNode[];
  gainNode: GainNode;
  type: WhiteNoiseType;
}

const NOISE_BUFFER_DURATION = 2;

const nativeSetTimeout = setTimeout;

const activeTimerIds = new Set<ReturnType<typeof setTimeout>>();

const trackedSetTimeout = (callback: () => void, delay: number): void => {
  const id = nativeSetTimeout(() => {
    activeTimerIds.delete(id);
    callback();
  }, delay);
  activeTimerIds.add(id);
};

export const stopAllAudioSynthesis = (): void => {
  activeTimerIds.forEach((id) => clearTimeout(id));
  activeTimerIds.clear();
};

export function createWhiteNoise(context: AudioContext): AudioBufferSourceNode {
  const bufferSize = context.sampleRate * NOISE_BUFFER_DURATION;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  return source;
}

export function createPinkNoise(context: AudioContext): AudioBufferSourceNode {
  const bufferSize = context.sampleRate * NOISE_BUFFER_DURATION;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;

    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;

    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] = pink * 0.11;
    b6 = white * 0.115926;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  return source;
}

export function createBrownNoise(context: AudioContext): AudioBufferSourceNode {
  const bufferSize = context.sampleRate * NOISE_BUFFER_DURATION;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    const output = (lastOut + 0.02 * white) / 1.02;
    lastOut = output;
    data[i] = output * 3.5;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  return source;
}

export function createRainSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const lowFreqGain = context.createGain();
  lowFreqGain.gain.value = 0.3;
  const lowFreqFilter = context.createBiquadFilter();
  lowFreqFilter.type = 'lowpass';
  lowFreqFilter.frequency.value = 200;
  const lowNoise = createPinkNoise(context);
  lowNoise.connect(lowFreqFilter);
  lowFreqFilter.connect(lowFreqGain);
  lowFreqGain.connect(outputNode);
  nodes.push(lowNoise, lowFreqFilter, lowFreqGain);

  const midFreqGain = context.createGain();
  midFreqGain.gain.value = 0.5;
  const midFreqFilter = context.createBiquadFilter();
  midFreqFilter.type = 'bandpass';
  midFreqFilter.frequency.value = 1000;
  midFreqFilter.Q.value = 0.5;
  const midNoise = createWhiteNoise(context);
  midNoise.connect(midFreqFilter);
  midFreqFilter.connect(midFreqGain);
  midFreqGain.connect(outputNode);
  nodes.push(midNoise, midFreqFilter, midFreqGain);

  const highFreqGain = context.createGain();
  highFreqGain.gain.value = 0.2;
  const highFreqFilter = context.createBiquadFilter();
  highFreqFilter.type = 'highpass';
  highFreqFilter.frequency.value = 5000;
  const highNoise = createWhiteNoise(context);
  highNoise.connect(highFreqFilter);
  highFreqFilter.connect(highFreqGain);
  highFreqGain.connect(outputNode);
  nodes.push(highNoise, highFreqFilter, highFreqGain);

  return nodes;
}

export function createThunderSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0;

  const lowFreqFilter = context.createBiquadFilter();
  lowFreqFilter.type = 'lowpass';
  lowFreqFilter.frequency.value = 150;

  const noise = createBrownNoise(context);
  noise.connect(lowFreqFilter);
  lowFreqFilter.connect(mainGain);
  mainGain.connect(outputNode);
  nodes.push(noise, lowFreqFilter, mainGain);

  const scheduleThunder = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 15 + 5;

    mainGain.gain.setValueAtTime(0, nextTime);
    mainGain.gain.linearRampToValueAtTime(0.8, nextTime + 0.1);
    mainGain.gain.exponentialRampToValueAtTime(0.01, nextTime + 2);

    trackedSetTimeout(scheduleThunder, (nextTime - now + 3) * 1000);
  };

  trackedSetTimeout(scheduleThunder, Math.random() * 5000);

  return nodes;
}

export function createOceanSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.5;

  const lowFreqFilter = context.createBiquadFilter();
  lowFreqFilter.type = 'lowpass';
  lowFreqFilter.frequency.value = 500;

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.1;

  const lfoGain = context.createGain();
  lfoGain.gain.value = 300;

  lfo.connect(lfoGain);
  lfoGain.connect(lowFreqFilter.frequency);
  lfo.start();

  const noise = createPinkNoise(context);
  noise.connect(lowFreqFilter);
  lowFreqFilter.connect(mainGain);
  mainGain.connect(outputNode);

  nodes.push(noise, lowFreqFilter, mainGain, lfo, lfoGain);

  return nodes;
}

export function createStreamSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.4;

  const highPassFilter = context.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = 800;

  const bandPassFilter = context.createBiquadFilter();
  bandPassFilter.type = 'bandpass';
  bandPassFilter.frequency.value = 2000;
  bandPassFilter.Q.value = 1;

  const noise = createPinkNoise(context);
  noise.connect(highPassFilter);
  highPassFilter.connect(bandPassFilter);
  bandPassFilter.connect(mainGain);
  mainGain.connect(outputNode);

  nodes.push(noise, highPassFilter, bandPassFilter, mainGain);

  return nodes;
}

export function createWindSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.3;

  const bandPassFilter = context.createBiquadFilter();
  bandPassFilter.type = 'bandpass';
  bandPassFilter.frequency.value = 400;
  bandPassFilter.Q.value = 2;

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.2;

  const lfoGain = context.createGain();
  lfoGain.gain.value = 200;

  lfo.connect(lfoGain);
  lfoGain.connect(bandPassFilter.frequency);
  lfo.start();

  const noise = createBrownNoise(context);
  noise.connect(bandPassFilter);
  bandPassFilter.connect(mainGain);
  mainGain.connect(outputNode);

  nodes.push(noise, bandPassFilter, mainGain, lfo, lfoGain);

  return nodes;
}

export function createForestSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const windNodes = createWindSound(context, outputNode);
  nodes.push(...windNodes);

  const scheduleBirdChirp = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 8 + 2;

    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2000 + Math.random() * 2000;

    const oscGain = context.createGain();
    oscGain.gain.value = 0;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = osc.frequency.value;
    filter.Q.value = 5;

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(outputNode);

    oscGain.gain.setValueAtTime(0, nextTime);
    oscGain.gain.linearRampToValueAtTime(0.1, nextTime + 0.05);
    oscGain.gain.linearRampToValueAtTime(0, nextTime + 0.15);

    osc.start(nextTime);
    osc.stop(nextTime + 0.2);

    trackedSetTimeout(scheduleBirdChirp, (nextTime - now + 0.3) * 1000);
  };

  trackedSetTimeout(scheduleBirdChirp, Math.random() * 3000);

  return nodes;
}

export function createFireSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.4;

  const lowPassFilter = context.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 1000;

  const noise = createPinkNoise(context);
  noise.connect(lowPassFilter);
  lowPassFilter.connect(mainGain);
  mainGain.connect(outputNode);
  nodes.push(noise, lowPassFilter, mainGain);

  const scheduleCrackle = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 2 + 0.5;

    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 100 + Math.random() * 100;

    const oscGain = context.createGain();
    oscGain.gain.value = 0;

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 500;

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(outputNode);

    oscGain.gain.setValueAtTime(0, nextTime);
    oscGain.gain.linearRampToValueAtTime(0.15, nextTime + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.01, nextTime + 0.1);

    osc.start(nextTime);
    osc.stop(nextTime + 0.15);

    trackedSetTimeout(scheduleCrackle, (nextTime - now + 0.2) * 1000);
  };

  trackedSetTimeout(scheduleCrackle, Math.random() * 1000);

  return nodes;
}

export function createCafeSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.3;

  const lowPassFilter = context.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 800;

  const noise = createPinkNoise(context);
  noise.connect(lowPassFilter);
  lowPassFilter.connect(mainGain);
  mainGain.connect(outputNode);
  nodes.push(noise, lowPassFilter, mainGain);

  const scheduleMurmur = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 5 + 2;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300 + Math.random() * 400;
    filter.Q.value = 2;

    const murmurGain = context.createGain();
    murmurGain.gain.value = 0;

    const murmurNoise = createPinkNoise(context);
    murmurNoise.connect(filter);
    filter.connect(murmurGain);
    murmurGain.connect(outputNode);

    murmurGain.gain.setValueAtTime(0, nextTime);
    murmurGain.gain.linearRampToValueAtTime(0.1, nextTime + 0.5);
    murmurGain.gain.linearRampToValueAtTime(0, nextTime + 2);

    murmurNoise.start(nextTime);
    murmurNoise.stop(nextTime + 2.5);

    trackedSetTimeout(scheduleMurmur, (nextTime - now + 3) * 1000);
  };

  trackedSetTimeout(scheduleMurmur, Math.random() * 2000);

  return nodes;
}

export function createLibrarySound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.1;

  const lowPassFilter = context.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 300;

  const noise = createBrownNoise(context);
  noise.connect(lowPassFilter);
  lowPassFilter.connect(mainGain);
  mainGain.connect(outputNode);
  nodes.push(noise, lowPassFilter, mainGain);

  const schedulePageTurn = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 15 + 10;

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const pageGain = context.createGain();
    pageGain.gain.value = 0;

    const pageNoise = createWhiteNoise(context);
    pageNoise.connect(filter);
    filter.connect(pageGain);
    pageGain.connect(outputNode);

    pageGain.gain.setValueAtTime(0, nextTime);
    pageGain.gain.linearRampToValueAtTime(0.15, nextTime + 0.05);
    pageGain.gain.exponentialRampToValueAtTime(0.01, nextTime + 0.3);

    pageNoise.start(nextTime);
    pageNoise.stop(nextTime + 0.5);

    trackedSetTimeout(schedulePageTurn, (nextTime - now + 1) * 1000);
  };

  trackedSetTimeout(schedulePageTurn, Math.random() * 10000);

  return nodes;
}

export function createNightSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const scheduleCricket = () => {
    const now = context.currentTime;

    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 4000 + Math.random() * 1000;

    const oscGain = context.createGain();
    oscGain.gain.value = 0;

    osc.connect(oscGain);
    oscGain.connect(outputNode);

    const chirpCount = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < chirpCount; i++) {
      const startTime = now + i * 0.1;
      oscGain.gain.setValueAtTime(0, startTime);
      oscGain.gain.linearRampToValueAtTime(0.05, startTime + 0.02);
      oscGain.gain.linearRampToValueAtTime(0, startTime + 0.05);
    }

    osc.start(now);
    osc.stop(now + chirpCount * 0.1 + 0.1);

    nodes.push(osc, oscGain);
    trackedSetTimeout(scheduleCricket, Math.random() * 3000 + 1000);
  };

  trackedSetTimeout(scheduleCricket, Math.random() * 1000);

  const scheduleFrog = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 20 + 10;

    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200 + Math.random() * 100;

    const oscGain = context.createGain();
    oscGain.gain.value = 0;

    osc.connect(oscGain);
    oscGain.connect(outputNode);

    oscGain.gain.setValueAtTime(0, nextTime);
    oscGain.gain.linearRampToValueAtTime(0.1, nextTime + 0.1);
    oscGain.gain.linearRampToValueAtTime(0.1, nextTime + 0.3);
    oscGain.gain.linearRampToValueAtTime(0, nextTime + 0.5);

    osc.start(nextTime);
    osc.stop(nextTime + 0.6);

    nodes.push(osc, oscGain);
    trackedSetTimeout(scheduleFrog, (nextTime - now + 1) * 1000);
  };

  trackedSetTimeout(scheduleFrog, Math.random() * 15000);

  return nodes;
}

export function createTrainSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.3;

  const lowPassFilter = context.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 200;

  const noise = createBrownNoise(context);
  noise.connect(lowPassFilter);
  lowPassFilter.connect(mainGain);
  mainGain.connect(outputNode);
  nodes.push(noise, lowPassFilter, mainGain);

  const rhythmGain = context.createGain();
  rhythmGain.gain.value = 0.15;

  const rhythmFilter = context.createBiquadFilter();
  rhythmFilter.type = 'bandpass';
  rhythmFilter.frequency.value = 500;
  rhythmFilter.Q.value = 1;

  const rhythmNoise = createWhiteNoise(context);
  rhythmNoise.connect(rhythmFilter);
  rhythmFilter.connect(rhythmGain);
  rhythmGain.connect(outputNode);
  nodes.push(rhythmNoise, rhythmFilter, rhythmGain);

  const lfo = context.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 1.5;

  const lfoGain = context.createGain();
  lfoGain.gain.value = 0.1;

  lfo.connect(lfoGain);
  lfoGain.connect(rhythmGain.gain);
  lfo.start();
  nodes.push(lfo, lfoGain);

  return nodes;
}

export function createAirplaneSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.35;

  const lowPassFilter = context.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 300;

  const noise = createBrownNoise(context);
  noise.connect(lowPassFilter);
  lowPassFilter.connect(mainGain);
  mainGain.connect(outputNode);

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.05;

  const lfoGain = context.createGain();
  lfoGain.gain.value = 50;

  lfo.connect(lfoGain);
  lfoGain.connect(lowPassFilter.frequency);
  lfo.start();

  nodes.push(noise, lowPassFilter, mainGain, lfo, lfoGain);

  return nodes;
}

export function createSingingBowlSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const scheduleBowl = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 20 + 10;

    const baseFreq = 200 + Math.random() * 100;

    const osc1 = context.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = baseFreq;

    const osc2 = context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq * 2;

    const osc3 = context.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = baseFreq * 3;

    const gain1 = context.createGain();
    gain1.gain.value = 0;

    const gain2 = context.createGain();
    gain2.gain.value = 0;

    const gain3 = context.createGain();
    gain3.gain.value = 0;

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(outputNode);
    gain2.connect(outputNode);
    gain3.connect(outputNode);

    gain1.gain.setValueAtTime(0, nextTime);
    gain1.gain.linearRampToValueAtTime(0.2, nextTime + 0.5);
    gain1.gain.exponentialRampToValueAtTime(0.01, nextTime + 8);

    gain2.gain.setValueAtTime(0, nextTime);
    gain2.gain.linearRampToValueAtTime(0.1, nextTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, nextTime + 5);

    gain3.gain.setValueAtTime(0, nextTime);
    gain3.gain.linearRampToValueAtTime(0.05, nextTime + 0.2);
    gain3.gain.exponentialRampToValueAtTime(0.01, nextTime + 3);

    osc1.start(nextTime);
    osc1.stop(nextTime + 10);
    osc2.start(nextTime);
    osc2.stop(nextTime + 6);
    osc3.start(nextTime);
    osc3.stop(nextTime + 4);

    nodes.push(osc1, osc2, osc3, gain1, gain2, gain3);
    trackedSetTimeout(scheduleBowl, (nextTime - now + 12) * 1000);
  };

  trackedSetTimeout(scheduleBowl, Math.random() * 5000);

  return nodes;
}

export function createWindChimeSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const chimeFrequencies = [523.25, 659.25, 783.99, 880, 1046.5, 1318.5];

  const scheduleChime = () => {
    const now = context.currentTime;
    const nextTime = now + Math.random() * 8 + 3;

    const freq = chimeFrequencies[Math.floor(Math.random() * chimeFrequencies.length)];

    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const oscGain = context.createGain();
    oscGain.gain.value = 0;

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 500;

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(outputNode);

    oscGain.gain.setValueAtTime(0, nextTime);
    oscGain.gain.linearRampToValueAtTime(0.15, nextTime + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.01, nextTime + 2);

    osc.start(nextTime);
    osc.stop(nextTime + 2.5);

    nodes.push(osc, filter, oscGain);
    trackedSetTimeout(scheduleChime, (nextTime - now + 3) * 1000);
  };

  trackedSetTimeout(scheduleChime, Math.random() * 3000);

  return nodes;
}

export function createBreathingSound(
  context: AudioContext,
  outputNode: AudioNode
): AudioNode[] {
  const nodes: AudioNode[] = [];

  const mainGain = context.createGain();
  mainGain.gain.value = 0.15;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;

  const noise = createPinkNoise(context);
  noise.connect(filter);
  filter.connect(mainGain);
  mainGain.connect(outputNode);

  const breatheCycle = () => {
    const now = context.currentTime;

    mainGain.gain.setValueAtTime(0.05, now);
    mainGain.gain.linearRampToValueAtTime(0.2, now + 4);
    mainGain.gain.linearRampToValueAtTime(0.2, now + 5);
    mainGain.gain.linearRampToValueAtTime(0.05, now + 9);
    mainGain.gain.linearRampToValueAtTime(0.05, now + 12);

    trackedSetTimeout(breatheCycle, 12000);
  };

  breatheCycle();

  nodes.push(noise, filter, mainGain);

  return nodes;
}

function createNoiseByType(
  context: AudioContext,
  outputNode: AudioNode,
  type: WhiteNoiseType
): AudioNode[] {
  switch (type) {
    case 'rain':
      return createRainSound(context, outputNode);
    case 'thunder':
      return createThunderSound(context, outputNode);
    case 'ocean':
      return createOceanSound(context, outputNode);
    case 'stream':
      return createStreamSound(context, outputNode);
    case 'wind':
      return createWindSound(context, outputNode);
    case 'forest':
      return createForestSound(context, outputNode);
    case 'fire':
      return createFireSound(context, outputNode);
    case 'cafe':
      return createCafeSound(context, outputNode);
    case 'library':
      return createLibrarySound(context, outputNode);
    case 'night':
      return createNightSound(context, outputNode);
    case 'train':
      return createTrainSound(context, outputNode);
    case 'airplane':
      return createAirplaneSound(context, outputNode);
    case 'singing_bowl':
      return createSingingBowlSound(context, outputNode);
    case 'wind_chime':
      return createWindChimeSound(context, outputNode);
    case 'breathing':
      return createBreathingSound(context, outputNode);
    case 'white_noise': {
      const gain = context.createGain();
      gain.gain.value = 0.3;
      const noise = createWhiteNoise(context);
      noise.connect(gain);
      gain.connect(outputNode);
      return [noise, gain];
    }
    case 'pink_noise': {
      const gain = context.createGain();
      gain.gain.value = 0.3;
      const noise = createPinkNoise(context);
      noise.connect(gain);
      gain.connect(outputNode);
      return [noise, gain];
    }
    case 'brown_noise': {
      const gain = context.createGain();
      gain.gain.value = 0.3;
      const noise = createBrownNoise(context);
      noise.connect(gain);
      gain.connect(outputNode);
      return [noise, gain];
    }
    default:
      return [];
  }
}

export class NoiseMixer {
  private context: AudioContext;
  private tracks: Map<WhiteNoiseType, NoiseTrack> = new Map();
  private masterGain: GainNode;
  private analyser: AnalyserNode;
  private scheduledTimers: Map<WhiteNoiseType, number[]> = new Map();

  constructor(context: AudioContext) {
    this.context = context;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 1;

    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(context.destination);
  }

  addTrack(noiseType: WhiteNoiseType, volume: number): NoiseTrack {
    if (this.tracks.has(noiseType)) {
      this.removeTrack(noiseType);
    }

    const gainNode = this.context.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(this.masterGain);

    const nodes = createNoiseByType(this.context, gainNode, noiseType);

    nodes.forEach((node) => {
      if ('start' in node && typeof node.start === 'function') {
        try {
          node.start();
        } catch {
          // Node might already be started
        }
      }
    });

    const track: NoiseTrack = {
      nodes,
      gainNode,
      type: noiseType,
    };

    this.tracks.set(noiseType, track);
    return track;
  }

  removeTrack(noiseType: WhiteNoiseType): void {
    const track = this.tracks.get(noiseType);
    if (!track) return;

    track.nodes.forEach((node) => {
      try {
        if ('stop' in node && typeof node.stop === 'function') {
          node.stop();
        }
        node.disconnect();
      } catch {
        // Node might already be stopped
      }
    });

    track.gainNode.disconnect();
    this.tracks.delete(noiseType);
  }

  setTrackVolume(noiseType: WhiteNoiseType, volume: number): void {
    const track = this.tracks.get(noiseType);
    if (track) {
      track.gainNode.gain.setValueAtTime(volume, this.context.currentTime);
    }
  }

  stopAll(): void {
    this.tracks.forEach((_, type) => {
      this.removeTrack(type);
    });
    this.scheduledTimers.clear();
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  getMasterGain(): GainNode {
    return this.masterGain;
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
  }

  getActiveTracks(): WhiteNoiseType[] {
    return Array.from(this.tracks.keys());
  }

  hasTrack(noiseType: WhiteNoiseType): boolean {
    return this.tracks.has(noiseType);
  }

  getTrackVolume(noiseType: WhiteNoiseType): number {
    const track = this.tracks.get(noiseType);
    return track ? track.gainNode.gain.value : 0;
  }
}

export const NOISE_CATEGORIES: { id: NoiseCategory; label: string }[] = [
  { id: 'nature', label: '自然' },
  { id: 'environment', label: '环境' },
  { id: 'meditation', label: '冥想' },
];

export const NOISE_OPTIONS: NoiseOption[] = [
  { id: 'rain', label: '雨声', icon: 'CloudRain', category: 'nature' },
  { id: 'thunder', label: '雷声', icon: 'CloudLightning', category: 'nature' },
  { id: 'ocean', label: '海浪', icon: 'Waves', category: 'nature' },
  { id: 'stream', label: '溪流', icon: 'Droplets', category: 'nature' },
  { id: 'wind', label: '风声', icon: 'Wind', category: 'nature' },
  { id: 'forest', label: '森林', icon: 'Trees', category: 'nature' },
  { id: 'fire', label: '篝火', icon: 'Flame', category: 'nature' },
  { id: 'cafe', label: '咖啡厅', icon: 'Coffee', category: 'environment' },
  { id: 'library', label: '图书馆', icon: 'BookOpen', category: 'environment' },
  { id: 'night', label: '夜晚', icon: 'Moon', category: 'environment' },
  { id: 'train', label: '火车', icon: 'Train', category: 'environment' },
  { id: 'airplane', label: '飞机', icon: 'Plane', category: 'environment' },
  { id: 'singing_bowl', label: '钵音', icon: 'Circle', category: 'meditation' },
  { id: 'wind_chime', label: '风铃', icon: 'Bell', category: 'meditation' },
  { id: 'breathing', label: '呼吸引导', icon: 'Activity', category: 'meditation' },
  { id: 'white_noise', label: '白噪声', icon: 'Radio', category: 'meditation' },
  { id: 'pink_noise', label: '粉噪声', icon: 'Waves', category: 'meditation' },
];

export const BUILT_IN_PRESETS: NoisePreset[] = [
  {
    id: 'rainy-reading',
    name: '雨天阅读',
    noises: [
      { type: 'rain', volume: 0.6 },
      { type: 'thunder', volume: 0.2 },
      { type: 'cafe', volume: 0.2 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'late-night-work',
    name: '深夜工作',
    noises: [
      { type: 'night', volume: 0.7 },
      { type: 'singing_bowl', volume: 0.3 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'forest-meditation',
    name: '森林冥想',
    noises: [
      { type: 'forest', volume: 0.5 },
      { type: 'stream', volume: 0.3 },
      { type: 'wind_chime', volume: 0.2 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'beach-relax',
    name: '海边放松',
    noises: [
      { type: 'ocean', volume: 0.8 },
      { type: 'wind', volume: 0.2 },
    ],
    isBuiltIn: true,
  },
];
