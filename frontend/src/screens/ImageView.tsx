import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useImageById } from '../hooks/images/useImages';
import { useLikeImage } from '../hooks/user/useUserAction';
import { useAuth } from '../hooks/context/useAuth';
import { useDeleteImage } from '../hooks/images/useImages';
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  Divider,
  CircularProgress,
  Chip,
  Card,
  CardMedia,
  CardContent,
  Alert
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DeleteIcon from '@mui/icons-material/Delete';
import CommentSection from '../components/comments/CommentSection'; 

const BASE_URL = '/api';

const ImageView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  
  const { data: image, isLoading, isError, error } = useImageById(id || '');
  const { mutate: likeImage, isPending: isLiking } = useLikeImage();
  const deleteMutation = useDeleteImage();

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (isError || !image) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Error loading image: {error?.message || 'Image not found'}
        </Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Container>
    );
  }

  const isOwner = isLoggedIn && user?.id === image.user.id;
  const fullImageUrl = image.url.startsWith('http')
    ? image.url
    : image.url.startsWith('/')
    ? `${BASE_URL}${image.url}` 
    : `${BASE_URL}/${image.url}`;

  const handleLikeImage = () => {
    if (!isLoggedIn) return navigate('/login');
    likeImage(image.id);
  };

  const handleDeleteImage = () => {
    if (isOwner) {
      deleteMutation.mutate(image.id, {
        onSuccess: () => navigate(-1),
        onError: (err) => console.error('Delete failed', err),
      });
    }
  };


  return (
    <Container maxWidth="md" sx={{ my: 4 }}>
      <Button 
        variant="outlined" 
        startIcon={<ArrowBackIcon />} 
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        Go Back
      </Button>
      
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Card sx={{ boxShadow: 'none' }}>
            <CardMedia
              component="img"
              sx={{ maxHeight: '70vh', objectFit: 'contain', width: '100%' }}
              image={fullImageUrl}
              alt={image.publicId || 'Image'}
            />
            
            <CardContent sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Uploaded {new Date(image.createdAt).toLocaleDateString()} by{' '}
                  <Typography component={RouterLink} to={`/profile/${image.user.id}`} sx={{ color: 'primary.main', textDecoration: 'none' }}>
                    {image.user.username}
                  </Typography>
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<FavoriteIcon />} 
                    onClick={handleLikeImage} 
                    disabled={isLiking}
                  >
                    {image.likes} {isLiking ? 'Liking…' : 'Like'}
                  </Button>
                  
                  {isOwner && (
                    <Button 
                      variant="outlined" 
                      color="error" 
                      size="small" 
                      startIcon={<DeleteIcon />} 
                      onClick={handleDeleteImage} 
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </Box>
              </Box>
              
              {image.tags && image.tags.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tags:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {image.tags.map((tag) => (
                      <Chip 
                        key={tag._id} 
                        label={tag.tag} 
                        size="small" 
                        onClick={() => navigate(`/results?q=${tag.tag}`)}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
        
        <Divider />
        
        {/* Comment section */}
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <CommentSection imageId={image.id} commentsCount={image.commentsCount} />
        </Box>
      </Paper>
    </Container>
  );
};

export default ImageView;