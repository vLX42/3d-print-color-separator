import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { renderSVG } from '@/lib/clientSvgTo3D';
import { Button } from './ui/button';

interface STLPreviewProps {
  svgContent: string;
  colorDepths: Record<string, number>;
  className?: string;
  qualitySettings?: {
    curveSegments: number;
    scaleFactor: number;
  };
}

export const STLPreview: React.FC<STLPreviewProps> = ({
  svgContent,
  colorDepths,
  className = '',
  qualitySettings = { curveSegments: 8, scaleFactor: 2.0 }
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [controls, setControls] = useState<any>(null);
  const [renderResult, setRenderResult] = useState<any>(null);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isRotating, setIsRotating] = useState(true);

  // Fit camera function with proper scale calculation
  const fitCamera = (extrusions: THREE.Group) => {
    if (!camera || !controls) return;
    
    const boundingBox = new THREE.Box3().setFromObject(extrusions);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate the maximum dimension of the model
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // If the model is very small, use a reasonable minimum viewing distance
    const effectiveSize = Math.max(maxDim, 10);
    
    // Calculate camera distance based on the field of view and model size
    const fov = camera.fov * (Math.PI / 180);
    const baseDistance = (effectiveSize * 1.5) / Math.tan(fov / 2);
    const distance = baseDistance / 2.6; // Zoom in 2.6x closer
    
    // Position camera to look at the model from a good angle
    const cameraPosition = new THREE.Vector3(
      center.x + distance * 0.5,
      center.y + distance * 0.5,
      center.z + distance
    );
    
    camera.position.copy(cameraPosition);
    camera.lookAt(center);
    
    // Set up controls
    controls.target.copy(center);
    controls.maxDistance = distance * 3;
    controls.minDistance = distance * 0.2;
    controls.saveState();
    
    // Update camera far plane
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
  };

  useEffect(() => {
    if (!mountRef.current || !svgContent) return;

    // Clean up any existing canvas elements first
    const existingCanvases = mountRef.current.querySelectorAll('canvas');
    existingCanvases.forEach(canvas => {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    });

    // Scene setup
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0xf0f0f0);

    // Camera setup
    const newCamera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    newCamera.position.set(50, 50, 100);
    newCamera.lookAt(0, 0, 0);

    // Renderer setup
    const newRenderer = new THREE.WebGLRenderer({ antialias: true });
    newRenderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    newRenderer.shadowMap.enabled = true;
    newRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(newRenderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    newScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    newScene.add(directionalLight);

    // OrbitControls
    import('three/examples/jsm/controls/OrbitControls').then(({ OrbitControls }) => {
      const newControls = new OrbitControls(newCamera, newRenderer.domElement);
      newControls.enableDamping = true;
      newControls.dampingFactor = 0.05;
      newControls.autoRotate = isRotating;
      newControls.autoRotateSpeed = 2.0;
      setControls(newControls);

      // Load SVG using the new simplified approach with quality settings
      const result = renderSVG(svgContent, colorDepths, qualitySettings);
      
      // Clear scene and add new meshes
      while (newScene.children.length > 2) { // Keep lights
        newScene.remove(newScene.children[2]);
      }
      
      // Add the 3D object to scene
      newScene.add(result.object);
      setRenderResult(result);
      
      // Fit camera to content
      fitCamera(result.object);
      
      setScene(newScene);
      setRenderer(newRenderer);
      setCamera(newCamera);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        newControls.update();
        newRenderer.render(newScene, newCamera);
      };
      animate();
    });

    // Handle window resize
    const handleResize = () => {
      if (mountRef.current && newCamera && newRenderer) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        newCamera.aspect = width / height;
        newCamera.updateProjectionMatrix();
        newRenderer.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && newRenderer.domElement) {
        mountRef.current.removeChild(newRenderer.domElement);
      }
      newRenderer.dispose();
    };
  }, [svgContent, colorDepths, qualitySettings]);

  // Update depths when colorDepths change (using the new update function)
  useEffect(() => {
    if (renderResult && scene) {
      Object.entries(colorDepths).forEach(([color, depth]) => {
        renderResult.update(depth, color);
      });
    }
  }, [colorDepths, renderResult, scene]);

  // Reset view when scale factor changes
  useEffect(() => {
    if (renderResult && controls && qualitySettings) {
      // Add a small delay to ensure the model has been updated
      const timer = setTimeout(() => {
        resetView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [qualitySettings?.scaleFactor, renderResult, controls]);

  // Toggle wireframe mode
  const toggleWireframe = () => {
    if (renderResult && scene) {
      renderResult.byColor.forEach((colorData: any[]) => {
        colorData.forEach((data: any) => {
          const material = data.mesh.material as THREE.MeshLambertMaterial;
          if (isWireframe) {
            // Switch back to solid
            material.wireframe = false;
          } else {
            // Switch to wireframe
            material.wireframe = true;
          }
        });
      });
      setIsWireframe(!isWireframe);
    }
  };

  // Toggle auto-rotation
  const toggleRotation = () => {
    if (controls) {
      controls.autoRotate = !isRotating;
      setIsRotating(!isRotating);
    }
  };

  // Reset camera view
  const resetView = () => {
    if (renderResult && controls) {
      fitCamera(renderResult.object);
      controls.reset();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mountRef} 
        className="w-full h-96 rounded-lg border-2 border-gray-200 bg-gray-50"
        style={{ minHeight: '400px' }}
      />
      
      {/* Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleWireframe}
          className="bg-white/90 backdrop-blur-sm"
        >
          {isWireframe ? 'Solid' : 'Wireframe'}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={toggleRotation}
          className="bg-white/90 backdrop-blur-sm"
        >
          {isRotating ? 'Stop' : 'Rotate'}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={resetView}
          className="bg-white/90 backdrop-blur-sm"
        >
          Reset View
        </Button>
      </div>
      
      {/* Info overlay */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-600">
        <div>Left click + drag: Rotate</div>
        <div>Right click + drag: Pan</div>
        <div>Scroll: Zoom</div>
      </div>
    </div>
  );
};
