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
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedTags, clearTags } = useGallery();
  const { isLoggedIn } = useAuth();


  const personalizedFeedQuery = usePersonalizedFeed();
  const imagesQuery = useImages();
  const imagesByTagQuery = useImagesByTag(selectedTags);

  // Use mainQuery to determine wether to show generic feed or personalized feed
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
      ? mainFeedData?.pages.flatMap((page) => page.data) || []
      : filteredImagesData?.pages.flatMap((page) => page.data) || [];
  }, [selectedTags, mainFeedData, filteredImagesData]);
  



  const error = selectedTags.length > 0 ? errorFiltered : errorMain;
  const isFetchingNext = selectedTags.length > 0 ? isFetchingNextFiltered : isFetchingNextMain;
  const fetchNextPage = selectedTags.length > 0 ? fetchNextFiltered : fetchNextMain;
  const hasNextPage = selectedTags.length > 0 ? !!hasNextFiltered : !!hasNextMain;
  const isLoading = selectedTags.length > 0 ? isLoadingFiltered : isLoadingMain;


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
      
              { error ? (
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
