import type { NextApiRequest, NextApiResponse } from 'next';
import { renderSVG } from '../../src/lib/svgTo3D';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as THREE from 'three';
import JSZip from 'jszip';

interface STLRequest {
  svgContent: string;
  colorDepths?: Record<string, number>;
  exportType: 'combined' | 'separate';
  qualitySettings?: {
    curveSegments: number;
    scaleFactor: number;
  };
}

interface STLResponse {
  success: boolean;
  data?: {
    type: 'combined' | 'separate';
    files: Array<{
      filename: string;
      content: string;
      color?: string;
    }>;
    colors: Array<{
      color: string;
      depth: number;
      pathCount: number;
    }>;
  };
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<STLResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { svgContent, colorDepths = {}, exportType, qualitySettings }: STLRequest = req.body;

    if (!svgContent) {
      return res.status(400).json({
        success: false,
        error: 'SVG content is required'
      });
    }

    // Use renderSVG to get the 3D object with proper quality settings
    const result = renderSVG(svgContent, colorDepths, qualitySettings);
    
    if (!result || !result.svgGroup || result.svgGroup.children.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid paths found in SVG'
      });
    }

    const exporter = new STLExporter();
    let files: Array<{
      filename: string;
      content: string;
      color?: string;
    }> = [];

    if (exportType === 'combined') {
      // Export single combined STL
      const stlContent = exporter.parse(result.svgGroup);
      files = [{
        filename: 'combined.stl',
        content: stlContent
      }];
    } else {
      // Export separate STL files by color
      const colorGroups = new Map<string, THREE.Group>();
      
      // Group meshes by color
      result.svgGroup.children.forEach((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshBasicMaterial;
          const colorHex = material.color.getHexString();
          
          if (!colorGroups.has(colorHex)) {
            colorGroups.set(colorHex, new THREE.Group());
          }
          
          // Clone the mesh for the color group
          const clonedMesh = child.clone();
          colorGroups.get(colorHex)!.add(clonedMesh);
        }
      });
      
      // Export each color group as separate STL
      for (const [colorHex, group] of colorGroups.entries()) {
        if (group.children.length > 0) {
          const stlContent = exporter.parse(group);
          files.push({
            filename: `layer-${colorHex}.stl`,
            content: stlContent,
            color: colorHex
          });
        }
      }
    }

    // Create color info for response
    const colors = Array.from(result.byColor.entries()).map(([color, meshes]) => ({
      color,
      depth: colorDepths[color] || 2.0,
      pathCount: meshes.length
    }));

    res.status(200).json({
      success: true,
      data: {
        type: exportType,
        files,
        colors
      }
    });

  } catch (error) {
    console.error('STL conversion error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
