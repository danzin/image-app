import React from 'react'

interface SidebarProps { 
  setView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setView }) => {
  return (
      <div className="sidebar navbar bg-transparent bg-opacity-60">
        <div className="navbar-start"></div>
        <div className="navbar-center">
            <ul className="menu menu-horizontal px-1">
              <li className='text-lg'>          
                <button onClick={() => setView('gallery')}>Gallery</button>
              </li>
              <li className='text-lg'>          
                <button onClick={() => setView('editProfile')}>Update Profile</button>
              </li> 
            </ul>
        </div>
      </div>

  )
}

export default Sidebar