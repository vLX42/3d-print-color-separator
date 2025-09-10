import * as THREE from 'three';

interface ColorLayer {
  color: string;
  paths: string[];
  depth: number;
}

export class ClientSVGTo3D {
  private colorLayers: Map<string, ColorLayer> = new Map();
  private defaultDepth = 2.0;

  // Parse SVG in browser environment
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

  // Simple SVG path to shape conversion for preview
  private pathToShape(pathData: string): THREE.Shape {
    const shape = new THREE.Shape();
    
    // Basic SVG path parsing for preview
    const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
    
    commands.forEach((command) => {
      const type = command[0].toUpperCase();
      const coords = command.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      
      switch (type) {
        case 'M': // Move to
          if (coords.length >= 2) {
            shape.moveTo(coords[0], -coords[1]);
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
            if (currentPoint) {
              shape.lineTo(coords[0], currentPoint.y);
            }
          }
          break;
        case 'V': // Vertical line
          if (coords.length >= 1) {
            const currentPoint = shape.currentPoint;
            if (currentPoint) {
              shape.lineTo(currentPoint.x, -coords[0]);
            }
          }
          break;
        case 'Z': // Close path
        case 'z':
          shape.closePath();
          break;
      }
    });
    
    return shape;
  }

  // Update depth for a specific color
  updateDepth(color: string, depth: number): void {
    const layer = this.colorLayers.get(color);
    if (layer) {
      layer.depth = depth;
    }
  }

  // Generate 3D meshes for preview
  generate3D(): Map<string, THREE.Mesh[]> {
    const meshesByColor = new Map<string, THREE.Mesh[]>();
    
    this.colorLayers.forEach((layer, colorKey) => {
      const meshes: THREE.Mesh[] = [];
      
      layer.paths.forEach((pathData, pathIndex) => {
        try {
          const shape = this.pathToShape(pathData);
          
          // Create extruded geometry for preview
          const extrudeSettings = {
            depth: layer.depth,
            bevelEnabled: false,
            steps: 1
          };
          
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          
          // Create material with the color
          const material = new THREE.MeshLambertMaterial({
            color: `#${colorKey}`,
            side: THREE.DoubleSide
          });
          
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

  // Get available colors and their current depths
  getColorLayers(): Array<{ color: string; depth: number; pathCount: number }> {
    return Array.from(this.colorLayers.entries()).map(([color, layer]) => ({
      color,
      depth: layer.depth,
      pathCount: layer.paths.length
    }));
  }
}
