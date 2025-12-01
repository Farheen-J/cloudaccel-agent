
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AgentPlan, GeneratedFile } from '../types';

interface ArchitectureGraphProps {
  plan: AgentPlan;
}

interface ArchNode {
  id: string;
  name: string;
  type: 'root' | 'deployment' | 'ecosystem' | 'module' | 'script';
  children?: ArchNode[];
}

export const ArchitectureGraph: React.FC<ArchitectureGraphProps> = ({ plan }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!plan || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 40, right: 90, bottom: 40, left: 90 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Build Hierarchy from Files
    const files = plan.files;
    
    // Nodes
    const deployments = files.filter(f => f.type === 'deployment');
    const ecosystem = files.filter(f => f.type === 'ecosystem');
    const modules = files.filter(f => f.type === 'module');
    const scripts = files.filter(f => f.type === 'script');

    const rootData: ArchNode = {
      id: 'root',
      name: 'Infrastructure Orchestration',
      type: 'root',
      children: []
    };

    const ecosystemNode: ArchNode = {
        id: 'ecosystem',
        name: 'Ecosystem Blueprint',
        type: 'ecosystem',
        children: []
    };

    const uniqueModules = new Set<string>();
    modules.forEach(m => {
        const parts = m.path.split('/');
        const moduleName = parts.length > 3 ? parts[3] : 'generic';
        if (!uniqueModules.has(moduleName)) {
            uniqueModules.add(moduleName);
            ecosystemNode.children!.push({
                id: `mod-${moduleName}`,
                name: `${moduleName} Module`,
                type: 'module',
                children: []
            });
        }
    });
    
    deployments.forEach((d, i) => {
        const deployNode: ArchNode = {
            id: `deploy-${i}`,
            name: d.path.split('/').pop() || 'Deployment',
            type: 'deployment',
            children: [ecosystemNode]
        };
        rootData.children!.push(deployNode);

        scripts.forEach((s, si) => {
            deployNode.children!.push({
                id: `script-${si}`,
                name: 'Import Script',
                type: 'script',
                children: []
            });
        });
    });

    if (rootData.children!.length === 0) {
        rootData.children!.push(ecosystemNode);
    }


    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create a group for zooming
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    const root = d3.hierarchy(rootData);
    const treeLayout = d3.tree<ArchNode>().size([innerHeight, innerWidth]);
    treeLayout(root);

    // Links
    g.selectAll('path.link')
      .data(root.links())
      .enter().append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal()
        .x((d: any) => d.y)
        .y((d: any) => d.x) as any
      )
      .style("fill", "none")
      .style("stroke", "#4b5563")
      .style("stroke-width", "2px")
      .style("stroke-dasharray", (d: any) => d.target.data.type === 'script' ? "4,4" : "0");

    // Nodes
    const node = g.selectAll('g.node')
      .data(root.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("mouseover", function() { d3.select(this).select("circle").attr("r", 10); })
      .on("mouseout", function() { d3.select(this).select("circle").attr("r", 8); });

    node.append('circle')
      .attr('r', 8)
      .style("fill", (d: any) => {
          switch(d.data.type) {
              case 'deployment': return '#a855f7';
              case 'ecosystem': return '#22c55e';
              case 'module': return '#3b82f6';
              case 'script': return '#ec4899'; // Pink for scripts
              default: return '#9ca3af';
          }
      })
      .style("stroke", "#1f2937")
      .style("stroke-width", "2px");

    node.append('text')
      .attr("dy", (d:any) => d.children ? "-1em" : "0.35em")
      .attr("x", (d: any) => d.children ? 0 : 15)
      .style("text-anchor", (d: any) => d.children ? "middle" : "start")
      .text((d: any) => d.data.name)
      .style("fill", "#e5e7eb")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.9)");

  }, [plan, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-gray-900/50 overflow-hidden">
        <div className="absolute top-2 left-2 flex gap-4 text-[10px] font-mono z-10 bg-gray-900/90 p-2 rounded border border-gray-800 pointer-events-none">
             <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Deployment</div>
             <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span>Ecosystem</div>
             <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Module</div>
             <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pink-500"></span>Script</div>
        </div>
        <div className="absolute bottom-4 right-4 text-xs text-gray-500 pointer-events-none">
            Scroll/Drag to Navigate
        </div>
      <svg ref={svgRef} className="w-full h-full block cursor-move"></svg>
    </div>
  );
};
