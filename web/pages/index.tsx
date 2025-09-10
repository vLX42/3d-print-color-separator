import Head from "next/head";
import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { quantize } from "@/lib/quantize";
import { separateColors } from "@/lib/separateColors";
import { joinSvg } from "@/lib/joinSvg";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const [colorCount, setColorCount] = useState(4);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [palette, setPalette] = useState<number[][] | null>(null);
  const [separatedImages, setSeparatedImages] = useState<string[]>([]);
  const [svgs, setSvgs] = useState<string[]>([]);
  const [joinedSvg, setJoinedSvg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [debug, setDebug] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setImageFile(file);
          setProgress(10);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadFile = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConvert = async () => {
    if (!image || !imageFile) return;
    
    setIsConverting(true);
    try {
      setProgress(20);
      
      // Step 1: Quantize Colors
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("colorCount", colorCount.toString());
      
      const quantizeResponse = await fetch("/api/quantize", {
        method: "POST",
        body: formData,
      });
      
      if (!quantizeResponse.ok) {
        throw new Error("Failed to quantize colors");
      }
      
      const quantizeResult = await quantizeResponse.json();
      const quantizedPalette = quantizeResult.palette || quantizeResult;
      setPalette(quantizedPalette);
      setProgress(40);
      
      // Wait a bit to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 2: Separate Colors
      const separated = separateColors(image, quantizedPalette);
      setSeparatedImages(separated);
      setProgress(60);
      
      // Wait a bit to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 3: Trace to SVG
      const svgPromises = separated.map(async (imgSrc, index) => {
        const traceFormData = new FormData();
        
        // Convert data URL to blob
        const response = await fetch(imgSrc);
        const blob = await response.blob();
        traceFormData.append("image", blob, `separated-${index}.png`);
        
        // Get the corresponding color for this layer
        const color = quantizedPalette[index];
        const hexColor = `#${color.map((c: number) => c.toString(16).padStart(2, '0')).join('')}`;
        traceFormData.append("color", hexColor);
        
        console.log(`Tracing SVG ${index} with color ${hexColor}, blob size: ${blob.size}`);
        
        const svgResponse = await fetch("/api/trace", {
          method: "POST",
          body: traceFormData,
        });
        
        if (!svgResponse.ok) {
          const errorText = await svgResponse.text();
          console.error(`SVG trace failed for ${index}:`, errorText);
          throw new Error(`Failed to trace SVG ${index}: ${errorText}`);
        }
        
        const svgResult = await svgResponse.json();
        console.log(`SVG ${index} result:`, svgResult);
        
        if (!svgResult.svg || svgResult.svg.trim() === "") {
          console.warn(`Empty SVG result for ${index}`);
          return "";
        }
        
        return svgResult.svg;
      });
      
      const tracedSvgs = await Promise.all(svgPromises);
      setSvgs(tracedSvgs);
      setProgress(80);
      
      // Wait a bit to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 4: Join SVGs
      const result = joinSvg(tracedSvgs);
      setJoinedSvg(result);
      setProgress(100);
      
    } catch (error) {
      console.error("Conversion failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Conversion failed: ${errorMessage}`);
      setProgress(0);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <>
      <Head>
        <title>3D Print Color Separator - Multi-Material 3D Printing Tool</title>
        <meta name="description" content="Convert AI-generated logos and designs into multi-color 3D printable files. Automatically separate colors for multi-material 3D printing. Compatible with svg2solid and major slicers." />
        <meta name="keywords" content="3D printing, multi-color, multi-material, Prusa MMU, Bambu AMS, svg2solid, color separation, 3D printer, filament, layers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div
        className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 text-foreground ${geistSans.variable} ${geistMono.variable}`}
      >
        <main className="container mx-auto p-4 md:p-8">
          <header className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-2xl shadow-lg">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              3D Print Color Separator
            </h1>
            <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              Transform your AI-generated logos and designs into multi-color 3D printable files. 
              Automatically separate colors into individual layers perfect for multi-material 3D printing.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-blue-800 text-sm">
                <strong>🎯 3D Printing Ready:</strong> Output is fully compatible with{" "}
                <a 
                  href="https://svg2solid.rknt.de/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  svg2solid.rknt.de
                </a>
                {" "}for converting to 3D models with proper layer separation
              </p>
            </div>
          </header>

          <div className="mb-8">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>Upload</span>
                <span>Process</span>
                <span>Complete</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg">
                <CardTitle className="text-xl flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Setup & Convert
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <Label htmlFor="image-upload" className="text-base font-medium flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                    Upload Your Design
                  </Label>
                  <Input 
                    id="image-upload" 
                    type="file" 
                    accept="image/png" 
                    onChange={handleFileChange}
                    className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors p-4 h-auto"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload PNG images with clear color separation for best results
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                    Colors for 3D Printing: {colorCount}
                  </Label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <Slider
                      defaultValue={[colorCount]}
                      min={2}
                      max={16}
                      step={1}
                      onValueChange={(value) => setColorCount(value[0])}
                      disabled={!image || isConverting}
                      className="mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Each color becomes a separate 3D printer filament layer
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button 
                    onClick={handleConvert} 
                    disabled={!image || isConverting} 
                    className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  >
                    {isConverting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                        Convert to 3D Print Layers
                      </div>
                    )}
                  </Button>
                  {!image && (
                    <p className="text-xs text-center text-muted-foreground">
                      Upload an image to start the conversion process
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-t-lg">
                <CardTitle className="text-xl flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  3D Print Ready Output
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {joinedSvg ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-green-700 mb-2">🎉 Ready for 3D Printing!</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your design has been separated into {svgs.length} color layers
                      </p>
                    </div>
                    <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50/50">
                      <div
                        className="mb-4 border rounded-lg p-4 bg-white flex items-center justify-center svg-preview shadow-sm"
                        style={{ minHeight: '200px' }}
                        dangerouslySetInnerHTML={{ __html: joinedSvg }}
                      />
                      <Button 
                        onClick={() => downloadFile(joinedSvg, "3d-print-layers.svg")}
                        className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/>
                            <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Download 3D Print SVG
                        </div>
                      </Button>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 mb-2">Next Steps for 3D Printing:</h4>
                      <ol className="text-sm text-blue-700 space-y-1">
                        <li>1. Upload the SVG to <a href="https://svg2solid.rknt.de/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">svg2solid.rknt.de</a></li>
                        <li>2. Convert to 3MF format with layer separation</li>
                        <li>3. Import into your slicer (PrusaSlicer, Cura, etc.)</li>
                        <li>4. Assign different filaments to each color layer</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎨</div>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No design processed yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload a PNG image and convert it to see your 3D print-ready layers here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <div className="flex items-center justify-center gap-2">
              <Input
                id="debug-toggle"
                type="checkbox"
                checked={debug}
                onChange={() => setDebug(!debug)}
                className="w-4 h-4"
              />
              <Label htmlFor="debug-toggle" className="text-sm text-muted-foreground">
                Show Individual Layer Details
              </Label>
            </div>
          </div>

          {debug && (
            <div className="mt-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Individual 3D Print Layers</h2>
                <p className="text-muted-foreground">Each layer represents a different filament color for your 3D printer</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-md border-0 bg-gradient-to-br from-orange-50 to-red-50">
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold">🎨</span>
                      </div>
                      Color Palette ({palette?.length || 0} colors)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {palette && (
                      <div>
                        <div className="flex flex-wrap gap-2 justify-center mb-3">
                          {palette.map((color, index) => (
                            <div
                              key={index}
                              className="w-10 h-10 rounded-lg border-2 border-white shadow-sm"
                              style={{
                                backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                              }}
                              title={`Filament ${index + 1}: RGB(${color[0]}, ${color[1]}, ${color[2]})`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                          Each color represents a different filament
                        </p>
                      </div>
                    )}
                    {!palette && (
                      <div className="text-center text-muted-foreground py-6 text-sm">
                        Convert your image to see the extracted color palette
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-md border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold">📄</span>
                      </div>
                      Separated Layers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {separatedImages.length > 0 && (
                      <div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {separatedImages.map((imgSrc, index) => (
                            <div key={index} className="space-y-2">
                              <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                                <img
                                  src={imgSrc}
                                  alt={`Layer ${index + 1}`}
                                  className="w-full h-16 object-contain"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-6"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = imgSrc;
                                  link.download = `layer-${index + 1}.png`;
                                  link.click();
                                }}
                              >
                                Layer {index + 1}
                              </Button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                          Individual print layers ready for multi-material printing
                        </p>
                      </div>
                    )}
                    {separatedImages.length === 0 && (
                      <div className="text-center text-muted-foreground py-6 text-sm">
                        Process your image to see separated color layers
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-md border-0 bg-gradient-to-br from-purple-50 to-blue-50">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold">🔧</span>
                      </div>
                      Vector Layers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {svgs.length > 0 && (
                      <div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {svgs.map((svg, index) => (
                            <div key={index} className="space-y-2">
                              <div
                                className="w-full border-2 border-gray-200 rounded-lg p-2 bg-white flex items-center justify-center"
                                style={{ minHeight: '64px' }}
                              >
                                <div
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  dangerouslySetInnerHTML={{ 
                                    __html: svg.replace(
                                      /<svg([^>]*)>/,
                                      '<svg$1 style="max-width: 100%; max-height: 48px; width: auto; height: auto;">'
                                    )
                                  }}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-6"
                                onClick={() => downloadFile(svg, `vector-layer-${index + 1}.svg`)}
                              >
                                SVG {index + 1}
                              </Button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                          Vector paths ready for 3D extrusion
                        </p>
                      </div>
                    )}
                    {svgs.length === 0 && (
                      <div className="text-center text-muted-foreground py-6 text-sm">
                        Complete conversion to see vector layer previews
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          <footer className="mt-16 py-8 border-t bg-gray-50/50 rounded-lg">
            <div className="max-w-4xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">🖨️ Multi-Material 3D Printing</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Perfect for creating multi-color logos, signs, and decorative objects with your 3D printer.
                    Each color layer can be printed with different filaments for stunning visual effects.
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Compatible with PrusaSlicer, Cura, and other major slicers</li>
                    <li>• Works with Prusa MMU, Bambu AMS, and manual filament changes</li>
                    <li>• Optimized for flat designs and text-based logos</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">🔧 Workflow Integration</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Seamlessly integrates with the 3D printing toolchain for professional results.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span>Upload AI-generated logo or design</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      <span>Automatic color separation and vectorization</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>Convert to 3D model via svg2solid.rknt.de</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <span>Slice and print with multiple filaments</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  Made for makers, designers, and 3D printing enthusiasts. 
                  Transform any 2D design into beautiful multi-color 3D prints.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
