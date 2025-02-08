import { useState, useEffect } from 'react';
import { IImage, ITag, IUser } from '../types';
import { useSearch } from '../hooks/search/useSearch';
import ImageCard from '../components/ImageCard';
import Gallery from '../components/Gallery';
import { Box } from '@mui/material';

const SearchResults = () => {
  const query = new URLSearchParams(location.search).get('q') || '';
  const [activeTab, setActiveTab] = useState<'users' | 'images' | 'tags'>('users');
  const [results, setResults] = useState<{
    users: IUser[] | string;
    images: IImage[] | string;
    tags: ITag[] | string;
  }>({ users: [], images: [], tags: [] });

  const { data, isFetching } = useSearch(query);

  useEffect(() => {
    if (data) {
      setResults({
        users: data.data.users,
        images: data.data.images,
        tags: data.data.tags
      });
    }
  }, [data]);

  const renderResults = () => {
    const currentResults = results[activeTab];

    if (typeof currentResults === 'string') {
      return <div className="message">{currentResults}</div>;
    }

    switch (activeTab) {
      case 'users':
        return (currentResults as IUser[]).map((user) => (
          <div key={user.id} className="user-card">
            <p>{user.username}</p>
          </div>
        ));
      case 'images':
        return (currentResults as IImage[]).map((image) => (
          <Box>
            <ImageCard image={image} />
          </Box>
          
        ));
      case 'tags':
        return (currentResults as ITag[]).map((tag) => (
          <div key={tag.id} className="tag-card">
            <p>#{tag.tag} ({tag.count} posts)</p>
          </div>
        ));
      default:
        return null;
    }
  };

  return (
    <div className="search-container">
      <div className="tabs">
        {(['users', 'images', 'tags'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {isFetching ? (
        <div className="loader">Loading...</div>
      ) : (
        <div className="results-container">{renderResults()}</div>
      )}
    </div>
  );
};

export default SearchResults;
