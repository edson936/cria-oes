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
  ShieldCheck,
  Copy,
  Check,
  Paperclip,
  FileCode,
  Terminal,
  Download,
  FileDown,
  RefreshCw,
  Square
} from 'lucide-react';

// --- Utilitários ---
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

// --- Componente de Sandbox (Visualizador de Código) ---
const CodeSandbox = ({ code, isOpen, onClose }: { code: string; isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  const fullHtml = code.includes('<html') ? code : `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>body { font-family: sans-serif; padding: 20px; color: #333; background: #fff; }</style>
      </head>
      <body>${code}</body>
    </html>
  `;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full h-full max-w-6xl glass rounded-3xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 bg-slate-900 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg">
              <Terminal size={18} className="text-indigo-400" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-200">Nexus Sandbox Preview</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <XCircle size={24} className="text-slate-500 hover:text-white" />
          </button>
        </div>
        <div className="flex-1 bg-white">
          <iframe 
            srcDoc={fullHtml} 
            title="sandbox-preview" 
            className="w-full h-full border-none"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
};

// --- Componente de Bloco de Código ---
const CodeBlock: React.FC<{ code: string; language?: string; isStreaming?: boolean }> = ({ code, language, isStreaming }) => {
  const [copied, setCopied] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (isStreaming && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [code, isStreaming]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    if (isStreaming) return;
    const extension = language || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus_full_output.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isExecutable = !isStreaming && (code.toLowerCase().includes('<html') || code.toLowerCase().includes('<div') || code.toLowerCase().includes('<body') || code.toLowerCase().includes('document.'));

  return (
    <div className="relative group my-4">
      <div className="bg-slate-900 border border-slate-800 border-b-0 rounded-t-2xl px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
          </div>
          <span className="text-[10px] font-mono text-slate-500 ml-2 uppercase tracking-widest flex items-center gap-2">
            {isStreaming ? (
              <span className="flex items-center gap-2 text-indigo-400 font-bold animate-pulse">
                <RefreshCw size={10} className="animate-spin" /> 
                RECONSTRUINDO ARQUIVO COMPLETO...
              </span>
            ) : (
              `${language || 'source'}`
            )}
          </span>
        </div>
        
        <div className="flex gap-2">
          {!isStreaming && (
            <>
              {isExecutable && (
                <button 
                  onClick={() => setSandboxOpen(true)}
                  className="p-1.5 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
                >
                  <Play size={10} fill="currentColor" /> TESTAR
                </button>
              )}
              <button 
                onClick={downloadFile}
                className="p-1.5 hover:bg-green-600 text-slate-200 hover:text-white rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold bg-green-900/20 border border-green-500/20"
              >
                <FileDown size={10} /> BAIXAR COMPLETO
              </button>
              <button 
                onClick={copyToClipboard}
                className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
              >
                {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />} COPIAR
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-b-2xl border border-slate-800 border-t-0">
        <pre 
          ref={preRef}
          className={`bg-[#010409] p-5 pt-4 overflow-x-auto font-mono text-[13px] text-indigo-100/90 shadow-inner max-h-[600px] custom-scrollbar transition-all ${isStreaming ? 'ring-1 ring-indigo-500/10' : ''}`}
        >
          <code className="block leading-relaxed">
            {code}
            {isStreaming && <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse align-middle" />}
          </code>
        </pre>
      </div>
      <CodeSandbox code={code} isOpen={sandboxOpen} onClose={() => setSandboxOpen(false)} />
    </div>
  );
};

// --- Renderizador de Markdown ---
const FormattedText = ({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentCodeBlock: string[] = [];
  let isCodeBlock = false;
  let currentLanguage = '';

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (isCodeBlock) {
        elements.push(<CodeBlock key={`code-${idx}`} code={currentCodeBlock.join('\n')} language={currentLanguage} isStreaming={false} />);
        currentCodeBlock = [];
        isCodeBlock = false;
        currentLanguage = '';
      } else {
        isCodeBlock = true;
        currentLanguage = line.trim().replace('```', '');
      }
      return;
    }

    if (isCodeBlock) {
      currentCodeBlock.push(line);
      return;
    }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={idx} className="text-lg font-bold text-indigo-300 mt-6 mb-2">{line.replace('### ', '')}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={idx} className="text-xl font-black text-indigo-400 mt-8 mb-4 border-b border-indigo-500/20 pb-2 uppercase tracking-tighter">{line.replace('## ', '')}</h2>);
    } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      elements.push(
        <div key={idx} className="flex gap-3 items-start ml-2 mb-1">
          <span className="text-indigo-500 mt-1.5 font-bold">•</span>
          <span className="flex-1 text-slate-300">{parseInline(line.trim().substring(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={idx} className="h-2" />);
    } else {
      elements.push(<p key={idx} className="leading-relaxed text-slate-300">{parseInline(line)}</p>);
    }
  });

  if (isCodeBlock) {
    elements.push(<CodeBlock key="streaming-code" code={currentCodeBlock.join('\n')} language={currentLanguage} isStreaming={true} />);
  }

  return (
    <div className="space-y-1 relative">
      {elements}
      {isStreaming && !isCodeBlock && lines[lines.length - 1].length > 0 && (
        <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};

const parseInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs border border-white/5">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const ConfigGuide = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
    <div className="max-w-md w-full glass p-8 rounded-3xl border-indigo-500/30 shadow-2xl animate-fade-in text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-indigo-600/20 p-4 rounded-2xl">
          <Settings size={40} className="text-indigo-400 animate-spin-slow" />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-2 text-white">Nexus IA Offline</h1>
      <p className="text-slate-400 text-sm mb-8">Adicione a `API_KEY` nas variáveis de ambiente para ativar o sistema.</p>
    </div>
  </div>
);

const NavItem = ({ icon, label, active, onClick, collapsed }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group ${
      active 
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' 
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

  if (!process.env.API_KEY) return <ConfigGuide />;

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-100 overflow-hidden font-sans">
      <aside className={`transition-all duration-500 ${isSidebarOpen ? 'w-64' : 'w-20'} glass border-r border-slate-800 flex flex-col z-20`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
            <Cpu size={24} className="text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tighter">NEXUS IA</span>}
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-8">
          <NavItem icon={<MessageSquare size={20} />} label="Inteligência" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} collapsed={!isSidebarOpen} />
          <NavItem icon={<ImageIcon size={20} />} label="Artes Visuais" active={activeTab === 'image'} onClick={() => setActiveTab('image')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Video size={20} />} label="Nexus Veo" active={activeTab === 'video'} onClick={() => setActiveTab('video')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Mic size={20} />} label="Live Voice" active={activeTab === 'live'} onClick={() => setActiveTab('live')} collapsed={!isSidebarOpen} />
        </nav>
        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-6 text-slate-500 hover:text-white flex justify-center group">
          <ChevronRight size={18} className={`transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      <main className="flex-1 relative flex flex-col overflow-hidden">
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
    { role: 'model', content: 'Protocolos Nexus ativos. Envie arquivos de qualquer tamanho para análise. Eu entregarei a reconstrução **COMPLETA** do código para você baixar.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<any>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedFile({ name: file.name, content: event.target?.result as string });
      };
      reader.readAsText(file);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;

    let promptMessage = input;
    if (attachedFile) {
      promptMessage = `RECONSTRUA E CORRIJA O ARQUIVO COMPLETO: [${attachedFile.name}].\nNÃO TRUNQUE O CÓDIGO. ENTREGUE CADA LINHA, DO INÍCIO AO FIM, SEM RESUMOS.\nInstruções extras: ${input || 'Correção completa e otimização.'}\n\nCONTEÚDO DO ARQUIVO:\n\`\`\`\n${attachedFile.content}\n\`\`\``;
    }

    const userDisplayMessage = input || `Corrigindo: ${attachedFile?.name}`;
    setInput('');
    setAttachedFile(null);
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: userDisplayMessage }]);
    setLoading(true);
    setIsStreaming(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({ 
          model: 'gemini-3-pro-preview',
          config: { 
            systemInstruction: 'Você é o NEXUS CORE, um engenheiro de software de elite. Sua regra de ouro é: NUNCA trunque código. Ao corrigir ou reconstruir um arquivo, você DEVE fornecer o conteúdo COMPLETO, linha por linha, dentro de um bloco de código markdown apropriado. Se o arquivo for grande, continue escrevendo até terminar. Sua resposta deve ser em Português do Brasil.',
            temperature: 0.1
          }
        });
      }

      const streamResponse = await chatRef.current.sendMessageStream({ message: promptMessage });
      let fullContent = '';
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      for await (const chunk of streamResponse) {
        const text = (chunk as GenerateContentResponse).text;
        fullContent += text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullContent;
          return updated;
        });
        // Scroll extra agressivo para acompanhar a escrita rápida de códigos longos
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    } catch (e: any) {
      setError("Erro na conexão com o Core Engine. O arquivo pode ser muito extenso para uma única sessão ou houve falha na rede.");
      console.error(e);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 md:p-6 animate-fade-in relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-10 pb-44 px-2 pt-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`flex gap-4 max-w-[95%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl border ${m.role === 'user' ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-900 border-indigo-500/30'}`}>
                {m.role === 'user' ? <User size={18} /> : <Cpu size={18} className="text-indigo-400" />}
              </div>
              <div className={`p-6 rounded-[2rem] text-[15px] shadow-2xl relative ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'glass border-slate-800 text-slate-200 rounded-tl-sm w-full'}`}>
                {m.content ? (
                  <FormattedText text={m.content} isStreaming={isStreaming && i === messages.length - 1} />
                ) : (
                  <div className="flex gap-1.5 py-2">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs mx-14 flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
      </div>

      <div className="absolute bottom-8 left-4 right-4 max-w-5xl mx-auto flex flex-col gap-4">
        {attachedFile && (
          <div className="flex items-center gap-3 self-start glass border-indigo-500/40 p-2.5 pl-4 pr-3 rounded-2xl animate-fade-in shadow-lg">
            <FileCode size={16} className="text-indigo-400" />
            <span className="text-xs font-bold text-slate-300">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <XCircle size={14} className="text-slate-500 hover:text-red-400" />
            </button>
          </div>
        )}
        
        <div className="glass border-white/10 rounded-[2.5rem] p-4 flex gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] focus-within:border-indigo-500/50 transition-all items-end">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
            accept=".txt,.js,.css,.html,.ts,.tsx,.json,.md,.py,.cpp,.java,.sh,.sql,.yaml,.xml" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="p-4 rounded-full hover:bg-slate-800 text-slate-400 transition-all flex-shrink-0 group disabled:opacity-30"
            title="Upload de arquivo para correção"
          >
            <Paperclip size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
          
          <textarea 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder={attachedFile ? "Pressione Enter para iniciar a reconstrução completa..." : "Descreva seu problema ou anexe um arquivo..."}
            className="flex-1 bg-transparent border-none px-2 py-3 text-sm focus:outline-none placeholder-slate-600 resize-none max-h-40 min-h-[44px] custom-scrollbar"
            rows={1}
            disabled={loading}
          />
          
          <button 
            onClick={sendMessage} 
            disabled={loading || (!input.trim() && !attachedFile)} 
            className="bg-indigo-600 p-4 rounded-[1.5rem] hover:bg-indigo-500 transition-all disabled:opacity-30 group shadow-lg shadow-indigo-600/30 flex-shrink-0"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImageView = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 animate-fade-in">
    <ImageIcon size={64} className="opacity-20" />
    <span className="text-xs uppercase font-black tracking-widest">Interface Vision em Calibração</span>
  </div>
);

const VideoView = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 animate-fade-in">
    <Video size={64} className="opacity-20" />
    <span className="text-xs uppercase font-black tracking-widest">Veo Engine Indisponível</span>
  </div>
);

const LiveView = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 animate-fade-in">
    <Mic size={64} className="opacity-20" />
    <span className="text-xs uppercase font-black tracking-widest">Voz em Manutenção</span>
  </div>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
