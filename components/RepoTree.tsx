
import React from 'react';
import { GeneratedFile } from '../types';
import { Folder, Code, Box, Terminal, FileCode, Book, Shield, AlertCircle } from 'lucide-react';

interface RepoTreeProps {
  files: GeneratedFile[];
  onSelectFile: (file: GeneratedFile) => void;
  selectedFile: GeneratedFile | null;
}

export const RepoTree: React.FC<RepoTreeProps> = ({ files, onSelectFile, selectedFile }) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  const getIcon = (file: GeneratedFile) => {
      if (file.path.endsWith('SECURITY_AUDIT.md')) return <Shield size={14} className="text-red-400" />;
      if (file.path.endsWith('README.md')) return <Book size={14} className="text-amber-400" />;

      switch(file.type) {
          case 'module': return <Box size={14} className="text-blue-400" />;
          case 'ecosystem': return <Folder size={14} className="text-green-400" />;
          case 'deployment': return <Code size={14} className="text-purple-400" />;
          case 'script': return <Terminal size={14} className="text-pink-400" />;
          case 'doc': return <Book size={14} className="text-gray-400" />;
          default: return <FileCode size={14} className="text-gray-400" />;
      }
  };

  const isModified = (file: GeneratedFile) => {
      return file.originalContent !== undefined && file.content !== file.originalContent;
  };

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider px-2 flex justify-between items-center">
        Generated Structure
        <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{files.length} Files</span>
      </h3>
      <div className="space-y-0.5">
        {sortedFiles.map((file) => {
            const modified = isModified(file);
            return (
              <button
                key={file.path}
                onClick={() => onSelectFile(file)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono transition-colors text-left group relative
                  ${selectedFile?.path === file.path 
                    ? 'bg-blue-900/30 text-blue-200 border border-blue-800/50' 
                    : 'text-gray-400 hover:bg-gray-800/50 border border-transparent'}`}
              >
                <div className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">{getIcon(file)}</div>
                <span className="truncate whitespace-nowrap direction-rtl flex-1" title={file.path}>
                    {file.path.split('/').pop()} 
                    <span className="text-gray-600 ml-2 text-[10px]">{file.path.substring(0, file.path.lastIndexOf('/'))}</span>
                </span>
                {modified && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Modified by user"></div>}
              </button>
            );
        })}
      </div>
    </div>
  );
};
