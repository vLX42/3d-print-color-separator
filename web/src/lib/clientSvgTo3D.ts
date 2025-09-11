import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

export interface ColorDepth {
  [color: string]: number;
}

export interface STLQualitySettings {
  curveSegments?: number;
  scaleFactor?: number;
}

export interface BaseLayerSettings {
  enabled: boolean;
  height: number;
  color: string;
}

export interface MirrorSettings {
  mirrorX: boolean;
  mirrorY: boolean;
}

const stokeMaterial = new THREE.LineBasicMaterial({
  color: '#adb5bd',
});

export function renderSVG(
  svgContent: string, 
  colorDepths: ColorDepth = {}, 
  qualitySettings: STLQualitySettings = {},
  baseLayer?: BaseLayerSettings,
  mirrorSettings?: MirrorSettings
) {
  const defaultExtrusion = 1;
  const loader = new SVGLoader();
  
  // Default quality settings - use even larger scale factor for better visibility
  const curveSegments = qualitySettings.curveSegments ?? 8;
  const scaleFactor = qualitySettings.scaleFactor ?? 2.0;  // Changed from 1.0 to 2.0
  
  try {
    const svgData = loader.parse(svgContent);
    
    const svgGroup = new THREE.Group();
    const updateMap: Array<{ shape: THREE.Shape; mesh: THREE.Mesh; lines: THREE.LineSegments }> = [];
    const byColor = new Map<string, Array<{ mesh: THREE.Mesh; shape: THREE.Shape; lines: THREE.LineSegments; depth: number }>>();
    const allShapes: THREE.Shape[] = [];

    svgGroup.scale.y *= -1;
    
    svgData.paths.forEach((path, pathIndex) => {
      const shapes = SVGLoader.createShapes(path);

      shapes.forEach((shape, shapeIndex) => {
        // Collect all shapes for base layer
        allShapes.push(shape);
        
        const colorHex = path.color.getHexString();
        const depth = colorDepths[colorHex] || defaultExtrusion;
        
        const meshGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: depth, // Use the actual depth from colorDepths
          bevelEnabled: false,
          curveSegments: curveSegments, // Now adjustable
        });
        const linesGeometry = new THREE.EdgesGeometry(meshGeometry);
        const fillMaterial = new THREE.MeshBasicMaterial({ color: path.color });
        const mesh = new THREE.Mesh(meshGeometry, fillMaterial);
        const lines = new THREE.LineSegments(linesGeometry, stokeMaterial);
        
        // Apply mirroring if specified
        if (mirrorSettings) {
          if (mirrorSettings.mirrorX) {
            mesh.scale.x *= -1;
            lines.scale.x *= -1;
          }
          if (mirrorSettings.mirrorY) {
            mesh.scale.y *= -1;
            lines.scale.y *= -1;
          }
        }
        
        if (!byColor.has(colorHex)) {
          byColor.set(colorHex, [{ mesh, shape, lines, depth }]);
        } else {
          byColor.get(colorHex)!.push({ mesh, shape, lines, depth });
        }

        updateMap.push({ shape, mesh, lines });
        svgGroup.add(mesh, lines);
      });
    });

    // Generate base layer if enabled
    if (baseLayer?.enabled && allShapes.length > 0) {
      allShapes.forEach((shape) => {
        const baseGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: baseLayer.height,
          bevelEnabled: false,
          curveSegments: curveSegments,
        });
        
        const baseColor = new THREE.Color(`#${baseLayer.color}`);
        const baseMaterial = new THREE.MeshBasicMaterial({ color: baseColor });
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        const baseLinesGeometry = new THREE.EdgesGeometry(baseGeometry);
        const baseLines = new THREE.LineSegments(baseLinesGeometry, stokeMaterial);
        
        // Apply mirroring to base layer
        if (mirrorSettings) {
          if (mirrorSettings.mirrorX) {
            baseMesh.scale.x *= -1;
            baseLines.scale.x *= -1;
          }
          if (mirrorSettings.mirrorY) {
            baseMesh.scale.y *= -1;
            baseLines.scale.y *= -1;
          }
        }
        
        // Position base layer below all existing layers (including any overlap systems)
        // This ensures the base layer acts as a true foundation
        baseMesh.position.z = -baseLayer.height - 1.0; // Gap below overlap systems
        baseLines.position.z = -baseLayer.height - 1.0;
        
        svgGroup.add(baseMesh, baseLines);
      });
    }

    const box = new THREE.Box3().setFromObject(svgGroup);
    const size = box.getSize(new THREE.Vector3());
    const yOffset = size.y / -2;
    const xOffset = size.x / -2;

    svgGroup.children.forEach((item) => {
      item.position.x = xOffset;
      item.position.y = yOffset;
      item.scale.set(scaleFactor, scaleFactor, scaleFactor);
    });
    svgGroup.rotateX(-Math.PI / 2);

    return {
      object: svgGroup,
      byColor,
      update(extrusion: number, colorHex: string) {
        const toUpdate = byColor.get(colorHex);
        if (toUpdate) {
          toUpdate.forEach((updateDetails) => {
            const meshGeometry = new THREE.ExtrudeGeometry(updateDetails.shape, {
              depth: extrusion,
              bevelEnabled: false,
              curveSegments: curveSegments, // Use the quality settings
            });
            const linesGeometry = new THREE.EdgesGeometry(meshGeometry);

            updateDetails.mesh.geometry.dispose();
            updateDetails.lines.geometry.dispose();
            updateDetails.mesh.geometry = meshGeometry;
            updateDetails.lines.geometry = linesGeometry;
          });
        }
      },
    };
  } catch (error) {
    console.error('Error parsing SVG:', error);
    throw new Error(`Failed to parse SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy class for backward compatibility
export class ClientSVGTo3D {
  private defaultDepth = 2.0;

  constructor() {}

  renderSVG(svgData: string) {
    const colorDepths: ColorDepth = {};
    return renderSVG(svgData, colorDepths);
  }
}
