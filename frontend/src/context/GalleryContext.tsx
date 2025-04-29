import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GalleryContextType {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  isTagDrawerOpen: boolean;
  setIsTagDrawerOpen: (isOpen: boolean) => void;
  clearTags: () => void;
}

const GalleryContext = createContext<GalleryContextType>({
  selectedTags: [],
  setSelectedTags: () => {},
  isTagDrawerOpen: false,
  setIsTagDrawerOpen: () => {},
  clearTags: () => {},
});

export const GalleryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState(false);

  const clearTags = () => setSelectedTags([]);

  const value = {
    selectedTags,
    setSelectedTags,
    isTagDrawerOpen,
    setIsTagDrawerOpen,
    clearTags,
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