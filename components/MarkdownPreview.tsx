import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  if (!content) return <div className="p-8 text-gray-500 italic">No content to preview.</div>;

  const renderContent = () => {
    // Basic Markdown Parser for Headers, Lists, Code Blocks
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let listBuffer: React.ReactNode[] = [];
    
    const flushList = () => {
        if (listBuffer.length > 0) {
            elements.push(
                <ul key={`list-${elements.length}`} className="list-none space-y-1 mb-4 ml-2">
                    {listBuffer}
                </ul>
            );
            listBuffer = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Code Blocks
        if (trimmed.startsWith('```')) {
            flushList();
            if (inCodeBlock) {
                elements.push(
                    <div key={`code-${i}`} className="bg-gray-900 rounded-md p-4 my-4 border border-gray-800 overflow-x-auto shadow-inner">
                        <pre className="font-mono text-xs text-blue-300 leading-relaxed">{codeBuffer.join('\n')}</pre>
                    </div>
                );
                codeBuffer = [];
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            continue;
        }

        // Headers
        if (line.startsWith('# ')) {
            flushList();
            elements.push(<h1 key={i} className="text-3xl font-bold text-white mb-6 mt-8 pb-3 border-b border-gray-800 flex items-center gap-2"><FileText size={24} className="text-blue-500"/> {line.substring(2)}</h1>);
            continue;
        }
        if (line.startsWith('## ')) {
             flushList();
             elements.push(<h2 key={i} className="text-xl font-semibold text-blue-200 mb-3 mt-6 border-b border-gray-800/50 pb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-green-500"/> {line.substring(3)}</h2>);
             continue;
        }
        if (line.startsWith('### ')) {
             flushList();
             elements.push(<h3 key={i} className="text-lg font-medium text-blue-100 mb-2 mt-4">{line.substring(4)}</h3>);
             continue;
        }

        // Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const text = trimmed.substring(2);
            // Check for bold prefixes like **Critical**:
            const isCritical = text.toLowerCase().includes('critical');
            
            listBuffer.push(
                <li key={`li-${i}`} className="flex gap-2 items-start">
                    <span className={`mt-1.5 text-[10px] ${isCritical ? 'text-red-500' : 'text-blue-500'}`}>•</span>
                    <span className="text-gray-300 text-sm">{processInlineFormatting(text)}</span>
                </li>
            );
            continue;
        }
        
        flushList();

        if (trimmed === '') {
            elements.push(<div key={i} className="h-2"></div>);
            continue;
        }

        elements.push(<p key={i} className="text-sm text-gray-300 leading-relaxed mb-2">{processInlineFormatting(line)}</p>);
    }
    
    flushList();
    return elements;
  };

  const processInlineFormatting = (text: string): React.ReactNode => {
      const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
      return parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={idx} className="font-bold text-white">{part.substring(2, part.length-2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={idx} className="bg-gray-800 text-blue-300 px-1 py-0.5 rounded text-xs font-mono">{part.substring(1, part.length-1)}</code>;
          }
          return part;
      });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-8">
      <div className="max-w-3xl mx-auto">
        {renderContent()}
      </div>
    </div>
  );
};