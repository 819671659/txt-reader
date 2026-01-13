
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VoiceName } from "../types";
import { decodeBase64, decodeAudioData, audioBufferToWav } from "../utils/audioUtils";

export class GeminiTTSService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  /**
   * Generates speech from text using the specified voice.
   */
  async generateSpeech(
    text: string, 
    voice: VoiceName, 
    referenceDescription?: string
  ): Promise<{ blobUrl: string; buffer: AudioBuffer }> {
    const prompt = referenceDescription 
      ? `Speak the following text exactly as written. Style: ${referenceDescription}. Text: ${text}`
      : text;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const rawData = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(rawData, audioCtx, 24000, 1);
    
    const wavBlob = audioBufferToWav(audioBuffer);
    const blobUrl = URL.createObjectURL(wavBlob);

    return { blobUrl, buffer: audioBuffer };
  }

  /**
   * Use multimodal Gemini to describe an uploaded voice and detect gender
   */
  async analyzeVoice(base64Audio: string, mimeType: string): Promise<{ description: string, gender: 'Male' | 'Female' | 'Neutral' }> {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Audio, mimeType } },
          { text: "Analyze this voice. Provide a short description (pitch, tone, etc.) and identify if the speaker is Male or Female." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            gender: { type: Type.STRING, enum: ["Male", "Female", "Neutral"] }
          },
          required: ["description", "gender"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { description: "Standard neutral voice", gender: "Neutral" };
    }
  }
}
