import React, { useState } from 'react';

interface Image {
  url: string;
  tags: string[];
  uploadedBy: string;
}

interface GalleryProps {
  images: (string | Image | undefined)[];
}

const Gallery: React.FC<GalleryProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<Image>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (image: Image) => {
    if (!image) return;
    // const imageUrl = typeof image === 'string' ? image : image.url;
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedImage(undefined);
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


  const getImageTags = (image: Image) =>{
    if (!image) return '';

    return image.tags.join(', ')
  }

  // const gridClass = images.length < 3
  //   ? 'sm:grid-cols-1 md:grid-cols-2 auto-rows-[600px]'
  //   : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 auto-rows-[300px]';

  return (
    <div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6`}>
        {images.map((img, index) => (
          <div key={index} className='group cursor-pointer relative' onClick={() => openModal(img as Image)}>
            {img && (
              <>
                <img
                  src={img.url}
                  alt={`Gallery item ${index}`}
                  className="w-full h-52 object-cover rounded-lg transition-transform transform scale-100 group-hover:scale-105"
                  />
              </>
            )}
          </div>
        ))}
      </div>
      {isModalOpen && selectedImage && (
        <dialog
        id="my_modal_3"
        className="bg-transparent max-w-[700px] max-h-100vh fixed top-1/2 left-1/2  transform -translate-x-1/2 -translate-y-1/2 w-4/5"
        onClick={handleOverlayClick}
        open
      >
        <div className="modal-box relative">
          <button
            className="absolute top-1 right-2"
            onClick={closeModal}
          >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" color='white' viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>

          </button>
          <img src={selectedImage.url} alt="Selected" className="w-full h-full object-cover" />
          <span className='font-bold'><span className='font-extrabold'>Tags:</span> {getImageTags(selectedImage)}</span>
        </div>
      </dialog>
      
      )}
    </div>
  );
};

export default Gallery;
