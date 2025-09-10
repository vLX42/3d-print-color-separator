import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { JSDOM } from 'jsdom';
import { parseSVG } from 'svg-path-parser';

interface ColorLayer {
  color: string;
  paths: string[];
  depth: number;
}

export class SVGTo3D {
  private scene: THREE.Scene;
  private colorLayers: Map<string, ColorLayer> = new Map();
  private defaultDepth = 2.0; // mm
  private defaultBaseHeight = 0.2; // mm for base layer

  constructor() {
    this.scene = new THREE.Scene();
  }

  // Parse SVG and extract color layers
  parseSVG(svgContent: string): void {
    const dom = new JSDOM(svgContent, { contentType: 'image/svg+xml' });
    const document = dom.window.document;
    const paths = document.querySelectorAll('path');
    
    this.colorLayers.clear();

    paths.forEach((path) => {
      const fill = path.getAttribute('fill') || '#000000';
      const pathData = path.getAttribute('d') || '';
      
      if (pathData) {
        const colorKey = fill.replace('#', '');
        
        if (!this.colorLayers.has(colorKey)) {
          this.colorLayers.set(colorKey, {
            color: colorKey,
            paths: [],
            depth: this.defaultDepth
          });
        }
        
        this.colorLayers.get(colorKey)!.paths.push(pathData);
      }
    });
  }

  // Convert SVG path to Three.js Shape using the SVG path parser
  private pathToShape(pathData: string): THREE.Shape {
    const shape = new THREE.Shape();
    
    try {
      const commands = parseSVG(pathData);
      let currentX = 0;
      let currentY = 0;
      let startX = 0;
      let startY = 0;

      commands.forEach((command: any) => {
        switch (command.code) {
          case 'M': // Move to (absolute)
            currentX = command.x || 0;
            currentY = -(command.y || 0); // Flip Y axis for SVG coordinate system
            startX = currentX;
            startY = currentY;
            shape.moveTo(currentX, currentY);
            break;
            
          case 'm': // Move to (relative)
            currentX += command.x || 0;
            currentY -= command.y || 0;
            startX = currentX;
            startY = currentY;
            shape.moveTo(currentX, currentY);
            break;
            
          case 'L': // Line to (absolute)
            currentX = command.x || 0;
            currentY = -(command.y || 0);
            shape.lineTo(currentX, currentY);
            break;
            
          case 'l': // Line to (relative)
            currentX += command.x || 0;
            currentY -= command.y || 0;
            shape.lineTo(currentX, currentY);
            break;
            
          case 'H': // Horizontal line (absolute)
            if (command.x !== undefined) {
              currentX = command.x;
              shape.lineTo(currentX, currentY);
            }
            break;
            
          case 'h': // Horizontal line (relative)
            if (command.x !== undefined) {
              currentX += command.x;
              shape.lineTo(currentX, currentY);
            }
            break;
            
          case 'V': // Vertical line (absolute)
            if (command.y !== undefined) {
              currentY = -command.y;
              shape.lineTo(currentX, currentY);
            }
            break;
            
          case 'v': // Vertical line (relative)
            if (command.y !== undefined) {
              currentY -= command.y;
              shape.lineTo(currentX, currentY);
            }
            break;
            
          case 'C': // Cubic Bezier (absolute)
            if (command.x && command.y && command.x1 !== undefined && command.y1 !== undefined && command.x2 !== undefined && command.y2 !== undefined) {
              const cp1x = command.x1;
              const cp1y = -command.y1;
              const cp2x = command.x2;
              const cp2y = -command.y2;
              const x = command.x;
              const y = -command.y;
              
              shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
              currentX = x;
              currentY = y;
            }
            break;
            
          case 'c': // Cubic Bezier (relative)
            if (command.x && command.y && command.x1 !== undefined && command.y1 !== undefined && command.x2 !== undefined && command.y2 !== undefined) {
              const cp1x = currentX + command.x1;
              const cp1y = currentY - command.y1;
              const cp2x = currentX + command.x2;
              const cp2y = currentY - command.y2;
              const x = currentX + command.x;
              const y = currentY - command.y;
              
              shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
              currentX = x;
              currentY = y;
            }
            break;
            
          case 'Q': // Quadratic Bezier (absolute)
            if (command.x && command.y && command.x1 !== undefined && command.y1 !== undefined) {
              const cpx = command.x1;
              const cpy = -command.y1;
              const x = command.x;
              const y = -command.y;
              
              shape.quadraticCurveTo(cpx, cpy, x, y);
              currentX = x;
              currentY = y;
            }
            break;
            
          case 'q': // Quadratic Bezier (relative)
            if (command.x && command.y && command.x1 !== undefined && command.y1 !== undefined) {
              const cpx = currentX + command.x1;
              const cpy = currentY - command.y1;
              const x = currentX + command.x;
              const y = currentY - command.y;
              
              shape.quadraticCurveTo(cpx, cpy, x, y);
              currentX = x;
              currentY = y;
            }
            break;
            
          case 'Z': // Close path
          case 'z':
            shape.closePath();
            break;
        }
      });

      return shape;
    } catch (error) {
      console.warn('Failed to parse SVG path:', pathData, error);
      // Fallback: create a simple rectangle if parsing fails
      const fallbackShape = new THREE.Shape();
      fallbackShape.moveTo(0, 0);
      fallbackShape.lineTo(10, 0);
      fallbackShape.lineTo(10, 10);
      fallbackShape.lineTo(0, 10);
      fallbackShape.closePath();
      return fallbackShape;
    }
  }

  // Generate 3D meshes from color layers using ExtrudeGeometry
  generate3D(): Map<string, THREE.Mesh[]> {
    const meshesByColor = new Map<string, THREE.Mesh[]>();
    
    this.colorLayers.forEach((layer, colorKey) => {
      const meshes: THREE.Mesh[] = [];
      
      layer.paths.forEach((pathData, pathIndex) => {
        try {
          const shape = this.pathToShape(pathData);
          
          // Create extruded geometry with proper settings for STL export
          const extrudeSettings = {
            depth: layer.depth,
            bevelEnabled: false,
            steps: 1,
            curveSegments: 12 // Smooth curves
          };
          
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          
          // Ensure proper geometry
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          geometry.computeVertexNormals();
          
          // Create material
          const material = new THREE.MeshBasicMaterial({
            color: `#${colorKey}`,
            side: THREE.DoubleSide
          });
          
          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData = { 
            color: colorKey, 
            depth: layer.depth, 
            pathIndex 
          };
          
          meshes.push(mesh);
        } catch (error) {
          console.warn(`Failed to process path ${pathIndex} for color ${colorKey}:`, error);
        }
      });
      
      if (meshes.length > 0) {
        meshesByColor.set(colorKey, meshes);
      }
    });
    
    return meshesByColor;
  }

  // Update depth for a specific color
  updateDepth(color: string, depth: number): void {
    const layer = this.colorLayers.get(color);
    if (layer) {
      layer.depth = depth;
    }
  }

  // Export single multi-color STL file
  exportMultiColorSTL(): string {
    const exporter = new STLExporter();
    const combinedScene = new THREE.Scene();
    const meshesByColor = this.generate3D();
    
    // Combine all meshes into one scene with height offsets
    let currentHeight = 0;
    
    meshesByColor.forEach((meshes, color) => {
      meshes.forEach((mesh) => {
        const clonedMesh = mesh.clone();
        
        // Position mesh at current height
        clonedMesh.position.z = currentHeight;
        
        // Ensure mesh world matrix is updated
        clonedMesh.updateMatrixWorld(true);
        
        combinedScene.add(clonedMesh);
      });
      
      // Move to next layer height
      const layer = this.colorLayers.get(color);
      if (layer) {
        currentHeight += layer.depth + this.defaultBaseHeight;
      }
    });
    
    // Update scene world matrix
    combinedScene.updateMatrixWorld(true);
    
    // Export as STL with proper options
    return exporter.parse(combinedScene, { binary: false });
  }

  // Export separate STL files for each color
  exportSeparateSTLs(): Map<string, string> {
    const exporter = new STLExporter();
    const stlFiles = new Map<string, string>();
    const meshesByColor = this.generate3D();
    
    meshesByColor.forEach((meshes, color) => {
      const colorScene = new THREE.Scene();
      
      meshes.forEach((mesh) => {
        const clonedMesh = mesh.clone();
        clonedMesh.updateMatrixWorld(true);
        colorScene.add(clonedMesh);
      });
      
      // Update scene world matrix
      colorScene.updateMatrixWorld(true);
      
      // Export as STL
      const stlContent = exporter.parse(colorScene, { binary: false });
      stlFiles.set(color, stlContent);
    });
    
    return stlFiles;
  }

  // Get available colors and their current depths
  getColorLayers(): Array<{ color: string; depth: number; pathCount: number }> {
    return Array.from(this.colorLayers.entries()).map(([color, layer]) => ({
      color,
      depth: layer.depth,
      pathCount: layer.paths.length
    }));
  }
}
