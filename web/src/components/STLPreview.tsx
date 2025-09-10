import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { ClientSVGTo3D } from '@/lib/clientSvgTo3D';
import { Button } from './ui/button';

interface STLPreviewProps {
  svgContent: string;
  colorDepths: Record<string, number>;
  className?: string;
}

export const STLPreview: React.FC<STLPreviewProps> = ({
  svgContent,
  colorDepths,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isRotating, setIsRotating] = useState(true);

  useEffect(() => {
    if (!mountRef.current || !svgContent) return;

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
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    newScene.add(directionalLight);

    // Generate 3D models
    const converter = new ClientSVGTo3D();
    converter.parseSVG(svgContent);

    // Update depths
    Object.entries(colorDepths).forEach(([color, depth]) => {
      converter.updateDepth(color, depth);
    });

    const meshesByColor = converter.generate3D();
    let currentHeight = 0;
    const allMeshes: THREE.Mesh[] = [];

    // Add meshes to scene with height offsets
    meshesByColor.forEach((meshes: THREE.Mesh[], color: string) => {
      meshes.forEach((mesh: THREE.Mesh) => {
        const clonedMesh = mesh.clone();
        clonedMesh.position.z = currentHeight;
        clonedMesh.castShadow = true;
        clonedMesh.receiveShadow = true;
        
        newScene.add(clonedMesh);
        allMeshes.push(clonedMesh);
      });
      
      const layer = converter.getColorLayers().find((l: any) => l.color === color);
      if (layer) {
        currentHeight += layer.depth + 0.2; // Base height
      }
    });

    // Fit camera to view all objects
    if (allMeshes.length > 0) {
      const box = new THREE.Box3();
      allMeshes.forEach(mesh => box.expandByObject(mesh));
      
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = newCamera.fov * (Math.PI / 180);
      const cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2)) * 1.5;
      
      newCamera.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.5, center.z + cameraZ);
      newCamera.lookAt(center);
    }

    // Mouse controls
    let mouseX = 0;
    let mouseY = 0;
    let isMouseDown = false;

    const handleMouseDown = (event: MouseEvent) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      const spherical = new THREE.Spherical();
      spherical.setFromVector3(newCamera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      newCamera.position.setFromSpherical(spherical);
      newCamera.lookAt(0, 0, 0);

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      newCamera.position.multiplyScalar(scale);
    };

    newRenderer.domElement.addEventListener('mousedown', handleMouseDown);
    newRenderer.domElement.addEventListener('mouseup', handleMouseUp);
    newRenderer.domElement.addEventListener('mousemove', handleMouseMove);
    newRenderer.domElement.addEventListener('wheel', handleWheel);

    setScene(newScene);
    setRenderer(newRenderer);
    setCamera(newCamera);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (isRotating && allMeshes.length > 0) {
        allMeshes.forEach(mesh => {
          mesh.rotation.z += 0.005;
        });
      }
      
      newRenderer.render(newScene, newCamera);
    };
    animate();

    // Cleanup
    return () => {
      if (mountRef.current && newRenderer.domElement) {
        mountRef.current.removeChild(newRenderer.domElement);
      }
      newRenderer.dispose();
      newScene.clear();
    };
  }, [svgContent, colorDepths, isRotating]);

  // Toggle wireframe mode
  const toggleWireframe = () => {
    if (!scene) return;
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.wireframe = !isWireframe;
      }
    });
    setIsWireframe(!isWireframe);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!camera || !renderer || !mountRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera, renderer]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mountRef} 
        className="w-full h-96 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100"
        style={{ minHeight: '400px' }}
      />
      
      {/* Controls */}
      <div className="absolute top-2 right-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={toggleWireframe}
          className="bg-white/80 backdrop-blur-sm"
        >
          {isWireframe ? '🔲' : '📦'} {isWireframe ? 'Solid' : 'Wire'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsRotating(!isRotating)}
          className="bg-white/80 backdrop-blur-sm"
        >
          {isRotating ? '⏸️' : '▶️'} {isRotating ? 'Pause' : 'Rotate'}
        </Button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-600 bg-white/80 backdrop-blur-sm rounded px-2 py-1">
        🖱️ Drag to rotate • 🔄 Scroll to zoom
      </div>
    </div>
  );
};
