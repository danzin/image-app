import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IImage, GalleryProps } from '../types';
import { useDeleteImage } from '../hooks/images/useImages';
import { useLikeImage } from '../hooks/user/useUserAction';
import ImageCard from './ImageCard';
import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../hooks/context/useAuth';
import {
  Box,
  Modal,
  Typography,
  Button,
  CircularProgress, 
  Fade, 
  Paper, 
  IconButton,
  Divider
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close'; 
import FavoriteIcon from '@mui/icons-material/Favorite'; 
import DeleteIcon from '@mui/icons-material/Delete'; 

const BASE_URL = import.meta.env.VITE_API_URL;

const Gallery: React.FC<GalleryProps> = ({ images, fetchNextPage, hasNextPage, isFetchingNext, isLoadingFiltered, isLoadingAll }) => {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth();
  
  const { id: profileId } = useParams<{ id: string }>();
  const { isProfileView } = useGallery();
  const [selectedImage, setSelectedImage] = useState<IImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const deleteMutation  = useDeleteImage();

  const isInOwnProfile = user?.id === profileId && isProfileView;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        console.log('Intersection observer triggered:', {
          isIntersecting: firstEntry.isIntersecting,
          hasNextPage,
          isFetchingNext
        });
        
        if (firstEntry.isIntersecting && hasNextPage && !isFetchingNext) {
          console.log('Fetching next page...');
          fetchNextPage();
        }
      },
      { 
        root: null,
        rootMargin: '100px', 
        threshold: 0.1
      }
    );

    const currentLoadMoreRef = loadMoreRef.current;
    if (currentLoadMoreRef) {
      console.log('observing load more element');
      observer.observe(currentLoadMoreRef);
    }
    
    return () => {
      if (currentLoadMoreRef) {
        observer.unobserve(currentLoadMoreRef);
      }
    };
  }, [hasNextPage, isFetchingNext, fetchNextPage]);

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
      deleteMutation.mutate(selectedImage.id);
      closeModal();
    }
  };

  const getImageTags = (image: IImage) => image?.tags?.map((tag) => tag.tag).join(', ') || '';

  const { mutate: likeImage, isPending: isLiking } = useLikeImage();


  const handleLikeImage = () => {

    // Only logged in users can like/dislike
    if (!isLoggedIn) return navigate('/login');
    if (!selectedImage) return;
  
    likeImage(selectedImage.id, {
      onSuccess: (updatedImage) => {
        setSelectedImage(updatedImage); 
      },
      onError: (error) => {
        console.error('Error liking image:', error);
      },
    });
  };

  const fullImageUrl = selectedImage?.url.startsWith('http') ? selectedImage.url : `${BASE_URL}${selectedImage?.url}`;


  return (
    <div  className='flex flex-col content-center gap-7 w-[100%] max-w-[700px] m-auto p-2'>
      {/* Skeleton when loading images */}
      {(isLoadingAll || isLoadingFiltered) &&
        Array.from({ length: 6 }).map((_) => (
          <div className="flex w-700 h-[500px] flex-col">
            <div className="skeleton h-[500px] w-full"></div>
          </div>
        ))
        }
       {!isLoadingAll &&
        !isLoadingFiltered &&
        images.map((img) => <ImageCard key={img.id} image={img} onClick={() => openModal(img)} />)}
        {(!images || images.length === 0) && (<div className='text-black'> Nothing to show. Go ahead and upload something! </div>)}

      {/* Infinite Scroll Loader */}
      <div ref={loadMoreRef} style={{ padding: '20px', textAlign: 'center' }}>
        {isFetchingNext && (
          <div className="flex w-700 flex-col gap-4">
            <div className="skeleton h-7 w-full"></div>
          </div>
        )}
      </div>
      
      {isModalOpen && (
        <>
          <input
            type="checkbox"
            id="image-modal"
            className="modal-toggle"
            checked
            onChange={closeModal}
          />
          <div className="modal" onClick={closeModal}>
            <div
              className="modal-box relative max-w-4xl "
              style={{ height: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <label
                htmlFor="image-modal"
                className="btn btn-sm btn-circle absolute right-2 top-2"
                onClick={closeModal}
              >
                ✕
              </label>
              {selectedImage && (
                <>
                  <img
                    src={fullImageUrl}
                    alt={selectedImage.publicId}
                    className="w-full max-h-[60vh] object-contain"
                  />
                  <div className="flex mt-2 justify-between text-left">
                    <div>
                      <p className="text-sm">
                        Uploader:{" "}
                        <Link to={`/profile/${selectedImage.user.id}`} className="text-blue-800">
                          {selectedImage.user.username}
                        </Link>
                      </p>
                      <p className="md:text-md sm:text-sm">Tags: {getImageTags(selectedImage)}</p>
                    </div>

                    <div className='flex gap-2'>
                      <button
                        className="btn btn-primary "
                        onClick={handleLikeImage}
                        disabled={isLiking}
                      >
                        {isLiking ? <span className="loading loading-spinner loading-xl"></span> : "Like"}
                      </button>
                      {isInOwnProfile && (
                        <button className="btn btn-secondary" onClick={handleDeleteImage}>
                          Delete
                        </button>
                      )}
                    </div>
                   
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Gallery;
