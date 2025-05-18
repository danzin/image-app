import React from 'react';
import { IImage } from '../types'; 
import {
    Card,
    CardMedia,
    CardActions,
    Typography,
    Chip
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useNavigate } from 'react-router-dom';

interface ImageCardProps {
  image: IImage;
}



const BASE_URL = '/api'; 

const ImageCard: React.FC<ImageCardProps> = ({ image }) => {
  const fullImageUrl = image.url.startsWith('http')
    ? image.url
    : image.url.startsWith('/')
    ? `${BASE_URL}${image.url}` 
    : `${BASE_URL}/${image.url}`;
 const navigate = useNavigate();

    const handleClick = () => {
      navigate(`/images/${image.id}`);
  };
  return (
    <Card
      sx={{
        width: '100%', 
        maxWidth: '700px', 
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'scale(1.03)', 
          boxShadow: 6, 
        },
        bgcolor: 'background.paper',
      }}
      onClick={handleClick}
    >
      <CardMedia
        component="img"
       
        // sx={{ height: { xs: 300, sm: 400, md: 500 }, objectFit: 'cover' }} 
        sx={{ maxHeight: '700px', objectFit: 'contain', width: '100%' }} 
        image={fullImageUrl}
        alt={image.id}
      />
      {/* date/likes */}
       <CardActions disableSpacing sx={{ justifyContent: 'space-between', px: 2, py:1 }}>
         <Typography variant="caption" color="text.secondary">
            {new Date(image.createdAt).toLocaleDateString()}
         </Typography>
         <Chip
            icon={<FavoriteIcon fontSize="small" />}
            label={image.likes}
            size="small"
            variant="outlined" 
            sx={{ ml: 'auto' }}
          />
      </CardActions>
    </Card>
  );
};

export default ImageCard;