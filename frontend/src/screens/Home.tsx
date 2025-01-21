import { useEffect, useRef, useState } from 'react';
import { useImages } from '../hooks/useImages';
import Gallery from '../components/Gallery';
import {Tags} from '../components/TagsContainer';

const Home = () => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeImages, setActiveImages] = useState<any[]>([]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { imagesQuery, imagesByTagQuery } = useImages();
  
  const {
    data: allImagesData,
    fetchNextPage: fetchNextAllImages,
    hasNextPage: hasNextAllImages,
    isFetchingNextPage: isFetchingNextAllImages,
    isLoading: isLoadingAll,
    error: errorAll
  } = imagesQuery;

  const {
    data: filteredImagesData,
    fetchNextPage: fetchNextFiltered,
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    isLoading: isLoadingFiltered,
    error: errorFiltered
  } = imagesByTagQuery(selectedTags, 1, 10);

  useEffect(() => {
    const images = selectedTags.length === 0
      ? allImagesData?.pages.flatMap((page) => page.data) || []
      : filteredImagesData?.pages.flatMap((page) => page.data) || [];
    
    setActiveImages(images);
  }, [allImagesData, filteredImagesData, selectedTags]);

  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) {
        if (selectedTags.length === 0 && hasNextAllImages) {
          fetchNextAllImages();
        } else if (selectedTags.length > 0 && hasNextFiltered) {
          fetchNextFiltered();
        }
      }
    };

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleIntersection);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    selectedTags,
    hasNextAllImages,
    hasNextFiltered,
    fetchNextAllImages,
    fetchNextFiltered
  ]);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  const isLoading = (isLoadingAll && selectedTags.length === 0) || 
                    (isLoadingFiltered && selectedTags.length > 0);
  const error = errorAll || errorFiltered;
  const isFetchingNext = isFetchingNextAllImages || isFetchingNextFiltered;

  return (
    <div className="grid grid-cols-5 gap-4">
      <div className="container flex flex-col overflow-y-auto mx-auto p-6 col-span-1">
        <h1 className="text-3xl font-bold mb-4">Search Tags</h1>
        <Tags 
          selectedTags={selectedTags}
          onSelectTags={handleTagsChange}
        />
        {selectedTags.length > 0 && (
          <button 
            className="mt-4 bg-gray-200 text-gray-700 rounded-full px-4 py-2"
            onClick={clearTags}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="container mx-auto p-6 col-span-4">
        <h1 className="text-3xl font-bold mb-4">Welcome to the Image Gallery</h1>
        <p className="text-lg mb-4">
          {selectedTags.length > 0 
            ? `Showing images tagged with: ${selectedTags.join(', ')}`
            : 'Explore our collection of images.'
          }
        </p>

        {isLoading ? (
          <p>Loading images...</p>
        ) : error ? (
          <p>Error fetching images</p>
        ) : (
          <>
            <Gallery images={activeImages} />
            <div ref={loadMoreRef} />
            {isFetchingNext && <p>Loading more...</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default Home;