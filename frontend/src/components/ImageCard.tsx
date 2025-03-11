import React from 'react';
import { ImageCardProps } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL;
const ImageCard: React.FC<ImageCardProps> = ({ image, onClick }) => {
  const fullImageUrl = image.url.startsWith('http') ? image.url : `${BASE_URL}${image.url}`;
  return (
    <>
    <div className="card bg-base-100 w-[100%]
                    rounded-lg overflow-hidden
                    transition-transform duration-200
                    ease-in-out cursor-pointer
                    hover:scale-105 shadow-sm"
                    onClick={() => onClick(image)}>
      <figure>
        <img
          src={fullImageUrl}
          alt={image.id} />
      </figure>
      <div className="card-body p-3">
          <div className="card-actions justify-between">
            <div className=''>{new Date(image.createdAt).toLocaleDateString()}</div>
            <div className="badge badge-outline"> {image.likes} ❤️
            </div>
          </div>
      </div>
    </div>
  </>
  );
};

export default ImageCard;
