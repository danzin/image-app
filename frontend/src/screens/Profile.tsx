import { useState } from 'react';
// import { Menu, X, ChevronDown, User, Calendar, Settings, BarChart2, Layout, FileText, Grid, LogOut } from 'lucide-react';
import AvatarEditor from '../components/AvatarEditor'; 
import { useCurrentUser, useUpdateUserAvatar, useUserImages } from '../hooks/useUsers';
import Gallery from '../components/Gallery';

const DashboardLayout = () => {
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // const [croppedImage, setCroppedImage] = useState(null);
  const mutation = useUpdateUserAvatar(); 

  console.log(currentUser)
  console.log('Current User ID:', currentUser?._id); 
  
  const {
    data: imagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isImagesLoading,
    error 
  } = useUserImages(currentUser?._id || '');
  const flattenedImages = imagesData?.pages?.flatMap(page => page.data) || [];
  console.log('Images Query Result:', {
    imagesData,
    hasNextPage,
    isFetchingNextPage,
    isImagesLoading,
    error
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
    console.log('MODAAAAAAAAAAAAAAAAAAAAAAAAAAL')
    console.log(isModalOpen)
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  const debounce = (func: any, delay: number) => {
    let timeout:any;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args) , delay);
    };
  };

  // This sends requests to the server and saves a new avatar 
  // every time a crop is done.
  // Will just debounce until I figure it out. Gotta get lots of more 
  // important things done before that 
  // so I suppose this one will have to wait.
  const handleImageUpload = debounce(async (croppedImage) => {
    try {
      const blob = await fetch(croppedImage).then((r) => r.blob());
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.jpg'); 

      mutation.mutate(formData);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    }
  }, 3500);

  return (
    <div className="min-h-screen bg-gray-50">
  
      {/* Main Content */}
      <div className={` flex flex-col flex-1 `}>
        
        {/* Profile Content */}
        <main className="flex-1">
          <div className="relative h-64 bg-gray-900">
            <img
              className="w-full h-full object-cover"
              src="/api/placeholder/1200/256"
              alt="Cover"
            />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="-mt-16 relative z-10">
              <div className="flex items-end">

                {/* Profile Picture */}
                <div className="relative group">
                  <img className='w-32 h-32 rounded-full border-4 border-white' src={currentUser?.avatar} alt="Profile" />

                  {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                      <div className="bg-white p-6 rounded-lg shadow-lg relative" onClick={(e) => e.stopPropagation()}>
                        <AvatarEditor onImageUpload={handleImageUpload} />
                        <button onClick={handleCloseModal} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Close</button>
                      </div>
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <label
                      htmlFor="update-pfp"
                      onClick={handleOpenModal}
                      className="text-sm text-white mb-4 cursor-pointer flex flex-col items-center"
                    >
                      <span>Update PFP</span>
                      <input
                        type="file"
                        id="update-pfp"
                        className="sr-only"
                        onChange={(e) => console.log(e.target.files)}
                      />
                    </label>
                  </div>

                </div>
                <div className="ml-6 mb-4">
                  <h1 className="text-2xl font-bold text-black">{currentUser?.username}</h1>
                  <p className="text-sm text-black">Software Developer</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="col-span-2">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-medium text-gray-900">About</h2>
                  <p className="mt-4 text-gray-500">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  </p>
                </div>

                <div className="mt-6 bg-white rounded-lg shadow p-6 flex flex-grow overflow-hidden">
                  <h2 className="text-lg font-medium text-gray-900">Gallery</h2>
                  <div className="mt-4 space-y-4 flex flex-row flex-wrap overflow-y-auto">
                    <Gallery
                        images={flattenedImages}
                        fetchNextPage={fetchNextPage}
                        hasNextPage={!!hasNextPage}
                        isFetchingNext={isFetchingNextPage}
                        source={currentUser?.username}
                      />
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-medium text-gray-900">Stats</h2>
                  <dl className="mt-4 grid grid-cols-1 gap-4">
                    {[
                      { label: 'Uploads', value: currentUser?.images.length.toString() },
                      { label: 'Followers', value: 'x' },
                      { label: 'Following', value: 'x' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-gray-50 rounded-lg p-4">
                        <dt className="text-sm font-medium text-gray-500">{stat.label}</dt>
                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;