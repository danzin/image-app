import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface GalleryContextType {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  isTagDrawerOpen: boolean;
  setIsTagDrawerOpen: (isOpen: boolean) => void;
  clearTags: () => void;
  isProfileView: boolean;
}

// Create context with a default value matching the interface
const GalleryContext = createContext<GalleryContextType>({
  selectedTags: [],
  setSelectedTags: () => {},
  isTagDrawerOpen: false,
  setIsTagDrawerOpen: () => {},
  clearTags: () => {},
  isProfileView: false
});

export const GalleryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState(false);
  const location = useLocation();
  
  const isProfileView = location.pathname.includes('profile');

  const clearTags = () => setSelectedTags([]);

  const value = {
    selectedTags,
    setSelectedTags,
    isTagDrawerOpen,
    setIsTagDrawerOpen,
    clearTags,
    isProfileView
  };

  return (
    <GalleryContext.Provider value={value}>
      {children}
    </GalleryContext.Provider>
  );
};

export const useGallery = () => {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery must be used within a GalleryProvider');
  }
  return context;
};