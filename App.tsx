
import React, { useState, useEffect, useRef } from 'react';
import { VOICE_PRESETS, MAX_TEXT_LENGTH } from './constants';
import { VoicePreset, CustomVoice, GeneratedSpeech, VoiceName, Language } from './types';
import { GeminiTTSService } from './services/geminiService';
import { fileToBase64 } from './utils/audioUtils';
import { translations } from './translations';
import { saveAudioBlob, getAudioBlob, deleteAudioBlob } from './utils/db';

// Icons as components
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const AudioWaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10v4"></path><path d="M8 6v12"></path><path d="M13 10v4"></path><path d="M18 8v8"></path></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const XCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;
const KeyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3L15.5 7.5z"></path></svg>;

const DEFAULT_USER_ID = 'local_user';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(Language.EN);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vox_gemini_key') || '');
  
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoicePreset>(VOICE_PRESETS[0]);
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [selectedRefVoice, setSelectedRefVoice] = useState<CustomVoice | null>(null);
  const [history, setHistory] = useState<GeneratedSpeech[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Edit State
  const [editingVoice, setEditingVoice] = useState<CustomVoice | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ttsService = useRef(new GeminiTTSService());

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem('vox_lang') as Language;
    if (Object.values(Language).includes(savedLang)) setLang(savedLang);
    loadUserData(DEFAULT_USER_ID);
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('vox_gemini_key', val);
  };

  const loadUserData = async (userId: string) => {
    const savedHistoryStr = localStorage.getItem(`vox_history_${userId}`);
    if (savedHistoryStr) {
      try {
        const parsedHistory = JSON.parse(savedHistoryStr) as GeneratedSpeech[];
        const hydratedHistory = await Promise.all(parsedHistory.map(async (item) => {
          const blob = await getAudioBlob(item.id);
          return { ...item, blobUrl: blob ? URL.createObjectURL(blob) : '' };
        }));
        setHistory(hydratedHistory);
      } catch (e) { console.error("History hydration failed", e); }
    }
    
    const savedCustomStr = localStorage.getItem(`vox_custom_voices_${userId}`);
    if (savedCustomStr) {
      try {
        const parsedCustom = JSON.parse(savedCustomStr) as CustomVoice[];
        const hydratedCustom = await Promise.all(parsedCustom.map(async (v) => {
          const blob = await getAudioBlob(v.id);
          return { ...v, blobUrl: blob ? URL.createObjectURL(blob) : '' };
        }));
        setCustomVoices(hydratedCustom);
      } catch (e) { console.error("Custom voices hydration failed", e); }
    }
  };

  const processAudioForReference = async (blob: Blob, fileName: string) => {
    const keyToUse = apiKey || 'TEST_MODE';
    
    setIsUploading(true);
    try {
      const base64 = await fileToBase64(new File([blob], fileName, { type: blob.type }));
      const analysis = await ttsService.current.analyzeVoice(keyToUse, base64, blob.type);
      const voiceId = `voice-${Date.now()}`;
      await saveAudioBlob(voiceId, blob);
      const newCustom: CustomVoice = {
        id: voiceId,
        userId: DEFAULT_USER_ID,
        name: fileName,
        blobUrl: URL.createObjectURL(blob),
        createdAt: Date.now(),
        description: analysis.description,
        gender: analysis.gender
      };
      const updatedVoices = [...customVoices, newCustom];
      setCustomVoices(updatedVoices);
      localStorage.setItem(`vox_custom_voices_${DEFAULT_USER_ID}`, JSON.stringify(updatedVoices.map(({ blobUrl, ...rest }) => rest)));
    } catch (error) {
      console.error(error);
      alert(lang === Language.EN ? "Testing Mode Active. In real scenarios, verify API Key." : "测试模式。实际使用请确认 API Key 有效。");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAudioForReference(file, file.name);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioForReference(audioBlob, `Recording_${new Date().toLocaleTimeString()}.webm`);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = window.setInterval(() => { setRecordDuration(prev => prev + 1); }, 1000);
    } catch (error) {
      alert(lang === Language.EN ? "Microphone access denied." : "无法访问麦克风。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => { mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop()); };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMatchingBaseVoice = (gender: 'Male' | 'Female' | 'Neutral'): VoiceName => {
    if (gender === 'Male') return VoiceName.FENRIR;
    if (gender === 'Female') return VoiceName.KORE;
    return VoiceName.ZEPHYR;
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    const keyToUse = apiKey || 'TEST_MODE';
    
    setIsGenerating(true);
    try {
      let baseVoice = selectedVoice.voiceValue;
      let stylePrompt = selectedVoice.stylePrompt;

      // If a personal reference voice is used, it takes precedence over the preset's style
      if (selectedRefVoice) {
        baseVoice = getMatchingBaseVoice(selectedRefVoice.gender || 'Neutral');
        stylePrompt = selectedRefVoice.description;
      }

      const result = await ttsService.current.generateSpeech(
        keyToUse,
        text, 
        baseVoice,
        stylePrompt
      );
      
      const audioId = Date.now().toString();
      const response = await fetch(result.blobUrl);
      const blob = await response.blob();
      await saveAudioBlob(audioId, blob);
      
      const newEntry: GeneratedSpeech = {
        id: audioId,
        userId: DEFAULT_USER_ID,
        text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        voiceName: selectedRefVoice ? `${t.usingPersonal} (${selectedRefVoice.name})` : selectedVoice.name,
        blobUrl: result.blobUrl,
        createdAt: Date.now()
      };
      
      const newHistory = [newEntry, ...history];
      setHistory(newHistory);
      localStorage.setItem(`vox_history_${DEFAULT_USER_ID}`, JSON.stringify(newHistory.map(({ blobUrl, ...rest }) => rest)));
    } catch (error) {
      console.error(error);
      alert(lang === Language.EN ? "Speech Generation Error. Ensure your API Key is valid." : "语音生成失败。请确保 API Key 有效。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayHistory = (id: string) => {
    const aud = document.getElementById(`audio-${id}`) as HTMLAudioElement;
    if (aud) {
      aud.currentTime = 0;
      aud.play().catch(e => console.error("Playback failed", e));
    }
  };

  const handleDeleteHistory = async (id: string) => {
    const item = history.find(h => h.id === id);
    if (item?.blobUrl) URL.revokeObjectURL(item.blobUrl);
    await deleteAudioBlob(id);
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(`vox_history_${DEFAULT_USER_ID}`, JSON.stringify(updated.map(({ blobUrl, ...rest }) => rest)));
  };

  const handleSaveVoiceEdit = () => {
    if (!editingVoice) return;
    const updated = customVoices.map(v => v.id === editingVoice.id ? editingVoice : v);
    setCustomVoices(updated);
    localStorage.setItem(`vox_custom_voices_${DEFAULT_USER_ID}`, JSON.stringify(updated.map(({ blobUrl, ...rest }) => rest)));
    setEditingVoice(null);
  };

  const handleLanguageToggle = () => {
    const newLang = lang === Language.EN ? Language.ZH : Language.EN;
    setLang(newLang);
    localStorage.setItem('vox_lang', newLang);
  };

  return (
    <div className="min-h-screen pb-12 text-slate-100 font-sans selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 glass-card border-b border-white/5 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl text-white shadow-xl shadow-indigo-500/20">
            <AudioWaveIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{t.appTitle}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        
        <div className="flex flex-1 max-w-lg items-center bg-slate-900/50 rounded-2xl border border-white/5 px-4 py-2 mx-4 w-full shadow-inner">
           <div className="text-indigo-400"><KeyIcon /></div>
           <input 
             type="password" 
             value={apiKey} 
             onChange={(e) => handleApiKeyChange(e.target.value)}
             placeholder={t.apiKeyPlaceholder}
             className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none px-3 font-mono text-indigo-300"
           />
           {apiKey ? (
             <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">READY</span>
           ) : (
             <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold">TEST MODE</span>
           )}
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={handleLanguageToggle}
            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition-all border border-white/5 hover:border-indigo-500/30 shadow-sm"
          >
            {lang === Language.EN ? '中文' : 'English'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="glow-border">
            <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                  {t.generateSpeech}
                </h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">{text.length}/{MAX_TEXT_LENGTH}</span>
              </div>
              <textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder={t.placeholder} 
                className="w-full h-56 p-6 rounded-2xl border border-white/5 bg-slate-900/40 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none resize-none leading-relaxed transition-all text-slate-200 placeholder-slate-600" 
                maxLength={MAX_TEXT_LENGTH} 
              />
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !text.trim()} 
                  className={`flex-1 md:flex-none flex items-center justify-center space-x-3 px-10 py-4 rounded-2xl font-bold transition-all shadow-2xl ${isGenerating || !text.trim() ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white hover:brightness-110 active:scale-95 shadow-indigo-500/20'}`}
                >
                  {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <PlayIcon />}
                  <span>{isGenerating ? t.generating : t.generateBtn}</span>
                </button>
                {selectedRefVoice && (
                  <button onClick={() => setSelectedRefVoice(null)} className="flex items-center space-x-2 px-6 py-4 rounded-2xl border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 transition-all text-sm font-bold">
                    <XCircleIcon />
                    <span>{t.removeRef}</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className={`transition-all duration-500 ${selectedRefVoice ? 'opacity-30 blur-[2px] pointer-events-none' : 'opacity-100'}`}>
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                {t.voicePresets}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {VOICE_PRESETS.map((voice) => (
                <button 
                  key={voice.id} 
                  onClick={() => setSelectedVoice(voice)} 
                  className={`group relative p-5 rounded-2xl border transition-all text-left overflow-hidden ${selectedVoice.id === voice.id ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/10' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60 hover:border-white/10'}`}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-bold ${selectedVoice.id === voice.id ? 'text-indigo-300' : 'text-slate-300'}`}>{voice.name}</span>
                      <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${voice.gender === 'Male' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : voice.gender === 'Female' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{voice.gender}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      {t[`${voice.id}_desc` as keyof typeof t] || voice.description}
                    </p>
                  </div>
                  {selectedVoice.id === voice.id && (
                    <div className="absolute bottom-0 right-0 w-12 h-12 bg-indigo-500/20 blur-2xl rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="glow-border">
            <div className="glass-card rounded-3xl p-8">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {t.library}
              </h2>
              {history.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-slate-600 bg-slate-900/20 rounded-2xl border border-white/5 border-dashed">
                  <div className="p-4 bg-slate-900/50 rounded-full mb-4 opacity-50"><AudioWaveIcon /></div>
                  <p className="text-sm font-medium">{t.noClips}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div key={item.id} className="group flex items-center justify-between p-5 bg-slate-900/30 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all">
                      <div className="flex flex-col min-w-0 pr-6">
                        <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">"{item.text}"</span>
                        <div className="flex items-center mt-2 space-x-3">
                           <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-bold border border-indigo-500/10">{item.voiceName}</span>
                           <span className="text-[9px] text-slate-500 font-bold uppercase">{new Date(item.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {item.blobUrl && (
                          <>
                            <audio id={`audio-${item.id}`} src={item.blobUrl} className="hidden" preload="auto" />
                            <button onClick={() => handlePlayHistory(item.id)} className="p-3 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"><PlayIcon /></button>
                            <a href={item.blobUrl} download={`voxgemini-${item.id}.wav`} className="p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"><DownloadIcon /></a>
                          </>
                        )}
                        <button onClick={() => handleDeleteHistory(item.id)} className="p-3 text-slate-600 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"><TrashIcon /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <section className="glow-border">
            <div className="glass-card rounded-3xl p-8 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                  {t.personalVoices}
                </h2>
                <div className="flex space-x-2">
                  <button onClick={startRecording} disabled={isRecording} className={`p-2.5 rounded-xl transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40' : 'bg-slate-800 text-slate-300 hover:text-indigo-400 border border-white/5'}`}>
                    <MicIcon />
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-slate-800 text-slate-300 hover:text-indigo-400 rounded-xl transition-all border border-white/5">
                    <PlusIcon />
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*" />
              </div>

              {isRecording && (
                <div className="mb-6 p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-rose-400 tracking-widest uppercase">{t.recording} {formatDuration(recordDuration)}</span>
                  </div>
                  <div className="flex space-x-2 w-full">
                    <button onClick={stopRecording} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20">{t.stopRecording}</button>
                    <button onClick={cancelRecording} className="flex-1 py-2.5 bg-slate-800 text-slate-400 border border-white/5 rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-all">{t.cancel}</button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500 mb-6 leading-relaxed font-medium italic opacity-80">{t.personalVoicesDesc}</p>
              
              <div className="space-y-3">
                {customVoices.length === 0 ? (
                  <div className="py-12 text-center text-slate-700 border border-white/5 border-dashed rounded-2xl text-[10px] font-bold uppercase tracking-widest">{t.noPersonalVoices}</div>
                ) : (
                  customVoices.map((voice) => (
                    <div 
                      key={voice.id} 
                      className={`group p-4 rounded-2xl border transition-all cursor-pointer ${selectedRefVoice?.id === voice.id ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/5' : 'bg-slate-900/30 border-white/5 hover:bg-slate-800/60'}`} 
                      onClick={() => setSelectedRefVoice(selectedRefVoice?.id === voice.id ? null : voice)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="text-sm font-bold text-slate-200 truncate">{voice.name}</span>
                          {voice.gender && (
                            <span className={`text-[8px] px-2 py-0.5 rounded-full border font-bold ${voice.gender === 'Male' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : 'bg-pink-500/10 text-pink-400 border-pink-500/10'}`}>
                              {voice.gender}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setEditingVoice({...voice}); }} className="p-1.5 text-slate-500 hover:text-indigo-400"><EditIcon /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteAudioBlob(voice.id); setCustomVoices(v => v.filter(vv => vv.id !== voice.id)); }} className="p-1.5 text-slate-500 hover:text-rose-500"><TrashIcon /></button>
                        </div>
                      </div>
                      {voice.description && <p className="text-[10px] text-slate-500 line-clamp-1 italic font-medium">"{voice.description}"</p>}
                    </div>
                  ))
                )}
              </div>
              
              {selectedRefVoice && (
                <div className="mt-6 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 animate-in slide-in-from-top-2">
                   <h4 className="text-[10px] font-bold text-indigo-400 flex items-center mb-1 uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></div>
                     {t.activeStyle}
                   </h4>
                   <p className="text-[9px] text-slate-500 font-medium">{t.activeStyleDesc.replace('{gender}', selectedRefVoice.gender || 'Neutral')}</p>
                </div>
              )}
            </div>
          </section>
          
          <section className="bg-gradient-to-br from-indigo-600/20 to-purple-700/20 rounded-3xl border border-white/10 p-8 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-colors"></div>
            <h3 className="font-bold mb-4 flex items-center text-sm text-indigo-300">
              <span className="mr-2">✨</span> {t.tips}
            </h3>
            <ul className="text-[11px] space-y-4 text-slate-400 font-medium">
              <li className="flex gap-3 leading-relaxed">
                <span className="text-indigo-500 font-bold">•</span>
                {t.tip1}
              </li>
              <li className="flex gap-3 leading-relaxed">
                <span className="text-indigo-500 font-bold">•</span>
                {t.tip2}
              </li>
              <li className="flex gap-3 leading-relaxed">
                <span className="text-indigo-500 font-bold">•</span>
                {t.tip3}
              </li>
            </ul>
          </section>
        </div>
      </main>

      {editingVoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-white/10 p-10 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-bold mb-8 text-white">{t.editVoice}</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block">{t.voiceNameLabel}</label>
                <input type="text" className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" value={editingVoice.name} onChange={e => setEditingVoice({...editingVoice, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block">{t.voiceRemarksLabel}</label>
                <textarea className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none transition-all h-32 resize-none text-sm font-medium" value={editingVoice.description} onChange={e => setEditingVoice({...editingVoice, description: e.target.value})} />
              </div>
              {editingVoice.gender && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.genderLabel}</span>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${editingVoice.gender === 'Male' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' : 'text-pink-400 border-pink-400/20 bg-pink-400/5'}`}>{editingVoice.gender}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <button onClick={handleSaveVoiceEdit} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20">{t.save}</button>
              <button onClick={() => setEditingVoice(null)} className="flex-1 bg-slate-800 text-slate-300 py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-white/5">{t.cancelEdit}</button>
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[120] flex items-center justify-center">
          <div className="bg-slate-900 p-12 rounded-[3rem] text-center shadow-3xl border border-white/10 max-w-sm w-full">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{t.analyzing}</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">{t.analyzingDesc}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
