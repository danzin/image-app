import React, { useState, useEffect, useRef } from 'react';
import { IImage } from '../types';
import { GalleryProps } from '../types';

const Gallery: React.FC<GalleryProps> = ({
  images,
  fetchNextPage,
  hasNextPage,
  isFetchingNext,
  source
}) => {
  console.log('Gallery Props:', { images, hasNextPage, isFetchingNext, source });

  if (!images) {
    return <div className="p-4">Loading gallery...</div>;
  }

  if (images.length === 0) {
    return <div className="p-4">No images available</div>;
  }

  const [selectedImage, setSelectedImage] = useState<IImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNext) {
        fetchNextPage();
      }
    };

    const observer = new IntersectionObserver(handleIntersection);
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasNextPage, isFetchingNext, fetchNextPage]);

  const openModal = (image: IImage) => {
    if (!image) return;
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDialogElement, MouseEvent>) => {
    const dialogElement = e.currentTarget;
    const rect = dialogElement.getBoundingClientRect();
    const isInDialog = e.clientY >= rect.top && e.clientY <= rect.bottom && e.clientX >= rect.left && e.clientX <= rect.right;

    if (!isInDialog) {
      closeModal();
    }
  };

  const getImageTags = (image: IImage) => {
    if (!image) return '';
    return image.tags.join(', ');
  };

  return (
    <div className="gallery-container h-full">
      <h2 className="text-lg font-bold">
        {source === 'all' ? 'All Images' : 'Your Images'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        {images.map((img, index) => (
          <div key={index} className="group cursor-pointer relative" onClick={() => openModal(img)}>
            {img && (
              <img
                src={img.url}
                alt={`Gallery item ${index}`}
                className="w-full h-52 object-cover rounded-lg transition-transform transform scale-100 group-hover:scale-105"
              />
            )}
          </div>
        ))}
      </div>
      {isModalOpen && selectedImage && (
        <dialog
          className="bg-transparent max-w-[700px] max-h-100vh fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5"
          onClick={handleOverlayClick}
          open
        >
          <div className="modal-box relative">
            <button className="absolute top-1 right-2" onClick={closeModal}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                color="white"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </button>
            <img src={selectedImage.url} alt="Selected" className="w-full h-full object-cover" />
            <span className="font-bold">
              <span className="font-extrabold">Tags:</span> {getImageTags(selectedImage)}
            </span>
          </div>
        </dialog>
      )}
      <div ref={loadMoreRef} className="h-10 flex justify-center items-center">
        {isFetchingNext && <p>Loading more...</p>}
      </div>
    </div>
  );
};

export default Gallery;
