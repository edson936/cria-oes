import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  GoogleGenAI, 
  Modality,
  LiveServerMessage,
  GenerateContentResponse
} from "@google/genai";
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  Zap,
  Loader2,
  Cpu,
  Video,
  Upload,
  Play,
  XCircle,
  Volume2,
  User,
  ChevronRight,
  AlertCircle,
  Settings,
  ShieldCheck
} from 'lucide-react';

// --- Utilitários de Áudio ---
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const encode = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
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
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- Componente de Guia de Configuração ---
const ConfigGuide = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
    <div className="max-w-md w-full glass p-8 rounded-3xl border-indigo-500/30 shadow-2xl animate-fade-in">
      <div className="flex justify-center mb-6">
        <div className="bg-indigo-600/20 p-4 rounded-2xl">
          <Settings size={40} className="text-indigo-400 animate-spin-slow" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-center mb-2">Configuração Necessária</h1>
      <p className="text-slate-400 text-center text-sm mb-8">
        Detectamos que a sua chave de API ainda não foi configurada corretamente no Netlify.
      </p>
      
      <div className="space-y-4">
        <div className="flex gap-4 items-start">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">1</div>
          <div>
            <p className="text-sm font-semibold">No Netlify, vá em:</p>
            <p className="text-xs text-slate-500 italic">Site Settings > Environment Variables</p>
          </div>
        </div>
        
        <div className="flex gap-4 items-start">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">2</div>
          <div>
            <p className="text-sm font-semibold">Crie uma nova variável:</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Key:</span>
                <span className="text-[10px] text-indigo-400 font-mono">API_KEY</span>
              </div>
              <div className="flex justify-between bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Value:</span>
                <span className="text-[10px] text-green-400 font-mono">AIzaSy...rs</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">3</div>
          <div>
            <p className="text-sm font-semibold">Salve e faça o Deploy:</p>
            <p className="text-xs text-slate-500">O Nexus será ativado automaticamente assim que o Netlify injetar a chave.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800">
        <div className="flex items-center gap-2 text-green-500 justify-center">
          <ShieldCheck size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Conexão Segura Ativada</span>
        </div>
      </div>
    </div>
  </div>
);

// --- Componentes de UI ---
const NavItem = ({ icon, label, active, onClick, collapsed }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
      active 
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 neon-border' 
      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
    }`}
  >
    <div className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
      {icon}
    </div>
    {!collapsed && <span className="font-semibold whitespace-nowrap text-sm tracking-tight">{label}</span>}
  </button>
);

const App = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'video' | 'live'>('chat');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Se a API_KEY não existir, mostramos o guia de configuração
  if (!process.env.API_KEY) {
    return <ConfigGuide />;
  }

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`transition-all duration-500 ${isSidebarOpen ? 'w-64' : 'w-20'} glass border-r border-slate-800 flex flex-col z-20`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Cpu size={24} className="text-white" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tighter leading-none">NEXUS</span>
              <span className="text-[10px] text-indigo-400 font-bold tracking-[0.2em] uppercase">Multi-Modal</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-8">
          <NavItem icon={<MessageSquare size={20} />} label="Inteligência" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} collapsed={!isSidebarOpen} />
          <NavItem icon={<ImageIcon size={20} />} label="Laboratório de Arte" active={activeTab === 'image'} onClick={() => setActiveTab('image')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Video size={20} />} label="Nexus Veo" active={activeTab === 'video'} onClick={() => setActiveTab('video')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Mic size={20} />} label="Live Voice" active={activeTab === 'live'} onClick={() => setActiveTab('live')} collapsed={!isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="w-full flex items-center justify-center p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-slate-200">
            <ChevronRight size={18} className={`transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(79,70,229,0.1),_transparent_50%)] pointer-events-none" />
        <div className="flex-1 relative z-10 overflow-hidden">
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'image' && <ImageView />}
          {activeTab === 'video' && <VideoView />}
          {activeTab === 'live' && <LiveView />}
        </div>
      </main>
    </div>
  );
};

const ChatView = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([
    { role: 'model', content: 'Iniciando Nexus... Sistemas operacionais. Como posso ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input;
    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({ 
          model: 'gemini-3-flash-preview',
          config: { 
            systemInstruction: 'Você é o Nexus, uma inteligência avançada. Responda em Português do Brasil com tom tecnológico e prestativo.',
            temperature: 0.8
          }
        });
      }

      const stream = await chatRef.current.sendMessageStream({ message: msg });
      let fullContent = '';
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      for await (const chunk of stream) {
        const text = (chunk as GenerateContentResponse).text;
        fullContent += text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullContent;
          return updated;
        });
      }
    } catch (e: any) {
      console.error(e);
      setError("Falha na comunicação com o servidor Nexus. Verifique se a cota da sua API Key não expirou.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 animate-fade-in">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-28 px-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${m.role === 'user' ? 'bg-indigo-600' : 'bg-slate-900 border border-indigo-500/30'}`}>
                {m.role === 'user' ? <User size={18} /> : <Cpu size={18} className="text-indigo-400" />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-indigo-500/10' : 'glass border-slate-800 text-slate-200'}`}>
                {m.content || <div className="flex gap-1 py-1"><div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" /><div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" /></div>}
              </div>
            </div>
          </div>
        ))}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-fade-in">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="absolute bottom-8 left-4 right-4 max-w-4xl mx-auto">
        <div className="glass border-indigo-500/20 rounded-2xl p-2 flex gap-2 shadow-2xl focus-within:border-indigo-500/50 transition-all">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Comando Nexus..."
            className="flex-1 bg-transparent border-none px-4 py-3 text-sm focus:outline-none placeholder-slate-600"
          />
          <button 
            onClick={sendMessage} 
            disabled={loading || !input.trim()} 
            className="bg-indigo-600 p-3 rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImageView = () => {
  const [prompt, setPrompt] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setImg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ text: prompt }]
      });
      for (const part of resp.candidates[0].content.parts) {
        if (part.inlineData) {
          setImg(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (e) {
      alert("Falha ao processar arte. Verifique a configuração da API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col items-center overflow-y-auto animate-fade-in custom-scrollbar">
      <div className="max-w-2xl w-full text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-4">
          <Sparkles size={12} /> Laboratório Visual
        </div>
        <h1 className="text-4xl font-black mb-2 text-white tracking-tight">Criação Nexus</h1>
        <p className="text-slate-500 text-sm">Transforme conceitos em realidade digital.</p>
      </div>
      <div className="w-full max-w-2xl space-y-6">
        <div className="glass p-6 rounded-3xl border-slate-800 space-y-4 shadow-2xl">
          <textarea 
            value={prompt} 
            onChange={e => setPrompt(e.target.value)}
            placeholder="Descreva a visão artística..."
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none h-28 text-slate-200 placeholder-slate-600 transition-all"
          />
          <button 
            onClick={generate} 
            disabled={loading || !prompt.trim()} 
            className="w-full bg-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-500 transition-all disabled:opacity-30 shadow-lg shadow-indigo-600/20"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
            {loading ? 'SINTETIZANDO...' : 'EXECUTAR CRIAÇÃO'}
          </button>
        </div>
        <div className="glass aspect-square rounded-3xl overflow-hidden flex items-center justify-center bg-slate-900/40 border border-slate-800/50 shadow-inner group relative">
          {img ? (
            <img src={img} className="w-full h-full object-cover animate-fade-in hover:scale-105 transition-transform duration-700" alt="Output" />
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-700">
              <ImageIcon size={64} strokeWidth={1} />
              <span className="text-[10px] uppercase font-black tracking-widest">Aguardando Input</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VideoView = () => {
  const [image, setImage] = useState<{ base64: string; mime: string } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const generate = async () => {
    if (!image || !prompt.trim() || isGenerating) return;

    const as = (window as any).aistudio;
    if (as && typeof as.hasSelectedApiKey === 'function') {
      if (!(await as.hasSelectedApiKey())) {
        if (typeof as.openSelectKey === 'function') await as.openSelectKey();
      }
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setStatus('Iniciando Motor Veo...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      let operation;
      try {
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt,
          image: { imageBytes: image.base64, mimeType: image.mime },
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
      } catch (err: any) {
        if (err.message?.includes("not found") || err.message?.includes("404")) {
          setStatus('Chave GCP com Billing Necessária.');
          if (as && typeof as.openSelectKey === 'function') await as.openSelectKey();
          setIsGenerating(false);
          return;
        }
        throw err;
      }

      while (!operation.done) {
        setStatus("Processando Redes Neurais...");
        await new Promise(r => setTimeout(r, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const resp = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await resp.blob();
        setVideoUrl(URL.createObjectURL(blob));
        setStatus('Renderização Completa');
      }
    } catch (e: any) {
      setStatus('Erro Crítico no Motor');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col items-center overflow-y-auto animate-fade-in custom-scrollbar">
      <div className="max-w-4xl w-full text-center mb-12">
        <h1 className="text-5xl font-black text-amber-500 mb-2 tracking-tighter italic">Nexus Veo</h1>
        <p className="text-slate-500 text-sm">Animação Cinematográfica Inteligente</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-6xl">
        <div className="space-y-6">
          <div className="glass aspect-video rounded-3xl border-dashed border-2 border-slate-700 flex flex-col items-center justify-center p-4 cursor-pointer relative overflow-hidden hover:border-amber-500/50 transition-all group">
            {image ? (
              <div className="w-full h-full relative group">
                <img src={`data:${image.mime};base64,${image.base64}`} className="w-full h-full object-cover rounded-2xl" alt="Base" />
                <button onClick={() => setImage(null)} className="absolute top-4 right-4 bg-red-500 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><XCircle size={18}/></button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-4 cursor-pointer w-full h-full justify-center">
                <div className="p-4 bg-slate-900 rounded-full group-hover:scale-110 transition-transform">
                  <Upload size={32} className="text-slate-500" />
                </div>
                <div className="text-center">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest block">Upload Frame Zero</span>
                  <span className="text-[10px] text-slate-600 block mt-1">Formatos sugeridos: JPG, PNG</span>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setImage({ base64: await blobToBase64(f), mime: f.type });
                }} />
              </label>
            )}
          </div>
          <div className="glass p-5 rounded-3xl space-y-4 shadow-xl">
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Descreva a dinâmica do vídeo..." className="w-full bg-transparent border-none text-slate-200 focus:ring-0 outline-none resize-none h-24 text-sm placeholder-slate-600" />
            <button onClick={generate} disabled={isGenerating || !image} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-30 shadow-lg shadow-amber-600/20 active:scale-95">
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {isGenerating ? 'RENDERIZANDO...' : 'INICIAR ENGINE'}
            </button>
          </div>
          {status && <p className="text-center text-[10px] uppercase font-black text-amber-500 tracking-[0.3em] animate-pulse">{status}</p>}
        </div>
        <div className="glass aspect-video rounded-3xl flex items-center justify-center bg-black/60 border border-slate-800 shadow-2xl relative overflow-hidden">
          {videoUrl ? (
            <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-800">
               <Video size={64} strokeWidth={1} />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Output Cinematográfico</span>
            </div>
          )}
          {isGenerating && <div className="absolute inset-0 bg-indigo-950/20 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-indigo-400 tracking-widest">SINTETIZANDO FRAMES...</span>
          </div>}
        </div>
      </div>
    </div>
  );
};

const LiveView = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [transcription, setTranscription] = useState<string[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stop = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsActive(false);
    setStatus('Encerrado');
  };

  const start = async () => {
    if (isActive) return stop();
    setStatus('Conectando...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => { setIsActive(true); setStatus('Transmissão Ativa'); },
          onmessage: async (m: LiveServerMessage) => {
            const base64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (m.serverContent?.inputTranscription) setTranscription(p => [...p.slice(-5), `Você: ${m.serverContent?.inputTranscription?.text}`]);
            if (m.serverContent?.outputTranscription) setTranscription(p => [...p.slice(-5), `Nexus: ${m.serverContent?.outputTranscription?.text}`]);
          },
          onclose: () => stop(),
          onerror: (e) => { console.error(e); stop(); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      sessionRef.current = await sessionPromise;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!isActive) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
        sessionRef.current?.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
      };
      source.connect(processor); processor.connect(inputCtx.destination);
    } catch (e) { 
      setStatus('Erro Periférico'); 
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in relative">
      <div className="absolute top-12 text-center">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Nexus Live Audio</h2>
        <p className="text-slate-500 text-xs tracking-widest uppercase">Protocolo de Voz Real-time</p>
      </div>

      <div className="relative group">
         <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${isActive ? 'bg-indigo-500/30 scale-150' : 'bg-transparent'}`} />
         <button 
          onClick={start} 
          className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative z-10 border-4 ${
            isActive ? 'bg-indigo-600 border-indigo-400 scale-95 shadow-indigo-500/40' : 'bg-slate-900 border-slate-800 hover:border-indigo-500/50'
          }`}
        >
          {isActive ? <MicOff size={64} className="text-white" /> : <Mic size={64} className="text-indigo-400" />}
          {isActive && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-50" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-400/20 animate-pulse" />
            </>
          )}
        </button>
      </div>

      <div className="mt-20 w-full max-w-lg glass rounded-3xl p-8 min-h-[220px] flex flex-col gap-6 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
           <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
            <Volume2 size={14} /> {status}
          </div>
          {isActive && <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /></div>}
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar max-h-40">
          {transcription.map((t, i) => (
            <div key={i} className={`text-xs animate-fade-in ${t.startsWith('Você') ? 'text-slate-500' : 'text-white font-semibold pl-2 border-l-2 border-indigo-500'}`}>
              {t}
            </div>
          ))}
          {transcription.length === 0 && <p className="text-slate-700 italic text-[10px] text-center pt-10 uppercase tracking-widest font-black">Aguardando Frequência...</p>}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}