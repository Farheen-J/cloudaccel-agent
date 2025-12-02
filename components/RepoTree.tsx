
import React, { useState } from 'react';
import { GeneratedFile, QualityReport } from '../types';
import { Folder, Code, Box, Terminal, FileCode, Book, Shield, Award, ChevronDown, ChevronUp } from 'lucide-react';

interface RepoTreeProps {
  files: GeneratedFile[];
  onSelectFile: (file: GeneratedFile) => void;
  selectedFile: GeneratedFile | null;
  qualityReport?: QualityReport; // NEW prop
}

export const RepoTree: React.FC<RepoTreeProps> = ({ files, onSelectFile, selectedFile, qualityReport }) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const [showQualityDetails, setShowQualityDetails] = useState(false);

  const getIcon = (file: GeneratedFile) => {
      if (file.path.endsWith('SECURITY_AUDIT.md')) return <Shield size={14} className="text-red-400" />;
      if (file.path.endsWith('README.md')) return <Book size={14} className="text-amber-400" />;
      if (file.path.endsWith('QUALITY_REPORT.md')) return <Award size={14} className="text-purple-400" />;

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

  const getGradeColor = (grade: string) => {
      if (grade === 'A') return 'text-green-400 bg-green-900/20 border-green-800';
      if (grade === 'B') return 'text-blue-400 bg-blue-900/20 border-blue-800';
      if (grade === 'C') return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      return 'text-red-400 bg-red-900/20 border-red-800';
  };

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {/* Quality Badge */}
      {qualityReport && (
          <div className="mb-4 mx-2 rounded bg-gray-950 border border-gray-800 shadow-inner overflow-hidden">
              <div 
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-900/50 transition-colors"
                onClick={() => setShowQualityDetails(!showQualityDetails)}
              >
                  <div className="flex flex-col">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Quality Score</span>
                      <div className="flex items-center gap-2">
                          <Award size={16} className={getGradeColor(qualityReport.grade).split(' ')[0]} />
                          <span className="text-lg font-bold text-white">{qualityReport.score}/100</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded border text-xs font-bold ${getGradeColor(qualityReport.grade)}`}>
                        Grade {qualityReport.grade}
                    </div>
                    {showQualityDetails ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
                  </div>
              </div>
              
              {showQualityDetails && (
                  <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 duration-200">
                      <div className="h-px bg-gray-800 mb-2"></div>
                      <p className="text-xs text-blue-300 leading-relaxed italic flex items-center gap-1.5">
                          <Award size={12}/> Detailed analysis available in 
                          <button 
                            className="underline hover:text-white"
                            onClick={(e) => {
                                e.stopPropagation();
                                const reportFile = files.find(f => f.path.endsWith('QUALITY_REPORT.md'));
                                if(reportFile) onSelectFile(reportFile);
                            }}
                          >
                              QUALITY_REPORT.md
                          </button>
                      </p>
                  </div>
              )}
          </div>
      )}

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
