import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';

// Set up DOM for server-side Three.js
const dom = new JSDOM();
global.document = dom.window.document;
global.window = dom.window as any;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;

export interface ColorDepth {
  [color: string]: number;
}

export interface STLQualitySettings {
  curveSegments?: number;
  scaleFactor?: number;
  overlapAmount?: number; // Overlap between layers for better connection
}

export function renderSVG(svgContent: string, colorDepths: ColorDepth = {}, qualitySettings: STLQualitySettings = {}) {
  const defaultExtrusion = 1;
  const loader = new SVGLoader();
  
  // Default quality settings
  const curveSegments = qualitySettings.curveSegments ?? 8; // Default to 8 (good balance)
  const scaleFactor = qualitySettings.scaleFactor ?? 0.25; // Default to 0.25 (256 units)
  const overlapAmount = qualitySettings.overlapAmount ?? 0.5; // Increased default overlap to 0.5mm for better gap elimination
  
  try {
    const svgData = loader.parse(svgContent);
    const svgGroup = new THREE.Group();
    const byColor = new Map<string, Array<{ mesh: THREE.Mesh; shape: THREE.Shape; depth: number }>>();
    
    // Create a base layer that covers all shapes with minimum depth
    const allShapes: THREE.Shape[] = [];

    svgGroup.scale.y *= -1;
    
    svgData.paths.forEach((path) => {
      const shapes = SVGLoader.createShapes(path);

      shapes.forEach((shape) => {
        const colorHex = path.color.getHexString();
        const baseDepth = colorDepths[colorHex] || defaultExtrusion;
        
        // Collect all shapes for base layer
        allShapes.push(shape);
        
        // Create the main colored layer with increased depth for overlap
        const mainDepth = baseDepth + overlapAmount;
        const meshGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: mainDepth,
          bevelEnabled: false,
          curveSegments: curveSegments,
          steps: 1
        });
        
        const fillMaterial = new THREE.MeshBasicMaterial({ color: path.color });
        const mesh = new THREE.Mesh(meshGeometry, fillMaterial);

        // Create a base layer for this shape (extends below main layer)
        const baseDepthExtended = overlapAmount * 2; // Base extends further down
        const baseMeshGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: baseDepthExtended,
          bevelEnabled: false,
          curveSegments: curveSegments,
          steps: 1
        });
        
        const baseMesh = new THREE.Mesh(baseMeshGeometry, fillMaterial);
        baseMesh.position.z = -overlapAmount; // Position base layer below main layer

        if (!byColor.has(colorHex)) {
          byColor.set(colorHex, [{ mesh, shape, depth: mainDepth }]);
        } else {
          byColor.get(colorHex)!.push({ mesh, shape, depth: mainDepth });
        }

        svgGroup.add(mesh);
        svgGroup.add(baseMesh); // Add base layer too
      });
    });

    // Apply scaling to X and Y axes only (preserve depth/Z values as specified in UI)
    svgGroup.scale.set(scaleFactor, scaleFactor, 1.0);
    
    // Then center the group properly
    const box = new THREE.Box3().setFromObject(svgGroup);
    const center = box.getCenter(new THREE.Vector3());
    
    // Move the entire group so its center is at the origin
    svgGroup.position.sub(center);
    
    // Rotate the group to lay flat (SVG is typically in XY plane, we want XZ plane for 3D printing)
    svgGroup.rotateX(-Math.PI / 2);

    return { svgGroup, byColor };
  } catch (error) {
    console.error('Error parsing SVG:', error);
    throw new Error(`Failed to parse SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function exportMultiColorSTL(svgContent: string, colorDepths: ColorDepth = {}): Buffer {
  const { svgGroup, byColor } = renderSVG(svgContent, colorDepths);
  const exporter = new STLExporter();
  
  // Export all geometries combined
  const combinedScene = new THREE.Scene();
  svgGroup.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      const clone = child.clone();
      combinedScene.add(clone);
    }
  });
  
  combinedScene.updateMatrixWorld(true);
  // Use text format for simplicity, but with reduced geometry
  const stlString = exporter.parse(combinedScene, { binary: false });
  
  return Buffer.from(stlString);
}

export async function exportSeparateSTLs(svgContent: string, colorDepths: ColorDepth = {}): Promise<Buffer> {
  const { svgGroup, byColor } = renderSVG(svgContent, colorDepths);
  const exporter = new STLExporter();
  const zip = new JSZip();

  for (const [color, colorShapeData] of byColor) {
    const scene = new THREE.Scene();
    
    colorShapeData.forEach((data) => {
      const clone = data.mesh.clone();
      // Apply same rotation as in your working code
      clone.rotation.z = Math.PI / 2;
      scene.add(clone);
    });
    
    scene.updateMatrixWorld(true);
    // Use text format for compatibility
    const result = exporter.parse(scene, { binary: false });
    zip.file(`${color}.stl`, result);
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 } // Maximum compression
  });

  return zipBuffer;
}

// Helper function to simplify geometry and reduce file size
function simplifyGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  // Create a simpler version with fewer curve segments
  const extrudeSettings = {
    curveSegments: 2, // Reduce from default 12 to 2
    steps: 1,
    bevelEnabled: false
  };
  
  return geometry;
}

// Legacy class for backward compatibility
export class SVGTo3D {
  private defaultDepth = 2.0;

  constructor() {}

  parseSVG(svgContent: string): void {
    // This method is kept for compatibility but actual parsing happens in renderSVG
  }

  renderSVG(svgData: string) {
    const colorDepths: ColorDepth = {};
    return renderSVG(svgData, colorDepths);
  }

  async exportSTL(colors: string[]): Promise<{ [color: string]: Buffer }> {
    throw new Error('This method is deprecated. Use exportSeparateSTLs instead.');
  }

  exportCombinedSTL(): Buffer {
    throw new Error('This method is deprecated. Use exportMultiColorSTL instead.');
  }

  setDepth(color: string, depth: number): void {
    // Deprecated - depths should be passed to render functions
  }
}
