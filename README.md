# 3D Print Color Separator

🎨 **Transform any image into multi-color 3D printable files!**

A powerful web application that automatically converts images into separate STL files for multi-material 3D printing. Perfect for creating colorful logos, signs, and decorative objects with your 3D printer.

## ✨ Features

### 🖼️ Image Processing
- **Multi-format support**: Upload PNG, JPG, or SVG images
- **Automatic color separation**: Intelligently separates your image into distinct color layers
- **Transparency handling**: Properly handles transparent pixels in PNG images
- **Quantization control**: Adjust the number of colors (2-16) for optimal printing

### 🔷 3D STL Conversion
- **Direct STL export**: Generate STL files for each color layer
- **Interactive 3D preview**: See your model before printing with Three.js rendering
- **Adjustable layer depths**: Set custom thickness (0.5-10mm) for each color
- **Quality settings**: Control curve segments and model scaling
- **Gap elimination**: Advanced overlap system prevents gaps between color layers
- **Batch download**: Get all STL files in a convenient ZIP package

### 🖨️ 3D Printing Ready
- **Multi-material support**: Compatible with Prusa MMU, Bambu AMS, and manual filament changes
- **Slicer compatibility**: Works with PrusaSlicer, Cura, and other major slicing software
- **Optimized output**: STL files designed for reliable multi-color printing
- **Print guidelines**: Built-in tips for layer heights and material assignment

## 🚀 Live Demo

Try it out at: **https://3dcolors.vlx.dk**

## 🛠️ How It Works

1. **Upload**: Drop your image (PNG, JPG, or SVG)
2. **Configure**: Set the number of colors for separation
3. **Convert**: Automatic color quantization and SVG vectorization
4. **Customize**: Adjust layer depths and quality settings
5. **Preview**: Interactive 3D preview of your model
6. **Download**: Get STL files ready for your 3D printer

## 🎯 Perfect For

- **Multi-material printers**: Prusa MMU, Bambu AMS, manual filament changes
- **Logo printing**: Company logos, gaming emblems, brand designs
- **Decorative objects**: Signs, plaques, artistic pieces
- **AI-generated art**: Bring your AI creations into the physical world
- **Educational projects**: Learning about color separation and 3D printing

## 🔧 Technical Stack

- **Frontend**: Next.js 15.5.2 with React and TypeScript
- **3D Rendering**: Three.js with STLExporter
- **Image Processing**: Canvas API with custom quantization algorithms
- **Vectorization**: Potrace for bitmap to SVG conversion
- **File Handling**: JSZip for multi-file downloads
- **Styling**: Tailwind CSS with custom UI components

## 🏃‍♂️ Local Development

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Setup
```bash
# Clone the repository
git clone https://github.com/vLX42/3d-print-color-separator.git
cd 3d-print-color-separator/web

# Install dependencies
npm install
# or
yarn install
# or
pnpm install

# Run development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
web/
├── pages/
│   ├── index.tsx           # Main application page
│   └── api/
│       ├── convert-stl.ts  # STL conversion endpoint
│       ├── quantize.ts     # Color quantization API
│       └── trace.ts        # SVG tracing API
├── src/
│   ├── components/
│   │   ├── STLPreview.tsx  # 3D model preview component
│   │   └── ui/             # Reusable UI components
│   └── lib/
│       ├── svgTo3D.ts      # SVG to 3D conversion logic
│       ├── quantize.ts     # Color quantization algorithms
│       └── separateColors.ts # Color layer separation
└── public/                 # Static assets
```

## 🎛️ Configuration Options

### Quality Settings
- **Curve Segments**: 2-64 segments (affects model smoothness)
- **Scale Factor**: 10%-100% (controls final model size)
- **Overlap Amount**: 0.5mm overlap for gap-free printing

### Layer Depth Guidelines
- **0.5-2mm**: Thin details, text, fine features
- **3-5mm**: Prominent elements, logos, main features
- **6-10mm**: Raised elements, 3D effects

## 🖨️ 3D Printing Tips

### Recommended Settings
- **Layer Height**: 0.2mm for best detail resolution
- **Infill**: 15-20% for decorative items, 100% for mechanical parts
- **Support**: Usually not needed for flat designs

### Multi-Material Workflow
1. Import each STL file separately in your slicer
2. Assign different materials/colors to each file
3. Ensure proper layer alignment in your slicer
4. Use same print settings for all color layers

### Compatible Printers
- **Prusa MMU**: Direct multi-material printing
- **Bambu AMS**: Automatic material changing
- **Manual changes**: Pause and resume for filament swaps
- **Single color**: Print each layer separately and assemble

## 🤝 Contributing

We welcome contributions! Whether it's:
- Bug reports and feature requests
- Code improvements and optimizations
- Documentation updates
- Testing with different printers and slicers

## 📝 License

This project is open source. Check the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by [svg2solid.rknt.de](https://svg2solid.rknt.de/)
- Built with amazing open-source libraries
- Thanks to the 3D printing community for feedback and testing

## 🔗 Links

- **Live Application**: https://3dcolors.vlx.dk
- **GitHub Repository**: https://github.com/vLX42/3d-print-color-separator
- **Issues & Support**: [GitHub Issues](https://github.com/vLX42/3d-print-color-separator/issues)

---

**Made for makers, designers, and 3D printing enthusiasts. Transform any 2D design into beautiful multi-color 3D prints! 🎨➡️🖨️**
