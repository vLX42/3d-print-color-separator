// src/components/Upload.tsx
import React from 'react';

interface UploadProps {
  onImageUpload: (image: HTMLImageElement, file: File) => void;
}

const Upload: React.FC<UploadProps> = ({ onImageUpload }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          onImageUpload(img, file);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <input type="file" accept="image/png" onChange={handleFileChange} />
    </div>
  );
};

export default Upload;
