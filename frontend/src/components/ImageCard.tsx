import React from 'react';
import { Card, CardMedia, Typography, Box } from '@mui/material';
import { ImageCardProps } from '../types';

const ImageCard: React.FC<ImageCardProps> = ({ image, onClick }) => {
  return (
    <Card
      onClick={() => onClick(image)}
      sx={{
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: 3,
        transition: 'transform 0.2s ease-in-out',
        cursor: 'pointer',
        '&:hover': { transform: 'scale(1.02)' },
      }}
    >
      <CardMedia
        component="img"
        image={image.url}
        alt={`Gallery item ${image.id}`}
        sx={{
          width: '100%',
          objectFit: 'cover',
          maxHeight: '600px',
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {new Date(image.createdAt).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {image.likes} ❤️
        </Typography>
      </Box>
    </Card>
  );
};

export default ImageCard;
