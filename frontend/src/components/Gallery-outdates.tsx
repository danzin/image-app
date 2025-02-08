import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IImage } from '../types';
import { GalleryProps } from '../types';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useImages } from '../hooks/useImages';
import { useLikeImage } from '../hooks/user/useUserAction';
import ImageCard from './ImageCard';

const Gallery: React.FC<GalleryProps> = ({
  images,
  fetchNextPage,
  hasNextPage,
  isFetchingNext,
  
}) => {
  const { user } = useAuth();
  const { id: profileId } = useParams<{ id: string }>();
  const isProfilePage = window.location.pathname.includes('profile');
  const [selectedImage, setSelectedImage] = useState<IImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { deleteImage } = useImages();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Check if the current profile belongs to the logged-in user
  const isInOwnProfile = user?.id === profileId && isProfilePage;

  // Set up infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNext) {
        fetchNextPage();
      }
    });
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasNextPage, isFetchingNext, fetchNextPage]);

  // Open and close modal handlers
  const openModal = useCallback((image: IImage) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  }, []);

  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
  };

  const handleDeleteImage = () => {
    if (selectedImage) {
      deleteImage(selectedImage.id);
      closeModal();
    }
  };

  // Close modal if click is outside the modal content
  const handleOverlayClick = (e: React.MouseEvent<HTMLDialogElement, MouseEvent>) => {
    const dialogRect = e.currentTarget.getBoundingClientRect();
    const isClickInside =
      e.clientX >= dialogRect.left &&
      e.clientX <= dialogRect.right &&
      e.clientY >= dialogRect.top &&
      e.clientY <= dialogRect.bottom;
    if (!isClickInside) closeModal();
  };

  const getImageTags = (image: IImage) => image?.tags?.map(tag => tag.tag).join(', ') || '';

  const { mutate: likeImage, isPending: isLiking } = useLikeImage();
  
  const handleLikeImage = () => {
    if (!selectedImage) return;
    likeImage(selectedImage.id, {
      onSuccess: (updatedData: { likeCount: number; liked: boolean }) => {
        
        //doesn't really work and is not necessary at the moment.
        setSelectedImage((prev) =>
          prev ? { ...prev, likeCount: updatedData.likeCount, liked: updatedData.liked } : prev
        );
      },
      onError: (error) => {
        console.error('Error liking image:', error);
      }
    });
  };

  // Early return if images aren't loaded yet
  if (!images) {
    return <div className="p-4">Loading gallery...</div>;
  }
  if (images.length === 0) {
    return <div className="p-4">No images available</div>;
  }

  return (
    <div className="gallery-container h-full">
      <h2 className="text-lg font-bold">
        {source === 'all' ? 'All Images' : 'Your Images'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        {images.map((img) => (
          <ImageCard key={img.id} image={img} onClick={openModal} />
          // <div
          //   key={img.id}
          //   className="group cursor-pointer relative"
          //   onClick={() => openModal(img)}
          // >
          //   <img
          //     src={img.url}
          //     alt={`Gallery item ${img.id}`}
          //     className="w-full h-52 object-cover rounded-lg transition-transform transform group-hover:scale-105"
          //   />
          //   {/* Like count overlay */}
          //   <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded">
          //     {img?.likes} <span role="img" aria-label="likes">❤️</span>
          //   </div>
          // </div>
        ))}
      </div>

      {isModalOpen && selectedImage && (
        <dialog
          className="bg-transparent max-w-[700px] max-h-[100vh] flex flex-col fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5"
          onClick={handleOverlayClick}
          open
        >
          <div className="modal-box relative flex flex-col">
            <button className="absolute top-1 right-2" onClick={closeModal}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                color="white"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </button>
            <img
              src={selectedImage.url}
              alt="Selected"
              className="w-full h-full object-cover"
            />
            <div className="mt-4">
              <div>
                Uploaded by:{' '}
                <Link to={`/profile/${selectedImage.user.id}`} className="text-blue-700 text-xl">
                  {selectedImage.user.username}
                </Link>
              </div>
              <div>Tags: {getImageTags(selectedImage)}</div>
              <div className="flex items-center mt-2 space-x-4">
                <button
                  onClick={handleLikeImage}
                  className="bg-red-700 hover:bg-red-400 text-white font-bold py-2 px-4 rounded-full flex items-center"
                >
                  <span role="img" aria-label="like" className={isLiking ? 'heartbeat' : ''}>❤️</span>
                </button>
                {isInOwnProfile && (
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
                    onClick={handleDeleteImage}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
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
