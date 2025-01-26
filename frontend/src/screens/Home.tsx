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
  TextField,
  useTheme,
  useMediaQuery,
  Drawer,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

const Home: React.FC = () => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeImages, setActiveImages] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); 

  const { imagesQuery, imagesByTagQuery } = useImages();

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
  } = imagesByTagQuery(selectedTags, 1, 10);

  useEffect(() => {
    const images =
      selectedTags.length === 0
        ? allImagesData?.pages.flatMap((page) => page.data) || []
        : filteredImagesData?.pages.flatMap((page) => page.data) || [];
    setActiveImages(images);
  }, [allImagesData, filteredImagesData, selectedTags]);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  const toggleDrawer = (open: boolean) => () => {
    setIsDrawerOpen(open);
  };

  const isLoading =
    (isLoadingAll && selectedTags.length === 0) ||
    (isLoadingFiltered && selectedTags.length > 0);
  const error = errorAll || errorFiltered;
  const isFetchingNext = isFetchingNextAllImages || isFetchingNextFiltered;

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md')); // Detect small screens

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <Grid container sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {/* Gallery */}
        <Grid item xs={12} md={9} sx={{ p: 3, overflowY: 'auto' }}>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            {isSmallScreen && (
              <>
                {/* Drawer Toggle Button */}
                <IconButton onClick={toggleDrawer(true)} size="large">
                  <MenuIcon />
                </IconButton>
                <TextField
                  fullWidth
                  label="Search Tags"
                  variant="outlined"
                  size="small"
                  sx={{
                    backgroundColor: 'background.paper', 
                    color: 'text.primary', 
                    borderRadius: 1, 
                  }}
                  InputProps={{
                    style: {
                      color: '#fff', 
                    },
                  }}
                />
              </>
            )}
            {selectedTags.length > 0 && (
              <Button variant="outlined" onClick={clearTags}>
                Clear Filters
              </Button>
            )}
          </Box>

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
              source="all"
            />
          )}
        </Grid>

        {/* Tags Section - Desktop View */}
        {!isSmallScreen && (
          <Grid
            item
            md={3}
            sx={{
              p: 3,
              overflowY: 'auto',
              borderLeft: '1px solid',
              borderColor: 'divider',
              display: { xs: 'none', md: 'block' }, 
            }}
          >
            <Tags selectedTags={selectedTags} onSelectTags={handleTagsChange} />
          </Grid>
        )}
      </Grid>

      {/* Mobile drawer */}
      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={toggleDrawer(false)}
        PaperProps={{
          sx: { backgroundColor: 'background.paper' },
        }}
      >
        <Box
          sx={{
            width: 250,
            p: 2,
            backgroundColor: 'background.default', 
            color: 'text.secondary',
          }}
          role="presentation"
        >
          <Typography variant="h6" sx={{ mb: 2 }} color="text.primary">
            Filter by Tags
          </Typography>
          <Tags selectedTags={selectedTags} onSelectTags={handleTagsChange} />
          <Button
            variant="outlined"
            color="secondary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => {
              clearTags();
              toggleDrawer(false)();
            }}
          >
            Clear Filters
          </Button>
        </Box>
      </Drawer>

    </Container>
  );
};

export default Home;
