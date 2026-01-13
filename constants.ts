
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
    id: 'v2',
    name: 'Puck',
    description: 'Energetic and bright, perfect for social media.',
    gender: 'Neutral',
    voiceValue: VoiceName.PUCK
  },
  {
    id: 'v3',
    name: 'Charon',
    description: 'Deep and authoritative voice.',
    gender: 'Male',
    voiceValue: VoiceName.CHARON
  },
  {
    id: 'v4',
    name: 'Kore',
    description: 'Soft, pleasant and friendly.',
    gender: 'Female',
    voiceValue: VoiceName.KORE
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
