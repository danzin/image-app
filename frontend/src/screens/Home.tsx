import React, { useState, useEffect } from 'react';
import { useImages } from '../hooks/useImages';
import { Tags } from '../components/TagsContainer';
import Gallery from '../components/Gallery';
import {
  Container,
  Box,
  Grid,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useGallery } from '../context/GalleryContext';
import { PaginatedResponse } from '../types';
import { UseInfiniteQueryResult } from '@tanstack/react-query';
import { LoadingSpinner } from '../components/LoadingSpinner';

const Home: React.FC = () => {
  const { selectedTags, clearTags } = useGallery();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  
  const { imagesQuery, imagesByTagQuery } = useImages();
  const [activeImages, setActiveImages] = useState<any[]>([]);


  const {
    data: allImagesData,
    fetchNextPage: fetchNextAllImages,
    hasNextPage: hasNextAllImages,
    isFetchingNextPage: isFetchingNextAllImages,
    isLoading: isLoadingAll,
    error: errorAll,
  } = imagesQuery as UseInfiniteQueryResult<PaginatedResponse, Error>;

  const {
    data: filteredImagesData,
    fetchNextPage: fetchNextFiltered,
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    isLoading: isLoadingFiltered,
    error: errorFiltered,
  } = imagesByTagQuery(selectedTags, 1, 10);

  
  useEffect(() => {
    setActiveImages(
      selectedTags.length === 0
        ? allImagesData?.pages.flatMap((page) => page.data) || []
        : filteredImagesData?.pages.flatMap((page) => page.data) || []
    );
  }, [selectedTags, allImagesData, filteredImagesData]);


  const isLoading =
    (isLoadingAll && selectedTags.length === 0) ||
    (isLoadingFiltered && selectedTags.length > 0);
  const error = errorAll || errorFiltered;
  const isFetchingNext = isFetchingNextAllImages || isFetchingNextFiltered;
  
  return (
    <Container maxWidth={false}  sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <Grid container sx={{ flexGrow: 1, overflow: 'hidden' }}>
      
        {/* Gallery */}
        <Grid item xs={12} md={10} sx={{ p: 3, overflowY: 'auto' }}>
          {selectedTags.length > 0 && (
            <Button variant="outlined" onClick={clearTags}>
              Clear Filters
            </Button>
          )}
      
            {isLoading ? (
            <Typography>Loading images...</Typography>
          ) : error ? (
            <Typography>Error fetching images</Typography>
          ) : (
            <Gallery
              images={activeImages}
              fetchNextPage={selectedTags.length === 0 ? fetchNextAllImages : fetchNextFiltered}
              hasNextPage={selectedTags.length === 0 ? hasNextAllImages : hasNextFiltered}
              isFetchingNext={isFetchingNext}
            />
          )}

        </Grid>

         {/* Desktop Tags Section */}
         {!isSmallScreen && (
          <Grid item md={2} sx={{
            p: 3,
            overflowY: 'auto',
            borderLeft: '1px solid',
            borderColor: 'divider',
          }}>
            <Tags />
          </Grid>
        )}
      </Grid>

  
     

    </Container>
  );
};

export default Home;
