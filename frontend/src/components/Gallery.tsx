import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Grid, Typography, Button, Dialog, IconButton, DialogTitle, DialogContent, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { IImage, GalleryProps } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDeleteImage } from '../hooks/images/useImages';
import { useLikeImage } from '../hooks/user/useUserAction';
import ImageCard from './ImageCard';
import { useGallery } from '../context/GalleryContext';

const Gallery: React.FC<GalleryProps> = ({ images, fetchNextPage, hasNextPage, isFetchingNext }) => {
  const { user } = useAuth();
  const { id: profileId } = useParams<{ id: string }>();
  const { isProfileView } = useGallery();
  const [selectedImage, setSelectedImage] = useState<IImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const deleteMutation  = useDeleteImage();

  const isInOwnProfile = user?.id === profileId && isProfileView;

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNext) {
        fetchNextPage(); 
      }
    }, { 
      root: null,
      rootMargin: '0px',
      threshold: 0.1
     });

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    
    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
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
      //TODO:
      deleteMutation.mutate(selectedImage.id);
      closeModal();
    }
  };

  const getImageTags = (image: IImage) => image?.tags?.map((tag) => tag.tag).join(', ') || '';

  const { mutate: likeImage, isPending: isLiking } = useLikeImage();


  const handleLikeImage = () => {
    if (!selectedImage) return;
    likeImage(selectedImage.id, {
      onSuccess: (updatedData: { likeCount: number; liked: boolean }) => {
        setSelectedImage((prev) =>
          prev ? { ...prev, likeCount: updatedData.likeCount, liked: updatedData.liked } : prev
        );
      },
      onError: (error) => {
        console.error('Error liking image:', error);
      },
    });
  };

  if (!images) {
    return <div>Loading gallery...</div>;
  }
  if (images.length === 0) {
    return <div>No images available</div>;
  }

  return (
    <Box sx={{ height: '100vh', overflowY: 'auto', p: 3 }}>
      <Grid container spacing={2}>
        {images.map((img) => (
          <Grid item xs={12} sm={12} md={8} lg={6} key={img.id}>
            <ImageCard image={img} onClick={openModal} />
          </Grid>
        ))}
       
      </Grid>
      <div ref={loadMoreRef} className="h-10 flex justify-center items-center" aria-label='REF'>
        {isFetchingNext && <p><CircularProgress /></p>}
      </div>
      

      <Dialog
        open={isModalOpen}
        onClose={closeModal}
        maxWidth="md"
        
      >
        {selectedImage && (
          
          <DialogContent  sx={{ textAlign: 'center', overflow: 'hidden' }}>
            <DialogTitle>
          <IconButton
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white' }}
            onClick={closeModal}
          >
            <CloseIcon />
          </IconButton>
          </DialogTitle>
            <Box
              component="img"
              src={selectedImage.url}
              alt={selectedImage.publicId}
              sx={{
                
                width: '100%',
                maxHeight: '60vh',
                objectFit: 'inherit',
              }}
            />
            <Box >
            <Box sx={{ display: 'flex', flexDirection: 'column' , gap: 0,  textAlign:'start'}}>

              <Typography variant="body2">Uploader:<Link className='text-blue-800' to={`/profile/${selectedImage.user.id}`}> {selectedImage.user.username}</Link></Typography>
              <Typography variant="body2">Tags: {getImageTags(selectedImage)}</Typography>
              </Box>
              <Box sx={{ m:'auto', display: 'flex', gap: 2, justifyContent: 'right' }}>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  onClick={handleLikeImage}
                  disabled={isLiking} 
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                  {isLiking ? <CircularProgress size={24} /> : 'Like'}
                </Button>
                {isInOwnProfile && (
                  <Button variant="contained" color="secondary" onClick={handleDeleteImage}>
                    Delete
                  </Button>
                )}
              </Box>
            </Box>
          </DialogContent>
        )}
        
      </Dialog>
    </Box>
  );
};

export default Gallery;
