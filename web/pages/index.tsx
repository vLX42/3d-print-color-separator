import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
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
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { STLPreview } from "@/components/STLPreview";

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

  // STL conversion state
  const [colorDepths, setColorDepths] = useState<Record<string, number>>({});
  const [isConvertingSTL, setIsConvertingSTL] = useState(false);
  const [stlProgress, setStlProgress] = useState(0);

  // STL quality settings
  const [stlQuality, setStlQuality] = useState({
    curveSegments: 8,
    scaleFactor: 2.0, // Changed from 1.0 to 2.0 for even better visibility
  });

  // Debounced quality settings for preview (to avoid constant re-rendering)
  const [debouncedStlQuality, setDebouncedStlQuality] = useState({
    curveSegments: 8,
    scaleFactor: 2.0, // Changed from 1.0 to 2.0 for even better visibility
  });

  // Debounce quality settings changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStlQuality(stlQuality);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [stlQuality]);

  // Convert different file types to PNG format
  const convertToPng = async (
    file: File
  ): Promise<{ imageFile: File; image: HTMLImageElement }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        // Create canvas to convert to PNG
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // For JPG files, add white background to preserve colors
        if (file.type === "image/jpeg" || file.type === "image/jpg") {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        // Convert canvas to PNG blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Could not convert to PNG"));
            return;
          }

          // Create new File object with PNG format
          const pngFile = new File(
            [blob],
            `converted_${file.name.split(".")[0]}.png`,
            {
              type: "image/png",
            }
          );

          resolve({ imageFile: pngFile, image: img });
        }, "image/png");
      };

      img.onerror = () => {
        reject(new Error("Could not load image"));
      };

      // Handle different file types
      if (file.type === "image/svg+xml") {
        // For SVG, read as text and create data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          const svgText = e.target?.result as string;
          const blob = new Blob([svgText], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          img.src = url;
        };
        reader.readAsText(file);
      } else {
        // For PNG/JPG, read as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      try {
        if (file.type === "image/png") {
          // PNG files can be used directly
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
        } else {
          // Convert other formats to PNG
          const { imageFile, image } = await convertToPng(file);
          setImage(image);
          setImageFile(imageFile);
          setProgress(10);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        alert("Error processing file. Please try a different image.");
      }
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

      // Initialize color depths for STL conversion
      initializeColorDepths(quantizedPalette);

      setProgress(40);

      // Wait a bit to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 2: Separate Colors
      const separated = separateColors(image, quantizedPalette);
      setSeparatedImages(separated);
      setProgress(60);

      // Wait a bit to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 3: Trace to SVG
      const svgPromises = separated.map(async (imgSrc, index) => {
        const traceFormData = new FormData();

        // Convert data URL to blob
        const response = await fetch(imgSrc);
        const blob = await response.blob();
        traceFormData.append("image", blob, `separated-${index}.png`);

        // Get the corresponding color for this layer
        const color = quantizedPalette[index];
        const hexColor = `#${color.map((c: number) => c.toString(16).padStart(2, "0")).join("")}`;
        traceFormData.append("color", hexColor);

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

        if (!svgResult.svg || svgResult.svg.trim() === "") {
          return "";
        }

        return svgResult.svg;
      });

      const tracedSvgs = await Promise.all(svgPromises);
      setSvgs(tracedSvgs);
      setProgress(80);

      // Wait a bit to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 4: Join SVGs
      const result = joinSvg(tracedSvgs);
      setJoinedSvg(result);
      setProgress(100);
    } catch (error) {
      console.error("Conversion failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Conversion failed: ${errorMessage}`);
      setProgress(0);
    } finally {
      setIsConverting(false);
    }
  };

  // Initialize color depths when palette is set
  const initializeColorDepths = (paletteColors: number[][]) => {
    const depths: Record<string, number> = {};
    paletteColors.forEach((color) => {
      const hexColor = color
        .map((c: number) => c.toString(16).padStart(2, "0"))
        .join("");
      depths[hexColor] = 2.0; // Default 2mm depth
    });
    setColorDepths(depths);
  };

  // Update color depth
  const updateColorDepth = (color: string, depth: number) => {
    setColorDepths((prev) => ({
      ...prev,
      [color]: depth,
    }));
  };

  // Convert SVG to STL
  const convertToSTL = async (
    exportType: "combined" | "separate" = "combined"
  ) => {
    if (!joinedSvg) {
      alert("Please complete the SVG conversion first");
      return;
    }

    setIsConvertingSTL(true);
    setStlProgress(0);

    try {
      setStlProgress(25);

      const response = await fetch("/api/convert-stl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          svgContent: joinedSvg,
          colorDepths: colorDepths, // Fixed: use colorDepths instead of depths
          exportType,
          qualitySettings: stlQuality,
        }),
      });

      setStlProgress(75);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`STL conversion failed: ${errorText}`);
      }

      // Handle binary response instead of JSON
      const blob = await response.blob();
      setStlProgress(90);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Set filename based on export type
      if (exportType === "separate") {
        a.download = "stl-layers.zip";
      } else {
        a.download = "combined.stl";
      }

      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStlProgress(100);

      // Reset progress after a moment
      setTimeout(() => setStlProgress(0), 2000);
    } catch (error) {
      console.error("STL conversion failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`STL conversion failed: ${errorMessage}`);
      setStlProgress(0);
    } finally {
      setIsConvertingSTL(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          3D Print Color Separator - Multi-Material 3D Printing Tool
        </title>
        <meta
          name="description"
          content="Convert AI-generated logos and designs into multi-color 3D printable files. Automatically separate colors for multi-material 3D printing. Compatible with svg2solid and major slicers."
        />
        <meta
          name="keywords"
          content="3D printing, multi-color, multi-material, Prusa MMU, Bambu AMS, svg2solid, color separation, 3D printer, filament, layers"
        />
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
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              3D Print Color Separator
            </h1>
            <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              Transform your AI-generated logos and designs into multi-color 3D
              printable files. Automatically separate colors into individual
              layers perfect for multi-material 3D printing.
            </p>
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
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white"
                  >
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <polyline
                      points="14,2 14,8 20,8"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  Setup & Convert
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <Label
                    htmlFor="image-upload"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    Upload Your Design
                  </Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    onChange={handleFileChange}
                    className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors p-4 h-auto"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload PNG, JPG, or SVG images with clear color separation
                    for best results
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      2
                    </span>
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
                        <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          3
                        </span>
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
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white"
                  >
                    <path
                      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <polyline
                      points="7,10 12,15 17,10"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <line
                      x1="12"
                      y1="15"
                      x2="12"
                      y2="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  3D Print Ready Output
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {joinedSvg ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-green-700 mb-2">
                        🎉 Ready for 3D Printing!
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your design has been separated into {svgs.length} color
                        layers
                      </p>
                    </div>
                    <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50/50">
                      <div
                        className="mb-4 border rounded-lg p-4 bg-white flex items-center justify-center svg-preview shadow-sm"
                        style={{ minHeight: "200px" }}
                        dangerouslySetInnerHTML={{ __html: joinedSvg }}
                      />
                      <Button
                        onClick={() =>
                          downloadFile(joinedSvg, "3d-print-layers.svg")
                        }
                        className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-white"
                          >
                            <path
                              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <polyline
                              points="7,10 12,15 17,10"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <line
                              x1="12"
                              y1="15"
                              x2="12"
                              y2="3"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                          Download 3D Print SVG
                        </div>
                      </Button>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 mb-2">
                        Next Steps for 3D Printing:
                      </h4>
                      <ol className="text-sm text-blue-700 space-y-1">
                        <li>
                          1. Use a tool like{" "}
                          <a
                            href="https://svg2solid.rknt.de/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-900"
                          >
                            svg2solid.rknt.de
                          </a>{" "}
                          to convert SVG to 3D
                        </li>
                        <li>2. Export as 3MF format with layer separation</li>
                        <li>
                          3. Import into your slicer (PrusaSlicer, Cura, etc.)
                        </li>
                        <li>
                          4. Assign different filaments to each color layer
                        </li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎨</div>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">
                      No design processed yet
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Upload a PNG image and convert it to see your 3D
                      print-ready layers here
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
              <Label
                htmlFor="debug-toggle"
                className="text-sm text-muted-foreground"
              >
                Show Individual Layer Details
              </Label>
            </div>
          </div>

          {debug && (
            <div className="mt-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Individual 3D Print Layers
                </h2>
                <p className="text-muted-foreground">
                  Each layer represents a different filament color for your 3D
                  printer
                </p>
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
                                  const link = document.createElement("a");
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
                          Individual print layers ready for multi-material
                          printing
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
                                style={{ minHeight: "64px" }}
                              >
                                <div
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "48px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: svg.replace(
                                      /<svg([^>]*)>/,
                                      '<svg$1 style="max-width: 100%; max-height: 48px; width: auto; height: auto;">'
                                    ),
                                  }}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-6"
                                onClick={() =>
                                  downloadFile(
                                    svg,
                                    `vector-layer-${index + 1}.svg`
                                  )
                                }
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

          {/* STL Conversion Section - Skeleton when no content */}
          {(!joinedSvg || joinedSvg.trim() === "") && (
            <div className="mt-8">
              <Card className="shadow-lg border-0 bg-gradient-to-br from-gray-50 to-gray-100">
                <CardHeader className="bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-t-lg">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="text-lg opacity-50">🔷</span>
                    </div>
                    3D Print Ready
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6 opacity-50">
                    <div>
                      <h3 className="font-semibold text-gray-600 mb-3">
                        🎛️ Layer Depths
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Upload an image to access 3D model generation and layer
                        depth controls.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Skeleton depth controls */}
                        {[1, 2, 3, 4].map((index) => (
                          <div
                            key={index}
                            className="bg-gray-100 rounded-lg p-4 border-2 border-gray-200"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-6 h-6 bg-gray-300 rounded animate-pulse"></div>
                              <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-gray-400">
                                <span>Depth (mm)</span>
                                <div className="h-3 bg-gray-300 rounded w-8 animate-pulse"></div>
                              </div>
                              <div className="h-6 bg-gray-300 rounded animate-pulse"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-600 mb-3">
                        ⚙️ Quality Settings
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-300 rounded w-32 animate-pulse"></div>
                          <div className="h-6 bg-gray-300 rounded animate-pulse"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-300 rounded w-24 animate-pulse"></div>
                          <div className="h-6 bg-gray-300 rounded animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-600 mb-3">
                        👁️ 3D Preview
                      </h3>
                      <div className="w-full h-96 rounded-lg border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                        <div className="text-center text-gray-400">
                          <div className="text-6xl mb-4 opacity-30">📦</div>
                          <div className="text-lg font-medium mb-2">
                            3D Preview
                          </div>
                          <div className="text-sm">
                            Upload and convert an image to see your 3D model
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="bg-gray-300 text-gray-500 px-6 py-3 rounded-lg cursor-not-allowed">
                        📦 Upload an image first
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* STL Conversion Section - Active when content available */}
          {joinedSvg && joinedSvg.trim() !== "" && (
            <div className="mt-8">
              <div className="text-green-500 font-bold mb-4">
                DEBUG: ACTIVE SECTION SHOWING
              </div>
              <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="text-lg">🔷</span>
                    </div>
                    3D Print Ready
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">
                        🎛️ Layer Depths
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Adjust the thickness (in mm) for each color layer.
                        Higher values create more prominent features.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {palette &&
                          palette.map((color, index) => {
                            const hexColor = color
                              .map((c: number) =>
                                c.toString(16).padStart(2, "0")
                              )
                              .join("");
                            return (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-white rounded-lg border"
                              >
                                <div
                                  className="w-6 h-6 rounded border-2 border-gray-300"
                                  style={{ backgroundColor: `#${hexColor}` }}
                                />
                                <div className="flex-1">
                                  <Label className="text-sm font-medium">
                                    Color {index + 1}
                                  </Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Slider
                                      value={[colorDepths[hexColor] || 2.0]}
                                      onValueChange={(value) =>
                                        updateColorDepth(hexColor, value[0])
                                      }
                                      max={10}
                                      min={0.5}
                                      step={0.1}
                                      className="flex-1"
                                    />
                                    <span className="text-sm text-gray-600 w-12">
                                      {(colorDepths[hexColor] || 2.0).toFixed(
                                        1
                                      )}
                                      mm
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* STL Quality Settings */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-semibold text-gray-800">
                          ⚙️ Quality Settings
                        </h3>
                        {JSON.stringify(stlQuality) !==
                          JSON.stringify(debouncedStlQuality) && (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            Updating...
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Curve Quality: {stlQuality.curveSegments} segments
                          </label>
                          <input
                            type="range"
                            min="2"
                            max="64"
                            value={stlQuality.curveSegments}
                            onChange={(e) =>
                              setStlQuality((prev) => ({
                                ...prev,
                                curveSegments: parseInt(e.target.value),
                              }))
                            }
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Fast (2)</span>
                            <span>Balanced (8)</span>
                            <span>Ultra High (64)</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Model Scale:{" "}
                            {(stlQuality.scaleFactor * 100).toFixed(0)}%
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={stlQuality.scaleFactor}
                            onChange={(e) =>
                              setStlQuality((prev) => ({
                                ...prev,
                                scaleFactor: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Small (10%)</span>
                            <span>Normal (25%)</span>
                            <span>Large (100%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3D Preview */}
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">
                        👁️ 3D Preview
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Interactive preview of your 3D model. Drag to rotate,
                        scroll to zoom.
                      </p>
                      <STLPreview
                        svgContent={joinedSvg}
                        colorDepths={colorDepths}
                        qualitySettings={debouncedStlQuality}
                        className="mb-4"
                      />
                    </div>

                    <div className="flex justify-center">
                      <Button
                        onClick={() => convertToSTL("separate")}
                        disabled={isConvertingSTL}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      >
                        {isConvertingSTL
                          ? "Converting..."
                          : "� Download STL Layer Files"}
                      </Button>
                    </div>

                    {stlProgress > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Converting to STL...</span>
                          <span>{stlProgress}%</span>
                        </div>
                        <Progress value={stlProgress} className="h-2" />
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">
                        💡 3D Printing Tips
                      </h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>
                          • <strong>Layer Files:</strong> Separate STL files for
                          each color - perfect for multi-material printers
                        </li>
                        <li>
                          • <strong>Depth Guidelines:</strong> 0.5-2mm for thin
                          details, 3-5mm for prominent features
                        </li>
                        <li>
                          • <strong>Print Settings:</strong> Use 0.2mm layer
                          height for best detail resolution
                        </li>
                        <li>
                          • <strong>Assembly:</strong> Import each color layer
                          separately in your slicer for proper material
                          assignment
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <footer className="mt-16 py-8 border-t bg-gray-50/50 rounded-lg">
            <div className="max-w-4xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">
                    🖨️ Multi-Material 3D Printing
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Perfect for creating multi-color logos, signs, and
                    decorative objects with your 3D printer. Each color layer
                    can be printed with different filaments for stunning visual
                    effects.
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>
                      • Compatible with PrusaSlicer, Cura, and other major
                      slicers
                    </li>
                    <li>
                      • Works with Qidi Box, Prusa MMU, Bambu AMS, and manual
                      filament changes
                    </li>
                    <li>• Optimized for flat designs and text-based logos</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">
                    🔧 Direct STL Workflow
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Complete 3D printing workflow with direct STL download.
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
                      <span>Download STL files for each color layer</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <span>Import into slicer and assign filament colors</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500 mb-2">
                  Made for makers, designers, and 3D printing enthusiasts.
                  Transform any 2D design into beautiful multi-color 3D prints.
                </p>
                <p className="text-xs text-gray-400">
                  <a
                    href="https://github.com/vLX42/3d-print-color-separator"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-600 underline transition-colors"
                  >
                    View Source Code on GitHub
                  </a>
                  {" • "}
                  Inspired by{" "}
                  <a
                    href="https://svg2solid.rknt.de/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-600 underline transition-colors"
                  >
                    svg2solid.rknt.de
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
