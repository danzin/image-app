import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { ImageCardProps } from '../types';

const ImageCard: React.FC<ImageCardProps>  = ({ image, onClick }) => {
  const formatDate = (dateString: Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }); 
  };
  return (
    <Card onClick={() => onClick(image)} className='group cursor-pointer relative rounded-lg'>
  <CardMedia
    component="img"
    image={image.url}
    alt={`Gallery item ${image.id}`}
    className='w-full md:min-h-[50vh] h-52 object-cover transition-transform transform group-hover:scale-105' 
  />
  <CardContent className='flex flex-row'>
    <Typography className='absolute bottom-2 right-2 bg-transparent bg-opacity-50 text-white p-1 rounded'>
      {image.likes} ❤️
    </Typography>
    <Typography variant="body2" color="text.primary">
      {formatDate(image.createdAt)}
    </Typography>
  </CardContent>
</Card>

  );
};

export default ImageCard;
