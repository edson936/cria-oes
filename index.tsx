import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  GoogleGenAI, 
  Modality,
  LiveServerMessage,
  GenerateContentResponse,
  Type
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
  ShieldCheck,
  Copy,
  Check,
  Paperclip,
  FileCode,
  Terminal,
  Download,
  FileDown,
  RefreshCw,
  Square,
  Plus,
  Trash2,
  History,
  Wind,
  Layers,
  Clapperboard,
  Ear
} from 'lucide-react';

// --- Interfaces ---
interface Message {
  role: 'user' | 'model';
  content: string;
  isCancelled?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

// --- Utilitários de Áudio e Dados ---
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

const createBlob = (data: Float32Array): any => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

// --- Componentes Compartilhados ---
const CodeSandbox = ({ code, isOpen, onClose }: { code: string; isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  const fullHtml = code.includes('<html') ? code : `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: sans-serif; padding: 20px; background: #fff; }</style></head><body>${code}</body></html>`;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full h-full max-w-6xl glass rounded-3xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 bg-slate-900 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3"><Terminal size={18} className="text-indigo-400" /><span className="font-bold text-sm text-slate-200">Sandbox Preview</span></div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors"><XCircle size={24} className="text-slate-500 hover:text-white" /></button>
        </div>
        <div className="flex-1 bg-white"><iframe srcDoc={fullHtml} className="w-full h-full border-none" sandbox="allow-scripts" /></div>
      </div>
    </div>
  );
};

const CodeBlock: React.FC<{ code: string; language?: string; isStreaming?: boolean; isCancelled?: boolean }> = ({ code, language, isStreaming, isCancelled }) => {
  const [copied, setCopied] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  useEffect(() => { if (isStreaming && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight; }, [code, isStreaming]);
  const copyToClipboard = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const downloadFile = () => { if (isStreaming) return; const extension = language || 'txt'; const blob = new Blob([code], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `nexus_output.${extension}`; link.click(); URL.revokeObjectURL(url); };
  const isExecutable = !isStreaming && (code.toLowerCase().includes('<html') || code.toLowerCase().includes('<div') || code.toLowerCase().includes('<body'));
  return (
    <div className="relative group my-4">
      <div className="bg-slate-900 border border-slate-800 border-b-0 rounded-t-2xl px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5"><div className={`w-2 h-2 rounded-full bg-red-500/40`} /><div className="w-2 h-2 rounded-full bg-amber-500/40" /><div className="w-2 h-2 rounded-full bg-green-500/40" /></div>
          <span className="text-[10px] font-mono text-slate-500 ml-2 uppercase tracking-widest">{isStreaming ? 'Processando...' : language || 'source'}</span>
        </div>
        <div className="flex gap-2">
          {!isStreaming && (
            <>
              {isExecutable && <button onClick={() => setSandboxOpen(true)} className="p-1 text-indigo-400 hover:text-white transition-colors"><Play size={14}/></button>}
              <button onClick={downloadFile} className="p-1 text-slate-400 hover:text-white"><FileDown size={14}/></button>
              <button onClick={copyToClipboard} className="p-1 text-slate-400 hover:text-white">{copied ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}</button>
            </>
          )}
        </div>
      </div>
      <pre ref={preRef} className="bg-[#010409] p-4 rounded-b-2xl overflow-x-auto font-mono text-xs text-indigo-100 shadow-inner max-h-[500px] custom-scrollbar">
        <code>{code}{isStreaming && <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse" />}</code>
      </pre>
      <CodeSandbox code={code} isOpen={sandboxOpen} onClose={() => setSandboxOpen(false)} />
    </div>
  );
};

const FormattedText = ({ text, isStreaming, isCancelled }: { text: string; isStreaming?: boolean; isCancelled?: boolean }) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentCodeBlock: string[] = [];
  let isCodeBlock = false;
  let currentLanguage = '';
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (isCodeBlock) {
        elements.push(<CodeBlock key={`code-${idx}`} code={currentCodeBlock.join('\n')} language={currentLanguage} isStreaming={false} isCancelled={isCancelled} />);
        currentCodeBlock = []; isCodeBlock = false; currentLanguage = '';
      } else { isCodeBlock = true; currentLanguage = line.trim().replace('```', ''); }
      return;
    }
    if (isCodeBlock) { currentCodeBlock.push(line); return; }
    if (line.startsWith('### ')) elements.push(<h3 key={idx} className="text-lg font-bold text-indigo-300 mt-4 mb-2">{line.replace('### ', '')}</h3>);
    else if (line.startsWith('## ')) elements.push(<h2 key={idx} className="text-xl font-black text-indigo-400 mt-6 mb-3 border-b border-indigo-500/20 pb-1">{line.replace('## ', '')}</h2>);
    else if (line.trim() === '') elements.push(<div key={idx} className="h-2" />);
    else elements.push(<p key={idx} className="leading-relaxed text-slate-300 text-sm mb-1">{line}</p>);
  });
  if (isCodeBlock) elements.push(<CodeBlock key="streaming-code" code={currentCodeBlock.join('\n')} language={currentLanguage} isStreaming={isStreaming} isCancelled={isCancelled} />);
  return <div className="space-y-1">{elements}</div>;
};

// --- App Principal ---
const App = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'video' | 'live'>('chat');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('nexus_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('nexus_sessions', JSON.stringify(sessions)); }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const createNewSession = () => {
    const id = Date.now().toString();
    const newSession: ChatSession = { id, title: 'Nova Conversa', messages: [{ role: 'model', content: 'Protocolos Nexus ativos. Envie arquivos ou códigos para análise.' }], timestamp: Date.now() };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(id);
    setActiveTab('chat');
  };

  const updateSessionMessages = (messages: Message[]) => {
    if (!activeSessionId) {
      const id = Date.now().toString();
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Nova Conversa';
      const title = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '');
      const newSession: ChatSession = { id, title, messages, timestamp: Date.now() };
      setSessions([newSession, ...sessions]);
      setActiveSessionId(id);
      return;
    }
    setSessions(sessions.map(s => {
      if (s.id === activeSessionId) {
        let title = s.title;
        if (s.messages.length <= 1 && messages.length > 1) {
          const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Conversa';
          title = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '');
        }
        return { ...s, messages, title };
      }
      return s;
    }));
  };

  if (!process.env.API_KEY) return <div className="h-screen bg-slate-950 flex items-center justify-center p-10 text-center"><div className="glass p-10 rounded-3xl border-indigo-500/30">Aguardando API_KEY...</div></div>;

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-100 overflow-hidden font-sans">
      <aside className={`transition-all duration-500 ${isSidebarOpen ? 'w-64' : 'w-20'} glass border-r border-slate-800 flex flex-col z-20`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl"><Cpu size={24} /></div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tighter">NEXUS IA</span>}
        </div>

        <div className="px-4 mb-4">
          <button onClick={createNewSession} className="w-full flex items-center gap-3 p-3 rounded-xl border border-indigo-500/30 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 group">
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-widest">Novo Chat</span>}
          </button>
        </div>

        <nav className="flex-shrink-0 px-4 space-y-2">
          <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-slate-400 hover:bg-slate-800'}`}>
            <MessageSquare size={20} />{isSidebarOpen && <span className="text-sm font-semibold">Inteligência</span>}
          </button>
          <button onClick={() => setActiveTab('image')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <ImageIcon size={20} />{isSidebarOpen && <span className="text-sm font-semibold">Artes Visuais</span>}
          </button>
          <button onClick={() => setActiveTab('video')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'video' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Video size={20} />{isSidebarOpen && <span className="text-sm font-semibold">Nexus Veo</span>}
          </button>
          <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'live' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Mic size={20} />{isSidebarOpen && <span className="text-sm font-semibold">Live Voice</span>}
          </button>
        </nav>

        {isSidebarOpen && (
          <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 px-4 space-y-1">
             <div className="px-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 border-b border-white/5 mb-2 flex items-center gap-2"><History size={12}/> Histórico</div>
             {sessions.map(s => (
               <div key={s.id} onClick={() => { setActiveSessionId(s.id); setActiveTab('chat'); }} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-100' : 'hover:bg-slate-800/50 border-transparent text-slate-400'}`}>
                 <span className="text-xs font-bold truncate flex-1">{s.title}</span>
                 <button onClick={(e) => { e.stopPropagation(); setSessions(sessions.filter(it => it.id !== s.id)); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"><Trash2 size={12}/></button>
               </div>
             ))}
          </div>
        )}

        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-6 text-slate-500 hover:text-white flex justify-center"><ChevronRight size={18} className={`transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : ''}`} /></button>
      </aside>

      <main className="flex-1 relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(79,70,229,0.05),_transparent_50%)] pointer-events-none" />
        <div className="flex-1 relative z-10 overflow-hidden">
          {activeTab === 'chat' && <ChatView messages={activeSession ? activeSession.messages : []} setMessages={updateSessionMessages} />}
          {activeTab === 'image' && <ImageView />}
          {activeTab === 'video' && <VideoView />}
          {activeTab === 'live' && <LiveView />}
        </div>
      </main>
    </div>
  );
};

// --- Chat View (Recodificado para estabilidade) ---
const ChatView = ({ messages, setMessages }: { messages: Message[], setMessages: (m: Message[]) => void }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isStreaming]);

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;
    isCancelledRef.current = false;
    let prompt = input;
    if (attachedFile) prompt = `Reconstrua este arquivo: [${attachedFile.name}].\n\n${input || 'Corrigir.'}\n\nConteúdo:\n\`\`\`\n${attachedFile.content}\n\`\`\``;
    const userMsg = { role: 'user' as const, content: input || `Análise: ${attachedFile?.name}` };
    const history = [...messages, userMsg];
    setMessages(history); setInput(''); setAttachedFile(null); setLoading(true); setIsStreaming(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: history.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        config: { systemInstruction: "Você é o NEXUS CORE. Nunca abrevie código.", temperature: 0.1 }
      });
      let fullText = '';
      setMessages([...history, { role: 'model', content: '' }]);
      for await (const chunk of response) {
        if (isCancelledRef.current) break;
        fullText += chunk.text;
        setMessages([...history, { role: 'model', content: fullText }]);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); setIsStreaming(false); }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-6 relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-32">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${m.role === 'user' ? 'bg-indigo-600' : 'bg-slate-900 border-indigo-500/20'}`}>{m.role === 'user' ? <User size={18}/> : <Cpu size={18} className="text-indigo-400"/>}</div>
            <div className={`p-6 rounded-3xl max-w-[85%] glass border-slate-800 text-slate-200 shadow-xl ${m.role === 'user' ? 'rounded-tr-none bg-indigo-900/10 border-indigo-500/20' : 'rounded-tl-none'}`}>
              <FormattedText text={m.content} isStreaming={isStreaming && i === messages.length - 1} isCancelled={m.isCancelled} />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-8 left-6 right-6 flex flex-col gap-3">
        {attachedFile && <div className="self-start glass px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs text-indigo-300"><FileCode size={14}/> {attachedFile.name} <button onClick={() => setAttachedFile(null)}><XCircle size={12}/></button></div>}
        <div className="glass rounded-[2rem] p-3 flex gap-2 items-end shadow-2xl">
          <button onClick={() => { const i = document.createElement('input'); i.type='file'; i.onchange=(e:any)=>{ const f=e.target.files[0]; const r=new FileReader(); r.onload=ev=>setAttachedFile({name:f.name, content:ev.target?.result as any}); r.readAsText(f); }; i.click(); }} className="p-3 hover:bg-slate-800 rounded-full text-slate-500"><Paperclip size={20}/></button>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(), sendMessage())} placeholder="Descreva o comando..." className="flex-1 bg-transparent border-none py-3 px-2 text-sm focus:outline-none resize-none max-h-40" rows={1} />
          {loading ? <button onClick={() => isCancelledRef.current = true} className="bg-red-600 p-3 rounded-2xl hover:bg-red-500 transition-all"><Square size={20} fill="white"/></button> : <button onClick={sendMessage} disabled={!input.trim()&&!attachedFile} className="bg-indigo-600 p-3 rounded-2xl hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-30"><Send size={20}/></button>}
        </div>
      </div>
    </div>
  );
};

// --- View de Artes Visuais ---
const ImageView = () => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true); setImage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) { setImage(`data:image/png;base64,${part.inlineData.data}`); break; }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-10 max-w-4xl mx-auto space-y-10">
      <div className="text-center space-y-4">
        <div className="bg-indigo-600/20 p-5 rounded-3xl inline-block text-indigo-400"><Layers size={48} className="animate-pulse" /></div>
        <h1 className="text-4xl font-black tracking-tighter">VISION LAB</h1>
        <p className="text-slate-400 max-w-md">Converta seus pensamentos em arte digital usando o motor Flash Image.</p>
      </div>

      <div className="w-full relative glass rounded-[2.5rem] p-4 flex gap-3 shadow-2xl focus-within:ring-2 ring-indigo-500/40">
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Descreva a obra de arte..." className="flex-1 bg-transparent border-none py-3 px-4 text-lg focus:outline-none resize-none" rows={1} />
        <button onClick={generateImage} disabled={loading} className="bg-indigo-600 p-4 rounded-3xl hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center gap-2 font-bold">
          {loading ? <Loader2 className="animate-spin"/> : <Sparkles size={20} />} GERAR
        </button>
      </div>

      <div className="w-full aspect-square max-w-md relative glass rounded-[2.5rem] overflow-hidden border-white/5 flex items-center justify-center bg-slate-900/50">
        {image ? (
          <div className="relative group w-full h-full">
            <img src={image} className="w-full h-full object-cover animate-fade-in" alt="Gerada" />
            <a href={image} download="nexus_art.png" className="absolute top-4 right-4 bg-black/60 backdrop-blur p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600">
              <Download size={20} />
            </a>
          </div>
        ) : (
          <div className="text-center p-10 space-y-3 opacity-20">
            {loading ? <div className="space-y-4"><div className="h-4 w-32 bg-indigo-500/20 rounded mx-auto animate-pulse"></div><div className="h-4 w-48 bg-indigo-500/20 rounded mx-auto animate-pulse [animation-delay:0.2s]"></div></div> : <ImageIcon size={64} className="mx-auto" />}
            <span className="text-xs uppercase font-bold tracking-[0.3em] block">Interface de Saída Visual</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- View de Vídeo (VEO) ---
const VideoView = () => {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const generateVideo = async () => {
    if (!prompt.trim() || loading) return;
    
    // Verificação obrigatória de API Key para VEO
    if (!await (window as any).aistudio.hasSelectedApiKey()) {
      await (window as any).aistudio.openSelectKey();
      return;
    }

    setLoading(true); setVideoUrl(null); setStatus('Inicializando Motores Veo...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      let op = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: { resolution: '720p', aspectRatio: '16:9' }
      });
      
      const messages = ['Renderizando frames...', 'Simulando física...', 'Codificando MP4...', 'Finalizando Atmosfera...'];
      let msgIdx = 0;
      
      while (!op.done) {
        setStatus(messages[msgIdx % messages.length]);
        msgIdx++;
        await new Promise(r => setTimeout(r, 10000));
        op = await ai.operations.getVideosOperation({ operation: op });
      }
      
      const uri = op.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const res = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await res.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (e) { console.error(e); setStatus('Erro na Geração'); } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-10 max-w-4xl mx-auto space-y-10">
      <div className="text-center space-y-4">
        <div className="bg-purple-600/20 p-5 rounded-3xl inline-block text-purple-400"><Clapperboard size={48} className="animate-bounce" /></div>
        <h1 className="text-4xl font-black tracking-tighter">NEXUS VEO</h1>
        <p className="text-slate-400 max-w-md">Criação cinematográfica em alta definição a partir de texto.</p>
      </div>

      <div className="w-full glass rounded-[2.5rem] p-4 flex gap-3 shadow-2xl">
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ex: Um holograma neon de um gato voando..." className="flex-1 bg-transparent border-none py-3 px-4 text-lg focus:outline-none resize-none" rows={1} />
        <button onClick={generateVideo} disabled={loading} className="bg-purple-600 p-4 rounded-3xl hover:bg-purple-500 disabled:opacity-50 transition-all flex items-center gap-2 font-bold">
          {loading ? <Loader2 className="animate-spin"/> : <Zap size={20} />} RENDERIZAR
        </button>
      </div>

      <div className="w-full aspect-video glass rounded-[2.5rem] overflow-hidden border-white/5 bg-slate-900/50 flex items-center justify-center relative">
        {videoUrl ? (
          <video src={videoUrl} controls className="w-full h-full object-contain animate-fade-in" autoPlay loop />
        ) : (
          <div className="text-center p-10 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                   <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
                   <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
                </div>
                <span className="text-sm font-mono text-indigo-400 uppercase tracking-widest animate-pulse">{status}</span>
              </div>
            ) : (
              <div className="opacity-20 flex flex-col items-center gap-2">
                <Video size={64} />
                <span className="text-xs font-bold uppercase tracking-[0.3em]">Cinematic Preview Output</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-600 font-mono text-center">Requer API Key paga e billing ativado para processamento Veo.</p>
    </div>
  );
};

// --- View de Live Voice ---
const LiveView = () => {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Pronto para conectar');
  const sessionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextStartTimeRef = useRef(0);

  const stopLive = () => {
    setActive(false);
    sessionRef.current?.close();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setStatus('Conexão encerrada');
  };

  const startLive = async () => {
    try {
      setStatus('Estabelecendo conexão neural...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      const inputCtx = new AudioContext({ sampleRate: 16000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: { 
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'Você é o Nexus Voice. Uma inteligência artificial amigável e direta. Responda de forma curta e natural.'
        },
        callbacks: {
          onopen: () => {
            setActive(true); setStatus('Transmissão ativa');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptNode = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptNode.onaudioprocess = (ev) => {
              const input = ev.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(input) }));
            };
            source.connect(scriptNode);
            scriptNode.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioCtxRef.current) {
              const buffer = await decodeAudioData(decode(audioData), audioCtxRef.current, 24000, 1);
              const node = audioCtxRef.current.createBufferSource();
              node.buffer = buffer;
              node.connect(audioCtxRef.current.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtxRef.current.currentTime);
              node.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(node);
              node.onended = () => sourcesRef.current.delete(node);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => stopLive(),
          onerror: (e) => { console.error(e); stopLive(); }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); setStatus('Erro ao acessar microfone'); }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-10 max-w-4xl mx-auto space-y-16">
      <div className="text-center space-y-4">
        <div className="bg-indigo-600/20 p-6 rounded-full inline-block text-indigo-400 relative">
          {active && <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-ping opacity-20"></div>}
          <Ear size={48} className={active ? 'animate-pulse' : ''} />
        </div>
        <h1 className="text-4xl font-black tracking-tighter">LIVE VOICE</h1>
        <p className="text-slate-400 max-w-sm mx-auto">Interação vocal de ultra baixa latência. Fale naturalmente com o Nexus.</p>
      </div>

      <div className="flex flex-col items-center gap-8 w-full">
         <div className="h-32 flex items-center gap-1.5 px-10">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`w-1 rounded-full bg-indigo-500 transition-all duration-300 ${active ? 'animate-wave' : 'h-2 opacity-10'}`} style={{ animationDelay: `${i * 0.1}s`, height: active ? 'auto' : '8px' }}></div>
            ))}
         </div>

         <div className="text-xs font-mono uppercase tracking-[0.4em] text-indigo-400 animate-pulse">{status}</div>

         {active ? (
           <button onClick={stopLive} className="group relative bg-red-600 hover:bg-red-500 p-8 rounded-full shadow-2xl shadow-red-600/20 transition-all">
             <MicOff size={32} />
             <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Desconectar</span>
           </button>
         ) : (
           <button onClick={startLive} className="group relative bg-indigo-600 hover:bg-indigo-500 p-8 rounded-full shadow-2xl shadow-indigo-600/40 transition-all">
             <Mic size={32} />
             <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Iniciar Link</span>
           </button>
         )}
      </div>

      <div className="grid grid-cols-2 gap-6 w-full opacity-40">
        <div className="glass p-4 rounded-2xl flex items-center gap-3">
           <Volume2 size={16} className="text-indigo-400"/>
           <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="w-1/2 h-full bg-indigo-500"></div></div>
        </div>
        <div className="glass p-4 rounded-2xl flex items-center gap-3">
           <ShieldCheck size={16} className="text-green-400"/>
           <span className="text-[10px] font-bold uppercase tracking-widest">Criptografia Ativa</span>
        </div>
      </div>
    </div>
  );
};

// --- Injeção de Estilo Adicional ---
const style = document.createElement('style');
style.textContent = `
  @keyframes wave {
    0%, 100% { height: 8px; }
    50% { height: 64px; }
  }
  .animate-wave {
    animation: wave 1s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
