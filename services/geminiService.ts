
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectConfig, AgentPlan, GeneratedFile, AgentLogStep, ValidationResult, ModuleManifest } from '../types';

// Dynamic Client Initializer for BYOK
const getAIClient = () => {
    // Priority: LocalStorage (User provided) -> Process Env (Deployment provided)
    const storedKey = localStorage.getItem('gemini_api_key');
    const key = storedKey || process.env.API_KEY || '';
    
    if (!key) {
        throw new Error("Missing API Key. Please provide a key in settings.");
    }
    return new GoogleGenAI({ apiKey: key });
};

// Helper to handle path inconsistencies (e.g. "./modules" vs "modules")
const normalizePath = (p: string) => p.replace(/^(\.\/|\/)/, '');

// Helper for Throttled Execution and Retries with Abort Support
const wait = (ms: number, signal?: AbortSignal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new Error("Operation cancelled"));
  
  const timer = setTimeout(resolve, ms);
  
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new Error("Operation cancelled"));
  }, { once: true });
});

// ROBUST JSON Repair Helper for Truncated Responses
const tryParseJsonWithRepair = (jsonString: string): any => {
    const raw = jsonString.trim();
    // 1. Clean Markdown
    let clean = raw.replace(/^```json/, '').replace(/```$/, '').trim();

    try {
        return JSON.parse(clean);
    } catch (e) {
        // 2. Aggressive Truncation Recovery
        let repaired = clean;
        const stack: string[] = [];
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openSquare = (repaired.match(/\[/g) || []).length;
        const closeSquare = (repaired.match(/\]/g) || []).length;
        const quoteCount = (repaired.match(/"/g) || []).length;
        
        if (quoteCount % 2 !== 0) repaired += '"'; 
        for (let i = 0; i < (openSquare - closeSquare); i++) repaired += ']';
        for (let i = 0; i < (openBraces - closeBraces); i++) repaired += '}';

        try {
            return JSON.parse(repaired);
        } catch (e2) {
            const lastClose = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
            if (lastClose > 0) {
                const sliced = clean.substring(0, lastClose + 1);
                try { return JSON.parse(sliced); } catch (e3) { 
                    if (sliced.startsWith('{') && !sliced.endsWith('}')) return JSON.parse(sliced + '}');
                    if (sliced.startsWith('[') && !sliced.endsWith(']')) return JSON.parse(sliced + ']');
                }
            }
            throw new Error("JSON parsing failed (Truncated response)");
        }
    }
};

// Strict Schema Validator
export const validateProjectSchema = (config: any): string[] => {
    const errors: string[] = [];
    if (!config || typeof config !== 'object') return ["Invalid JSON structure"];
    if (!config.project_name) errors.push("Field 'project_name' is required.");
    if (!config.use_case || !['new', 'existing'].includes(config.use_case)) errors.push("Field 'use_case' must be 'new' or 'existing'.");
    
    if (!config.services || !Array.isArray(config.services)) {
        errors.push("Field 'services' must be an array.");
    } else {
        config.services.forEach((s: any, i: number) => {
            if (!s.service) errors.push(`Service at index ${i}: Missing 'service' name.`);
            if (!s.region) errors.push(`Service '${s.service || i}': Missing 'region'.`);
            if (!s.resources || !Array.isArray(s.resources)) {
                errors.push(`Service '${s.service || i}': 'resources' must be an array.`);
            } else {
                s.resources.forEach((r: any, j: number) => {
                    if (!r.name) errors.push(`Service '${s.service}' Resource ${j}: Missing 'name'.`);
                });
            }
        });
    }
    return errors;
};

const generateWithRetry = async <T>(
  operation: () => Promise<T>, 
  retries = 3, 
  baseDelay = 2000, 
  signal?: AbortSignal
): Promise<T> => {
  if (signal?.aborted) throw new Error("Operation cancelled");

  try {
    return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
            if (signal?.aborted) reject(new Error("Operation cancelled"));
            signal?.addEventListener('abort', () => reject(new Error("Operation cancelled")), { once: true });
        })
    ]);
  } catch (error: any) {
    if (error.message === "Operation cancelled" || error.name === 'AbortError') throw error;
    if (retries > 0 && (error?.status === 429 || error?.code === 429 || error?.status === 503)) {
      const delay = baseDelay * (4 - retries) + (Math.random() * 1000); 
      await wait(delay, signal);
      return generateWithRetry(operation, retries - 1, baseDelay * 1.5, signal);
    }
    throw error;
  }
};

// Helper to split bundled content into multiple files
const splitBundledContent = (originalPath: string, content: string): GeneratedFile[] => {
    const files: GeneratedFile[] = [];
    const baseDir = originalPath.substring(0, originalPath.lastIndexOf('/'));
    
    // Robust Regex to match ### START OF FILE: filename ###
    // Matches:
    // 1. ### START OF FILE:
    // 2. (Capturing Group 1): The filename (any non-newline characters)
    // 3. Optional ###
    // 4. Content (everything until next header)
    const regex = /###\s*START OF FILE:\s*(.*?)\s*(?:###)?\s*[\r\n]+([\s\S]*?)(?=(?:###\s*START OF FILE:|$))/gi;
    
    let match;
    let found = false;

    // Reset regex index
    regex.lastIndex = 0;

    console.log("Attempting to split content for:", originalPath);

    while ((match = regex.exec(content)) !== null) {
        found = true;
        const filename = match[1].trim();
        const fileContent = match[2].trim();
        
        console.log("Found part:", filename);

        if (filename && fileContent) {
            let type: GeneratedFile['type'] = 'module';
            if (originalPath.includes('ecosystem')) type = 'ecosystem';
            if (originalPath.includes('deployment')) type = 'deployment';
            
            // Construct correct path. If originalPath was 'deployments/main.tf' and found 'variables.tf',
            // new path is 'deployments/variables.tf'.
            const newPath = `${baseDir}/${filename}`;

            files.push({
                path: newPath,
                content: fileContent,
                originalContent: fileContent, 
                type
            });
        }
    }
    
    // Fallback: If no headers found, treat as single file
    if (!found) {
        console.warn(`No bundle headers found in ${originalPath}. Using raw content.`);
        let type: GeneratedFile['type'] = 'module';
        if (originalPath.includes('ecosystem')) type = 'ecosystem';
        if (originalPath.includes('deployment')) type = 'deployment';
        
        files.push({
            path: originalPath,
            content: content,
            originalContent: content, 
            type
        });
    }
    
    return files;
};

// --- AGENTS ---

const ARCHITECT_BLUEPRINT_INSTRUCTION = `
You are the "CloudAccel Architect Agent".
Your goal is to design the *File Structure* for a Cloud Infrastructure project.

OUTPUT FORMAT:
Do NOT return JSON. Return a line-delimited list of files in this format:
[TYPE] PATH

Where TYPE is one of: MODULE, ECOSYSTEM, DEPLOYMENT, SCRIPT
And PATH is the full file path.

RULES:
1. **Modules**: For each service (VPC, EC2, etc.), list ONLY the 'main.tf' file (e.g., [MODULE] output/modules/vpc/main.tf). The engineer will generate the rest.
2. **Ecosystem**: List ONLY '[ECOSYSTEM] output/ecosystem/main.tf'.
3. **Deployments**: List ONLY '[DEPLOYMENT] output/deployments/main.tf'. Do NOT use subfolders like 'dev/'. Flat structure.
4. **Existing**: If use_case='existing', add '[SCRIPT] output/import_resources.sh'.

Example Output:
[MODULE] output/modules/vpc/main.tf
[MODULE] output/modules/ec2/main.tf
[ECOSYSTEM] output/ecosystem/main.tf
[DEPLOYMENT] output/deployments/main.tf
`;

const LIBRARIAN_INSTRUCTION = `
You are the "CloudAccel Librarian Agent".
Identify required Terraform modules and find their LATEST verified versions.
INPUT: Project Configuration (JSON).
TOOLS: Google Search.
1. Identify every unique service.
2. For each, determine the best 'terraform-aws-modules' source.
3. Use Google Search to find the latest version.
4. Return JSON list: [ { "service": "VPC", "source": "terraform-aws-modules/vpc/aws", "version": "5.x.x" } ].
`;

const MODULE_ENGINEER_INSTRUCTION = `
You are the "CloudAccel Module Engineer".
Write Terraform Modules.

INPUTS: "service_config", "use_community_modules", "module_manifest".

STRICT OUTPUT FORMAT (BUNDLED):
You MUST generate multiple files combined into one text block.
Use these EXACT headers to separate files:
### START OF FILE: main.tf ###
### START OF FILE: variables.tf ###
### START OF FILE: outputs.tf ###
### START OF FILE: versions.tf ###

RULES:
1. **No Hardcoded IDs**: If use_case='existing', do NOT hardcode IDs in 'main.tf'. Use variables for everything. The import script will handle state binding.
2. **Community Modules**: If true, wrap 'terraform-aws-modules'. Use 'for_each' on the module block.
3. **Outputs**: Always export critical IDs/ARNs in 'outputs.tf'.
`;

const ECOSYSTEM_ARCHITECT_INSTRUCTION = `
You are the "CloudAccel Ecosystem Architect".
Orchestrate modules into a cohesive system.

STRICT OUTPUT FORMAT (BUNDLED):
You MUST generate multiple files combined into one text block.
Use these EXACT headers:
### START OF FILE: main.tf ###
### START OF FILE: variables.tf ###
### START OF FILE: outputs.tf ###
### START OF FILE: versions.tf ###

RULES:
1. **NO Hardcoding**: Do NOT hardcode CIDR blocks, instance types, or IPs in 'main.tf'. You MUST use 'var.<variable_name>'.
2. **Variables**: Define all input variables in 'variables.tf' with 'default = null'.
3. **Main**: Instantiate modules using 'for_each'. Wire outputs from one module to inputs of another.
`;

const DEPLOYMENT_ENGINEER_INSTRUCTION = `
You are the "CloudAccel Deployment Engineer".
Configure the environment and instantiate the Ecosystem.

STRICT OUTPUT FORMAT (BUNDLED):
You MUST generate multiple files combined into one text block.
Use these EXACT headers:
### START OF FILE: main.tf ###
### START OF FILE: variables.tf ###
### START OF FILE: terraform.tfvars ###
### START OF FILE: outputs.tf ###
### START OF FILE: versions.tf ###

RULES:
1. **The Missing Link**: In 'main.tf', you MUST instantiate the ecosystem module:
   module "ecosystem" {
     source = "../../ecosystem"
     ...pass all variables...
     providers = { aws = aws }
   }
2. **Providers**: Define 'provider "aws"' in 'main.tf'.
3. **Values**: Put actual values (CIDRs, instance types) in 'terraform.tfvars'.
4. **No Subfolders**: Output all files directly to the target path.
5. **No Hardcoded IDs**: In 'terraform.tfvars', strictly use configuration values. Do not output resource IDs.
`;

const SCRIPT_ENGINEER_INSTRUCTION = `
You are the "CloudAccel Script Engineer".
Create a **MANUAL IMPORT GUIDE** (Bash script).

RULES:
1. **Manual Commands**: Do NOT write a complex loop. Write explicit 'terraform import' commands for each existing resource found in the config.
2. **Commented**: Comment out the commands so the user can review them.
3. **Structure**:
   # --- VPC: us-east-1 ---
   # terraform import module.ecosystem.module.vpc["vpc_existing1"].aws_vpc.this vpc-12345
`;

const VALIDATOR_INSTRUCTION = `
You are the "CloudAccel Validator Agent".
Validate Project Config JSON.
RULES:
1. **Community Module Exemptions**: 'ami', 'vpc_security_group_ids' optional for 'terraform-aws-modules/ec2-instance'.
2. **Defaults**: Assume reasonable defaults exist.
OUTPUT FORMAT: JSON: { "isValid": boolean, "issues": [ { "severity": "error"|"warning", "service": "string", "message": "string" } ] }
`;

const AUDITOR_SYSTEM_INSTRUCTION = `
You are the "CloudAccel Security Auditor Agent".
Analyze Terraform code for risks (CIS, NIST).

STRICT OUTPUT FORMAT (MARKDOWN + FIXES):
1. **Report**: Return a Markdown report of security findings.
2. **Fixes**: If you can fix a vulnerability, append the fixed file content at the end using this header:
   ### FIX APPLIED: path/to/file ###
   [Content of the fixed file]

STRICT AUTO-REMEDIATION RULES:
1. **NO PLACEHOLDERS**: Do NOT add comments like "Restrict in production". ACTUALLY CHANGE the code to be secure (e.g. use private CIDRs).
2. **Least Privilege**: Remove open 0.0.0.0/0 access on ports 22/3389.
`;

const WRITER_SYSTEM_INSTRUCTION = `
You are the "CloudAccel Technical Writer Agent".
Generate a comprehensive **README.md**.
Include: Title, Architecture, Prerequisites, Modules Used, Deployment Guide.
`;

const REVERSE_SYNC_INSTRUCTION = `
You are the "CloudAccel Designer Agent".
Update the Project Configuration (JSON) based on changes in the Terraform Code (HCL).
OUTPUT: Return ONLY the updated ProjectConfig JSON.
`;

// --- METHODS ---

export const validateConfiguration = async (config: ProjectConfig, signal?: AbortSignal): Promise<ValidationResult> => {
  const ai = getAIClient();
  const schemaErrors = validateProjectSchema(config);
  if (schemaErrors.length > 0) {
      return {
          isValid: false,
          issues: schemaErrors.map(msg => ({ severity: 'error', service: 'System', resource: 'Schema', message: msg }))
      };
  }

  const prompt = `Validate this Config: ${JSON.stringify(config, null, 2)}`;

  return generateWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: VALIDATOR_INSTRUCTION, tools: [{googleSearch: {}}] }
    });
    if (!response.text) return { isValid: true, issues: [] };
    const text = response.text;
    const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonBlock ? jsonBlock[1] : text.replace(/```json/g, '').replace(/```/g, '');
    try { return tryParseJsonWithRepair(jsonString) as ValidationResult; } catch (e) { return { isValid: true, issues: [] }; }
  }, 3, 5000, signal);
};

export const generateModuleManifest = async (config: ProjectConfig, signal?: AbortSignal): Promise<ModuleManifest> => {
  const ai = getAIClient();
  const prompt = `Find latest module versions for: ${JSON.stringify(config, null, 2)}`;
  return generateWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: LIBRARIAN_INSTRUCTION, tools: [{googleSearch: {}}] }
    });
    if (!response.text) return [];
    const text = response.text;
    const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonBlock ? jsonBlock[1] : text.replace(/```json/g, '').replace(/```/g, '');
    try { return tryParseJsonWithRepair(jsonString) as ModuleManifest; } catch (e) { return []; }
  }, 3, 10000, signal);
};

export const syncDesignFromCode = async (currentConfig: ProjectConfig, filePath: string, fileContent: string, signal?: AbortSignal): Promise<ProjectConfig> => {
    const ai = getAIClient();
    const prompt = `Update Config based on HCL: ${fileContent}\nCurrent Config: ${JSON.stringify(currentConfig)}`;
    return generateWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: REVERSE_SYNC_INSTRUCTION, responseMimeType: "application/json" }
      });
      if (!response.text) throw new Error("Failed to sync.");
      return JSON.parse(response.text) as ProjectConfig;
    }, 3, 3000, signal);
};

const generateArchitectBlueprint = async (config: ProjectConfig, signal?: AbortSignal): Promise<AgentPlan> => {
  const ai = getAIClient();
  const prompt = `Design file structure for: ${JSON.stringify(config)}`;
  
  return generateWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
            systemInstruction: ARCHITECT_BLUEPRINT_INSTRUCTION, 
            responseMimeType: "text/plain" // Plain text to avoid JSON truncation
        }
      });
      if (!response.text) throw new Error("Architect failed");
      
      // Parse Line-Delimited Output
      const files: { path: string, type: GeneratedFile['type'] }[] = [];
      const lines = response.text.split('\n');
      
      lines.forEach(line => {
          const match = line.trim().match(/^\[(\w+)\]\s+(.+)$/);
          if (match) {
              const typeStr = match[1].toLowerCase();
              let type: GeneratedFile['type'] = 'module';
              if (typeStr.includes('ecosystem')) type = 'ecosystem';
              else if (typeStr.includes('deployment')) type = 'deployment';
              else if (typeStr.includes('script')) type = 'script';
              
              files.push({ type, path: match[2].trim() });
          }
      });

      return {
          summary: "Generated by CloudAccel Architect",
          workflow_proposal: "1. Provision Modules\n2. Orchestrate in Ecosystem\n3. Deploy to Environment",
          files: files as any
      };
  }, 5, 5000, signal);
};

const generateFileStream = async (
    context: any, 
    file: GeneratedFile,
    systemInstruction: string,
    onUpdate: (partialText: string) => void,
    onLog: (log: AgentLogStep) => void,
    runId: string, 
    logId: number,
    signal?: AbortSignal
): Promise<string> => {
  const ai = getAIClient();
  const prompt = `Generate BUNDLED CONTENT for: ${file.path}\nContext: ${JSON.stringify(context)}`;

  let fullText = "";
  let chunkCount = 0;

  await generateWithRetry(async () => {
      const streamResult = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: systemInstruction }
      });

      for await (const chunk of streamResult) {
          if (signal?.aborted) break;
          const chunkText = chunk.text;
          if (chunkText) {
            fullText += chunkText;
            chunkCount++;
            onUpdate(chunkText);
            if (chunkCount % 5 === 0) {
                 onLog({ 
                     id: logId, runId, agent: 'Orchestrator', status: 'running', timestamp: new Date(), level: 'debug', 
                     message: `Streamed ${chunkText.length} chars...` 
                 });
            }
          }
      }
      return fullText;
  }, 5, 5000, signal);

  return fullText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
};

const generateSecurityAuditAndFixes = async (files: GeneratedFile[], signal?: AbortSignal): Promise<{report: string, remediated_files: {path:string, content:string}[]}> => {
  const ai = getAIClient();
  const tfContent = files.filter(f => (f.path.endsWith('.tf') || f.path.endsWith('.tfvars')) && f.content);
  if (tfContent.length === 0) return { report: "# Security Audit Report\nNo files analyzed.", remediated_files: [] };
  
  const prompt = `Audit and Fix these files: ${JSON.stringify(tfContent.map(f => ({ path: f.path, content: f.content })))}`;
  
  return generateWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
            systemInstruction: AUDITOR_SYSTEM_INSTRUCTION, 
            responseMimeType: "text/plain" // Text to avoid JSON limits
        }
      });
      
      const fullText = response.text || "# Audit Failed";
      
      // Parse the Report (Markdown) and Fixes (Bundled headers)
      const parts = fullText.split(/###\s*FIX APPLIED:/i);
      const report = parts[0];
      const remediated_files: {path:string, content:string}[] = [];

      for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const firstLineBreak = part.indexOf('\n');
          if (firstLineBreak === -1) continue;
          
          const path = part.substring(0, firstLineBreak).trim();
          let content = part.substring(firstLineBreak + 1).trim();
          
          // Remove trailing ### if present (from next header split)
          content = content.replace(/###$/, '').trim();
          
          remediated_files.push({ path: normalizePath(path), content });
      }

      return { report, remediated_files };
  }, 5, 5000, signal);
};

const generateReadme = async (config: ProjectConfig, summary: string, signal?: AbortSignal): Promise<string> => {
  const ai = getAIClient();
  const prompt = `Generate README. Summary: ${summary}\nConfig: ${JSON.stringify(config)}`;
  return generateWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: WRITER_SYSTEM_INSTRUCTION }
      });
      return response.text || "# Documentation\nGenerated by CloudAccel.";
  }, 5, 5000, signal);
};

// --- ORCHESTRATOR ---
export const analyzeAndGeneratePlan = async (
    config: ProjectConfig, 
    moduleManifest: ModuleManifest | null, 
    runId: string, 
    onLog: (log: AgentLogStep) => void, 
    onFileUpdate: (path: string, partialContent: string) => void, 
    signal?: AbortSignal
): Promise<AgentPlan> => {
  if (signal?.aborted) throw new Error("Operation cancelled");
  getAIClient();

  onLog({ id: 1, runId, agent: 'Architect', status: 'running', timestamp: new Date(), level: 'info', message: 'Designing Infrastructure Blueprint...' });
  const blueprint = await generateArchitectBlueprint(config, signal);
  onLog({ id: 1, runId, agent: 'Architect', status: 'completed', timestamp: new Date(), level: 'info', message: `Blueprint designed.` });
  
  const normalizedFiles: GeneratedFile[] = (blueprint.files || []).map(f => {
      let type = (f.type || '').toLowerCase();
      const lowerPath = f.path.toLowerCase();
      if (lowerPath.includes('modules/')) type = 'module';
      else if (lowerPath.includes('ecosystem/')) type = 'ecosystem';
      else if (lowerPath.includes('deployments/') || lowerPath.endsWith('.tfvars')) type = 'deployment';
      else if (lowerPath.endsWith('.sh')) type = 'script';
      return { path: f.path, type: type as any, content: '', originalContent: '' };
  });
  
  if (config.use_case === 'existing' && !normalizedFiles.some(f => f.type === 'script')) {
      normalizedFiles.push({ path: 'output/import_resources.sh', type: 'script', content: '', originalContent: '' });
  }
  
  const plan: AgentPlan = { summary: blueprint.summary, workflow_proposal: blueprint.workflow_proposal, files: normalizedFiles };
  
  onLog({ id: 15, runId, agent: 'Orchestrator', status: 'running', timestamp: new Date(), level: 'info', message: 'Spawning Specialized Engineers (Sequential)...' });
  
  // STRICT SEQUENTIAL EXECUTION to prevent Rate Limits and ensure Bundling works
  const CONCURRENCY_LIMIT = 1;
  const queue = [...normalizedFiles];
  const fileLogIds = new Map<string, number>();
  normalizedFiles.forEach((f, i) => fileLogIds.set(f.path, 1000 + i));

  const processNext = async () => {
      if (queue.length === 0) return;
      const file = queue.shift();
      if (!file) return;

      if (file.type === 'script' && config.use_case !== 'existing') {
          await processNext();
          return;
      }

      let instruction = MODULE_ENGINEER_INSTRUCTION;
      let context: any = config;

      if (file.type === 'ecosystem') instruction = ECOSYSTEM_ARCHITECT_INSTRUCTION;
      else if (file.type === 'deployment') instruction = DEPLOYMENT_ENGINEER_INSTRUCTION;
      else if (file.type === 'script') instruction = SCRIPT_ENGINEER_INSTRUCTION;
      else if (file.type === 'module') {
          instruction = MODULE_ENGINEER_INSTRUCTION;
          const parts = file.path.split('/');
          const moduleIndex = parts.indexOf('modules');
          const serviceName = (moduleIndex !== -1 && moduleIndex + 1 < parts.length) ? parts[moduleIndex + 1] : '';
          
          if (serviceName) {
            const foundService = config.services.find(s => 
                s.service.toLowerCase().replace(/[^a-z]/g, '') === serviceName.toLowerCase().replace(/[^a-z]/g, '')
            );
            context = { 
                service_config: foundService || config,
                use_community_modules: config.use_community_modules,
                module_manifest: moduleManifest 
            };
          }
      }

      const stepId = fileLogIds.get(file.path) || Date.now();
      onLog({ id: stepId, runId, agent: 'Orchestrator', status: 'running', timestamp: new Date(), level: 'info', message: `Generating: ${file.path}...` });
      
      try {
        const content = await generateFileStream(context, file, instruction, (partial) => {
            onFileUpdate(file.path, partial);
        }, onLog, runId, stepId, signal);
        
        // --- SPLITTING LOGIC ---
        // Check for bundled headers and explode into multiple files
        if (content.match(/###\s*START OF FILE:/i)) {
            const splitFiles = splitBundledContent(file.path, content);
            if (splitFiles.length > 0) {
                // Remove the original placeholder file from plan
                const placeholderIdx = plan.files.findIndex(f => f.path === file.path);
                if (placeholderIdx !== -1) plan.files.splice(placeholderIdx, 1);
                
                // Add the new split files
                splitFiles.forEach(sf => {
                    plan.files.push(sf);
                    onFileUpdate(sf.path, sf.content);
                });
                onLog({ id: stepId, runId, agent: 'Orchestrator', status: 'completed', timestamp: new Date(), level: 'debug', message: `Split bundle into ${splitFiles.length} files.` });
            } else {
                console.warn("Splitting returned 0 files for", file.path);
            }
        } else {
             // Single file update
             const idx = plan.files.findIndex(f => f.path === file.path);
             if (idx !== -1) {
                 plan.files[idx].content = content;
                 plan.files[idx].originalContent = content;
             }
        }
        
        onLog({ id: stepId, runId, agent: 'Orchestrator', status: 'completed', timestamp: new Date(), level: 'info', message: `Generated: ${file.path}` });
      } catch (e: any) {
        onFileUpdate(file.path, `// Error: ${e.message}`);
        onLog({ id: stepId, runId, agent: 'Orchestrator', status: 'error', timestamp: new Date(), level: 'info', message: `Failed: ${file.path}` });
      }
      
      // Delay to respect rate limits
      await wait(1500, signal); 
      await processNext();
  };

  const activePromises: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY_LIMIT; i++) activePromises.push(processNext());
  await Promise.all(activePromises);
  
  onLog({ id: 15, runId, agent: 'Orchestrator', status: 'completed', timestamp: new Date(), level: 'info', message: 'Code generation complete.' });

  onLog({ id: 2, runId, agent: 'Auditor', status: 'running', timestamp: new Date(), level: 'info', message: 'Security Scan & Auto-Remediation...' });
  const securityResult = await generateSecurityAuditAndFixes(plan.files, signal);
  
  if (securityResult.remediated_files) {
      securityResult.remediated_files.forEach(fixedFile => {
          const idx = plan.files.findIndex(f => normalizePath(f.path) === normalizePath(fixedFile.path));
          if (idx !== -1) {
              plan.files[idx].content = fixedFile.content;
              plan.files[idx].originalContent = fixedFile.content;
              onFileUpdate(plan.files[idx].path, fixedFile.content); 
          }
          onLog({ id: 2000 + idx, runId, agent: 'Auditor', status: 'completed', timestamp: new Date(), level: 'debug', message: `Auto-remediated: ${fixedFile.path}` });
      });
  }
  
  const auditDoc: GeneratedFile = { path: './SECURITY_AUDIT.md', content: securityResult.report, originalContent: securityResult.report, type: 'doc' };
  plan.files.push(auditDoc);
  onFileUpdate(auditDoc.path, auditDoc.content);
  onLog({ id: 2, runId, agent: 'Auditor', status: 'completed', timestamp: new Date(), level: 'info', message: 'Audit complete.' });
  
  onLog({ id: 3, runId, agent: 'Writer', status: 'running', timestamp: new Date(), level: 'info', message: 'Writing Documentation...' });
  const readme = await generateReadme(config, plan.summary, signal);
  const readmeDoc: GeneratedFile = { path: './README.md', content: readme, originalContent: readme, type: 'doc' };
  plan.files.push(readmeDoc);
  onFileUpdate(readmeDoc.path, readmeDoc.content);
  onLog({ id: 3, runId, agent: 'Writer', status: 'completed', timestamp: new Date(), level: 'info', message: 'Done.' });

  return plan;
};
