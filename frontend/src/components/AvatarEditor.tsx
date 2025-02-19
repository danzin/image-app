import React, { useState } from 'react';
import Avatar from 'react-avatar-edit';
//TODO: CHANGE  THIS WHOLE THING
interface AvatarEditorProps {
  onImageUpload: (croppedImage: string | null) => void;
}

const AvatarEditor: React.FC<AvatarEditorProps> = ({ onImageUpload }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [src, _setSrc] = useState<string | undefined>(undefined);

  const onClose = () => {
    setPreview(null);
  };

  const onCrop = (croppedImage: string) => {
    setPreview(croppedImage);
    onImageUpload(croppedImage); 
  };

  const onBeforeFileLoad = (elem: React.ChangeEvent<HTMLInputElement>) => {
    const file = elem.target.files?.[0];
    if (file && file.size > 70000000) { // Limit file size to a massive file
      alert('File is too big!');
      elem.target.value = '';
    }
  };

  return (
    <div className="avatar-editor">
      <Avatar
        width={390}
        height={295}
        onCrop={onCrop}
        onClose={onClose}
        onBeforeFileLoad={onBeforeFileLoad}
        src={src}
        label="Choose an image"
      />
      {preview && (
        <div className="preview-container">
          <h4>Preview</h4>
          <img src={preview} alt="Cropped Preview" />
        </div>
      )}
    </div>
  );
};

export default AvatarEditor;