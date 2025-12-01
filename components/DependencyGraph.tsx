import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ProjectConfig } from '../types';

interface DependencyGraphProps {
  data: ProjectConfig;
}

interface TreeNode {
  name: string;
  type: 'root' | 'region' | 'service' | 'resource' | 'detail';
  children?: TreeNode[];
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            // Only update if dimensions actually changed and are valid
            if (width > 0 && height > 0) {
                setDimensions({ width, height });
            }
        }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
        updateSize();
    });

    resizeObserver.observe(containerRef.current);
    
    window.addEventListener('resize', updateSize);

    return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Draw Graph
  useEffect(() => {
    if (!data || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 20, right: 120, bottom: 40, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Data Transformation: Flatten the structure into a D3 hierarchy
    const rootData: TreeNode = {
      name: data.project_name || 'Project',
      type: 'root',
      children: []
    };

    const findOrCreate = (nodes: TreeNode[], name: string, type: TreeNode['type']): TreeNode => {
        if (!nodes) return { name, type, children: [] }; 
        let node = nodes.find(n => n.name === name && n.type === type);
        if (!node) {
            node = { name, type, children: [] };
            nodes.push(node);
        }
        return node;
    };

    data.services.forEach(service => {
        const regionName = service.region || 'global';
        const regionNode = findOrCreate(rootData.children!, regionName, 'region');
        
        const serviceName = service.service || 'Unknown Service';
        const serviceNode = findOrCreate(regionNode.children!, serviceName, 'service');

        service.resources.forEach(res => {
            const resNode = findOrCreate(serviceNode.children!, res.name || 'unnamed-resource', 'resource');
            
            res.details.forEach(det => {
                if (resNode.children) {
                    resNode.children.push({
                        name: det.name,
                        type: 'detail'
                    });
                }
            });
        });
    });

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const root = d3.hierarchy(rootData);
    
    const treeLayout = d3.tree<TreeNode>()
        .size([innerHeight, innerWidth]);

    treeLayout(root);

    // Links
    svg.selectAll('path.link')
      .data(root.links())
      .enter().append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal()
        .x((d: any) => d.y)
        .y((d: any) => d.x) as any
      )
      .style("fill", "none")
      .style("stroke", "#4b5563")
      .style("stroke-width", "1.5px")
      .style("opacity", 0.6);

    // Nodes
    const node = svg.selectAll('g.node')
      .data(root.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    // Node Circle
    node.append('circle')
      .attr('r', 6)
      .style("fill", (d: any) => {
          switch(d.data.type) {
              case 'root': return '#ef4444'; 
              case 'region': return '#f59e0b';
              case 'service': return '#3b82f6';
              case 'resource': return '#10b981';
              case 'detail': return '#8b5cf6';
              default: return '#9ca3af';
          }
      })
      .style("stroke", "#1f2937")
      .style("stroke-width", "2px");

    // Labels
    node.append('text')
      .attr("dy", ".35em")
      .attr("x", (d: any) => d.children && d.children.length > 0 ? -12 : 12)
      .style("text-anchor", (d: any) => d.children && d.children.length > 0 ? "end" : "start")
      .text((d: any) => d.data.name)
      .style("fill", "#e5e7eb")
      .style("font-size", "11px")
      .style("font-family", "Inter, sans-serif")
      .style("font-weight", "500")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)");

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900/50 relative">
        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-3 text-[10px] font-mono z-10 bg-gray-900/80 p-1.5 rounded border border-gray-800 backdrop-blur-sm pointer-events-none select-none">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span>Project</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Region</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Service</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span>Resource</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Detail</div>
        </div>
      <svg ref={svgRef} className="w-full h-full block"></svg>
    </div>
  );
};