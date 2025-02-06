import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import {  useUploadImage } from '../hooks/useImages';
import { UploadFormProps } from '../types';


const UploadForm: React.FC<UploadFormProps> = ({ onClose }) => {
  const uploadImageMutation  = useUploadImage();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      //image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() && tags.length < 5) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        // Useing functional state update to ensure the latest state is used
        // because the tags variable represents the tags from the previous state update, not the
        // most up-to-date state, because react batches state updates and re-renders components
        // Without the functional updater, the tags state represents the tags from the previous update
        setTags((prevTags) => {
          const updatedTags = [...prevTags, tagInput.trim()];
          console.log('Updated Tags:', updatedTags); // Logs the new state
          return updatedTags;
        });
        setTagInput('');
      }
    }
  };
  

  const removeTag = (tagToRemove: string) => {
    setTags((prevTags) => {
      const updatedTags = prevTags.filter(tag => tag !== tagToRemove);
      console.log('Updated Tags:', updatedTags); // Logs the new state
      return updatedTags;
    });
    console.log(tags)
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(droppedFile);
    }
  };

  const handleUpload = () => {
    if (file) {
      const formData = new FormData();
      console.log('tags:', JSON.stringify(tags));
      formData.append('image', file);
      formData.append('tags', JSON.stringify(tags));
      console.log('formData: ', formData)
      uploadImageMutation.mutate(formData);
      onClose();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl h-4/5 mx-auto p-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="w-full"
      >
        {!preview ? (
          <label
            htmlFor="dropzone-file"
            className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                SVG, PNG, JPG or GIF (MAX. 800x400px)
              </p>
            </div>
            <input
              id="dropzone-file"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*"
            />
          </label>
        ) : (
          <div className="relative w-full h-64 mb-4">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => {
                setPreview('');
                setFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="w-full space-y-4 mt-4">
        <div className="flex flex-col space-y-2">
          <label htmlFor="tags" className="text-sm font-medium">
            Tags ({tags.length}/5):
          </label>
          <input
            id="tags"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Type a tag and press Enter"
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={tags.length >= 5}
          />
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleUpload}
        disabled={!file}
      >
        Upload Image
      </button>
    </div>
  );
};

export default UploadForm;