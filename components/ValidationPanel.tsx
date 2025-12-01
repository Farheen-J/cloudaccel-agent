
import React from 'react';
import { ValidationResult } from '../types';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ValidationPanelProps {
  validation: ValidationResult | null;
  onProceed: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ validation, onProceed, onCancel, isProcessing }) => {
  if (!validation) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0">
          <div className="flex items-center gap-3">
            {validation.isValid ? (
               <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center border border-green-800/50">
                  <CheckCircle size={16} className="text-green-500" />
               </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-amber-900/30 flex items-center justify-center border border-amber-800/50">
                   <AlertTriangle size={16} className="text-amber-500" />
                </div>
            )}
            <div>
                <h3 className="font-bold text-gray-200">
                    {validation.isValid ? 'Validation Passed' : 'Validation Issues Detected'}
                </h3>
                <p className="text-xs text-gray-500">
                    {validation.issues.length} issue(s) found in configuration.
                </p>
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 bg-gray-950/50 flex-1">
            {validation.issues.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <CheckCircle size={32} className="mx-auto mb-2 opacity-50 text-green-500"/>
                    <p>Configuration looks good!</p>
                </div>
            )}
            {validation.issues.map((issue, idx) => (
                <div key={idx} className={`p-3 rounded border flex items-start gap-3 ${issue.severity === 'error' ? 'bg-red-900/10 border-red-900/50' : 'bg-amber-900/10 border-amber-900/50'}`}>
                    {issue.severity === 'error' ? <XCircle size={16} className="text-red-500 mt-0.5 shrink-0"/> : <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0"/>}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-300 uppercase">{issue.service} / {issue.resource}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${issue.severity === 'error' ? 'border-red-800 text-red-400 bg-red-900/20' : 'border-amber-800 text-amber-400 bg-amber-900/20'}`}>
                                {issue.severity}
                            </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-1">{issue.message}</p>
                        {issue.suggestion && (
                            <p className="text-xs text-gray-500 italic">Suggestion: {issue.suggestion}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-900 sticky bottom-0">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            Go Back & Edit
          </button>
          <button 
            onClick={onProceed}
            disabled={isProcessing}
            className={`px-4 py-2 text-xs font-bold text-white rounded shadow-lg transition-colors flex items-center gap-2
                ${validation.isValid 
                    ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' 
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isProcessing ? 'Proceeding...' : validation.isValid ? 'Generate Plan' : 'Ignore & Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
};
