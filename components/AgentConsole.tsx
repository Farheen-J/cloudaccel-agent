import React, { useEffect, useRef } from 'react';
import { AgentLogStep } from '../types';
import { Terminal, CheckCircle2, Loader2, AlertCircle, ShieldCheck, PenTool, Layout, Bug, Hash } from 'lucide-react';

interface AgentConsoleProps {
  logs: AgentLogStep[];
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({ logs, debugMode, setDebugMode, onMouseDown }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Correct Filter Logic: 
  // If debugMode is ON, show ALL logs (info + debug).
  // If debugMode is OFF, show ONLY info logs.
  const visibleLogs = logs.filter(log => debugMode || log.level !== 'debug');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, debugMode]);

  const getAgentIcon = (agent: string) => {
    switch(agent) {
        case 'Architect': return <Layout size={14} className="text-blue-400" />;
        case 'Auditor': return <ShieldCheck size={14} className="text-green-400" />;
        case 'Writer': return <PenTool size={14} className="text-purple-400" />;
        default: return <Terminal size={14} className="text-gray-400" />;
    }
  };

  const currentRunId = logs.length > 0 ? logs[logs.length - 1].runId : null;

  return (
    <div className="flex flex-col h-full bg-gray-950 border-t border-gray-800 font-mono text-xs relative">
        {/* Resize Handle */}
        <div 
            className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/50 z-10 transition-colors"
            onMouseDown={onMouseDown}
        />

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
                <Terminal size={14} className="text-blue-500" />
                <span className="font-semibold text-gray-300">Agent Observability Console</span>
            </div>

            <div className="ml-auto flex items-center gap-4">
                {currentRunId && (
                    <div className="flex items-center gap-1.5 text-[10px] bg-blue-900/20 text-blue-400 border border-blue-900/50 px-2 py-0.5 rounded font-mono select-all" title="Unique Session Trace ID">
                        <Hash size={10} /> 
                        <span className="font-bold opacity-70">TRACE:</span>
                        {currentRunId}
                    </div>
                )}
                
                <span className="text-[10px] text-gray-600 bg-gray-950 px-2 py-0.5 rounded border border-gray-800">
                    {visibleLogs.length} Events
                </span>
                
                <div className="h-4 w-px bg-gray-700"></div>
                
                <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white select-none">
                    <span className="text-[10px] font-medium">DEBUG MODE</span>
                    <div className={`relative w-8 h-4 rounded-full transition-colors ${debugMode ? 'bg-blue-600' : 'bg-gray-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${debugMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={debugMode} 
                        onChange={(e) => setDebugMode(e.target.checked)} 
                    />
                </label>
            </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {visibleLogs.length === 0 && (
                <div className="text-gray-600 italic text-center mt-4">
                    {logs.length > 0 ? "Debug logs hidden. Enable Debug Mode." : "Waiting for agent tasks..."}
                </div>
            )}
            {visibleLogs.map((log) => (
                <div key={`${log.id}-${log.timestamp.getTime()}`} className={`flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 ${log.level === 'debug' ? 'opacity-60 hover:opacity-100' : ''}`}>
                    <div className="w-16 shrink-0 text-gray-500 text-[10px] text-right pt-0.5 font-mono">
                        {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                             <span className={`px-1.5 py-0.5 rounded text-[10px] border font-bold uppercase w-20 flex items-center justify-center gap-1
                                ${log.level === 'debug' ? 'bg-gray-900 text-gray-500 border-gray-800' : 'bg-gray-800 text-gray-300 border-gray-700'}
                             `}>
                                {getAgentIcon(log.agent)} {log.agent}
                             </span>
                             {log.status === 'running' && <Loader2 size={12} className="animate-spin text-blue-500" />}
                             {log.status === 'completed' && <CheckCircle2 size={12} className="text-green-500" />}
                             {log.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
                             {log.level === 'debug' && <Bug size={10} className="text-gray-600" />}
                        </div>
                        <p className={`pl-1 whitespace-pre-wrap break-all ${log.status === 'running' ? 'text-blue-200' : log.level === 'debug' ? 'text-gray-500' : 'text-gray-400'}`}>
                            {log.message}
                        </p>
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    </div>
  );
};