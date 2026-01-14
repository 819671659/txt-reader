
import { VoicePreset, VoiceName } from './types';

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'v1',
    name: 'Zephyr',
    description: 'Calm and steady, great for narrations.',
    gender: 'Neutral',
    voiceValue: VoiceName.ZEPHYR
  },
  {
    id: 'v4',
    name: 'Kore',
    description: 'Soft, pleasant and friendly.',
    gender: 'Female',
    voiceValue: VoiceName.KORE
  },
  {
    id: 'v3',
    name: 'Charon',
    description: 'Deep and authoritative voice.',
    gender: 'Male',
    voiceValue: VoiceName.CHARON
  },
  {
    id: 'v6',
    name: 'Little Girl',
    description: 'Innocent and sweet child voice.',
    gender: 'Female',
    voiceValue: VoiceName.KORE,
    stylePrompt: 'Speak in a very high-pitched, innocent, and sweet voice of a 6-year-old little girl.'
  },
  {
    id: 'v7',
    name: 'Loli',
    description: 'Cute, high-pitched anime style voice.',
    gender: 'Female',
    voiceValue: VoiceName.KORE,
    stylePrompt: 'Speak in a cute, energetic, very high-pitched anime-style girl (Loli) voice.'
  },
  {
    id: 'v8',
    name: 'Mature Sister',
    description: 'Elegant, cool and reliable female voice.',
    gender: 'Female',
    voiceValue: VoiceName.KORE,
    stylePrompt: 'Speak in a mature, elegant, calm, and sophisticated female voice with a confident tone.'
  },
  {
    id: 'v5',
    name: 'Fenrir',
    description: 'Strong, bold and clear.',
    gender: 'Male',
    voiceValue: VoiceName.FENRIR
  }
];

export const MAX_TEXT_LENGTH = 5000;
