import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Avatar,
  Modal,
  Grid,
  Paper,
  Divider,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import AvatarEditor from '../components/AvatarEditor';
import Gallery from '../components/Gallery';
import { EditProfile } from '../components/EditProfile';
import { useGetUser, useUpdateUserAvatar, useUpdateUserCover, useUserImages } from '../hooks/useUsers';
import { useFollowUser } from '../hooks/useUserAction';
import { useAuth } from '../context/AuthContext';
import { useIsFollowing } from '../hooks/useUserAction';

const DashboardLayout:React.FC  = () => {
  const { id } = useParams(); 
  const { data: userData, isLoading, error: getUserError } = useGetUser(id as string); //userData -> data of the user profile
  const {
    data: imagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserImages(userData?.id || '');

  const { user } = useAuth(); 
  const theme = useTheme();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isProfileOwner = id === user?.id;
  const avatarMutation = useUpdateUserAvatar();

  const notifySuccess = (message: string) => toast.success(message);
  const notifyError = (message: string) => toast.error(message);

  const flattenedImages = imagesData?.pages?.flatMap((page) => page.data) || [];

  const { mutate: followUser, isPending: followPending } = useFollowUser();
  const handleFollowUser = (id: string) => {
    followUser(id as string, {
  
      onError: (error) => {
        console.error('Error following user:', error);
      }
    })
  }

  const { data: isFollowing, isLoading: isCheckingFollow } = useIsFollowing(id as string);

  const handleImageUpload = async (croppedImage: string) => {
    try {
      const blob = await fetch(croppedImage).then((res) => res.blob());
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.jpg');
      avatarMutation.mutate(formData);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', bgcolor: theme.palette.background.default }}>
      {/* Cover Photo */}
      <Box sx={{ position: 'relative', height: { xs: '20vh', sm: '25vh', md: '30vh' }, bgcolor: 'grey.900' }}>
        <img
          src={userData?.cover}
          alt="Cover"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
          }}
        />
      </Box>

      <Box sx={{ 
        maxWidth: '100%', 
        width: { lg: '1200px' }, 
        mx: 'auto', 
        px: { xs: 1, sm: 2 }, 
        mt: { xs: -6, sm: -8 }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {/* Profile Picture */}
          <Box sx={{ position: 'relative' }}>
          <Avatar
            src={userData?.avatar}
            sx={{
              width: { xs: 96, sm: 128 }, 
              height: { xs: 96, sm: 128 },
              border: `4px solid ${theme.palette.background.paper}`,
            }}
          />
            {isProfileOwner && (
              <Button
                variant="contained"
                size="small"
                sx={{ position: 'absolute', bottom: 0, mx: 'auto', background: 'transparent', color: 'black' }}
                onClick={() => setIsModalOpen(true)}
              >
                Update
              </Button>
            )}
          </Box>

          {/* User Info */}
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5" fontWeight="bold" color="text.secondary">
                {userData?.username}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Software Developer
              </Typography>
              
            </Box>
            {!isProfileOwner && ( <Button variant="outlined" size="small" onClick={() => handleFollowUser(id as string)} sx={{ ml: 2, py: 1 }}>
            {isFollowing ? 'Unfollow' : 'Follow'}
            </Button>) }
           
          </Box>

          {/* Edit Profile */}
          {isProfileOwner && (
            <Button variant="outlined" onClick={() => setIsEditOpen(true)} sx={{ ml: 'auto' }}>
              Edit Profile
            </Button>
           ) 
          }
        </Box>

        <Grid 
          container 
          spacing={2}
          sx={{ 
            mt: { xs: 2, sm: 4 }, 
            flexDirection: { xs: 'column-reverse', lg: 'row' },
            alignItems: 'stretch',
          }}
        >
          {/* Gallery */}
          <Grid 
            item 
            xs={12} 
            lg={8} 
            sx={{ p: 3, display: 'flex', flexDirection: 'column' }}
          > 
            <Paper 
              elevation={2} 
              sx={{ 
                p: 3, 
                flexGrow: 1, 
                overflowY: 'auto', 
              }} 
            >
              <Gallery
                images={flattenedImages}
                fetchNextPage={fetchNextPage}
                hasNextPage={!!hasNextPage}
                isFetchingNext={isFetchingNextPage}
              />
            </Paper>
          </Grid>

          {/* Stats Section */}
          <Grid 
            item 
            xs={12} 
            lg={4} 
            sx={{ display: 'flex', flexDirection: 'column', height: '500px' }} 
          >
            <Paper elevation={2} sx={{ p: 3, flexGrow: 1 }}>
              <Typography variant="h6">About</Typography>
              <Typography variant="body2" color="text.secondary">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Typography variant="h6">Stats</Typography>
              <Grid container spacing={2} color="text.secondary">
                {[
                  { label: 'Uploads', value: userData?.images.length || 0 },
                  { label: 'Followers', value: userData?.followers.length || 0 },
                  { label: 'Following', value: userData?.following.length || 0 },
                ].map((stat) => (
                  <Grid item xs={12} key={stat.label}>
                    <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {stat.label}
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        {stat.value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Avatar Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            boxShadow: 24,
          }}
        >
          <AvatarEditor onImageUpload={handleImageUpload} />
          <Button onClick={() => setIsModalOpen(false)} sx={{ mt: 2 }}>
            Close
          </Button>
        </Box>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            boxShadow: 24,
          }}
        >
          <EditProfile onComplete={() => setIsEditOpen(false)} notifySuccess={notifySuccess} notifyError={notifyError} />
        </Box>
      </Modal>

      <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar theme="dark" />
    </Box>
  );
};

export default DashboardLayout;