import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { toast } from 'react-toastify';
import { ImageEditorProps } from '../types';
import { Box, Button, Typography, Paper, Stack, Avatar } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload'; 

// Center the crop on load
function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
): Crop {
    return centerCrop(
      makeAspectCrop(
      {
        unit: '%',
        width: 90, // Start with 90% width crop
      },
        aspect,
        mediaWidth,
        mediaHeight,
      ),
      mediaWidth,
      mediaHeight,
    );
}


const ImageEditor: React.FC<ImageEditorProps> = ({
    onImageUpload,
    type,
    aspectRatio,
    onClose, 
}) => {
  const defaultAspectRatio = type === 'avatar' ? 1 / 1 : 16 / 9; 
  const finalAspectRatio = aspectRatio || defaultAspectRatio;

  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null); 

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); 
      const reader = new FileReader();
      reader.addEventListener('load', () => setSrc(reader.result?.toString() || null));
      reader.readAsDataURL(e.target.files[0]);
    } else {
      setSrc(null); 
    }
      e.target.value = ''; 
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, finalAspectRatio));
    imgRef.current = e.currentTarget; 
  }, [finalAspectRatio]);


  useEffect(() => {
    if (
      !completedCrop ||
      !previewCanvasRef.current ||
      !imgRef.current
    ) {
      return;
    }

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio || 1; // For higher resolution displays

    canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      completedCrop.width * scaleX, // Draw at original crop size on canvas
      completedCrop.height * scaleY,
    );

}, [completedCrop]);

const generateCroppedImageBlob = useCallback(async (): Promise<Blob | null> => {
    if (!completedCrop || !imgRef.current) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas'); // Use canvas for blob generation
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to the desired output size
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width, // Draw filling the canvas
      canvas.height
    );

    // Return a promise that resolves with the blob
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
            resolve(blob);
        },
        'image/png',
        0.9 
      );
    });
  }, [completedCrop]);

  const handleSave = async () => {
    const imageBlob = await generateCroppedImageBlob();
    if (imageBlob) {
      onImageUpload(imageBlob); 
      toast.success('Image processed!');
      if (onClose) onClose(); // Close the modal on successful save
    } else {
      toast.error('Could not crop image. Please select an image and define a crop area.');
    }
  };

  const handleCancel = () => {
    setSrc(null);
    setCrop(undefined);
    setCompletedCrop(null);
    if (onClose) onClose(); 
  }

  return (
    <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 'md', width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Edit {type === 'avatar' ? 'Avatar' : 'Cover Photo'}
      </Typography>

      {/* File Input - Styled */}
      <Button
        component="label" 
        variant="outlined"
        startIcon={<CloudUploadIcon />}
        fullWidth
      >
        {src ? 'Change Image' : 'Upload Image'}
        <input
          type="file"
          accept="image/*"
          hidden 
          onChange={onSelectFile}
        />
      </Button>

      {src && (
        <Stack spacing={2} alignItems="center">
          <Typography variant="body2" color="text.secondary">Crop your image:</Typography>
          <Box sx={{ width: '100%', maxWidth: '500px', maxHeight: '50vh', overflow: 'auto', border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={finalAspectRatio}
              circularCrop={type === 'avatar'} // Apply circular crop
            >
              <img
                src={src}
                alt="Image to crop"
                onLoad={onImageLoad}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '45vh' }} // display size
              />
            </ReactCrop>
          </Box>

          {/* Preview Area */}
          {!!completedCrop && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2">Preview</Typography>
            {/* Canvas for high-quality preview */}
            {type === 'avatar' ? (
              <Avatar sx={{ width: 100, height: 100, bgcolor: 'action.disabledBackground' }}>
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    objectFit: 'contain',
                    width: completedCrop.width,
                    height: completedCrop.height,
                    borderRadius: '50%', 
                    display: completedCrop ? 'block' : 'none' // Hide if no crop
                  }}/>
              </Avatar>
            ) : (
                <Box sx={{ border: '1px solid', borderColor: 'divider', width: '100%', maxWidth: 300, aspectRatio: `${finalAspectRatio}` }}>
                  <canvas
                    ref={previewCanvasRef}
                    style={{
                      display: completedCrop ? 'block' : 'none', 
                      objectFit: 'contain',
                      width: '100%', 
                      height: '100%', 
                    }}/>
                </Box>
            )}
          </Box>
          )}
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ width: '100%', mt: 2 }}>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!completedCrop} 
            >
              Save {type === 'avatar' ? 'Avatar' : 'Cover'}
            </Button>
          </Stack>
      </Stack>
      )}
    </Paper>
  );
};

export default ImageEditor;