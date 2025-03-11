import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGallery } from "../context/GalleryContext";
import { useAuth } from "../hooks/context/useAuth";
import { Bars3Icon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Tags } from "../components/TagsContainer";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

const Navbar = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { isProfileView } = useGallery();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formattedQuery = searchTerm
      .split(" ")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .join(",");
    if (formattedQuery) {
      navigate(`/results?q=${formattedQuery}`);
    }
    setSearchTerm("");
  };

  return (
    <>
      {/* Navbar */}
      <div className="navbar bg-slate-800 shadow-md sticky top-0 z-50">
        <div className="flex-1">
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            {!isProfileView && (
              <button
                className="btn btn-ghost btn-circle"
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Open menu"
              >
                <Bars3Icon className="w-6 h-6 text-white" />
              </button>
            )}
          </div>

          {/* Logo */}
          <Link to="/" className="text-xl font-bold text-white ml-4">
            Peek
          </Link>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex items-center border rounded-lg bg-gray-700 px-3 py-1 md:w-64"
        >
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="eg: user tag item"
            className="bg-transparent outline-none px-2 text-white w-full"
            aria-label="Search"
          />
        </form>

        {/* Auth & Profile */}
        <div className="flex items-center gap-4 ml-4">
          {isLoggedIn ? (
            <>
              <NotificationBell />
              <ProfileMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm btn-outline text-white">
                Log In
              </Link>
              <Link to="/register" className="btn btn-sm btn-primary">
                Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${
          isDrawerOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={() => setIsDrawerOpen(false)}
      ></div>

      {/* Drawer Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-gray-800 shadow-lg transform transition-transform ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } z-50`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 text-white">
        
          <h2 className="text-lg font-semibold mt-4">Filter by Tags</h2>
          <Tags />
        </div>
      </aside>
    </>
  );
};

export default Navbar;
