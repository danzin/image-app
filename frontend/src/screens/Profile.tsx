import React, { useEffect, useRef, useState } from 'react';
import { EditProfile } from '../components/EditProfile';
import Gallery from '../components/Gallery';
import Sidebar from '../components/Sidebar';
import { useUser } from '../hooks/useUsers';


const Profile: React.FC = () => {
  const { useCurrentUser, useUserImages } = useUser()
  const { data: user, isLoading: isUserLoading, error: userError } = useCurrentUser();
  const userId = user?.id || '';
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isImagesLoading, error: imagesError } = useUserImages(userId);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [view, setView] = useState('gallery');
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasNextPage, fetchNextPage]);

  const images = data?.pages.flatMap(page => page.data) || [];

  if (isUserLoading || isImagesLoading) {
    return <p>Loading...</p>;
  }

  if (userError || imagesError) {
    return <p>Error loading user or images</p>;
  } 
  console.log(images)

  return(
    <div className="profile-page grid">


      <Sidebar setView={setView} />
      <div className="content flex container mx-auto p-4 justify-center">
        {view === 'gallery' && (
          <div className='flex flex-col items-center'>
            <p className='font-bold'>Your Images</p>
            <Gallery images={images} />
            <div ref={loadMoreRef} />
            {isFetchingNextPage && <p>Loading more...</p>}
          </div>
          )}
        {view === 'editProfile' && <EditProfile />}
      </div>
    </div>
    );

}

export default Profile;