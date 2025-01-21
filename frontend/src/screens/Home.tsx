import React, { useState, useEffect } from 'react';
import { useImages } from '../hooks/useImages';
import { Tags } from '../components/TagsContainer';
import Gallery from '../components/Gallery';

const Home: React.FC = () => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeImages, setActiveImages] = useState<any[]>([]);

  const { imagesQuery, imagesByTagQuery } = useImages();

  const {
    data: allImagesData,
    fetchNextPage: fetchNextAllImages,
    hasNextPage: hasNextAllImages,
    isFetchingNextPage: isFetchingNextAllImages,
    isLoading: isLoadingAll,
    error: errorAll,
  } = imagesQuery;


  const {
    data: filteredImagesData,
    fetchNextPage: fetchNextFiltered,
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    isLoading: isLoadingFiltered,
    error: errorFiltered,
  } = imagesByTagQuery(selectedTags, 1, 10);

  useEffect(() => {
    const images =
      selectedTags.length === 0
        ? allImagesData?.pages.flatMap((page) => page.data) || []
        : filteredImagesData?.pages.flatMap((page) => page.data) || [];
    setActiveImages(images);
  }, [allImagesData, filteredImagesData, selectedTags]);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  const isLoading =
    (isLoadingAll && selectedTags.length === 0) ||
    (isLoadingFiltered && selectedTags.length > 0);
  const error = errorAll || errorFiltered;
  const isFetchingNext = isFetchingNextAllImages || isFetchingNextFiltered;

  return (
    <div className="flex flex-col gap-3 h-screen">

      {/* Header */}
      <div className=" flex items-center justify-between px-4 h-[9vh]">
        <div className="flex flex-col justify-center h-full">
          <h1 className="text-2xl lg:text-3xl font-bold">Welcome to the Image Gallery</h1>
        </div>
      </div>

      <div className='flex flex-grow overflow-hidden'>

        {/* Gallery Section */}
        <div className="w-3/4 flex flex-col mx-auto p-6 overflow-y-auto items-center align-center ">
        <div className="flex flex-col">
            {selectedTags.length > 0 && (
              <button
              className="bg-gray-200 text-gray-700 rounded-full px-4 py-2"
              onClick={clearTags}
              >
                Clear Filters
              </button>
            )}

          </div>
          {isLoading ? (
            <p>Loading images...</p>
          ) : error ? (
            <p>Error fetching images</p>
          ) : (
            <Gallery
            images={activeImages}
            fetchNextPage={selectedTags.length === 0 ? fetchNextAllImages : fetchNextFiltered}
            hasNextPage={selectedTags.length === 0 ? hasNextAllImages : hasNextFiltered}
            isFetchingNext={isFetchingNext}
            source="all"
            />
          )}
        </div>

        {/* Tags Section */}
        <div className="w-1/4 h-full flex flex-col flex-wrap gap-4 overflow-y-auto p-6">
          <Tags selectedTags={selectedTags} onSelectTags={handleTagsChange} />
          
        </div>
      </div>
    </div>
  );
};

export default Home;
