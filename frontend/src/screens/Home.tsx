import React, { useState, useEffect } from 'react';
import { useImages, useImagesByTag } from '../hooks/useImages';
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
  CircularProgress,
} from '@mui/material';
import { useGallery } from '../context/GalleryContext';

const Home: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedTags, clearTags } = useGallery();
  const imagesQuery = useImages();
  const imagesByTagQuery = useImagesByTag(selectedTags, 10);


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
  } = imagesByTagQuery;
  

  /**
   * The problem with infinite scroll was how I used to update an unnecessary
   * state for active images inside the useEffect hook, because that's not what useEffect
   * is supposed to be used for. Especially inside components that rely on immediate data
   * during render phase. Effects are meant for actions to happen aftger the render,
   * not to determine what gets rendered.
   * 
   * Deriving activeImages from the readily available queries and momoizing it
   * turned out to be a proper solution. useMemo ensures the compute value is 
   * immediately available during render.
   */
  const activeImages = React.useMemo(() => {
    return selectedTags.length === 0
      ? allImagesData?.pages.flatMap((page) => page.data) || []
      : filteredImagesData?.pages.flatMap((page) => page.data) || [];
  }, [selectedTags, allImagesData, filteredImagesData]);
  



  const error = errorAll || errorFiltered;
  const isFetchingNext = isFetchingNextAllImages || isFetchingNextFiltered;
  const fetchNextPage = selectedTags.length === 0 ? fetchNextAllImages : fetchNextFiltered;
  const hasNextPage = selectedTags.length === 0 ? !!hasNextAllImages : !!hasNextFiltered;

  return (
    <Box   sx={{ height: '100%', display: 'flex', flexDirection: 'column' , overflow: 'auto'}}>
      <Grid container sx={{ flexGrow: 1, overflow: 'hidden' }}>
      
        {/* Gallery */}
        <Grid 
          item 
          xs={12} 
          md={10} 
          lg={10} 
          sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
          {selectedTags.length > 0 && (
            <Button variant="outlined" onClick={clearTags}>
              Clear Filters
            </Button>
          )}
      
              {isLoadingAll ? (
            <Typography><CircularProgress /></Typography>
          ) : error ? (
            <Typography>Error fetching images</Typography>
          ) : (
            <Gallery
            images={activeImages}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
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

  
     

    </Box>
  );
};

export default Home;
