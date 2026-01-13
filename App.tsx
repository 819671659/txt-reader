
import React, { useState, useEffect, useRef } from 'react';
import { VOICE_PRESETS, MAX_TEXT_LENGTH } from './constants';
import { VoicePreset, CustomVoice, GeneratedSpeech, VoiceName, Language, User } from './types';
import { GeminiTTSService } from './services/geminiService';
import { fileToBase64 } from './utils/audioUtils';
import { translations } from './translations';
import { DB_CONFIG } from './dbConfig';
import { saveAudioBlob, getAudioBlob, deleteAudioBlob } from './utils/db';

// Icons as components
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const AudioWaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10v4"></path><path d="M8 6v12"></path><path d="M13 10v4"></path><path d="M18 8v8"></path></svg>;
const DatabaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const XCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(Language.EN);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [formData, setFormData] = useState({ username: '', password: '' });
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

    const sessionUser = sessionStorage.getItem('vox_session_user');
    if (sessionUser) {
      const parsedUser = JSON.parse(sessionUser);
      setUser(parsedUser);
      loadUserData(parsedUser.id);
    }
  }, []);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    try {
      const mockUser: User = {
        id: btoa(formData.username),
        username: formData.username,
        dbConfig: DB_CONFIG
      };
      setUser(mockUser);
      sessionStorage.setItem('vox_session_user', JSON.stringify(mockUser));
      await loadUserData(mockUser.id);
    } catch (error) {
      alert(t.loginError);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    history.forEach(item => { if(item.blobUrl) URL.revokeObjectURL(item.blobUrl) });
    customVoices.forEach(v => { if(v.blobUrl) URL.revokeObjectURL(v.blobUrl) });
    setUser(null);
    sessionStorage.removeItem('vox_session_user');
    setHistory([]);
    setCustomVoices([]);
    setSelectedRefVoice(null);
    setFormData({ username: '', password: '' });
  };

  const processAudioForReference = async (blob: Blob, fileName: string) => {
    if (!user) return;
    setIsUploading(true);
    try {
      const base64 = await fileToBase64(new File([blob], fileName, { type: blob.type }));
      const analysis = await ttsService.current.analyzeVoice(base64, blob.type);
      const voiceId = `voice-${Date.now()}`;
      await saveAudioBlob(voiceId, blob);
      const newCustom: CustomVoice = {
        id: voiceId,
        userId: user.id,
        name: fileName,
        blobUrl: URL.createObjectURL(blob),
        createdAt: Date.now(),
        description: analysis.description,
        gender: analysis.gender
      };
      const updatedVoices = [...customVoices, newCustom];
      setCustomVoices(updatedVoices);
      localStorage.setItem(`vox_custom_voices_${user.id}`, JSON.stringify(updatedVoices.map(({ blobUrl, ...rest }) => rest)));
    } catch (error) {
      alert(lang === Language.EN ? "Could not process audio." : "音频处理失败。");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
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

  // NEW: Smart base voice selector based on gender
  const getMatchingBaseVoice = (gender: 'Male' | 'Female' | 'Neutral'): VoiceName => {
    if (gender === 'Male') return VoiceName.FENRIR;
    if (gender === 'Female') return VoiceName.KORE;
    return VoiceName.ZEPHYR;
  };

  const handleGenerate = async () => {
    if (!text.trim() || !user) return;
    setIsGenerating(true);
    try {
      // Logic: If personal voice is selected, use a matching prebuilt voice as base
      let baseVoice = selectedVoice.voiceValue;
      if (selectedRefVoice) {
        baseVoice = getMatchingBaseVoice(selectedRefVoice.gender || 'Neutral');
      }

      const result = await ttsService.current.generateSpeech(
        text, 
        baseVoice,
        selectedRefVoice?.description
      );
      
      const audioId = Date.now().toString();
      const response = await fetch(result.blobUrl);
      const blob = await response.blob();
      await saveAudioBlob(audioId, blob);
      
      const newEntry: GeneratedSpeech = {
        id: audioId,
        userId: user.id,
        text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        voiceName: selectedRefVoice ? `${t.usingPersonal} (${selectedRefVoice.name})` : selectedVoice.name,
        blobUrl: result.blobUrl,
        createdAt: Date.now()
      };
      
      const newHistory = [newEntry, ...history];
      setHistory(newHistory);
      localStorage.setItem(`vox_history_${user.id}`, JSON.stringify(newHistory.map(({ blobUrl, ...rest }) => rest)));
    } catch (error) {
      alert(t.loginError);
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
    if (user) {
      localStorage.setItem(`vox_history_${user.id}`, JSON.stringify(updated.map(({ blobUrl, ...rest }) => rest)));
    }
  };

  const handleSaveVoiceEdit = () => {
    if (!user || !editingVoice) return;
    const updated = customVoices.map(v => v.id === editingVoice.id ? editingVoice : v);
    setCustomVoices(updated);
    localStorage.setItem(`vox_custom_voices_${user.id}`, JSON.stringify(updated.map(({ blobUrl, ...rest }) => rest)));
    setEditingVoice(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-6 text-gray-900">
        <div className="mb-8 flex items-center space-x-3">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg"><AudioWaveIcon /></div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.appTitle}</h1>
        </div>
        <div className="w-full max-w-md glass-morphism rounded-3xl shadow-2xl overflow-hidden border border-white p-8">
            <h2 className="text-2xl font-bold mb-2">{t.authWelcome}</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">{t.authSubtitle}</p>
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t.username}</label>
                <input required type="text" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t.password}</label>
                <input required type="password" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="pt-4 mt-2 flex items-center text-xs text-gray-400 bg-gray-50/50 p-3 rounded-xl border border-dashed">
                <DatabaseIcon /><span className="ml-2">Connected via config: <b>{DB_CONFIG.host}:{DB_CONFIG.port}</b></span>
              </div>
              <button type="submit" disabled={isAuthLoading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all mt-6">
                {isAuthLoading ? t.connecting : (authMode === 'login' ? t.login : t.register)}
              </button>
            </form>
            <div className="mt-8 text-center">
               <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-sm text-gray-400 hover:text-indigo-600 font-medium transition-colors">
                 {authMode === 'login' ? "Don't have an account? Create one" : "Return to Login"}
               </button>
            </div>
        </div>
        <div className="mt-8 flex items-center bg-white/50 p-1 rounded-xl border border-white/50 shadow-sm">
            <button onClick={() => setLang(Language.EN)} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${lang === Language.EN ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>EN</button>
            <button onClick={() => setLang(Language.ZH)} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${lang === Language.ZH ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>中文</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 text-gray-900">
      <header className="sticky top-0 z-50 glass-morphism border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white"><AudioWaveIcon /></div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{t.appTitle}</h1>
            <p className="text-[10px] text-gray-400 font-medium">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="hidden lg:flex flex-col items-end mr-4">
            <span className="text-xs font-bold text-gray-700">{user.username}</span>
            <span className="text-[10px] text-green-500 font-medium flex items-center"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>{t.connectedTo}: {user.dbConfig.host}</span>
          </div>
          <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => setLang(Language.EN)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${lang === Language.EN ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>EN</button>
            <button onClick={() => setLang(Language.ZH)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${lang === Language.ZH ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>ZH</button>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-50 text-gray-500 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-600 transition-all border">{t.logout}</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{t.generateSpeech}</h2>
              <span className="text-sm text-gray-400">{text.length}/{MAX_TEXT_LENGTH} {t.charLimit}</span>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} className="w-full h-48 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed transition-all" maxLength={MAX_TEXT_LENGTH} />
            <div className="mt-6 flex items-center space-x-4">
              <button onClick={handleGenerate} disabled={isGenerating || !text.trim()} className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-8 py-3 rounded-xl font-semibold transition-all shadow-lg ${isGenerating || !text.trim() ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:transform active:scale-95'}`}>
                {isGenerating ? <span>{t.generating}</span> : <><PlayIcon /><span>{t.generateBtn}</span></>}
              </button>
              {selectedRefVoice && (
                <button onClick={() => setSelectedRefVoice(null)} className="flex items-center space-x-2 px-4 py-3 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all text-sm font-medium">
                  <XCircleIcon />
                  <span>{t.removeRef}</span>
                </button>
              )}
            </div>
          </section>

          <section className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${selectedRefVoice ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t.voicePresets}</h2>
              {selectedRefVoice && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-pulse">{t.usingPersonal}</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {VOICE_PRESETS.map((voice) => (
                <button key={voice.id} onClick={() => setSelectedVoice(voice)} className={`p-4 rounded-xl border-2 transition-all text-left ${selectedVoice.id === voice.id ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">{voice.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-white border rounded-full text-gray-400">{voice.gender}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{voice.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">{t.library}</h2>
            {history.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                <AudioWaveIcon /><p className="mt-2 text-sm">{t.noClips}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-sm transition-all group">
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-sm font-medium truncate">"{item.text}"</span>
                      <span className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Voice: {item.voiceName} • {new Date(item.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {item.blobUrl && (
                        <>
                          <audio id={`audio-${item.id}`} src={item.blobUrl} className="hidden" preload="auto" />
                          <button onClick={() => handlePlayHistory(item.id)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><PlayIcon /></button>
                          <a href={item.blobUrl} download={`voxgemini-${item.id}.wav`} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"><DownloadIcon /></a>
                        </>
                      )}
                      <button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><TrashIcon /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white rounded-2xl shadow-sm border p-6 flex flex-col h-fit">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">{t.personalVoices}</h2>
              <div className="flex space-x-2">
                <button onClick={startRecording} disabled={isRecording} className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`} title={t.record}>
                  <MicIcon />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"><PlusIcon /></button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*" />
            </div>

            {isRecording && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-red-600">{t.recording} {formatDuration(recordDuration)}</span>
                </div>
                <div className="flex space-x-3">
                  <button onClick={stopRecording} className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors shadow-sm">{t.stopRecording}</button>
                  <button onClick={cancelRecording} className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">{t.cancel}</button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-4">{t.personalVoicesDesc}</p>
            {customVoices.length === 0 ? (
                <div className="py-8 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl italic text-xs">{t.noPersonalVoices}</div>
              ) : (
                customVoices.map((voice) => (
                  <div key={voice.id} className={`p-3 rounded-xl border mb-3 cursor-pointer transition-all ${selectedRefVoice?.id === voice.id ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'bg-gray-50 hover:bg-white hover:border-gray-200'}`} onClick={() => setSelectedRefVoice(selectedRefVoice?.id === voice.id ? null : voice)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-sm font-semibold truncate">{voice.name}</span>
                        {voice.gender && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${voice.gender === 'Male' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'}`}>
                            {voice.gender}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingVoice({...voice}); }} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"><EditIcon /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteAudioBlob(voice.id); setCustomVoices(v => v.filter(vv => vv.id !== voice.id)); }} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><TrashIcon /></button>
                      </div>
                    </div>
                    {voice.description && <p className="text-[10px] text-gray-500 line-clamp-2 italic">"{voice.description}"</p>}
                  </div>
                ))
              )}
            
            {selectedRefVoice && (
              <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in slide-in-from-top-2">
                 <h4 className="text-xs font-bold text-indigo-600 flex items-center mb-1">
                   <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-1.5"></div>
                   {t.activeStyle}
                 </h4>
                 <p className="text-[10px] text-indigo-500">{t.activeStyleDesc.replace('{gender}', selectedRefVoice.gender || 'Neutral')}</p>
              </div>
            )}
          </section>
          <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="font-bold mb-3 flex items-center">💡 {t.tips}</h3>
            <ul className="text-xs space-y-3 opacity-90">
              <li>• {t.tip1}</li>
              <li>• {t.tip2}</li>
              <li>• {t.tip3}</li>
            </ul>
          </section>
        </div>
      </main>

      {/* Edit Voice Modal */}
      {editingVoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-6 text-gray-900">{t.editVoice}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t.voiceNameLabel}</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={editingVoice.name} onChange={e => setEditingVoice({...editingVoice, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t.voiceRemarksLabel}</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none" value={editingVoice.description} onChange={e => setEditingVoice({...editingVoice, description: e.target.value})} />
              </div>
              {editingVoice.gender && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-400 uppercase">{t.genderLabel}</span>
                  <span className={`text-xs font-bold ${editingVoice.gender === 'Male' ? 'text-blue-600' : 'text-pink-600'}`}>{editingVoice.gender}</span>
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-8">
              <button onClick={handleSaveVoiceEdit} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">{t.save}</button>
              <button onClick={() => setEditingVoice(null)} className="flex-1 bg-gray-50 text-gray-500 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all border">{t.cancelEdit}</button>
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl text-center shadow-xl">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-bold">{t.analyzing}</h3>
            <p className="text-sm text-gray-500">{t.analyzingDesc}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
