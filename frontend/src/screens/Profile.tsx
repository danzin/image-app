import React, { useState } from 'react';
import { EditProfile } from '../components/EditProfile';
import Gallery from '../components/Gallery';
import Sidebar from '../components/Sidebar';
import { useCurrentUser } from '../hooks/users';


const Profile: React.FC = () => {

  const [view, setView] = useState('gallery');
  const { data: user } = useCurrentUser();
  
  return(
    <div className="profile-page grid">

      <Sidebar setView={setView} />
      <div className="content flex container mx-auto p-4 justify-center">
        {view === 'gallery' && (
          <div className='flex flex-col items-center'>
          <p className='font-bold'>Your Images</p>
          <Gallery images={user?.images || []} />
          </div>
          )}
        {view === 'editProfile' && <EditProfile />}
      </div>
    </div>
    );

}

export default Profile;