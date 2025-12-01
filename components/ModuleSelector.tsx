
import React, { useState, useEffect } from 'react';
import { ModuleManifest, ModuleVersion } from '../types';
import { Package, CheckCircle2, Edit2, Loader2, ExternalLink } from 'lucide-react';

interface ModuleSelectorProps {
  manifest: ModuleManifest;
  isProcessing: boolean;
  onConfirm: (updatedManifest: ModuleManifest) => void;
  onCancel: () => void;
}

export const ModuleSelector: React.FC<ModuleSelectorProps> = ({ manifest, isProcessing, onConfirm, onCancel }) => {
  const [localManifest, setLocalManifest] = useState<ModuleManifest>([]);

  useEffect(() => {
    setLocalManifest(JSON.parse(JSON.stringify(manifest)));
  }, [manifest]);

  const updateModule = (index: number, field: keyof ModuleVersion, value: string) => {
    const updated = [...localManifest];
    updated[index] = { ...updated[index], [field]: value };
    setLocalManifest(updated);
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-900/30 flex items-center justify-center border border-purple-800/50">
               <Package size={16} className="text-purple-400" />
            </div>
            <div>
                <h3 className="font-bold text-gray-200">
                    Community Module Selection
                </h3>
                <p className="text-xs text-gray-500">
                    Review or override the versions detected by the Librarian Agent.
                </p>
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 bg-gray-950/50 flex-1">
            <table className="w-full text-left text-xs text-gray-400">
                <thead className="text-[10px] uppercase font-bold text-gray-500 bg-gray-900/50">
                    <tr>
                        <th className="px-3 py-2">Service</th>
                        <th className="px-3 py-2">Module Source</th>
                        <th className="px-3 py-2">Version</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {localManifest.map((mod, idx) => (
                        <tr key={idx} className="group hover:bg-gray-900/30 transition-colors">
                            <td className="px-3 py-3 font-medium text-gray-200">{mod.service}</td>
                            <td className="px-3 py-3">
                                <input 
                                    type="text" 
                                    value={mod.source}
                                    onChange={(e) => updateModule(idx, 'source', e.target.value)}
                                    className="bg-transparent border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 w-full outline-none transition-colors"
                                />
                            </td>
                            <td className="px-3 py-3">
                                <input 
                                    type="text" 
                                    value={mod.version}
                                    onChange={(e) => updateModule(idx, 'version', e.target.value)}
                                    className="bg-transparent border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 w-24 outline-none transition-colors font-mono text-blue-300"
                                />
                            </td>
                            <td className="px-3 py-3 text-right">
                                <a 
                                    href={`https://registry.terraform.io/modules/${mod.source}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-400 transition-colors"
                                    title="View on Registry"
                                >
                                    <ExternalLink size={12}/>
                                </a>
                            </td>
                        </tr>
                    ))}
                    {localManifest.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-gray-600 italic">
                                No specific community modules detected for the current services.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-900 sticky bottom-0">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(localManifest)}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded shadow-lg shadow-blue-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
            Confirm & Generate Code
          </button>
        </div>
      </div>
    </div>
  );
};
