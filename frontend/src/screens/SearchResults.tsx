import { useState, useEffect } from 'react';
import { IImage, ITag, IUser } from '../types';
import { useSearch } from '../hooks/search/useSearch';
import { Box, Button, CircularProgress } from '@mui/material';
import { useImagesByTag } from '../hooks/images/useImages';
import Gallery from '../components/Gallery';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const SearchResults = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('q') || '';
  const queryClient = useQueryClient();
  const searchTerms = query.split(',').map((term) => term.trim()).filter((term) => term.length > 0);
  const [activeTab, setActiveTab] = useState<'users' | 'images' | 'tags'>('images');
  const [_results, setResults] = useState<{
    users: IUser[] | null;
    images: IImage[] | null;
    tags: ITag[] | null;
  }>({ users: [], images: [], tags: [] });

  const { data, isFetching } = useSearch(query);

  useEffect(() => {
    if (query) {
      queryClient.invalidateQueries({ 
        queryKey: ['query', query],
        exact: false 
      });
    }
  }, [query, queryClient,location.search]);

  const {
    data: _imagePages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useImagesByTag(searchTerms, {
    
    // Only run if searchTerms has items AND search results exist
    enabled: searchTerms.length > 0 && !!data?.data.tags
  });

  useEffect(() => {
    if (data) {
      setResults({
        users: data.data.users,
        images: data.data.images,
        tags: data.data.tags
      });
    }
  }, [data]);


  return (
    <Box sx={{ maxWidth: '800px', margin: 'auto', p: 3 }}>
      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {(['images', 'users' , 'tags'] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'contained' : 'outlined'}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </Box>
        {isFetching 
          ? (<CircularProgress/>)
          : (
            <>

            {/* Images Tab */}
              {activeTab === 'images' &&
                (data?.data.images === null ? (
                  <p>No images found for {query}.</p>
                ) : (
                  <Gallery images={data?.data.images || []} fetchNextPage={fetchNextPage} isFetchingNext={isFetchingNextPage} hasNextPage={hasNextPage} />
                ))
              }
              {/* Users tab */}
                {activeTab === 'users' &&
                  (data?.data.users === null ? (
                    <p>No users found {query}.</p>
                  ) : (
                    data?.data.users?.map((user) => (
                      <Box key={user.id} sx={{ p: 2, borderBottom: '1px solid #ccc' }}>
                        <Link to={`/profile/${user.id}`} className='text-cyan-200'>{user.username}</Link>
                      </Box>
                    ))
                  ))
                }

              {/* Tags Tab */}
                {activeTab === 'tags' &&
                  (data?.data.tags === null ? (
                    <p>No tags found for {query}.</p>
                  ) : (
                    data?.data.tags?.map((tag) => (
                      <Box key={tag._id} sx={{ p: 2, borderBottom: '1px solid #ccc' }}>
                        <p>#{tag.tag} ({tag.count} posts)</p>
                      </Box>
                    ))
                  ))
                }
            </>
          )
        }
    </Box>
  );
};

export default SearchResults;
