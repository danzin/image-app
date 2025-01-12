import React, { useState } from 'react';

interface Image {
  url: string;
  // Add other properties if needed
}

interface GalleryProps {
  images: (string | Image | undefined)[];
}

const Gallery: React.FC<GalleryProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const openModal = (image: string) => {
    setSelectedImage(image);
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement;
    if (modal) {
      modal.showModal();
    }
  };

  const closeModal = () => {
    setSelectedImage(null);
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement;
    if (modal) {
      modal.close();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDialogElement, MouseEvent>) => {
    const modalBox = document.querySelector('.modal-box');
    if (modalBox && !modalBox.contains(e.target as Node)) {
      closeModal();
    }
  };

  const getImageUrl = (image: string | Image | undefined) => {
    if (!image) return '';
    return typeof image === 'string' ? image : image.url;
  };

  const gridClass = images.length < 3 ? 'sm:grid-cols-1 md:grid-cols-2 auto-rows-[600px]' : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 auto-rows-[300px]';

  return (
    <div>
      <div className={`box-border p-4 grid ${gridClass} gap-4`}>
        {images.map((img, index) => (
          <div key={index} className="" onClick={() => openModal(getImageUrl(img))}>
            {img && (
              <img
                src={getImageUrl(img)}
                alt={`Gallery item ${index}`}
                className="w-full h-full object-cover cursor-pointer rounded-lg"
              />
            )}
          </div>
        ))}
      </div>
      {selectedImage && (
        <dialog id="my_modal_3" className="modal" onClick={handleOverlayClick}>
          <div className="modal-box">
            <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
            <button className="btn btn-primary" onClick={closeModal}>Close</button>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default Gallery;