
export enum VoiceName {
  ZEPHYR = 'Zephyr',
  PUCK = 'Puck',
  CHARON = 'Charon',
  KORE = 'Kore',
  FENRIR = 'Fenrir'
}

export enum Language {
  EN = 'en',
  ZH = 'zh'
}

export interface DbConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
}

export interface User {
  id: string;
  username: string;
  dbConfig: DbConfig;
}

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  gender: 'Male' | 'Female' | 'Neutral';
  voiceValue: VoiceName;
}

export interface CustomVoice {
  id: string;
  userId: string;
  name: string;
  blobUrl: string;
  createdAt: number;
  description?: string;
  gender?: 'Male' | 'Female' | 'Neutral';
}

export interface GeneratedSpeech {
  id: string;
  userId: string;
  text: string;
  voiceName: string;
  blobUrl: string;
  createdAt: number;
}
