import React from 'react';
import { useImages, useImagesByTag, usePersonalizedFeed } from '../hooks/images/useImages';
import { Tags } from '../components/TagsContainer';
import Gallery from '../components/Gallery';
import {
  Box,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
  Drawer,
  Divider, 
} from '@mui/material';

import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../hooks/context/useAuth';
const SIDEBAR_WIDTH = 280;

const Home: React.FC = () => {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
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

  const sidebarContent = (
    <Box sx={{ p: 2, width: SIDEBAR_WIDTH }}>
      <Typography variant="h6" gutterBottom>Filter by Tags</Typography>
      <Divider sx={{ mb: 2 }}/>
      <Tags /> 
    </Box>
  );

  return (
    <Box sx={{
      display: 'flex',
      flexGrow: 1,
      height: '100%', 
      overflow: 'hidden' 
    }}>
       {isLargeScreen && (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              position: 'relative',
              borderRight: `1px solid ${theme.palette.divider}`, 
              bgcolor: 'background.paper' 
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 }, 
          overflowY: 'auto',
          height: '100%', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center' 
        }}
      >
        {selectedTags.length > 0 && (
          <Button variant="outlined" onClick={clearTags} sx={{ mb: 2, alignSelf: 'flex-start' }}>
            Clear Tag Filters
          </Button>
        )}

        {error ? (
          <Typography color="error">Error fetching images: {error.message}</Typography>
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
      </Box>
        

    </Box>
  );
};

export default Home;