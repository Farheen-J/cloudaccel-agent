
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Terminal, 
  Network, 
  Layers, 
  FileJson, 
  AlertCircle,
  Cpu,
  RefreshCw,
  LayoutTemplate,
  Code2,
  Save,
  Download,
  Upload,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  FileText,
  Eye,
  GitCompare,
  FileDiff,
  History,
  Settings
} from 'lucide-react';
import JSZip from 'jszip';

import { ProjectConfig, AgentPlan, GeneratedFile, AgentLogStep, ValidationResult, ModuleManifest, HistoryEntry } from './types';
import { SAMPLE_INPUT_NEW, SAMPLE_INPUT_EXISTING } from './constants';
import { analyzeAndGeneratePlan, validateConfiguration, syncDesignFromCode, generateModuleManifest } from './services/geminiService';
import { DependencyGraph } from './components/DependencyGraph';
import { ResourceEditor } from './components/ResourceEditor';
import { RepoTree } from './components/RepoTree';
import { ArchitectureGraph } from './components/ArchitectureGraph';
import { AgentConsole } from './components/AgentConsole';
import { MarkdownPreview } from './components/MarkdownPreview';
import { ValidationPanel } from './components/ValidationPanel';
import { DiffViewer } from './components/DiffViewer';
import { ModuleSelector } from './components/ModuleSelector';
import { HistoryPanel } from './components/HistoryPanel';
import { SyncModal } from './components/SyncModal';
import { ApiKeyModal } from './components/ApiKeyModal';

enum Tab {
  INPUT = 'input',
  DEPENDENCY = 'dependency',
  REPO = 'repo'
}

const EMPTY_PROJECT: ProjectConfig = {
  use_case: 'new',
  project_name: 'my-new-project',
  terraform_version: '1.5.0',
  modules_repo: './output/modules',
  ecosystem_repo: './output/ecosystem',
  deployments_repo: './output/deployments',
  services: []
};

// --- Confirmation Modal Component ---
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-900/30 flex items-center justify-center border border-amber-800/50">
             <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <h3 className="font-bold text-gray-200">{title}</h3>
        </div>
        <div className="p-5">
          <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="p-4 bg-gray-950/50 border-t border-gray-800 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded shadow-lg shadow-red-900/20 transition-colors"
          >
            Confirm & Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [jsonInput, setJsonInput] = useState<string>(JSON.stringify(SAMPLE_INPUT_NEW, null, 2));
  const [parsedConfig, setParsedConfig] = useState<ProjectConfig | null>(SAMPLE_INPUT_NEW);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INPUT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Validation State
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Module Selection State
  const [moduleManifest, setModuleManifest] = useState<ModuleManifest | null>(null);
  const [showModuleSelector, setShowModuleSelector] = useState(false);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Observability State
  const [agentLogs, setAgentLogs] = useState<AgentLogStep[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null); // Track session
  const [consoleExpanded, setConsoleExpanded] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(200); 
  const [isResizingConsole, setIsResizingConsole] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Editable Code State
  const [editedContent, setEditedContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  // Repo View State
  const [repoViewMode, setRepoViewMode] = useState<'code' | 'arch' | 'preview' | 'diff'>('code');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  
  // Confirmation State
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Effects ---
  useEffect(() => {
    // Check for API Key on mount
    const stored = localStorage.getItem('gemini_api_key');
    const envKey = process.env.API_KEY;
    
    if (stored) setApiKey(stored);
    else if (envKey) setApiKey(envKey);
    else setShowApiKeyModal(true);
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      setParsedConfig(parsed);
      setError(null);
    } catch (e) {
      // Allow invalid JSON while typing
    }
  }, [jsonInput]);

  useEffect(() => {
    if (selectedFile) {
        setEditedContent(formatContent(selectedFile));
        setIsDirty(false);
        // Reset to code view if switching file (unless it was preview)
        if (repoViewMode === 'diff') setRepoViewMode('code');
    } else {
        setEditedContent('');
    }
  }, [selectedFile]);

  // Sidebar Resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.max(200, Math.min(e.clientX, 600));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = 'default';
    };
    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  // Console Resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingConsole) return;
      const newHeight = Math.max(100, Math.min(window.innerHeight - e.clientY, window.innerHeight - 100));
      setConsoleHeight(newHeight);
    };
    const handleMouseUp = () => {
      setIsResizingConsole(false);
      document.body.style.cursor = 'default';
    };
    if (isResizingConsole) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingConsole]);

  useEffect(() => {
    if (pendingFile && !modalConfig) {
      processZipImport(pendingFile);
      setPendingFile(null);
    }
  }, [pendingFile, modalConfig]);


  // --- Helper Methods ---
  const handleSaveApiKey = (key: string) => {
      localStorage.setItem('gemini_api_key', key);
      setApiKey(key);
      setShowApiKeyModal(false);
  };
  
  const generateRunId = () => Date.now().toString(36).toUpperCase();

  const addToHistory = (action: HistoryEntry['action'], message: string, config: ProjectConfig) => {
      const entry: HistoryEntry = {
          id: Date.now().toString(),
          timestamp: new Date(),
          action,
          message,
          configSnapshot: JSON.parse(JSON.stringify(config)) // Deep copy
      };
      setHistory(prev => [entry, ...prev]);
  };

  const handleActionWithConfirmation = (actionName: string, message: string, action: () => void) => {
    const hasWork = plan !== null || (parsedConfig !== null && parsedConfig.services.length > 0 && JSON.stringify(parsedConfig) !== JSON.stringify(EMPTY_PROJECT));
    
    if (hasWork) {
      setModalConfig({
        isOpen: true,
        title: actionName,
        message: message,
        onConfirm: () => {
          setModalConfig(null);
          action();
        }
      });
    } else {
      action();
    }
  };

  const loadSample = (type: 'new' | 'existing') => {
    handleActionWithConfirmation(
      "Overwrite Workspace?",
      `Loading the ${type} infrastructure sample will discard your current configuration and generated code.`,
      () => {
        const data = type === 'new' ? SAMPLE_INPUT_NEW : SAMPLE_INPUT_EXISTING;
        const jsonStr = JSON.stringify(data, null, 2);
        setJsonInput(jsonStr);
        setParsedConfig(data);
        setPlan(null);
        setSelectedFile(null);
        setAgentLogs([]);
        setActiveTab(Tab.INPUT);
        addToHistory('load', `Loaded ${type} sample`, data);
      }
    );
  };

  const handleReset = () => {
    handleActionWithConfirmation(
      "Clear Workspace?",
      "This will permanently delete your current project configuration and all generated files.",
      () => {
        setJsonInput(JSON.stringify(EMPTY_PROJECT, null, 2));
        setParsedConfig(EMPTY_PROJECT);
        setPlan(null);
        setSelectedFile(null);
        setActiveTab(Tab.INPUT);
        setError(null);
        setEditedContent('');
        setIsDirty(false);
        setRepoViewMode('code');
        setAgentLogs([]);
        addToHistory('load', 'Cleared workspace', EMPTY_PROJECT);
      }
    );
  };

  const handleConfigUpdate = (newConfig: ProjectConfig) => {
    setParsedConfig(newConfig);
    setJsonInput(JSON.stringify(newConfig, null, 2));
    if (plan) setPlan(null);
  };

  const handleFileUpdate = (path: string, content: string, isFullUpdate = false) => {
      setPlan(prev => {
          if (!prev) return prev;
          const newFiles = [...prev.files];
          const index = newFiles.findIndex(f => f.path === path);
          
          if (index !== -1) {
              if (isFullUpdate) {
                  newFiles[index] = { ...newFiles[index], content: content };
              } else {
                  newFiles[index] = { ...newFiles[index], content: (newFiles[index].content || '') + content };
              }
              // If originalContent is empty (first stream), set it
              if (!newFiles[index].originalContent) {
                  newFiles[index].originalContent = newFiles[index].content;
              }
              return { ...prev, files: newFiles };
          } else {
              const type = path.endsWith('.md') ? 'doc' : 'module'; 
              newFiles.push({ 
                  path, 
                  content, 
                  originalContent: content, 
                  type: type as any 
              });
              return { ...prev, files: newFiles };
          }
      });

      setSelectedFile(prev => {
          if (!prev) {
               const type = path.endsWith('.md') ? 'doc' : 'module'; 
              return { path, content, originalContent: content, type: type as any };
          }
          return prev;
      });
  };

  // --- 1. VALIDATION PHASE ---
  const handlePreFlightCheck = async () => {
      if (!apiKey) {
          setShowApiKeyModal(true);
          return;
      }
      if (isValidating || isAnalyzing) return;
      if (!parsedConfig) {
          setError("Invalid JSON Input");
          return;
      }
      
      setIsValidating(true);
      setError(null);
      
      try {
        const result = await validateConfiguration(parsedConfig);
        setValidationResult(result);
      } catch (e: any) {
          setError("Validation failed: " + e.message);
      } finally {
          setIsValidating(false);
      }
  };

  // --- 2. MODULE DETECTION (If Community Modules) ---
  const handleModuleDetection = async () => {
      setValidationResult(null); // Close validation panel

      if (parsedConfig?.use_community_modules) {
          const runId = generateRunId(); // New session
          setCurrentRunId(runId);
          
          setIsAnalyzing(true); 
          setConsoleExpanded(true);
          // Clear logs for new major action
          setAgentLogs([]); 
          
          setAgentLogs(prev => [...prev, {
             id: Date.now(), runId, agent: 'Librarian', status: 'running', timestamp: new Date(), level: 'info', message: 'Scanning registry for latest module versions...'
          }]);
          
          try {
              const manifest = await generateModuleManifest(parsedConfig);
              setModuleManifest(manifest);
              setAgentLogs(prev => [...prev, {
                 id: Date.now(), runId, agent: 'Librarian', status: 'completed', timestamp: new Date(), level: 'info', message: `Found ${manifest.length} recommended modules.`
              }]);
              setShowModuleSelector(true);
              setIsAnalyzing(false); // Pause for user input
          } catch (e: any) {
              console.error("Librarian failed", e);
              // Fallback: Proceed without specific manifest
              handleGenerate(null); 
          }
      } else {
          handleGenerate(null);
      }
  };

  // --- 3. GENERATION PHASE ---
  const handleGenerate = async (manifest: ModuleManifest | null) => {
    if (isAnalyzing) return;
    if (!parsedConfig) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Use existing runId if coming from Librarian, else new one
    const runId = currentRunId || generateRunId();
    if (!currentRunId) {
        setCurrentRunId(runId);
        setAgentLogs([]); // Clear logs if new run
    }

    setIsAnalyzing(true);
    setShowModuleSelector(false); // Close modal
    setError(null);
    setPlan(null);
    setSelectedFile(null);
    
    setConsoleExpanded(true);
    
    try {
      setActiveTab(Tab.DEPENDENCY);
      
      const generatedPlan = await analyzeAndGeneratePlan(
          parsedConfig!, 
          manifest,
          runId,
          (log) => {
            setAgentLogs(prev => {
                // Ensure we only update/append logs for the current runId
                if (log.runId !== runId) return prev;
                
                const existingIndex = prev.findIndex(p => p.id === log.id);
                if (existingIndex !== -1) {
                    const newLogs = [...prev];
                    newLogs[existingIndex] = log;
                    return newLogs;
                }
                return [...prev, log];
            });
          },
          (path, partial) => {
              handleFileUpdate(path, partial, false);
          },
          controller.signal
      );

      setPlan(generatedPlan); 
      addToHistory('generate', `Generated ${generatedPlan.files.length} files`, parsedConfig);
      
      if (generatedPlan.files.length > 0) {
        const readme = generatedPlan.files.find(f => f.path.endsWith('README.md'));
        const security = generatedPlan.files.find(f => f.path.endsWith('SECURITY_AUDIT.md'));
        const first = generatedPlan.files[0];
        const fileToShow = readme || security || first;
        
        setSelectedFile(fileToShow);
        if (fileToShow.path.endsWith('.md')) setRepoViewMode('preview');
        else setRepoViewMode('code');
      }
      
      setActiveTab(Tab.REPO);
      
    } catch (e: any) {
      if (e.message === "Operation cancelled" || e.name === 'AbortError') {
          setAgentLogs(prev => [...prev, {
              id: 9999, runId, agent: 'Orchestrator', status: 'error', timestamp: new Date(), message: `Operation cancelled.`, level: 'info'
          }]);
      } else {
          setError("Analysis Failed. " + (e.message || "Please check your API Key."));
          setAgentLogs(prev => [...prev, {
              id: 999, runId, agent: 'Orchestrator', status: 'error', timestamp: new Date(), message: `Error: ${e.message}`, level: 'info'
          }]);
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          if (currentRunId) {
            setAgentLogs(prev => [...prev, {
                id: 9998, runId: currentRunId, agent: 'Orchestrator', status: 'error', timestamp: new Date(), message: `Stopping generation...`, level: 'info'
            }]);
          }
      }
      setIsAnalyzing(false);
  };

  // --- SYNC TO DESIGN ---
  const handleSyncClick = () => {
      if (!parsedConfig || !selectedFile || isSyncing) return;
      setShowSyncModal(true);
  };

  const handleConfirmSync = async (commitMessage: string) => {
    setShowSyncModal(false);
    if (!parsedConfig || !selectedFile) return;
    
    setIsSyncing(true);
    const runId = generateRunId();
    setCurrentRunId(runId);
    setAgentLogs([]); // Clear for sync run

    setAgentLogs(prev => [...prev, {
        id: Date.now(), runId, agent: 'Designer', status: 'running', timestamp: new Date(), message: `Reverse Sync: Updating JSON from ${selectedFile.path}...`, level: 'info'
    }]);

    try {
        // Use editedContent as the source of truth for sync
        const contentToSync = editedContent;
        
        const newConfig = await syncDesignFromCode(parsedConfig, selectedFile.path, contentToSync);
        setParsedConfig(newConfig);
        setJsonInput(JSON.stringify(newConfig, null, 2));
        
        // Also save the code locally
        handleSaveCode();
        
        addToHistory('sync', commitMessage, newConfig);

        setAgentLogs(prev => [...prev, {
            id: Date.now(), runId, agent: 'Designer', status: 'completed', timestamp: new Date(), message: `Design synced. Dependency graph updated.`, level: 'info'
        }]);
    } catch (e: any) {
        setError("Sync failed: " + e.message);
        setAgentLogs(prev => [...prev, {
            id: Date.now(), runId, agent: 'Designer', status: 'error', timestamp: new Date(), message: `Sync error: ${e.message}`, level: 'info'
        }]);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleSaveCode = () => {
    if (!plan || !selectedFile) return;
    const updatedFiles = plan.files.map(f => 
        f.path === selectedFile.path ? { ...f, content: editedContent } : f
    );
    const updatedPlan = { ...plan, files: updatedFiles };
    setPlan(updatedPlan);
    const newSelectedFile = updatedFiles.find(f => f.path === selectedFile.path);
    if (newSelectedFile) setSelectedFile(newSelectedFile);
    setIsDirty(false);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
        fileInputRef.current.click();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    handleActionWithConfirmation(
      "Import Project Archive?",
      "Importing a ZIP file will completely overwrite your current workspace configuration and code.",
      () => {
        setPendingFile(file);
      }
    );
  };

  const processZipImport = async (file: File) => {
    setIsImporting(true);
    setError(null);
    setPlan(null);
    setSelectedFile(null);
    setAgentLogs([]);
    const runId = generateRunId();
    setCurrentRunId(runId);

    try {
      await new Promise(resolve => setTimeout(resolve, 800)); 

      const zip = await JSZip.loadAsync(file);
      const metadataFile = zip.file("cloud-accel-project.json");
      if (!metadataFile) throw new Error("Invalid ZIP: Missing cloud-accel-project.json");

      const metadataContent = await metadataFile.async("string");
      const metadata = JSON.parse(metadataContent);

      if (metadata.config) {
        setParsedConfig(metadata.config);
        setJsonInput(JSON.stringify(metadata.config, null, 2));
        addToHistory('import', `Imported ${file.name}`, metadata.config);
      }

      const restoredFiles: GeneratedFile[] = [];
      const filePromises: Promise<void>[] = [];

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath !== "cloud-accel-project.json") {
            const p = (async () => {
                const content = await zipEntry.async("string");
                let type: any = 'module';
                if (relativePath.includes('ecosystem')) type = 'ecosystem';
                if (relativePath.includes('deployment')) type = 'deployment';
                if (relativePath.endsWith('.sh')) type = 'script';
                if (relativePath.endsWith('.md')) type = 'doc';
                
                restoredFiles.push({
                  path: `./${relativePath}`,
                  content: content,
                  originalContent: content, // Assume imported is original
                  type: type
                });
            })();
            filePromises.push(p);
        }
      });

      await Promise.all(filePromises);

      setPlan({
        summary: metadata.plan_summary || "Imported Project",
        workflow_proposal: metadata.workflow_proposal || "Imported Project Workflow",
        files: restoredFiles
      });

      setActiveTab(Tab.REPO);
      if (restoredFiles.length > 0) {
        const readme = restoredFiles.find(f => f.path.endsWith('README.md'));
        const first = restoredFiles[0];
        const fileToShow = readme || first;

        setSelectedFile(fileToShow);
        if (fileToShow.path.endsWith('.md')) setRepoViewMode('preview');
        else setRepoViewMode('code');
      }
      
      setAgentLogs([{
          id: 1, runId, agent: 'Orchestrator', status: 'completed', timestamp: new Date(), message: 'Project imported from archive.', level: 'info'
      }]);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to import ZIP file.");
    } finally {
        setIsImporting(false);
    }
  };

  const cleanupTerraformCode = (content: string): string => {
    if (!content) return '';
    let formatted = content;
    const keywords = ['resource', 'module', 'variable', 'output', 'provider', 'terraform', 'data', 'locals'];
    const regex = new RegExp(`}(\\s*)(${keywords.join('|')})`, 'g');
    formatted = formatted.replace(regex, '}\n\n$2');
    if (!formatted.endsWith('\n')) formatted += '\n';
    return formatted;
  };

  const handleExport = async () => {
    if (!plan || !parsedConfig) return;
    try {
        const zip = new JSZip();
        plan.files.forEach(file => {
            const cleanPath = file.path.replace(/^(\.\/|\/)/, '');
            let contentToSave = file.content;
            if (file.path.endsWith('.tf') || file.path.endsWith('.tfvars')) {
                contentToSave = cleanupTerraformCode(contentToSave);
            }
            contentToSave = contentToSave.replace(/\r?\n/g, "\r\n");
            zip.file(cleanPath, contentToSave);
        });
        
        // Add Meta-Project README
        const metaReadme = `# CloudAccel Agent Project\n\nThis project was generated by CloudAccel.\n\n## Structure\n- **modules/**: Terraform modules\n- **ecosystem/**: Cross-region orchestration\n- **deployments/**: Regional deployments\n- **scripts/**: Helper scripts`;
        zip.file("README.md", metaReadme);

        const projectMetadata = {
            config: parsedConfig,
            plan_summary: plan.summary,
            workflow_proposal: plan.workflow_proposal,
            exported_at: new Date().toISOString()
        };
        zip.file("cloud-accel-project.json", JSON.stringify(projectMetadata, null, 2));

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cloud-accel-${parsedConfig.project_name || 'infrastructure'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export failed", e);
        setError("Export failed. See console.");
    }
  };

  const formatContent = (file: GeneratedFile) => {
    if (!file.content) return '';
    if (file.path.endsWith('.json')) {
        try {
            const obj = JSON.parse(file.content);
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return file.content;
        }
    }
    if (file.path.endsWith('.tf') || file.path.endsWith('.tfvars')) {
        return cleanupTerraformCode(file.content);
    }
    return file.content;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans relative">
      <ConfirmationModal 
        isOpen={!!modalConfig}
        title={modalConfig?.title || ''}
        message={modalConfig?.message || ''}
        onConfirm={modalConfig?.onConfirm || (() => {})}
        onCancel={() => setModalConfig(null)}
      />

      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        onSave={handleSaveApiKey} 
        onClose={() => setShowApiKeyModal(false)}
        isBlocking={!apiKey}
      />

      {/* Sync Modal Overlay */}
      {showSyncModal && (
        <SyncModal 
           isSyncing={isSyncing}
           onConfirm={handleConfirmSync}
           onCancel={() => setShowSyncModal(false)}
        />
      )}

      {/* History Overlay */}
      {showHistory && (
          <HistoryPanel 
             history={history}
             onRestore={(config) => {
                 setParsedConfig(config);
                 setJsonInput(JSON.stringify(config, null, 2));
                 setPlan(null); // Clear plan on restore
                 setAgentLogs([]);
             }}
             onClose={() => setShowHistory(false)}
          />
      )}

      {/* Validation Panel Overlay */}
      <ValidationPanel 
        validation={validationResult}
        isProcessing={isAnalyzing}
        onProceed={handleModuleDetection}
        onCancel={() => setValidationResult(null)}
      />

      {/* Module Selector Overlay */}
      {showModuleSelector && moduleManifest && (
          <ModuleSelector 
             manifest={moduleManifest}
             isProcessing={isAnalyzing}
             onConfirm={handleGenerate}
             onCancel={() => setShowModuleSelector(false)}
          />
      )}

      {isImporting && (
          <div className="absolute inset-0 z-[50] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
              <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-white">Importing Project...</h2>
              <p className="text-gray-400 text-sm mt-2">Restoring configuration and code workspace</p>
          </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".zip" />

      <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Cpu size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">CloudAccel <span className="text-blue-400">Agent</span></h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">ADK v1.21</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={() => setShowApiKeyModal(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${!apiKey ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400'}`}
                title="Configure API Key"
            >
                {!apiKey ? <AlertCircle size={14} /> : <Settings size={14} />} 
                {!apiKey ? 'Missing API Key' : 'Settings'}
            </button>
            
            <div className="h-6 w-px bg-gray-700 mx-1"></div>

            <div className="flex gap-2">
                 <button 
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium transition-colors"
                >
                    <History size={14}/> Timeline
                </button>
                 <button 
                    onClick={handleSyncClick}
                    disabled={isSyncing || !selectedFile}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800 rounded text-xs font-bold text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Update Design (JSON) based on current file edits"
                >
                    {isSyncing ? <Loader2 size={12} className="animate-spin"/> : <GitCompare size={12} />} 
                    Sync Design
                </button>
            </div>
            
            <div className="h-6 w-px bg-gray-700 mx-1"></div>

            <div className="flex gap-2">
                 <button 
                    onClick={handleReset} 
                    className="flex items-center justify-center w-8 h-8 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    title="Clear Workspace"
                >
                    <Trash2 size={16}/>
                </button>
                 <button 
                    onClick={handleImportClick} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors text-blue-300"
                >
                    <Upload size={12}/> Import ZIP
                </button>
                <div className="h-6 w-px bg-gray-700 mx-1"></div>
                <button onClick={() => loadSample('new')} className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors">
                    Load New Infra
                </button>
                <button onClick={() => loadSample('existing')} className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors">
                    Load Existing Infra
                </button>
            </div>
            <button 
                onClick={isAnalyzing ? handleAbort : handlePreFlightCheck}
                disabled={isValidating}
                className={`flex items-center gap-2 px-4 py-2 rounded font-medium text-sm shadow-lg shadow-blue-500/20 transition-all
                  ${isAnalyzing ? 'bg-red-800 hover:bg-red-700 cursor-pointer' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
                {isAnalyzing ? <X size={16}/> : isValidating ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
                {isAnalyzing ? 'Stop Generation' : isValidating ? 'Validating...' : 'Generate Plan'}
            </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        <div className={`flex flex-col h-full transition-all duration-300 w-full`}>
          <div className="flex border-b border-gray-800 bg-gray-900 px-4 shrink-0">
            <button 
                onClick={() => setActiveTab(Tab.INPUT)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === Tab.INPUT ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
                <FileJson size={16} /> JSON Input
            </button>
            <button 
                onClick={() => setActiveTab(Tab.DEPENDENCY)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === Tab.DEPENDENCY ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
                <Network size={16} /> Resource Dependency
            </button>
            <button 
                onClick={() => setActiveTab(Tab.REPO)}
                disabled={!plan}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === Tab.REPO ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed'}`}
            >
                <Layers size={16} /> Repository & Code
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative bg-gray-900/30">
            {error && (
                <div className="absolute top-4 right-4 z-50 bg-red-900/90 border border-red-700 text-white px-4 py-3 rounded shadow-lg flex items-center gap-2 max-w-md animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0"/>
                    <p className="text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto hover:text-red-200">&times;</button>
                </div>
            )}

            <div className={`h-full flex flex-col p-4 ${activeTab === Tab.INPUT ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Configuration (JSON)</label>
                    <span className="text-xs text-gray-500">Edit to change requirements</span>
                </div>
                <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="flex-1 w-full bg-gray-950 border border-gray-800 rounded p-4 font-mono text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                    spellCheck={false}
                />
            </div>

            {activeTab === Tab.DEPENDENCY && parsedConfig && (
                <div className="h-full p-4 flex flex-col md:flex-row gap-4 overflow-hidden animate-in fade-in duration-200">
                    <div className="flex-1 flex flex-col min-h-[300px] h-full overflow-hidden">
                         <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300">
                                <Network className="text-blue-500" size={16} />
                                Visual Topology
                            </h2>
                            <p className="text-xs text-gray-500">
                                {parsedConfig.use_case === 'new' ? "New Infrastructure Proposal" : "Existing Infrastructure Map"}
                            </p>
                         </div>
                        <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-inner relative">
                            <DependencyGraph data={parsedConfig} />
                        </div>
                    </div>
                    <div className="w-full md:w-96 flex flex-col h-full overflow-hidden">
                        <ResourceEditor config={parsedConfig} onChange={handleConfigUpdate} />
                    </div>
                </div>
            )}

            {activeTab === Tab.REPO && plan && (
               <div className="h-full flex flex-row overflow-hidden animate-in fade-in duration-200">
                   
                   <div style={{ width: sidebarWidth }} className="flex flex-col border-r border-gray-800 bg-gray-900/50 shrink-0 overflow-hidden">
                        <div className="p-4 border-b border-gray-800">
                             <h3 className="text-xs font-bold text-blue-400 uppercase mb-2">Workflow Proposal</h3>
                             <p className="text-xs text-gray-400 leading-relaxed bg-gray-900 p-2 rounded border border-gray-800 max-h-32 overflow-y-auto">
                                 {plan.workflow_proposal}
                             </p>
                        </div>
                        <RepoTree 
                            files={plan.files} 
                            qualityReport={plan.qualityReport}
                            onSelectFile={(file) => {
                                const switchFile = () => {
                                    setSelectedFile(file);
                                    if (file.path.endsWith('.md')) setRepoViewMode('preview');
                                    else if (repoViewMode === 'diff') setRepoViewMode('diff');
                                    else setRepoViewMode('code');
                                };
                                if (isDirty) handleActionWithConfirmation("Discard Changes?", "You have unsaved changes in the current file.", switchFile);
                                else switchFile();
                            }} 
                            selectedFile={selectedFile}
                        />
                   </div>

                   <div 
                      onMouseDown={() => setIsResizingSidebar(true)}
                      className={`w-1 hover:w-1.5 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-all z-20 flex flex-col justify-center items-center ${isResizingSidebar ? 'bg-blue-500 w-1.5' : ''}`}
                   >
                       <div className="h-8 w-0.5 bg-gray-600 rounded"></div>
                   </div>

                   <div className="flex-1 flex flex-col bg-gray-950 min-w-0">
                        <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between shrink-0">
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => setRepoViewMode('code')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${repoViewMode === 'code' ? 'bg-blue-900/40 border-blue-800 text-blue-200' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                                >
                                    <Code2 size={14}/> Code View
                                </button>
                                <button 
                                    onClick={() => setRepoViewMode('diff')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${repoViewMode === 'diff' ? 'bg-blue-900/40 border-blue-800 text-blue-200' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                                >
                                    <FileDiff size={14}/> Diff Changes
                                </button>
                                <button 
                                    onClick={() => setRepoViewMode('arch')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${repoViewMode === 'arch' ? 'bg-blue-900/40 border-blue-800 text-blue-200' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                                >
                                    <LayoutTemplate size={14}/> Architecture
                                </button>
                             </div>

                             <div className="flex items-center gap-2">
                                 {selectedFile && (
                                     <>
                                        {selectedFile.path.endsWith('.md') && (
                                            <div className="flex items-center bg-gray-800 rounded p-0.5 mr-2">
                                                <button 
                                                    onClick={() => setRepoViewMode('preview')}
                                                    className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors flex items-center gap-1 ${repoViewMode === 'preview' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                                                >
                                                    <Eye size={10} /> Preview
                                                </button>
                                                <button 
                                                    onClick={() => setRepoViewMode('code')}
                                                    className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors flex items-center gap-1 ${repoViewMode === 'code' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                                                >
                                                    <Code2 size={10} /> Source
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-sm text-gray-300 font-mono mr-4">
                                            {selectedFile.path.endsWith('.md') ? <FileText size={14} className="text-amber-400"/> : <Terminal size={14} className="text-blue-400" />}
                                            <span className="truncate max-w-xs" title={selectedFile.path}>{selectedFile.path}</span>
                                        </div>
                                     </>
                                 )}
                             </div>
                        </div>

                        <div className="flex-1 overflow-auto relative">
                            {repoViewMode === 'code' && selectedFile && (
                                <div className="absolute inset-0 p-0 flex flex-col">
                                     <textarea 
                                        value={editedContent}
                                        onChange={(e) => {
                                            setEditedContent(e.target.value);
                                            setIsDirty(true);
                                        }}
                                        spellCheck={false}
                                        className="flex-1 w-full bg-gray-950 p-4 font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap outline-none resize-none"
                                     />
                                </div>
                            )}
                            {repoViewMode === 'diff' && selectedFile && (
                                <div className="absolute inset-0 p-0 flex flex-col">
                                    <DiffViewer original={selectedFile.originalContent || ''} modified={editedContent} />
                                </div>
                            )}
                            {repoViewMode === 'preview' && selectedFile && (
                                <div className="absolute inset-0 bg-gray-950">
                                    <MarkdownPreview content={selectedFile.content} />
                                </div>
                            )}
                            {repoViewMode !== 'arch' && !selectedFile && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                    <Code2 size={48} className="mb-4 opacity-50"/>
                                    <p>Select a file from the sidebar to view code</p>
                                </div>
                            )}
                            {repoViewMode === 'arch' && (
                                <ArchitectureGraph plan={plan} />
                            )}
                        </div>

                        {repoViewMode !== 'arch' && selectedFile && (
                            <div className="h-12 border-t border-gray-800 bg-gray-900/50 flex items-center px-4 justify-between shrink-0">
                                <span className="text-xs text-gray-500 flex items-center gap-2">
                                    Generated by Gemini 2.5 Flash
                                    {isDirty && <span className="text-amber-500 font-bold px-1.5 py-0.5 bg-amber-900/20 rounded text-[10px]">Unsaved Changes</span>}
                                </span>
                                <div className="flex gap-2">
                                    {isDirty && (
                                            <button 
                                                onClick={handleSaveCode}
                                                className="flex items-center gap-2 px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-bold text-gray-200 transition-colors"
                                            >
                                                <Save size={12} /> Save Edits
                                            </button>
                                    )}
                                    <button 
                                        onClick={handleExport}
                                        className="flex items-center gap-2 px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white transition-colors shadow-lg shadow-green-900/20"
                                    >
                                        <Download size={12} /> Export & Download ZIP
                                    </button>
                                </div>
                            </div>
                        )}
                        {repoViewMode === 'arch' && (
                             <div className="h-12 border-t border-gray-800 bg-gray-900/50 flex items-center px-4 justify-between shrink-0">
                                <span className="text-xs text-gray-500">Visualization Mode</span>
                                <button 
                                    onClick={handleExport}
                                    className="flex items-center gap-2 px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white transition-colors shadow-lg shadow-green-900/20"
                                >
                                    <Download size={12} /> Export & Download ZIP
                                </button>
                             </div>
                        )}
                   </div>
               </div>
            )}
          </div>
        </div>
      </main>

      <div 
        style={{ height: consoleExpanded ? consoleHeight : '2rem' }}
        className={`border-t border-gray-800 bg-gray-950 transition-all duration-300 flex flex-col shrink-0`}
      >
          <div 
             className="h-8 bg-gray-900 flex items-center px-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors shrink-0"
             onClick={() => setConsoleExpanded(!consoleExpanded)}
          >
             <Terminal size={14} className="text-gray-400 mr-2" />
             <span className="text-xs font-semibold text-gray-300">Agent Observability Console</span>
             <span className="ml-2 text-[10px] text-gray-500">{agentLogs.length} events</span>
             <div className="ml-auto">
                 {consoleExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
             </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
              <AgentConsole 
                logs={agentLogs} 
                debugMode={debugMode}
                setDebugMode={setDebugMode}
                onMouseDown={() => setIsResizingConsole(true)}
              />
          </div>
      </div>
    </div>
  );
};

export default App;
