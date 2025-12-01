
import React, { useState } from 'react';
import { GitCommit, Loader2 } from 'lucide-react';

interface SyncModalProps {
  onConfirm: (message: string) => void;
  onCancel: () => void;
  isSyncing: boolean;
}

export const SyncModal: React.FC<SyncModalProps> = ({ onConfirm, onCancel, isSyncing }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
        onConfirm(message);
    }
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-md w-full p-5 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <GitCommit size={20} className="text-purple-400"/> Sync Code to Design
            </h3>
            <p className="text-sm text-gray-400 mb-4">
                This will update your JSON configuration to match the changes made in the code. Please provide a commit message for the history.
            </p>
            
            <form onSubmit={handleSubmit}>
                <input 
                    type="text"
                    autoFocus
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Updated instance type to t3.large"
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-purple-500 outline-none mb-4"
                />
                
                <div className="flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={onCancel}
                        disabled={isSyncing}
                        className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={isSyncing || !message.trim()}
                        className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded shadow-lg shadow-purple-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />}
                        Sync Changes
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};
