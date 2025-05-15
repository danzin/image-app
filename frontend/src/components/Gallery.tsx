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


// TODO: Fix the modal preview of images. It works with cloudniary but fails in docker with local uploads.
const Gallery: React.FC<GalleryProps> = ({ images, fetchNextPage, hasNextPage, isFetchingNext, isLoadingFiltered, isLoadingAll }) => {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { id: profileId } = useParams<{ id: string }>();

  const [selectedImage, setSelectedImage] = useState<IImage | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const deleteMutation = useDeleteImage();

  const isProfileOwner = isLoggedIn && user?.id === profileId;
  const isLoading = isLoadingAll || isLoadingFiltered;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasNextPage && !isFetchingNext) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [hasNextPage, isFetchingNext, fetchNextPage]);

  const openModal = useCallback((image: IImage) => setSelectedImage(image), []);
  const closeModal = () => setSelectedImage(null);

  const handleDeleteImage = () => {
    if (selectedImage && isProfileOwner) {
      deleteMutation.mutate(selectedImage.id, {
        onSuccess: closeModal,
        onError: (err) => console.error('Delete failed', err),
      });
    }
  };

  const getImageTags = (img: IImage) => img.tags?.map(t => t.tag).join(', ') || '';
  const { mutate: likeImage, isPending: isLiking } = useLikeImage();
  const handleLikeImage = () => {
    if (!isLoggedIn) return navigate('/login');
    if (!selectedImage) return;
    likeImage(selectedImage.id, {
      onSuccess: updated => setSelectedImage(updated),
      onError: err => console.error('Error liking:', err),
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 2, sm: 3, md: 4 }, width: '100%', maxWidth: '700px', m: '0 auto', p: { xs: 1, sm: 2 } }}>

      {/* Loading Skeletons */}
      {isLoading && images.length === 0 && Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} sx={{ width: '100%', maxWidth: '700px' }}>
          <Skeleton variant="rectangular" height={400} />
          <CardActions>
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="circular" width={40} height={40} sx={{ ml: 'auto' }} />
          </CardActions>
        </Card>
      ))}

      {/* Image Cards */}
      {!isLoading && images.map(img => (
        <ImageCard key={img.id} image={img} onClick={openModal} />
      ))}

      {/* Empty State */}
      {!isLoading && images.length === 0 && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
          Nothing to show yet.{isProfileOwner && ' Why not upload something?'}
        </Typography>
      )}

      {/* Infinite Scroll Trigger */}
      <Box ref={loadMoreRef} sx={{ height: 50, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isFetchingNext && <CircularProgress size={24} />}
      </Box>

      {/* Modal for Selected Image */}
      <Modal open={Boolean(selectedImage)} onClose={closeModal} closeAfterTransition sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Fade in={Boolean(selectedImage)}>
          <Paper sx={{ position: 'relative', bgcolor: 'background.paper', boxShadow: 24, p: { xs: 2, sm: 3, md: 4 }, borderRadius: 2, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <IconButton onClick={closeModal} sx={{ position: 'absolute', top: 8, right: 8 }}>
              <CloseIcon />
            </IconButton>

            {selectedImage && (
              <>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.publicId}
                    style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Uploader:{' '}
                      <Typography component={RouterLink} to={`/profile/${selectedImage.user.id}`} sx={{ color: 'primary.main', textDecoration: 'none' }}>
                        {selectedImage.user.username}
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Tags: {getImageTags(selectedImage)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mt: { xs: 1, sm: 0 } }}>
                    <Button variant="outlined" size="small" startIcon={<FavoriteIcon />} onClick={handleLikeImage} disabled={isLiking || !isLoggedIn}>
                      {selectedImage.likes} {isLiking ? 'Liking…' : 'Like'}
                    </Button>

                    {isProfileOwner && (
                      <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={handleDeleteImage} disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
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