
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  GoogleGenAI, 
  Modality, 
  GenerateContentResponse,
  LiveServerMessage 
} from "@google/genai";
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  History, 
  Zap,
  Loader2,
  Terminal,
  Cpu,
  Video,
  Upload,
  Play,
  Download,
  AlertCircle,
  Key
} from 'lucide-react';

// --- Utilitários ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- Componentes Principais ---

const App = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'live' | 'video'>('chat');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} glass border-r border-slate-800 flex flex-col`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <Cpu size={24} className="text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">Nexus IA</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="Chat" 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<ImageIcon size={20} />} 
            label="Arte" 
            active={activeTab === 'image'} 
            onClick={() => setActiveTab('image')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Video size={20} />} 
            label="Vídeo (Veo)" 
            active={activeTab === 'video'} 
            onClick={() => setActiveTab('video')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Mic size={20} />} 
            label="Voz (Live)" 
            active={activeTab === 'live'} 
            onClick={() => setActiveTab('live')} 
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Terminal size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'image' && <ImageView />}
        {activeTab === 'live' && <LiveView />}
        {activeTab === 'video' && <VideoView />}
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, collapsed }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 shadow-[0_0_15px_rgba(79,70,229,0.1)]' 
        : 'hover:bg-slate-800 text-slate-400'
    }`}
  >
    {icon}
    {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </button>
);

// --- Chat View ---
const ChatView = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([
    { role: 'model', content: 'Olá! Sou o Nexus, seu assistente inteligente. Como posso ajudar você hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: 'Você é o Nexus IA, um assistente brasileiro altamente prestativo. Responda em Português Brasileiro.',
        }
      });
      setMessages(prev => [...prev, { role: 'model', content: response.text || '...' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', content: 'Erro na conexão.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-24 pt-4 px-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-lg ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'glass text-slate-200 rounded-tl-none border-slate-700'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && <div className="glass p-4 rounded-2xl w-12 flex justify-center"><Loader2 className="animate-spin text-indigo-400" size={20} /></div>}
      </div>
      <div className="absolute bottom-6 left-4 right-4 max-w-4xl mx-auto">
        <div className="glass border-slate-700 rounded-2xl p-2 flex items-center shadow-2xl">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Mensagem..." className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-slate-100" />
          <button onClick={handleSend} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 p-3 rounded-xl"><Send size={20} /></button>
        </div>
      </div>
    </div>
  );
};

// --- Image View ---
const ImageView = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setResultImage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ text: prompt }],
        config: { imageConfig: { aspectRatio: '1:1' } }
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) { setResultImage(`data:image/png;base64,${part.inlineData.data}`); break; }
      }
    } catch (err) { alert('Erro na geração.'); } finally { setIsGenerating(false); }
  };

  return (
    <div className="flex flex-col items-center h-full p-8 max-w-5xl mx-auto w-full">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3"><Sparkles className="text-indigo-400" /> Nexus Arte</h1>
      </header>
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass p-6 rounded-3xl border-slate-700 h-fit">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva sua arte..." className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white min-h-[150px]" />
          <button onClick={generateImage} disabled={isGenerating || !prompt.trim()} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Zap size={18} />} {isGenerating ? 'Criando...' : 'Gerar'}
          </button>
        </div>
        <div className="aspect-square glass rounded-3xl border-slate-700 flex items-center justify-center overflow-hidden">
          {resultImage ? <img src={resultImage} className="w-full h-full object-cover animate-in fade-in" /> : isGenerating ? <Loader2 className="animate-spin text-indigo-500" size={48} /> : <ImageIcon size={64} className="opacity-20" />}
        </div>
      </div>
    </div>
  );
};

// --- Video View (Nexus Veo) ---
const VideoView = () => {
  const [image, setImage] = useState<{ base64: string; mime: string } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      setNeedsApiKey(!hasKey);
    };
    checkKey();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await blobToBase64(file);
      setImage({ base64, mime: file.type });
    }
  };

  const openKeySelection = async () => {
    await (window as any).aistudio.openSelectKey();
    setNeedsApiKey(false);
  };

  const generateVideo = async () => {
    if (!image || !prompt.trim() || isGenerating) return;

    // Verificar API Key conforme regras de Veo
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await openKeySelection();
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setStatus('Iniciando Alquimia Visual...');

    try {
      // Cria instância do GoogleGenAI imediatamente antes do uso
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let operation;
      try {
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: prompt,
          image: {
            imageBytes: image.base64,
            mimeType: image.mime
          },
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        });
      } catch (err: any) {
        // Regra obrigatória para erro 404/Entidade não encontrada
        if (err.message?.includes("Requested entity was not found") || JSON.stringify(err).includes("NOT_FOUND")) {
          setStatus('Chave de API inválida ou sem permissão. Por favor, selecione uma chave de um projeto GCP pago.');
          await openKeySelection();
          setIsGenerating(false);
          return;
        }
        throw err;
      }

      const messages = [
        "Interpretando sua visão...",
        "Moldando o espaço-tempo...",
        "Colorindo os frames intermediários...",
        "Finalizando a composição cinemática...",
        "Quase lá! Polindo os detalhes..."
      ];
      let msgIndex = 0;

      while (!operation.done) {
        setStatus(messages[msgIndex % messages.length]);
        msgIndex++;
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await videoResponse.blob();
        setVideoUrl(URL.createObjectURL(videoBlob));
        setStatus('Alquimia concluída com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Erro: ${err.message || 'Ocorreu um problema na geração.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-amber-500 mb-2 flex items-center justify-center gap-3">
          <Video className="text-amber-500" /> Nexus Veo
        </h1>
        <p className="text-slate-400">Transforme uma imagem estática em uma jornada cinematográfica.</p>
        
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-2 rounded-full text-xs font-semibold">
            <AlertCircle size={14} /> Requer Chave de API Paga (GCP)
          </div>
          
          {needsApiKey && (
            <button 
              onClick={openKeySelection}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-400 px-6 py-2 rounded-xl border border-amber-500/30 transition-all font-bold text-sm"
            >
              <Key size={16} /> Configurar Chave de API de Faturamento
            </button>
          )}
          
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline hover:text-amber-500 transition-colors">
            Saiba mais sobre o faturamento do Google Cloud
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="glass p-8 rounded-3xl border-slate-700 border-dashed border-2 hover:border-amber-500/50 transition-all group relative">
            {!image ? (
              <label className="flex flex-col items-center justify-center cursor-pointer py-10">
                <Upload size={48} className="text-slate-500 group-hover:text-amber-500 transition-colors mb-4" />
                <span className="text-slate-300 font-medium">Carregar Imagem Base</span>
                <span className="text-slate-500 text-sm mt-1">PNG, JPG até 10MB</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            ) : (
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl">
                <img src={`data:${image.mime};base64,${image.base64}`} className="w-full h-full object-cover" />
                <button onClick={() => setImage(null)} className="absolute top-2 right-2 bg-red-500 p-2 rounded-full hover:bg-red-600 transition-colors">
                  <Terminal size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="glass p-6 rounded-3xl border-slate-700">
            <label className="block text-sm font-medium text-amber-500 mb-2 uppercase tracking-wider">Ação e Movimento</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: faça a pessoa sorrir e o fundo se tornar um pôr do sol mágico com pássaros voando..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-amber-500 min-h-[120px]"
            />
            <button
              onClick={generateVideo}
              disabled={isGenerating || !image || !prompt.trim()}
              className="w-full mt-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,119,6,0.2)]"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
              {isGenerating ? 'Alquimizando...' : 'Gerar Vídeo Mágico'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="aspect-video glass rounded-3xl border-slate-700 flex items-center justify-center overflow-hidden relative shadow-2xl bg-slate-900/40">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
            ) : isGenerating ? (
              <div className="text-center space-y-6 p-8">
                <div className="relative w-24 h-24 mx-auto">
                   <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full"></div>
                   <div className="absolute inset-0 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="space-y-2">
                  <p className="text-amber-500 font-bold text-xl animate-pulse">{status}</p>
                  <p className="text-slate-500 text-sm">A geração de vídeo pode levar de 1 a 3 minutos.</p>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 text-center p-8">
                <Video size={64} className="mx-auto mb-4 opacity-10" />
                <p>O resultado da sua alquimia aparecerá aqui</p>
              </div>
            )}
          </div>
          
          {videoUrl && (
            <a 
              href={videoUrl} 
              download="nexus-video.mp4"
              className="glass p-4 rounded-2xl flex items-center justify-center gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 transition-all font-bold"
            >
              <Download size={20} /> Baixar MP4 em Alta Definição
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Live View (Voz) ---
const LiveView = () => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = () => {
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    for (const source of sourcesRef.current) source.stop();
    sourcesRef.current.clear();
    setIsActive(false);
    setIsConnecting(false);
  };

  const startSession = async () => {
    if (isActive) { stopSession(); return; }
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => { setIsActive(true); setIsConnecting(false); },
          onmessage: async (msg) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.inputTranscription) setTranscription(p => [...p.slice(-5), `Você: ${msg.serverContent.inputTranscription.text}`]);
            if (msg.serverContent?.outputTranscription) setTranscription(p => [...p.slice(-5), `Nexus: ${msg.serverContent.outputTranscription.text}`]);
          },
          onclose: () => stopSession(),
          onerror: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          inputAudioTranscription: {}, outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
      
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const pcm = createBlob(e.inputBuffer.getChannelData(0));
        sessionRef.current?.sendRealtimeInput({ media: pcm });
      };
      source.connect(processor);
      processor.connect(inputCtx.destination);
      
    } catch (err) { setIsConnecting(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className={`w-48 h-48 rounded-full mb-8 flex items-center justify-center relative ${isActive ? 'bg-indigo-600/20' : 'bg-slate-900'}`}>
        {isActive && <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-ping opacity-20"></div>}
        <button onClick={startSession} className={`z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-red-500' : 'bg-indigo-600'}`}>
          {isConnecting ? <Loader2 className="animate-spin" /> : isActive ? <MicOff size={40} /> : <Mic size={40} />}
        </button>
      </div>
      <div className="w-full max-w-2xl glass rounded-2xl p-6 h-64 overflow-y-auto">
        {transcription.map((t, i) => <div key={i} className="mb-2 text-sm">{t}</div>)}
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
