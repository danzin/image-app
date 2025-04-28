import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { toast } from 'react-toastify';
import { ImageEditorProps } from '../types';

const ImageEditor: React.FC<ImageEditorProps> = ({ 
  onImageUpload, 
  type,
  aspectRatio 
}) => {
  const defaultAspectRatio = type === 'avatar' ? 1 : 2.7;
  const finalAspectRatio = aspectRatio || defaultAspectRatio;
  
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: type === 'avatar' ? 90 : 100,
    height: type === 'avatar' ? 90 : Math.round(100 / finalAspectRatio),
    x: type === 'avatar' ? 5 : 0,
    y: type === 'avatar' ? 5 : 30
  });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setSrc(reader.result as string));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = useCallback((img: HTMLImageElement) => {
    imgRef.current = img;
    
    // Set initial crop based on type and aspect ratio
    if (type === 'avatar') {
      setCrop({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
      });
    } else {
      const height = Math.round(100 / finalAspectRatio);
      setCrop({
        unit: '%',
        width: 100,
        height,
        x: 0,
        y: (100 - height) / 2 // Center vertically aaaaaaaaaaaaaaaaaaaa
      });
    }
  }, [type, finalAspectRatio]);

  const generateCroppedImage = useCallback(() => {
    if (!completedCrop || !imgRef.current) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Calculate scales
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    if (type === 'avatar') {
      // For avatar - make it square and circular [doesn't work]
      const size = Math.min(completedCrop.width, completedCrop.height);
      canvas.width = size;
      canvas.height = size;

      // Draw circular mask for avatar
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
    }

    // Draw image
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas.toDataURL('image/png');
  }, [completedCrop, type]);

  const handleSave = () => {
    const croppedImage = generateCroppedImage();
    if (croppedImage) {
      onImageUpload(croppedImage);
      toast.success('Image processed!');
    } else {
      toast.error('Please crop the image first');
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {!src && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <input 
            type="file" 
            accept="image/*" 
            onChange={onSelectFile}
            className="cursor-pointer"
          />
          <p className="mt-2 text-sm text-gray-500">
            Upload {type === 'avatar' ? 'a profile picture' : 'a cover photo'}
          </p>
        </div>
      )}
      
      {src && (
        <div className="flex flex-col gap-4">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={finalAspectRatio}
            circularCrop={type === 'avatar'}
            className="max-w-full"
          >
            <img 
              src={src} 
              onLoad={(e) => onImageLoad(e.currentTarget)}
              className="max-w-full h-auto"
            />
          </ReactCrop>

          {completedCrop && (
            <div className="flex flex-col items-center gap-2">
              <h4 className="text-lg font-medium">Preview</h4>
              <div 
                className={`
                  ${type === 'avatar' ? 'w-32 h-32 rounded-full' : 'w-full max-w-md'} 
                  overflow-hidden
                `}
                style={type === 'cover' ? { aspectRatio: finalAspectRatio } : undefined}
              >
                <img 
                  src={generateCroppedImage() || ''} 
                  alt="Cropped Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setSrc(null)} 
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default ImageEditor;