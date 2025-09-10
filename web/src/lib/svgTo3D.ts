import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

interface ColorLayer {
  color: string;
  paths: string[];
  depth: number;
}

interface SVGShape {
  path: string;
  color: string;
  mesh?: THREE.Mesh;
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
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const paths = svgDoc.querySelectorAll('path');
    
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

  // Convert SVG path to Three.js shape
  private pathToShape(pathData: string): THREE.Shape {
    const shape = new THREE.Shape();
    
    // Basic SVG path parsing - simplified for common cases
    const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
    
    commands.forEach((command) => {
      const type = command[0].toUpperCase();
      const coords = command.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      
      switch (type) {
        case 'M': // Move to
          if (coords.length >= 2) {
            shape.moveTo(coords[0], -coords[1]); // Flip Y axis
          }
          break;
        case 'L': // Line to
          if (coords.length >= 2) {
            shape.lineTo(coords[0], -coords[1]);
          }
          break;
        case 'H': // Horizontal line
          if (coords.length >= 1) {
            const currentPoint = shape.currentPoint;
            shape.lineTo(coords[0], currentPoint.y);
          }
          break;
        case 'V': // Vertical line
          if (coords.length >= 1) {
            const currentPoint = shape.currentPoint;
            shape.lineTo(currentPoint.x, -coords[0]);
          }
          break;
        case 'Z': // Close path
          shape.closePath();
          break;
        // Add more path commands as needed
      }
    });
    
    return shape;
  }

  // Generate 3D meshes from color layers
  generate3D(): Map<string, THREE.Mesh[]> {
    const meshesByColor = new Map<string, THREE.Mesh[]>();
    
    this.colorLayers.forEach((layer, colorKey) => {
      const meshes: THREE.Mesh[] = [];
      
      layer.paths.forEach((pathData) => {
        try {
          const shape = this.pathToShape(pathData);
          
          // Create extruded geometry
          const extrudeSettings = {
            depth: layer.depth,
            bevelEnabled: false,
            steps: 1
          };
          
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          
          // Create material
          const material = new THREE.MeshBasicMaterial({
            color: `#${colorKey}`,
            side: THREE.DoubleSide
          });
          
          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData = { color: colorKey, depth: layer.depth };
          
          meshes.push(mesh);
        } catch (error) {
          console.warn('Failed to process path:', pathData, error);
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
        
        // Rotate for proper STL orientation
        clonedMesh.rotation.x = -Math.PI / 2;
        
        combinedScene.add(clonedMesh);
      });
      
      // Move to next layer height
      const layer = this.colorLayers.get(color);
      if (layer) {
        currentHeight += layer.depth + this.defaultBaseHeight;
      }
    });
    
    combinedScene.updateMatrixWorld(true);
    
    // Export as STL
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
        clonedMesh.rotation.x = -Math.PI / 2; // Proper STL orientation
        colorScene.add(clonedMesh);
      });
      
      colorScene.updateMatrixWorld(true);
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
