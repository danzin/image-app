import React from 'react';
import { useImages, useImagesByTag, usePersonalizedFeed } from '../hooks/images/useImages';
import { Tags } from '../components/TagsContainer';
import Gallery from '../components/Gallery';
import {
  Box,
  Grid,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../hooks/context/useAuth';

const Home: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedTags, clearTags } = useGallery();
  const { isLoggedIn } = useAuth();

  const personalizedFeedQuery = usePersonalizedFeed();
  const imagesQuery = useImages();
  const imagesByTagQuery = useImagesByTag(selectedTags);

  // Use mainQuery to determine whether to show generic feed or personalized feed
  // if a user is logged in
  const mainQuery = isLoggedIn ? personalizedFeedQuery : imagesQuery;
  
  const {
    data: mainFeedData,
    fetchNextPage: fetchNextMain,
    hasNextPage: hasNextMain,
    isFetchingNextPage: isFetchingNextMain,
    isLoading: isLoadingMain,
    error: errorMain,
  } = mainQuery;

  const {
    data: filteredImagesData,
    fetchNextPage: fetchNextFiltered,
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    isLoading: isLoadingFiltered,
    error: errorFiltered,
  } = imagesByTagQuery;

  const activeImages = React.useMemo(() => {
    return selectedTags.length === 0
      ? mainFeedData?.pages.flatMap((page) => page.data) || []
      : filteredImagesData?.pages.flatMap((page) => page.data) || [];
  }, [selectedTags, mainFeedData, filteredImagesData]);

  const error = selectedTags.length > 0 ? errorFiltered : errorMain;
  const isFetchingNext = selectedTags.length > 0 ? isFetchingNextFiltered : isFetchingNextMain;
  const fetchNextPage = selectedTags.length > 0 ? fetchNextFiltered : fetchNextMain;
  const hasNextPage = selectedTags.length > 0 ? !!hasNextFiltered : !!hasNextMain;
  const isLoading = selectedTags.length > 0 ? isLoadingFiltered : isLoadingMain;

  return (
    <Box sx={{ 
      flexGrow: 1, 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'visible',
      height: 'auto',
      minHeight: '100%' 
    }}>
      <Grid container sx={{ flexGrow: 1 }}>
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
      
          {error ? (
            <Typography>Error fetching images</Typography>
          ) : (
            <Gallery
              images={activeImages}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNext={isFetchingNext}
              isLoadingFiltered={isLoadingFiltered}
              isLoadingAll={isLoading}
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