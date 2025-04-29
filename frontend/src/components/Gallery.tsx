import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { IImage, GalleryProps } from '../types';
import { useDeleteImage } from '../hooks/images/useImages';
import { useLikeImage } from '../hooks/user/useUserAction';
import ImageCard from './ImageCard';
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
  Divider,
  Card,
  Skeleton,
  CardActions
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close'; 
import FavoriteIcon from '@mui/icons-material/Favorite'; 
import DeleteIcon from '@mui/icons-material/Delete'; 

const BASE_URL = import.meta.env.VITE_API_URL;

const Gallery: React.FC<GalleryProps> = ({ images, fetchNextPage, hasNextPage, isFetchingNext, isLoadingFiltered, isLoadingAll }) => {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth();
  
  const { id: profileId } = useParams<{ id: string }>();

  const [selectedImage, setSelectedImage] = useState<IImage | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const deleteMutation  = useDeleteImage();

  const isProfileOwner = isLoggedIn && user?.id === profileId;

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
  }, []);

  const closeModal = () => {
    setSelectedImage(null);

  };

  const handleDeleteImage = () => {
    if (selectedImage && isProfileOwner) { 
      deleteMutation.mutate(selectedImage.id, {
        onSuccess: () => closeModal(), 
        onError: (err) => console.error("Delete failed", err) 
      });
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

  const isLoading = isLoadingAll || isLoadingFiltered;

  return (
  <Box sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center', 
    gap: { xs: 2, sm: 3, md: 4 },
    width: '100%',
    maxWidth: '700px', // Max width for gallery
    margin: '0 auto', // Center the gallery 
    p: { xs: 1, sm: 2 } 
  }}>
  
    {/* Loading Skeletons */}
    {isLoading && !images?.length && 
      Array.from({ length: 3 }).map((_, index) => (
        <Card key={`skeleton-${index}`} sx={{ width: '100%', maxWidth: '700px' }}>
            <Skeleton variant="rectangular" height={400} />
            <CardActions>
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="circular" width={40} height={40} sx={{ml: 'auto'}} />
            </CardActions>
        </Card>
      ))}

     {/* Image Cards */}
     {!isLoading && images.map((img) => (
          <ImageCard key={img.id} image={img} onClick={openModal} />
      ))}

      {/* Empty State */}
      {!isLoading && (!images || images.length === 0) && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
          Nothing to show yet.
          {isProfileOwner && " Why not upload something?"}
        </Typography>
        )}

      {/* Infinite Scroll Loader Trigger */}
      <Box ref={loadMoreRef} sx={{ height: '50px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isFetchingNext && <CircularProgress size={24} />}
      </Box>

      <Modal
        open={!!selectedImage} 
        onClose={closeModal}
        closeAfterTransition
        aria-labelledby="image-modal-title"
        aria-describedby="image-modal-description"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center'}} // Center the modal
      >
        <Fade in={!!selectedImage}>
         
          <Paper sx={{
            position: 'relative', 
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: {xs: 2, sm: 3, md: 4}, 
            borderRadius: 2,
            maxWidth: '90vw', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            display: 'flex',
            flexDirection: 'column'
          }}>
            <IconButton
              aria-label="close"
              onClick={closeModal}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>

            {selectedImage && (
              <>
                <Box sx={{ flexShrink: 0, mb: 2, display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={fullImageUrl}
                    alt={selectedImage.publicId}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '65vh', 
                        objectFit: 'contain',
                        display: 'block' 
                    }}
                  />
                </Box>

                <Divider sx={{ my: 2 }}/>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" id="image-modal-description">
                        Uploader:{" "}
                        <Typography component={RouterLink} to={`/profile/${selectedImage.user.id}`} sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                          {selectedImage.user.username}
                        </Typography>
                      </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Tags: {getImageTags(selectedImage)}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mt: {xs: 1, sm: 0} }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FavoriteIcon />}
                        onClick={handleLikeImage}
                        disabled={isLiking || !isLoggedIn} 
                      >
                        {selectedImage.likes} {isLiking ? 'Liking...' : 'Like'}
                      </Button>
                      {isProfileOwner && ( 
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={handleDeleteImage}
                            disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </Box>
                </Box>
              </>
            )}
          </Paper>
        </Fade>
      </Modal>
  </Box>

  );
};

export default Gallery;
