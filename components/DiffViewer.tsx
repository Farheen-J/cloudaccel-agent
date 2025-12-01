
import React, { useMemo } from 'react';

interface DiffViewerProps {
  original: string;
  modified: string;
}

// Simple diff logic to show added/removed lines
const computeDiff = (text1: string, text2: string) => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  const result: { type: 'same' | 'added' | 'removed', content: string, lineNum?: number }[] = [];
  
  // A naive LCS-based approach or just line-by-line comparison is complex without a lib.
  // We'll use a simplified block matching approach for visualization.
  
  let i = 0;
  let j = 0;

  while (i < lines1.length || j < lines2.length) {
      if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
          result.push({ type: 'same', content: lines1[i], lineNum: i + 1 });
          i++;
          j++;
      } else if (j < lines2.length && (!lines1[i] || lines2[j] !== lines1[i])) {
          // Check lookahead
          let k = 1;
          let found = false;
          // Look ahead in original to see if this modified line matches later
          // This is expensive but okay for small files.
          // Optimization: Simple fallback -> treat as add/remove
          
          if (lines1.includes(lines2[j], i)) {
              // Line 2 exists later in original -> So current original line was removed
              result.push({ type: 'removed', content: lines1[i] });
              i++;
          } else {
              // Line 2 is new
              result.push({ type: 'added', content: lines2[j] });
              j++;
          }
      } else if (i < lines1.length) {
          result.push({ type: 'removed', content: lines1[i] });
          i++;
      }
  }

  return result;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified }) => {
  const diffs = useMemo(() => computeDiff(original || '', modified || ''), [original, modified]);

  return (
    <div className="flex-1 bg-gray-950 overflow-auto font-mono text-xs">
      {diffs.map((line, idx) => (
        <div key={idx} className={`flex ${line.type === 'added' ? 'bg-green-900/20' : line.type === 'removed' ? 'bg-red-900/20' : ''}`}>
           <div className="w-10 shrink-0 text-gray-600 text-right pr-2 select-none border-r border-gray-800 bg-gray-900/50">
               {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : line.lineNum}
           </div>
           <div className={`flex-1 pl-2 whitespace-pre-wrap break-all ${line.type === 'added' ? 'text-green-300' : line.type === 'removed' ? 'text-red-300' : 'text-gray-400'}`}>
               {line.content || ' '} 
           </div>
        </div>
      ))}
      {diffs.length === 0 && <div className="p-4 text-gray-500 italic">No content.</div>}
    </div>
  );
};
