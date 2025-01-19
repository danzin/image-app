import { useEffect, useRef } from 'react';
import { useImages } from '../hooks/images';
import Gallery from '../components/Gallery';
import Tags from '../components/TagsContainer';

const Home = () => {
  const { imagesQuery } = useImages();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = imagesQuery;
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className='grid grid-cols-5 gap-4'>
      <div className="container mx-auto p-6 col-span-4">
        <h1 className="text-3xl font-bold mb-4">Welcome to the Image Gallery</h1>
        <p className="text-lg mb-4">Explore our collection of images.</p>
        {isLoading ? (
          <p>Loading images...</p>
        ) : error ? (
          <p>Error fetching images</p>
        ) : (
          <>
            <Gallery images={images} />
            <div ref={loadMoreRef} />
            {isFetchingNextPage && <p>Loading more...</p>}
          </>
        )}
      </div>
      <div className="container mx-auto p-6 col-span-1">
        <div className="fixed top-28 left-auto right-auto w-[20%]">
          <h1 className="text-3xl font-bold mb-4">Search tags</h1>
          <Tags />
        </div>
      </div>
    </div>
  );
};

export default Home;