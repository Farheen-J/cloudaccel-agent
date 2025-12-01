
import React from 'react';
import { ProjectConfig, ServiceConfig, ServiceResource, ResourceDetail } from '../types';
import { Trash2, Plus, Layers, MapPin, Box, Network, Edit2, X, Server, Database, Cloud, HardDrive, Fingerprint, Settings, ToggleLeft, ToggleRight, Package } from 'lucide-react';

interface ResourceEditorProps {
  config: ProjectConfig;
  onChange: (config: ProjectConfig) => void;
}

// Smart Schema Mapping
const SERVICE_SCHEMAS: Record<string, any> = {
  vpc: { resource: 'VPC', child: 'Subnet', val: 'CIDR', icon: Network },
  ec2: { resource: 'Instance', child: 'Tag/Config', val: 'Value', icon: Server },
  s3: { resource: 'Bucket', child: 'Rule', val: 'Value', icon: HardDrive },
  rds: { resource: 'Cluster', child: 'Database', val: 'Engine', icon: Database },
  lambda: { resource: 'Function', child: 'Env Var', val: 'Value', icon: Cloud },
  dynamodb: { resource: 'Table', child: 'Index', val: 'Type', icon: Database },
  default: { resource: 'Resource', child: 'Property', val: 'Value', icon: Box }
};

const getSchema = (serviceName: string) => {
  const normalized = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('vpc') || normalized.includes('network')) return SERVICE_SCHEMAS.vpc;
  if (normalized.includes('ec2') || normalized.includes('compute')) return SERVICE_SCHEMAS.ec2;
  if (normalized.includes('s3') || normalized.includes('storage')) return SERVICE_SCHEMAS.s3;
  if (normalized.includes('rds') || normalized.includes('sql')) return SERVICE_SCHEMAS.rds;
  if (normalized.includes('lambda') || normalized.includes('serverless')) return SERVICE_SCHEMAS.lambda;
  if (normalized.includes('dynamo')) return SERVICE_SCHEMAS.dynamodb;
  return SERVICE_SCHEMAS.default;
};

export const ResourceEditor: React.FC<ResourceEditorProps> = ({ config, onChange }) => {
  const updateConfig = (updater: (c: ProjectConfig) => void) => {
    const newConfig = JSON.parse(JSON.stringify(config)); 
    updater(newConfig);
    onChange(newConfig);
  };

  const addService = () => {
    updateConfig((c) => {
      c.services.push({
        service: 'New Service',
        region: 'us-east-1',
        resources: []
      });
    });
  };

  const removeService = (index: number) => {
    updateConfig((c) => {
      c.services.splice(index, 1);
    });
  };

  const updateService = (index: number, field: keyof ServiceConfig, value: any) => {
    updateConfig((c) => {
      // @ts-ignore
      c.services[index][field] = value;
    });
  };

  const addResource = (serviceIndex: number, schema: any) => {
    updateConfig((c) => {
      const count = c.services[serviceIndex].resources.length + 1;
      c.services[serviceIndex].resources.push({
        name: `${schema.resource.toLowerCase()}-${count}`,
        details: []
      });
    });
  };

  const removeResource = (serviceIndex: number, rIndex: number) => {
    updateConfig((c) => {
      c.services[serviceIndex].resources.splice(rIndex, 1);
    });
  };

  const updateResource = (serviceIndex: number, rIndex: number, field: keyof ServiceResource, value: any) => {
    updateConfig((c) => {
      // @ts-ignore
      c.services[serviceIndex].resources[rIndex][field] = value;
    });
  };

  const addDetail = (serviceIndex: number, rIndex: number, schema: any) => {
    updateConfig((c) => {
      const count = c.services[serviceIndex].resources[rIndex].details.length + 1;
      c.services[serviceIndex].resources[rIndex].details.push({
        name: `${schema.child.toLowerCase()}-${count}`,
        value: ''
      });
    });
  };

  const removeDetail = (serviceIndex: number, rIndex: number, dIndex: number) => {
    updateConfig((c) => {
      c.services[serviceIndex].resources[rIndex].details.splice(dIndex, 1);
    });
  };

  const updateDetail = (sIdx: number, rIdx: number, dIdx: number, field: keyof ResourceDetail, value: string) => {
    updateConfig((c) => {
      // @ts-ignore
      c.services[sIdx].resources[rIdx].details[dIdx][field] = value;
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 flex flex-col h-full overflow-hidden shadow-xl">
        <div className="p-3 border-b border-gray-800 bg-gray-800/80 flex justify-between items-center backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Edit2 size={16} className="text-blue-400"/> Resource Editor
            </h3>
            <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-800">Auto-save on edit</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Project Level */}
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-800">
                <div className="col-span-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Project Name</label>
                    <input 
                        type="text" 
                        value={config.project_name}
                        onChange={(e) => updateConfig(c => { c.project_name = e.target.value })}
                        className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 outline-none transition-colors"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Use Case</label>
                    <select 
                        value={config.use_case}
                        onChange={(e) => updateConfig(c => { c.use_case = e.target.value as any })}
                        className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 outline-none transition-colors"
                    >
                        <option value="new">New Infrastructure</option>
                        <option value="existing">Existing Infrastructure</option>
                    </select>
                </div>
                 <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Settings size={10} /> Terraform Version
                    </label>
                    <input 
                        type="text" 
                        value={config.terraform_version || '1.5.0'}
                        placeholder="e.g. 1.5.0"
                        onChange={(e) => updateConfig(c => { c.terraform_version = e.target.value })}
                        className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 outline-none transition-colors"
                    />
                </div>
                
                {/* Community Module Toggle */}
                <div className="col-span-2 bg-gray-900/50 rounded border border-gray-800 p-2 flex items-center justify-between mt-2">
                    <div className="flex flex-col">
                         <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                            <Package size={12} className="text-purple-400"/>
                            Use Community Modules
                         </span>
                         <span className="text-[10px] text-gray-500">Wrap verified "terraform-aws-modules"</span>
                    </div>
                    <button 
                        onClick={() => updateConfig(c => { c.use_community_modules = !c.use_community_modules })}
                        className={`transition-colors ${config.use_community_modules ? 'text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                        {config.use_community_modules 
                            ? <ToggleRight size={28} /> 
                            : <ToggleLeft size={28} />
                        }
                    </button>
                </div>
            </div>

            {/* Services */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Layers size={14}/> Cloud Services
                    </label>
                    <button onClick={addService} className="text-xs flex items-center gap-1 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 px-2 py-1 rounded border border-blue-900 transition-colors">
                        <Plus size={12}/> Add Service
                    </button>
                </div>

                {config.services.length === 0 && (
                    <div className="text-center p-8 border-2 border-dashed border-gray-800 rounded text-gray-600 text-sm">
                        No services defined. Add one to get started.
                    </div>
                )}

                {config.services.map((service, sIdx) => {
                    const schema = getSchema(service.service);
                    const ServiceIcon = schema.icon;

                    return (
                        <div key={sIdx} className="border border-gray-700 rounded-lg bg-gray-800/20 overflow-hidden shadow-sm transition-all hover:border-gray-600">
                            {/* Service Header */}
                            <div className="p-3 bg-gray-800/50 flex gap-2 items-center border-b border-gray-700/50">
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 bg-gray-900/50 rounded px-2 py-1 border border-gray-800 focus-within:border-blue-500 transition-colors">
                                        <ServiceIcon size={14} className="text-blue-500 shrink-0"/>
                                        <input 
                                            type="text" 
                                            value={service.service}
                                            placeholder="Service Name (e.g. VPC, EC2)"
                                            onChange={(e) => updateService(sIdx, 'service', e.target.value)}
                                            className="w-full bg-transparent border-none text-sm font-semibold text-gray-200 focus:ring-0 placeholder-gray-600 p-0"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-900/50 rounded px-2 py-1 border border-gray-800 focus-within:border-amber-500 transition-colors">
                                        <MapPin size={14} className="text-amber-500 shrink-0"/>
                                        <input 
                                            type="text" 
                                            value={service.region}
                                            placeholder="Region"
                                            onChange={(e) => updateService(sIdx, 'region', e.target.value)}
                                            className="w-full bg-transparent border-none text-xs text-gray-400 focus:ring-0 placeholder-gray-600 p-0"
                                        />
                                    </div>
                                </div>
                                <button onClick={() => removeService(sIdx)} className="p-1.5 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded transition-colors">
                                    <Trash2 size={14}/>
                                </button>
                            </div>

                            {/* Resources */}
                            <div className="p-3 space-y-3">
                                {service.resources.map((res, rIdx) => (
                                    <div key={rIdx} className="pl-3 border-l-2 border-gray-700 hover:border-green-500/50 transition-colors">
                                        <div className="flex flex-col gap-2 mb-2">
                                            {/* Resource Name Row */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 w-full mr-2">
                                                    <span className="text-[10px] uppercase font-bold text-green-500/80 w-16 text-right shrink-0 truncate" title={schema.resource}>
                                                        {schema.resource}
                                                    </span>
                                                    <input 
                                                        type="text" 
                                                        value={res.name}
                                                        onChange={(e) => updateResource(sIdx, rIdx, 'name', e.target.value)}
                                                        className="bg-gray-950 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 w-full focus:border-green-500 outline-none transition-colors"
                                                        placeholder={`${schema.resource} Name`}
                                                    />
                                                </div>
                                                <button onClick={() => removeResource(sIdx, rIdx)} className="text-gray-600 hover:text-red-400 p-1">
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>

                                            {/* Resource ID Row (Existing) */}
                                            {config.use_case === 'existing' && (
                                                <div className="flex items-center gap-2 mr-6">
                                                    <span className="text-[10px] uppercase font-bold text-amber-500/80 w-16 text-right shrink-0 flex items-center justify-end gap-1">
                                                        <Fingerprint size={10} /> ID
                                                    </span>
                                                    <input 
                                                        type="text" 
                                                        value={res.resource_id || ''}
                                                        onChange={(e) => updateResource(sIdx, rIdx, 'resource_id', e.target.value)}
                                                        className="bg-gray-950 border border-gray-700 border-dashed rounded px-2 py-0.5 text-xs text-amber-200 w-full focus:border-amber-500 outline-none transition-colors font-mono"
                                                        placeholder={`Existing AWS ID (e.g. vpc-123...)`}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Details / Properties */}
                                        <div className="space-y-1 pl-2">
                                            {res.details.map((detail, dIdx) => (
                                                <div key={dIdx} className="flex items-center gap-2 group ml-6">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></div>
                                                    <input 
                                                        type="text" 
                                                        value={detail.name}
                                                        onChange={(e) => updateDetail(sIdx, rIdx, dIdx, 'name', e.target.value)}
                                                        className="bg-transparent border-b border-gray-700 hover:border-gray-500 px-1 py-0.5 text-xs text-gray-400 w-24 focus:border-purple-500 outline-none transition-colors"
                                                        placeholder={schema.child}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={detail.value || ''}
                                                        placeholder={schema.val}
                                                        onChange={(e) => updateDetail(sIdx, rIdx, dIdx, 'value', e.target.value)}
                                                        className="bg-transparent border-b border-gray-700 hover:border-gray-500 px-1 py-0.5 text-xs text-gray-500 w-24 focus:border-purple-500 outline-none font-mono transition-colors"
                                                    />
                                                    <button onClick={() => removeDetail(sIdx, rIdx, dIdx)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 transition-opacity">
                                                        <X size={12}/>
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => addDetail(sIdx, rIdx, schema)} className="text-[10px] text-purple-500/70 hover:text-purple-400 mt-1 pl-8 flex items-center gap-1">
                                                <Plus size={8}/> Add {schema.child}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => addResource(sIdx, schema)} className="text-xs flex items-center gap-1 text-green-500/70 hover:text-green-400 mt-3 pl-2 py-1 w-full border border-dashed border-gray-700 rounded justify-center hover:bg-gray-800 transition-colors">
                                    <Plus size={12}/> Add {schema.resource}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};