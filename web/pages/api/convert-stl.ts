import type { NextApiRequest, NextApiResponse } from 'next';
import { renderSVG, BaseLayerSettings } from '../../src/lib/svgTo3D';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as THREE from 'three';
import JSZip from 'jszip';
import { getColorFilename } from '../../src/lib/colorNaming';

interface STLRequest {
  svgContent: string;
  colorDepths?: Record<string, number>;
  exportType: 'combined' | 'separate';
  qualitySettings?: {
    curveSegments: number;
    scaleFactor: number;
    overlapAmount?: number;
  };
  baseLayer?: {
    height: number;
    color: string;
  } | null;
  mirrorSettings?: {
    mirrorX: boolean;
    mirrorY: boolean;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { svgContent, colorDepths = {}, exportType, qualitySettings, baseLayer, mirrorSettings }: STLRequest = req.body;

    if (!svgContent) {
      return res.status(400).json({
        success: false,
        error: 'SVG content is required'
      });
    }

    // Use renderSVG to get the 3D object with proper quality settings
    const result = renderSVG(svgContent, colorDepths, qualitySettings, baseLayer ? {
      height: baseLayer.height,
      color: baseLayer.color
    } : undefined, mirrorSettings);
    
    if (!result || !result.svgGroup || result.svgGroup.children.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid paths found in SVG'
      });
    }

    const exporter = new STLExporter();

    if (exportType === 'combined') {
      // Export single combined STL
      const stlContent = exporter.parse(result.svgGroup);
      
      // Return binary STL file
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="combined.stl"');
      res.status(200).send(Buffer.from(stlContent));
      
    } else {
      // Export separate STL files as ZIP
      const zip = new JSZip();
      
      // Use the byColor data from renderSVG which properly handles all layers including base
      if (result.byColor) {
        for (const [colorKey, meshData] of result.byColor.entries()) {
          if (meshData.length > 0) {
            const group = new THREE.Group();
            
            // Add all meshes for this color to the group
            meshData.forEach((data) => {
              const clonedMesh = data.mesh.clone();
              group.add(clonedMesh);
            });
            
            if (group.children.length > 0) {
              const stlContent = exporter.parse(group);
              
              // Generate human-readable filename
              let filename: string;
              if (colorKey === 'base') {
                filename = 'base-layer.stl';
              } else {
                const colorName = getColorFilename(colorKey);
                filename = `${colorName}-layer.stl`;
              }
              
              zip.file(filename, stlContent);
            }
          }
        }
      }
      
      // Generate ZIP file as buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Return ZIP file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="stl-layers.zip"');
      res.status(200).send(zipBuffer);
    }

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
