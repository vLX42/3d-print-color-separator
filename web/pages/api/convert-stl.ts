import type { NextApiRequest, NextApiResponse } from 'next';
import { SVGTo3D } from '../../src/lib/svgTo3D';

interface STLRequest {
  svgContent: string;
  depths?: Record<string, number>;
  exportType: 'combined' | 'separate';
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
    const { svgContent, depths = {}, exportType }: STLRequest = req.body;

    if (!svgContent) {
      return res.status(400).json({
        success: false,
        error: 'SVG content is required'
      });
    }

    // Initialize SVG to 3D converter
    const converter = new SVGTo3D();
    
    // Parse the SVG
    converter.parseSVG(svgContent);
    
    // Update depths if provided
    Object.entries(depths).forEach(([color, depth]) => {
      converter.updateDepth(color, depth);
    });
    
    const colorLayers = converter.getColorLayers();
    
    if (colorLayers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid paths found in SVG'
      });
    }

    let files: Array<{
      filename: string;
      content: string;
      color?: string;
    }> = [];

    if (exportType === 'combined') {
      // Export single multi-color STL
      const stlContent = converter.exportMultiColorSTL();
      files = [{
        filename: 'multicolor-print.stl',
        content: stlContent
      }];
    } else {
      // Export separate STL files
      const separateSTLs = converter.exportSeparateSTLs();
      files = Array.from(separateSTLs.entries()).map(([color, content]) => ({
        filename: `layer-${color}.stl`,
        content,
        color
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        type: exportType,
        files,
        colors: colorLayers
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
