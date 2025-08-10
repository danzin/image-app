import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { GalleryProps } from '../types';
import ImageCard from './ImageCard';
import { useAuth } from '../hooks/context/useAuth';
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
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: { xs: 3, sm: 4, md: 5 }, 
      width: '100%', 
      maxWidth: '800px', 
      m: '0 auto', 
      p: { xs: 2, sm: 3 } 
    }}>

      {/* Loading Skeletons with better styling */}
      {isLoading && images.length === 0 && Array.from({ length: 3 }).map((_, i) => (
        <Card 
          key={i} 
          sx={{ 
            width: '100%', 
            maxWidth: '700px',
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
            borderRadius: 2
          }}
        >
          <Skeleton 
            variant="rectangular" 
            height={400} 
            sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)' }}
          />
          <CardActions sx={{ p: 2 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="circular" width={40} height={40} sx={{ ml: 'auto' }} />
          </CardActions>
        </Card>
      ))}

      {/* Image Cards with motion */}
      {!isLoading && images.map((img, index) => (
        <motion.div
          key={img.id}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          style={{ width: '100%', maxWidth: '700px' }}
        >
          <ImageCard image={img} />
        </motion.div>
      ))}

      {/* Enhanced Empty State */}
      {!isLoading && images.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ 
            textAlign: 'center', 
            py: 8,
            px: 4,
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 3,
            minWidth: '300px'
          }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                background: 'linear-gradient(45deg, #f8fafc, #cbd5e1)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontWeight: 600
              }}
            >
              No images yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isProfileOwner ? 'Upload your first image to get started!' : 'This user hasn\'t shared any images yet.'}
            </Typography>
          </Box>
        </motion.div>
      )}

      {/* Enhanced Infinite Scroll Trigger */}
      <Box 
        ref={loadMoreRef} 
        sx={{ 
          height: 80, 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          mt: 2
        }}
      >
        {isFetchingNext && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <CircularProgress 
              size={32} 
              sx={{ 
                color: '#6366f1',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }} 
            />
          </motion.div>
        )}
      </Box>
    </Box>
  );
};

export default Gallery;