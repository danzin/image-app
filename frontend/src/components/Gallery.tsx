import React, {  useEffect, useRef } from 'react';

import { useParams } from 'react-router-dom';
import { GalleryProps } from '../types';
import ImageCard from './ImageCard';
import {useAuth } from '../hooks/context/useAuth';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  Skeleton,
  CardActions
} from '@mui/material';


const Gallery: React.FC<GalleryProps> = ({ images, fetchNextPage, hasNextPage, isFetchingNext, isLoadingFiltered, isLoadingAll }) => {
  const { user, isLoggedIn } = useAuth();
  const { id: profileId } = useParams<{ id: string }>();

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
        <ImageCard key={img.id} image={img} />
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

   
    </Box>
  );
};

export default Gallery;