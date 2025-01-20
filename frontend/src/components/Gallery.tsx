import React, { useState } from 'react';

interface Image {
  url: string;
}

interface GalleryProps {
  images: (string | Image | undefined)[];
}

const Gallery: React.FC<GalleryProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (image: string | Image | undefined) => {
    if (!image) return;
    const imageUrl = typeof image === 'string' ? image : image.url;
    setSelectedImage(imageUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDialogElement, MouseEvent>) => {
    const dialogElement = e.currentTarget;
    const rect = dialogElement.getBoundingClientRect();
    const isInDialog = (e.clientY >= rect.top && e.clientY <= rect.bottom &&
      e.clientX >= rect.left && e.clientX <= rect.right);
    
    if (!isInDialog) {
      closeModal();
    }
  };

  const getImageUrl = (image: string | Image | undefined) => {
    if (!image) return '';
    return typeof image === 'string' ? image : image.url;
  };

  const gridClass = images.length < 3
    ? 'sm:grid-cols-1 md:grid-cols-2 auto-rows-[600px]'
    : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 auto-rows-[300px]';

  return (
    <div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6`}>
        {images.map((img, index) => (
          <div key={index} className='group cursor-pointer relative' onClick={() => openModal(img)}>
            {img && (
              <img
                src={getImageUrl(img)}
                alt={`Gallery item ${index}`}
                className="w-full h-48 object-cover rounded-lg transition-transform transform scale-100 group-hover:scale-105"
              />
            )}
          </div>
        ))}
      </div>
      {isModalOpen && selectedImage && (
        <dialog id="my_modal_3" className="bg-transparent max-w-[700px] max-h-[900px] fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5" onClick={handleOverlayClick} open>
          <div className="modal-box">
            <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
            <button className="btn btn-primary" onClick={closeModal}>
              Close
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default Gallery;
