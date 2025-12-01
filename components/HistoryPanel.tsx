
import React from 'react';
import { HistoryEntry, ProjectConfig } from '../types';
import { History, RotateCcw, ArrowRight, Play, Edit3, Upload, Download } from 'lucide-react';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (config: ProjectConfig) => void;
  onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onRestore, onClose }) => {
  const getIcon = (action: HistoryEntry['action']) => {
      switch(action) {
          case 'generate': return <Play size={14} className="text-blue-400" />;
          case 'sync': return <Edit3 size={14} className="text-purple-400" />;
          case 'import': return <Upload size={14} className="text-green-400" />;
          case 'load': return <Download size={14} className="text-amber-400" />;
          default: return <History size={14} className="text-gray-400" />;
      }
  };

  const getLabel = (action: string) => {
      if (action === 'generate') return 'Generated Plan';
      if (action === 'sync') return 'Synced Design';
      if (action === 'import') return 'Imported Archive';
      if (action === 'load') return 'Loaded Sample';
      return action;
  };

  // Sort history newest first
  const sortedHistory = [...history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-end bg-gray-950/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div 
            className="h-full w-96 bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <History size={16} /> Project Timeline
                </h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {sortedHistory.length === 0 && (
                    <div className="text-center text-gray-500 italic py-8">No history yet.</div>
                )}
                {sortedHistory.map((entry, idx) => (
                    <div key={entry.id} className="relative pl-6 pb-2 group">
                        {/* Timeline Line */}
                        {idx !== sortedHistory.length - 1 && (
                            <div className="absolute top-3 left-[11px] bottom-[-24px] w-px bg-gray-800 group-hover:bg-gray-700 transition-colors"></div>
                        )}
                        
                        {/* Timeline Dot */}
                        <div className="absolute top-1 left-0 w-6 h-6 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center z-10 group-hover:border-blue-500 transition-colors">
                            {getIcon(entry.action)}
                        </div>

                        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:border-blue-500/50 transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-gray-300">{getLabel(entry.action)}</span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-3 leading-relaxed">{entry.message}</p>
                            
                            <button 
                                onClick={() => {
                                    onRestore(entry.configSnapshot);
                                    onClose();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded text-xs text-blue-400 font-medium transition-colors"
                            >
                                <RotateCcw size={12} /> Restore Snapshot
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {/* Click outside to close */}
        <div className="absolute inset-0 z-[-1]" onClick={onClose}></div>
    </div>
  );
};
