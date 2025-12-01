import React, { useState } from 'react';
import { Key, Lock, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  isOpen: boolean;
  onClose?: () => void; // Optional if non-blocking
  isBlocking?: boolean;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, isOpen, onClose, isBlocking = true }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim().startsWith('AIza')) {
        setError("Invalid API Key format. It should start with 'AIza'.");
        return;
    }
    onSave(key.trim());
    if (onClose) onClose();
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-gray-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="p-6 text-center border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-900/50">
          <div className="w-16 h-16 rounded-full bg-blue-900/20 flex items-center justify-center border border-blue-500/30 mx-auto mb-4 shadow-lg shadow-blue-900/20">
             <Key size={32} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Welcome to CloudAccel</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
             To activate the AI Agents, please enter your Google Gemini API Key.
          </p>
        </div>

        <div className="p-6 bg-gray-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Gemini API Key
                </label>
                <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-gray-600" />
                    <input 
                        type="password" 
                        value={key}
                        onChange={(e) => { setKey(e.target.value); setError(null); }}
                        placeholder="AIzaSy..."
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        autoFocus
                    />
                </div>
                {error && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
                        <AlertCircle size={12} /> {error}
                    </div>
                )}
            </div>

            <div className="bg-blue-900/10 border border-blue-900/30 rounded-lg p-3 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200/70 leading-relaxed">
                    Your key is stored locally in your browser (localStorage) and is never sent to our servers.
                </p>
            </div>

            <button 
                type="submit"
                disabled={!key}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                Connect Agents
            </button>
          </form>

          <div className="mt-6 text-center">
             <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-400 transition-colors"
             >
                Get a free API Key from Google AI Studio <ExternalLink size={10} />
             </a>
          </div>
        </div>
        
        {!isBlocking && onClose && (
             <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-400">
                 &times;
             </button>
        )}
      </div>
    </div>
  );
};