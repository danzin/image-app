import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import UploadForm from './UploadForm';
const Navbar = () => {
  const {user, isLoggedIn, logout} = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
    <div className="navbar bg-transparent shadow-lg bg-opacity-60">
      <div className="flex-1 flex">
        <a className="btn btn-ghost text-xl">Peek</a>
      </div>
      <div className="flex flex-1 justify-center">
        <div className="menu menu-horizontal px-1">
          <li className="backdrop-blur-xl">
            <Link to="/">Home</Link>
          </li>
        </div>
      </div>
      <div className="flex flex-1 justify-end">
        {isLoggedIn ? (
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle avatar"
            >
              <div className="w-10 rounded-full">
                <img
                  alt="Avatar"
                  src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                />
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow"
            >
              <li>
                <a className="justify-between">
                  <Link to="/profile">Profile</Link>
                  <span className="badge">New</span>
                </a>
              </li>
              <li>
                <a>Settings</a>
              </li>
              <li>
                <a onClick={openModal}>Upload</a>
              </li>
              <li>
                <a
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Logout
                </a>
              </li>
            </ul>
          </div>
        ) : (
          <>
            <Link to="/login" className="btn glass">
              Log In
            </Link>
            <Link to="/register/" className="btn glass">
              Register
            </Link>
          </>
        )}
      </div>
    </div>

    {/* Modal */}
    {isModalOpen && (
      <div className="modal modal-open">
        <div className="modal-box">
          <UploadForm onClose={closeModal} />
          <div className="modal-action">
            <button className="btn btn-outline" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
};
export default Navbar;