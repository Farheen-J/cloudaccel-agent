
export interface ResourceDetail {
  name: string;
  value: string | null; // was 'cidr'
}

export interface ServiceResource {
  name: string;
  type?: string; // e.g., 't3.micro', 'Standard'
  resource_id?: string; // NEW: AWS Resource ID for existing imports
  details: ResourceDetail[]; // was 'subnets'
}

export interface ServiceConfig {
  service: string;
  region: string;
  resources: ServiceResource[]; // was 'vpcs'
}

export interface ProjectConfig {
  use_case: 'new' | 'existing';
  project_name: string;
  terraform_version?: string; // NEW: User defined version
  use_community_modules?: boolean; // NEW: Toggle for terraform-aws-modules
  modules_repo: string;
  ecosystem_repo: string;
  deployments_repo: string;
  services: ServiceConfig[];
}

export interface ModuleVersion {
  service: string;
  source: string;
  version: string;
}

export type ModuleManifest = ModuleVersion[];

export interface GeneratedFile {
  path: string;
  content: string;
  originalContent?: string; // NEW: For diffing against user edits
  type: 'module' | 'ecosystem' | 'deployment' | 'state' | 'script' | 'doc';
}

export interface AgentPlan {
  summary: string;
  files: GeneratedFile[];
  workflow_proposal: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface AgentLogStep {
  id: number;
  runId: string; // NEW: Session ID to prevent ghost logs
  agent: 'Orchestrator' | 'Architect' | 'Auditor' | 'Writer' | 'Validator' | 'Designer' | 'Librarian';
  message: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: Date;
  level?: 'info' | 'debug'; // Added level for debug mode
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  service: string;
  resource: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: 'generate' | 'sync' | 'edit' | 'import' | 'load';
  message: string;
  configSnapshot: ProjectConfig;
}
