import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, User, Bot, Trash2, Globe, Book, Brain, Mic, MicOff, Paperclip, X, FileText, Sparkles, Menu, Moon, Settings, LogIn, LogOut, ChevronLeft, Download, FileAudio, BrainCircuit } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { Feedback } from './Feedback';

// --- IndexedDB Helper Functions ---
const DB_NAME = 'AnaChakChatDB';
const DB_VERSION = 2; // Incremented version for schema change
const MSG_STORE_NAME = 'messages';
const MEMORY_STORE_NAME = 'memory';

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject("Error opening DB");
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const dbInstance = (e.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(MSG_STORE_NAME)) {
        dbInstance.createObjectStore(MSG_STORE_NAME, { autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains(MEMORY_STORE_NAME)) {
        dbInstance.createObjectStore(MEMORY_STORE_NAME, { keyPath: 'userId' });
      }
    };
  });
};

const getMessagesFromDB = (): Promise<Message[]> => {
  return new Promise(async (resolve) => {
    const db = await openDB();
    const transaction = db.transaction(MSG_STORE_NAME, 'readonly');
    const store = transaction.objectStore(MSG_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
};

const saveMessageToDB = async (message: Message) => {
  const db = await openDB();
  const transaction = db.transaction(MSG_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(MSG_STORE_NAME);
  store.add(message);
};

const clearMessagesFromDB = async () => {
  const db = await openDB();
  const transaction = db.transaction(MSG_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(MSG_STORE_NAME);
  store.clear();
};

const getMemoryFromDB = (userId: string): Promise<UserMemory | null> => {
    return new Promise(async (resolve) => {
        const db = await openDB();
        const transaction = db.transaction(MEMORY_STORE_NAME, 'readonly');
        const store = transaction.objectStore(MEMORY_STORE_NAME);
        const request = store.get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};

const saveMemoryToDB = async (memory: UserMemory) => {
    const db = await openDB();
    const transaction = db.transaction(MEMORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE_NAME);
    store.put(memory);
};

const clearMemoryForUser = async (userId: string) => {
    const db = await openDB();
    const transaction = db.transaction(MEMORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE_NAME);
    store.delete(userId);
};
// --- End IndexedDB Helper Functions ---

// Enhanced type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    pdfjsLib: any;
  }

  // Manually defining Speech Recognition API types to fix TypeScript error.
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
}

interface Message {
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  sources?: any[];
  status?: 'thinking' | 'complete' | 'error';
  attachmentPreview?: { type: 'image' | 'pdf' | 'audio'; data: string; name: string };
}

interface UserMemory {
    userId: string;
    preferences: string[];
    facts: string[];
    summary: string;
}

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 48 48" {...props}>
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.596,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

const MarkdownRenderer = ({ content }: { content: string }) => {
  // Return early if content is empty or not a string, to avoid errors with thinking messages etc.
  if (typeof content !== 'string' || !content.trim()) {
    return <div className="text-base font-khmer whitespace-pre-wrap">{content}</div>;
  }
  
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  // Helper to push collected list items to the main elements array
  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-disc list-inside pl-4 space-y-1 my-2">{currentList}</ul>);
      currentList = [];
    }
  };

  // Helper to parse inline markdown like **bold**
  const parseInline = (line: string): React.ReactNode[] => {
    const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Handle unordered list items
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      currentList.push(<li key={index}>{parseInline(trimmedLine.substring(2))}</li>);
    } else {
      // If we encounter a non-list item, the current list (if any) is finished.
      flushList();
      
      // Handle headings, e.g., "១. គ្រឿងផ្សំ:" or "**Heading**"
      if (/^\S+\.\s.*:$/.test(trimmedLine) || (trimmedLine.startsWith('**') && trimmedLine.endsWith('**'))) {
        const headingContent = (trimmedLine.startsWith('**') && trimmedLine.endsWith('**'))
            ? trimmedLine.slice(2, -2)
            : trimmedLine;
        elements.push(<h4 key={index} className="font-bold mt-4 mb-2">{parseInline(headingContent)}</h4>);
      } else if (trimmedLine) {
        // Handle regular paragraphs
        elements.push(<p key={index}>{parseInline(trimmedLine)}</p>);
      }
      // Empty lines are ignored, creating natural spacing between blocks.
    }
  });

  // Flush any remaining list at the end of the content
  flushList();

  return <div className="font-khmer text-base space-y-2">{elements}</div>;
};


const Sidebar = ({ isOpen, onClose, user, onSignIn, onSignOut, onClearMemory }: {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; avatar: string } | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onClearMemory: () => void;
}) => {
  const [authStep, setAuthStep] = useState<'initial' | 'login'>('initial');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  
  useEffect(() => {
      if (!isOpen) {
        setTimeout(() => {
          setAuthStep('initial');
          setLoginMethod('email');
        }, 300);
      }
  }, [isOpen]);
  
  const handleSignIn = (e: React.MouseEvent) => {
    e.preventDefault();
    onSignIn();
  };

  const LoggedInView = () => (
    <div className="flex flex-col flex-grow">
      <nav className="p-4">
        <ul className="space-y-2">
          <li>
            <a href="#" className="flex items-center p-3 text-text-light dark:text-text-dark rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <Settings className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
              <span>Settings</span>
            </a>
          </li>
           <li>
            <button onClick={onClearMemory} className="w-full flex items-center p-3 text-text-light dark:text-text-dark rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <BrainCircuit className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
              <span>Clear Memory</span>
            </button>
          </li>
        </ul>
      </nav>
      <div className="mt-auto p-4 border-t border-divider-light dark:border-divider-dark">
        <div className="flex items-center space-x-3">
          <img src={user!.avatar} alt="User Avatar" className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div>
            <p className="font-semibold text-text-light dark:text-text-dark">{user!.name}</p>
          </div>
          <button onClick={onSignOut} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5" aria-label="Sign Out">
            <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );

  const LoggedOutView = () => (
    <div className="flex flex-col h-full">
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <a href="#" className="flex items-center p-3 text-text-light dark:text-text-dark rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <Settings className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
                <span>Settings</span>
              </a>
            </li>
          </ul>
        </nav>
      <div className="mt-auto p-4 border-t border-divider-light dark:border-divider-dark">
        <button onClick={() => setAuthStep('login')} className="w-full flex items-center justify-center p-3 text-text-light bg-accent rounded-lg hover:opacity-90 transition-opacity font-bold">
          <LogIn className="w-5 h-5 mr-3" />
          <span>Sign In</span>
        </button>
      </div>
    </div>
  );

  const AuthView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-divider-light dark:border-divider-dark">
        <button onClick={() => setAuthStep('initial')} className="flex items-center text-sm text-text-light dark:text-text-dark hover:opacity-80">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </button>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-xl font-bold mb-6 text-center text-text-light dark:text-text-dark">Sign In to AnaChakChat</h3>
        
        <button onClick={handleSignIn} className="w-full flex items-center justify-center p-3 mb-4 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
          <GoogleIcon className="w-5 h-5 mr-3" />
          Sign in with Google
        </button>
        
        <div className="flex items-center my-4">
            <hr className="flex-grow border-gray-300 dark:border-gray-600" />
            <span className="mx-4 text-xs font-medium text-gray-500">OR</span>
            <hr className="flex-grow border-gray-300 dark:border-gray-600" />
        </div>

        <div className="flex border border-divider-light dark:border-gray-600 rounded-lg p-1 mb-4">
            <button onClick={() => setLoginMethod('email')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${loginMethod === 'email' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                Email
            </button>
            <button onClick={() => setLoginMethod('phone')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${loginMethod === 'phone' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                Phone
            </button>
        </div>
        
        {loginMethod === 'email' ? (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Email</label>
              <input type="email" placeholder="you@example.com" className="w-full mt-1 p-2 border border-divider-light dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"/>
            </div>
            <div>
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Password</label>
              <input type="password" placeholder="••••••••" className="w-full mt-1 p-2 border border-divider-light dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"/>
            </div>
            <button onClick={handleSignIn} className="w-full p-3 text-white bg-primary rounded-lg hover:opacity-90">Sign In with Email</button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Phone Number</label>
              <input type="tel" placeholder="+1 (555) 123-4567" className="w-full mt-1 p-2 border border-divider-light dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"/>
            </div>
            <button onClick={handleSignIn} className="w-full p-3 text-white bg-primary rounded-lg hover:opacity-90">Send Code</button>
          </form>
        )}
      </div>
    </div>
  );


  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-lg shadow-xl z-50 transform transition-transform duration-300 ease-in-out border-r border-divider-light dark:border-divider-dark ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full relative">
          <div className="p-4 border-b border-divider-light dark:border-divider-dark">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-light dark:text-text-dark">AnaChakChat</h2>
              </div>
            </div>
          </div>
          
          {user ? <LoggedInView /> : 
            <div className="flex-grow flex flex-col">
              <div className="relative flex-grow">
                  <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${authStep === 'initial' ? '' : 'opacity-0 pointer-events-none'}`}>
                      <LoggedOutView />
                  </div>
                  <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${authStep === 'login' ? '' : 'opacity-0 pointer-events-none'}`}>
                      <AuthView />
                  </div>
              </div>
            </div>
          }
        </div>
      </aside>
    </>
  );
};

// New helper function to wait for the statically loaded PDF.js library
const ensurePdfJsIsLoaded = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const maxAttempts = 40; // 40 * 250ms = 10 seconds
    let attempts = 0;

    const check = () => {
      if (window.pdfjsLib) {
        // Configure the worker once the library is confirmed to be loaded.
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js`;
        }
        resolve(window.pdfjsLib);
      } else {
        attempts++;
        if (attempts > maxAttempts) {
          console.error("PDF.js library failed to load after 10 seconds.");
          reject(new Error('PDF_LIB_NOT_LOADED'));
        } else {
          setTimeout(check, 250);
        }
      }
    };
    check();
  });
};

const AdvancedKhmerAI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<{ file: File; base64: string; type: 'image' | 'pdf' | 'audio' } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isApiConfigured, setIsApiConfigured] = useState(false);
  const [showSendRipple, setShowSendRipple] = useState(false);
  const [theme, setTheme] = useState('light');
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; avatar: string; } | null>(null);
  const [userMemory, setUserMemory] = useState<UserMemory | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const aiRef = useRef<GoogleGenAI | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isGenerating = messages.length > 0 && messages[messages.length - 1]?.status === 'thinking';

  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await ensurePdfJsIsLoaded();

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      if (!fullText.trim()) {
        throw new Error("Could not extract any text. The document might be image-based or empty.");
      }

      return fullText;
    } catch (error) {
      // Re-throw the original error to be handled by the sendMessage function.
      // This ensures the correct user-facing message is displayed for PDF_LIB_NOT_LOADED or other errors.
      throw error;
    }
  };

  useEffect(() => {
    // Load messages from DB on initial load
    getMessagesFromDB().then(dbMessages => {
        if (dbMessages && dbMessages.length > 0) {
            setMessages(dbMessages);
        }
    });
    
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => console.log('SW registered: ', registration))
          .catch(registrationError => console.log('SW registration failed: ', registrationError));
      });
    }

    const handleInstallPrompt = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        setInstallPrompt(null);
    });
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const handleSignIn = async () => {
    const mockUser = { 
        id: 'user123',
        name: 'Sokha', 
        avatar: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>')}` 
    };
    setUser(mockUser);
    const memory = await getMemoryFromDB(mockUser.id);
    setUserMemory(memory);
    console.log("Loaded memory for user:", memory);
    setIsSidebarOpen(false);
  };

  const handleSignOut = () => {
      setUser(null);
      setUserMemory(null);
      setIsSidebarOpen(false);
  };
  
  const handleClearMemory = async () => {
    if (!user) return;
    await clearMemoryForUser(user.id);
    setUserMemory(null);
    alert("AI memory has been cleared.");
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    try {
        if (process.env.API_KEY) {
            aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            setIsApiConfigured(true);
        } else {
            getMessagesFromDB().then(dbMessages => {
              if (dbMessages.length === 0) {
                const demoMessage: Message = {
                    type: 'ai',
                    content: 'សួស្តី! ខ្ញុំជា AnaChakChat។ សូមបញ្ចូល API Key ដើម្បីចាប់ផ្តើម។\n\nHello! I am AnaChakChat. Please provide an API Key to get started. This is a demo view.',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'error',
                };
                setMessages([demoMessage]);
              }
            });
        }
    } catch (e) {
        console.error(e);
        setMessages([{
            type: 'ai',
            content: 'Error initializing the AI. Please check the API Key.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'error',
        }]);
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'km-KH';

    const stopAndClearTimer = () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    };

    const resetTimer = () => {
      stopAndClearTimer();
      autoStopTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 5000); // Auto-stop after 5 seconds of silence
    };

    recognition.onstart = () => {
      setIsListening(true);
      resetTimer(); // Start timer on recognition start
    };

    recognition.onend = () => {
      setIsListening(false);
      stopAndClearTimer(); // Cleanup timer on end
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      stopAndClearTimer();
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetTimer(); // Reset timer every time speech is detected
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setInputText(finalTranscriptRef.current + interimTranscript);
    };

    // Cleanup on component unmount
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        stopAndClearTimer();
    };
}, []);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  const addMessage = (message: Message) => {
    // A single function to add a message to state and DB
    setMessages(prev => [...prev, message]);
    if (message.status !== 'thinking') {
        saveMessageToDB(message);
    }
  };

  const updateLastMessage = (updatedMessage: Message) => {
    setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0) {
            newMessages[lastIndex] = updatedMessage;
        }
        return newMessages;
    });
    saveMessageToDB(updatedMessage);
  };
  
  const updateMemory = async (userInput: string, aiOutput: string) => {
    if (!user || !aiRef.current) return;

    const memoryPrompt = `Based on the following recent exchange, update the user's memory profile. Extract key facts, inferred user preferences, and provide a concise one-sentence summary of this specific interaction. Respond ONLY with a JSON object. "facts" and "preferences" should be arrays of strings. "summary" should be a single string. If no new facts or preferences are found, return empty arrays.\n\nUser said: "${userInput}"\nYou responded: "${aiOutput}"`;
    const memorySchema = {
        type: Type.OBJECT,
        properties: {
            facts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key facts mentioned by the user." },
            preferences: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Inferred user preferences (e.g., interests, communication style)." },
            summary: { type: Type.STRING, description: "A concise, one-sentence summary of the user's request and the AI's answer." }
        },
        required: ["facts", "preferences", "summary"]
    };

    try {
        const response = await aiRef.current.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: memoryPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: memorySchema,
            }
        });

        const newMemoryData = JSON.parse(response.text.trim());
        if (!newMemoryData.facts && !newMemoryData.preferences && !newMemoryData.summary) {
            console.log("No new memory to update.");
            return;
        }

        const existingMemory = await getMemoryFromDB(user.id) || { userId: user.id, facts: [], preferences: [], summary: '' };
        
        const updatedMemory: UserMemory = {
            userId: user.id,
            facts: [...new Set([...existingMemory.facts, ...(newMemoryData.facts || [])])],
            preferences: [...new Set([...existingMemory.preferences, ...(newMemoryData.preferences || [])])],
            summary: existingMemory.summary ? `${existingMemory.summary}\n- ${newMemoryData.summary}` : (newMemoryData.summary || '')
        };

        await saveMemoryToDB(updatedMemory);
        setUserMemory(updatedMemory);
        console.log("Memory updated successfully:", updatedMemory);
    } catch (error) {
        console.error("Failed to update memory:", error);
    }
};


  const sendMessage = async (text: string, attachmentData: typeof attachment) => {
    if ((!text.trim() && !attachmentData) || isGenerating || !isApiConfigured) return;
    
    setShowSendRipple(true);
    setTimeout(() => setShowSendRipple(false), 600);

    const userMessage: Message = {
      type: 'user',
      content: text,
      attachmentPreview: attachmentData ? { 
        type: attachmentData.type, 
        data: `data:${attachmentData.file.type};base64,${attachmentData.base64}`, 
        name: attachmentData.file.name 
      } : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'complete'
    };
    
    const thinkingMessage: Message = {
        type: 'ai',
        content: '',
        timestamp: '',
        status: 'thinking',
    };
    
    addMessage(userMessage);
    setMessages(prev => [...prev, thinkingMessage]);

    try {
        if (!aiRef.current) throw new Error("AI not initialized.");

        const history = messages.filter(m => m.status !== 'thinking').map(msg => {
            const parts: any[] = [];
            if (msg.attachmentPreview?.type === 'image' && msg.attachmentPreview.data) {
                const base64Data = msg.attachmentPreview.data.split(',')[1];
                const mimeType = msg.attachmentPreview.data.match(/data:(.*);base64,/)?.[1] || 'image/png';
                parts.push({ inlineData: { mimeType, data: base64Data } });
            }
            if (msg.content) {
                parts.push({ text: msg.content });
            }
            return { role: msg.type === 'user' ? 'user' : 'model', parts };
        });

        const currentUserParts: any[] = [];
        let promptText = text;

        if (attachmentData) {
            if (attachmentData.type === 'image') {
                currentUserParts.push({
                    inlineData: { mimeType: attachmentData.file.type, data: attachmentData.base64 }
                });
            } else if (attachmentData.type === 'pdf') {
                try {
                    const pdfText = await extractTextFromPdf(attachmentData.file);
                    promptText = `You are an AI assistant analyzing a PDF. The user uploaded "${attachmentData.file.name}". Your task is to answer the user's query based ONLY on the text extracted from this PDF. Do not use external knowledge or web search. If the answer cannot be found in the provided text, you must state that explicitly.\n\n--- PDF TEXT START ---\n${pdfText}\n--- PDF TEXT END ---\n\nUser's question: "${text || 'Please provide a concise summary of the document.'}"`;
                } catch (pdfError: any) {
                    console.error("PDF extraction failed:", pdfError);
                    
                    let failureReason = "An unknown error occurred while processing the PDF.";

                    if (pdfError && pdfError.message) {
                        const msg = pdfError.message.toLowerCase();
                        if (msg === 'pdf_lib_not_loaded') {
                            failureReason = "The PDF processing library couldn't be loaded. This can be due to a slow network connection or a network blocker (like a firewall or ad-blocker). Please check your connection, disable any blockers for this site, and refresh the page.";
                        } else if (msg.includes("could not extract any text")) {
                            failureReason = "I couldn't find any readable text in this PDF. It might be an image-only document or corrupted.";
                        } else if (msg.includes('worker')) {
                            failureReason = "The PDF processing component (worker) failed to load. This is usually a temporary network issue. Please try uploading the file again.";
                        } else if (msg.includes('invalid') || msg.includes('malformed')) {
                             failureReason = "The provided file appears to be an invalid or malformed PDF. Please try a different file.";
                        } else {
                            failureReason = pdfError.message; // Use the raw error for other cases
                        }
                    }

                    const errorMessage: Message = { type: 'ai', content: `Sorry, I couldn't process the PDF file "${attachmentData.file.name}".\n**Reason:** ${failureReason}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'error' };
                    updateLastMessage(errorMessage);
                    return;
                }
            } else if (attachmentData.type === 'audio') {
                currentUserParts.push({
                    inlineData: { mimeType: attachmentData.file.type, data: attachmentData.base64 }
                });
                promptText = text.trim() ? `First, please transcribe the attached audio file. Then, using that transcription, please follow this instruction: "${text}"` : "Please transcribe the attached audio file.";
            }
        } else {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (text.match(urlRegex)) {
                 promptText = `Please use your web search tool to access, read, and understand the content of the provided URL. After analyzing the content, answer my original question based on that information.\n\nMy message is: "${text}"`;
            }
        }
        
        if (promptText.trim()) {
            currentUserParts.push({ text: promptText });
        }
        
        if (currentUserParts.length === 0) {
             setMessages(prev => prev.slice(0, -2)); // Remove user and thinking message
             return;
        }
        
        let systemInstruction = 'You are an advanced AI assistant with expertise in Khmer language and culture. You can search the internet for up-to-date information. When you use web sources, you must cite them. Your name is AnaChakChat.';
        if (user && userMemory) {
            const memoryContext = `\n\n---
Here is a summary of your past conversations with this user. Use this information to personalize your responses and maintain context.
User Preferences: ${userMemory.preferences.join(', ') || 'None noted.'}
Key Facts: ${userMemory.facts.join(', ') || 'None noted.'}
Conversation History Summary:
${userMemory.summary || 'No summary available.'}
---`;
            systemInstruction += memoryContext;
        }

        const contentsForApi = [...history, { role: 'user', parts: currentUserParts }];
        
        const stream = await aiRef.current.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contentsForApi,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
                ...(!isThinkingEnabled && { thinkingConfig: { thinkingBudget: 0 } }),
            },
        });

        let fullResponse = '';
        let sources: any[] = [];
        for await (const chunk of stream) {
            fullResponse += chunk.text;
            if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                sources = chunk.candidates[0].groundingMetadata.groundingChunks;
            }
        }
        
        const aiResponseMessage: Message = {
            type: 'ai',
            content: fullResponse || "I'm not sure how to respond to that.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sources,
            status: 'complete',
        };

        updateLastMessage(aiResponseMessage);
        
        // After a successful response, update the memory
        if (user) {
            await updateMemory(userMessage.content, aiResponseMessage.content);
        }

    } catch (error) {
        console.error("Gemini API call failed", error);
        const errorMessage: Message = { type: 'ai', content: 'An error occurred. Please try again.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'error' };
        updateLastMessage(errorMessage);
    }
  };
  
  const handleSend = () => {
    sendMessage(inputText, attachment);
    setInputText('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text, null);
  };


  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(); 
    }
  };

  const clearChat = () => {
    setMessages([]);
    clearMessagesFromDB();
  };

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      recognitionRef.current.stop();
    } else {
      finalTranscriptRef.current = inputText ? (inputText.endsWith(' ') ? inputText : inputText + ' ') : '';
      recognitionRef.current.start();
    }
  }, [isListening, inputText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    let fileType: 'image' | 'pdf' | 'audio';
    if (f.type.startsWith('image/')) {
        fileType = 'image';
    } else if (f.type === 'application/pdf') {
        fileType = 'pdf';
    } else if (f.type.startsWith('audio/')) {
        fileType = 'audio';
    } else {
        console.warn("Unsupported file type:", f.type);
        return;
    }

    const r = new FileReader();
    r.onloadend = () => {
        setAttachment({ 
            file: f, 
            base64: (r.result as string).split(',')[1], 
            type: fileType 
        });
    };
    r.readAsDataURL(f);
  };

  const canSend = (inputText.trim() || attachment) && !isGenerating && isApiConfigured;

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans relative">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        user={user} 
        onSignIn={handleSignIn} 
        onSignOut={handleSignOut}
        onClearMemory={handleClearMemory} 
      />

      <header className="bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-lg shadow-sm p-2 sm:p-3 border-b border-divider-light dark:border-divider-dark relative z-10">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-text-light dark:text-text-dark" aria-label="Menu">
                <Menu className="w-6 h-6" />
            </button>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center animate-logo-pulse">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className={`absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 ${isApiConfigured ? 'bg-green-400' : 'bg-red-500'} shadow`}>
                {isApiConfigured && <Globe className="w-2 h-2 text-white" />}
              </div>
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-bold text-text-light dark:text-text-dark">
                AnaChakChat
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                Internet-Integrated • Culturally Aware
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {installPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-sm font-bold transition-colors transform hover:scale-105"
                aria-label="Install App"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}
            <button
                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-text-light dark:text-text-dark text-sm font-medium transition-colors transform hover:scale-105"
                aria-label={isThinkingEnabled ? 'Disable AI thinking' : 'Enable AI thinking'}
            >
                <Sparkles className={`w-4 h-4 transition-colors ${isThinkingEnabled ? 'text-primary' : 'text-gray-500'}`} />
                <span className="hidden sm:inline">{isThinkingEnabled ? 'Thinking On' : 'Thinking Off'}</span>
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-text-light dark:text-text-dark" aria-label="Toggle dark mode">
                <Moon className="w-5 h-5" />
            </button>
            <button onClick={clearChat} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-text-light dark:text-text-dark" aria-label="Clear chat">
                <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-0 flex flex-col">
        {messages.length === 0 && isApiConfigured ? (
          <div className="m-auto text-center px-4">
            <div className="relative mb-6 inline-block">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center relative ring-8 ring-white/50 dark:ring-background-dark/50 shadow-lg">
                  <Brain className="w-12 h-12 text-white" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-khmer text-text-light dark:text-text-dark animate-slide-in-up">
              សួស្តី តើមានអ្វីចង់ឲ្យខ្ញុំជួយដែរ?
            </h2>
             <div className="mt-8 flex flex-wrap justify-center gap-3 animate-slide-in-up" style={{ animationDelay: '200ms' }}>
                <button onClick={() => handleQuickReply('រកស៊ី')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-divider-light dark:border-divider-dark rounded-full text-sm font-semibold font-khmer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors transform hover:scale-105">រកស៊ី</button>
                <button onClick={() => handleQuickReply('សុខភាព')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-divider-light dark:border-divider-dark rounded-full text-sm font-semibold font-khmer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors transform hover:scale-105">សុខភាព</button>
                <button onClick={() => handleQuickReply('បកប្រែ')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-divider-light dark:border-divider-dark rounded-full text-sm font-semibold font-khmer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors transform hover:scale-105">បកប្រែ</button>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full">
            {messages.map((msg, idx) => {
              if (msg.status === 'thinking') {
                return (
                  <div key={idx} className="flex items-end gap-3 mb-6 justify-start">
                    <div className="flex-shrink-0 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-md ring-2 ring-primary/50">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 backdrop-blur-sm shadow-md border border-divider-light/50 dark:border-divider-dark/50 max-w-xs px-6 py-4 rounded-2xl rounded-bl-md">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium font-khmer">កំពុងគិត...</span>
                        <div className="flex space-x-1.5 items-center">
                          <div className="w-2 h-2 bg-primary rounded-full animate-dot-fade"></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-dot-fade"></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-dot-fade"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={idx} 
                  className={`flex items-end gap-3 mb-6 ${
                    msg.type === 'user' ? 'justify-end' : 'justify-start'
                  } animate-slide-in-up`}
                >
                  {msg.type === 'ai' && (
                    <div className="flex-shrink-0 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-md ring-2 ring-primary/50">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                  
                  <div className={`max-w-[90%] sm:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md leading-relaxed ${
                    msg.type === 'user' 
                      ? 'bg-user-bubble-light dark:bg-slate-700 text-text-light dark:text-text-dark rounded-br-md' 
                      : `bg-white dark:bg-slate-800 text-text-light dark:text-text-dark border border-divider-light/50 dark:border-divider-dark/50 rounded-bl-md ${msg.status === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' : ''}`
                  }`}>
                    
                    {msg.attachmentPreview && (
                      <div className="mb-2">
                        {msg.attachmentPreview.type === 'image' ? (
                          <img src={msg.attachmentPreview.data} alt="upload" className="max-w-full h-auto rounded-lg border shadow-sm dark:border-divider-dark" />
                        ) : (
                          <div className="flex items-center space-x-3 p-3 bg-indigo-100/50 dark:bg-indigo-900/50 rounded-lg">
                             {msg.attachmentPreview.type === 'pdf' ? <FileText className="w-6 h-6 text-indigo-700 dark:text-indigo-300 flex-shrink-0" /> : <FileAudio className="w-6 h-6 text-indigo-700 dark:text-indigo-300 flex-shrink-0" />}
                            <span className="text-sm text-text-light dark:text-text-dark truncate font-medium">{msg.attachmentPreview.name}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <MarkdownRenderer content={msg.content} />
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 border-t border-divider-light dark:border-divider-dark pt-3">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center space-x-1">
                          <Book className="w-3 h-3" />
                          <span>Sources:</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((s, i) => (
                            <a href={s.web.uri} key={i} target="_blank" rel="noreferrer" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors duration-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200">
                              {i + 1}. {s.web.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs opacity-60">{msg.timestamp}</p>
                      {msg.type === 'ai' && msg.status === 'complete' && <Feedback answerId={`${idx}-${msg.timestamp}`} contentToCopy={msg.content} />}
                    </div>
                  </div>
                  
                  {msg.type === 'user' && (
                    <div className="flex-shrink-0 mb-2">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md">
                        { user ? <img src={user.avatar} className="w-10 h-10 rounded-full" /> : <User className="w-5 h-5 text-white" /> }
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <footer className="bg-transparent p-4 sm:p-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          {attachment && (
            <div className="mb-3 relative w-max max-w-xs border border-primary/20 dark:border-primary/30 rounded-xl p-2 bg-white dark:bg-slate-800 shadow-lg">
              {attachment.type === 'image' ? (
                <img src={`data:${attachment.file.type};base64,${attachment.base64}`} alt="preview" className="w-28 h-28 object-cover rounded-lg" />
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-2 p-3 h-28 w-28">
                  {attachment.type === 'pdf' ? <FileText className="w-10 h-10 text-primary" /> : <FileAudio className="w-10 h-10 text-primary" />}
                  <span className="text-xs text-text-light dark:text-text-dark break-all font-medium leading-tight">{attachment.file.name}</span>
                </div>
              )}
              <button onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md" aria-label="Remove attachment">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="flex items-end space-x-3">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,audio/*" className="hidden" />
            
            <div className="flex-1 flex items-center p-2 rounded-full bg-white dark:bg-slate-800 shadow-md hover:shadow-lg transition-shadow duration-300 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-primary border border-divider-light/80 dark:border-divider-dark">
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isGenerating || !!attachment}
                    className="p-3 rounded-full text-gray-500 hover:text-primary hover:bg-primary/10 dark:text-gray-400 dark:hover:text-primary dark:hover:bg-primary/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-110"
                    aria-label="Attach file"
                >
                    <Paperclip className="w-5 h-5" />
                </button>

                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={attachment ? 'Ask about the file…' : 'សរសេរសារ...'}
                    className="flex-1 w-full bg-transparent px-2 py-2.5 focus:outline-none resize-none max-h-40 overflow-y-auto font-khmer font-medium placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    rows={1}
                    aria-label="Message input"
                />

                {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                    <button
                        onClick={toggleListening}
                        disabled={isGenerating}
                        className={`p-3 rounded-full transition-all duration-200 disabled:opacity-50 transform hover:scale-110 ${
                            isListening 
                                ? 'text-white bg-red-500 animate-pulse' 
                                : 'text-gray-500 hover:text-primary hover:bg-primary/10 dark:text-gray-400 dark:hover:text-primary dark:hover:bg-primary/20'
                        }`}
                        aria-label={isListening ? 'Stop listening' : 'Start listening'}
                    >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                )}
            </div>

            <button 
                onClick={handleSend} 
                disabled={!canSend} 
                className={`relative flex items-center justify-center w-14 h-14 shrink-0 rounded-full bg-primary text-white transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:bg-gray-400 disabled:scale-100 disabled:cursor-not-allowed ${canSend ? 'hover:bg-primary/90' : ''} ${showSendRipple ? 'animate-pulse' : ''}`} 
                aria-label="Send message"
            >
                <Send className="w-5 h-5" />
                {showSendRipple && <div className="absolute inset-0 rounded-full bg-white/30 animate-ping"></div>}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<AdvancedKhmerAI />);
