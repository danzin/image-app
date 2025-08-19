import React, { useState, useCallback } from 'react';
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
  IconButton,
  Card,
  Container,
  alpha,
  useMediaQuery,
  Stack,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

import { useNavigate, useParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Gallery from '../components/Gallery';
import { EditProfile } from '../components/EditProfile';
import {  useGetUser, useUpdateUserAvatar, useUserImages, useUpdateUserCover } from '../hooks/user/useUsers';
import { useFollowUser, useIsFollowing } from '../hooks/user/useUserAction';
import { useAuth } from '../hooks/context/useAuth';
import ImageEditor from '../components/ImageEditor';
import { useQueryClient } from '@tanstack/react-query';
import { ChangePassword } from '../components/ChangePassword';

const BASE_URL = '/api'

const Profile:React.FC  = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); 
  const { user, isLoggedIn } = useAuth(); 
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();

  const profileUserId = id || user?.publicId;

  // Data for profile being viewed - use the identifier to get user data
  // If no id is provided in URL and user is logged in, use their data
  const { data: profileData, isLoading: isLoadingProfile, error: getUserError } = useGetUser(
    id ? id : (isLoggedIn ? user?.username : undefined)
  );

  const {
    data: imagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingImages,
  } = useUserImages(profileData?.publicId || '', { enabled: !!profileData?.publicId });
  
  const { data: isFollowing, isLoading: isCheckingFollow } = useIsFollowing(
    profileData?.publicId || '', 
    { enabled: isLoggedIn && !!profileData?.publicId && profileData?.publicId !== user?.publicId }
  );

  // modals state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  //check if user is the owner of the profile
  const isProfileOwner = isLoggedIn && profileData?.publicId === user?.publicId;

  // mutations
  const avatarMutation = useUpdateUserAvatar();
  const coverMutation = useUpdateUserCover();
  const { mutate: followUserMutation, isPending: followPending } = useFollowUser();


  const notifySuccess = useCallback((message: string) => toast.success(message), []);
  const notifyError = useCallback((message: string) => toast.error(message), []);

  const flattenedImages = imagesData?.pages?.flatMap((page) => page.data) || [];

  // Proper check for data in imagesData. totalPages can't be accessed because it's a property of each page object within pages array, 
  // not a direct property of imagesData. This was causing the TS error, `imagesData` is of type `InfiniteData<ImagePageData, number> | undefined`
  // so I needed to check if it exists and then if it has any pages
  const isLoadingAll = isLoadingImages || (imagesData?.pages.length === 0); 

  const handleFollowUser = () => {
    if (!isLoggedIn) return navigate('/login');
    if (!profileUserId || !profileData) return;

    followUserMutation(profileData.publicId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['isFollowing', profileData.publicId] });
        queryClient.invalidateQueries({ queryKey: ['user', profileData.publicId] });
      },
      onError: (error: Error) => {
        notifyError(`Action failed: ${error?.message || 'Unknown error'}`);
        console.error('Error following/unfollowing user:', error);
      }
    });
  };


// Handler for Avatar upload (receives Blob)
const handleAvatarUpload = useCallback((croppedImage: Blob | null) => {
  if (!croppedImage) {
    notifyError('Image processing failed.'); 
    setIsAvatarModalOpen(false);
    return;
}
  
  try {
    avatarMutation.mutate(croppedImage, {
      onSuccess: () => notifySuccess('Avatar updated successfully!'),
      onError: (error: Error) => notifyError(`Avatar upload failed: ${error?.message || 'Error'}`),
      onSettled: () => setIsAvatarModalOpen(false)
    });
  } catch (error) {
    notifyError('Error processing image');
    console.error('Error converting dataURL to Blob:', error);
  }
}, [avatarMutation, notifyError, notifySuccess]);

// Handler for Cover upload (receives Blob)
const handleCoverUpload = useCallback((croppedImage: Blob | null) => {
  if (!croppedImage) {
    notifyError('Image processing failed.'); 
    setIsAvatarModalOpen(false);
    return;
}  
  try {
    coverMutation.mutate(croppedImage, {
      onSuccess: () => notifySuccess('Cover photo updated successfully!'),
      onError: (error: Error) => notifyError(`Cover upload failed: ${error?.message || 'Error'}`),
      onSettled: () => setIsCoverModalOpen(false)
    });
  } catch (error) {
    notifyError('Error processing image');
    console.error('Error converting dataURL to Blob:', error);
  }
}, [coverMutation, notifyError, notifySuccess]);

    // Loading state
    if (isLoadingProfile) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
          <CircularProgress />
        </Box>
      );
    }

    if (getUserError) {
      return (
        <Container maxWidth="lg" sx={{ mt: 3 }}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="error">
              Error loading profile: {(getUserError as Error)?.message || 'Unknown error'}
            </Typography>
          </Card>
        </Container>
      );
    }

    
  if (!profileData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Card sx={{ p: 3, textAlign: 'center' }}>
          <Typography>User not found.</Typography>
        </Card>
      </Container>
    );
  }

  const getFullUrl = (urlPath: string | undefined): string | undefined => {
    if (!urlPath) return undefined;
    const imageUrl =  urlPath.startsWith('http')
    ? urlPath
    : urlPath.startsWith('/')
    ? `${BASE_URL}${urlPath}` 
    : `${BASE_URL}/${urlPath}`;
    return imageUrl
  };
  
  const fullAvatarUrl = getFullUrl(profileData?.avatar);
  const fullCoverUrl = getFullUrl(profileData?.cover);

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
    {/* Cover Photo */}
    <Box sx={{
      position: 'relative',
      height: { xs: '25vh', sm: '30vh', md: '35vh' },
      bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundImage: fullCoverUrl ? `url(${fullCoverUrl})` : 'none',
    }}>
      {/* Dark overlay gradient */}
      <Box
        sx={{
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: '80px',
          background: `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.7)}, transparent)`,
        }}
      />
      
      {/* Edit Cover Button */}
      {isProfileOwner && (
        <IconButton
          size="medium"
          onClick={() => setIsCoverModalOpen(true)}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            color: theme.palette.text.primary,
            '&:hover': {
              bgcolor: theme.palette.background.paper,
            },
            zIndex: 10,
            boxShadow: theme.shadows[2],
          }}
          aria-label="Edit cover photo"
        >
          <EditIcon />
        </IconButton>
      )}
    </Box>

    {/* Main Content Container */}
    <Container maxWidth="lg" sx={{ position: 'relative' }}>
      {/* Profile Header Section */}
      <Box sx={{
        mt: { xs: -8, sm: -10 }, 
        px: { xs: 2, sm: 3 },
        mb: 4,
        position: 'relative',
      }}>
        <Grid container spacing={2} alignItems="flex-end">
          {/* Avatar Section */}
          <Grid item xs={12} sm="auto">
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                src={fullAvatarUrl}
                alt={`${profileData?.username}'s avatar`}
                sx={{
                  width: { xs: 120, sm: 140, md: 160 },
                  height: { xs: 120, sm: 140, md: 160 },
                  border: `4px solid ${theme.palette.background.paper}`,
                  boxShadow: theme.shadows[4],
                }}
              />
              
              {/* Edit Avatar Button */}
              {isProfileOwner && (
                <IconButton
                  size="small"
                  onClick={() => setIsAvatarModalOpen(true)}
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    color: theme.palette.primary.main,
                    '&:hover': { bgcolor: theme.palette.background.paper },
                    boxShadow: theme.shadows[2],
                  }}
                  aria-label="Edit profile picture"
                >
                  <CameraAltIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Grid>

          {/* User Info Section */}
          <Grid item xs={12} sm>
            <Box sx={{ 
              pt: { xs: 2, sm: 0 },
              pl: { xs: 0, sm: 2 },
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2
            }}>
              {/* Name and Bio */}
              <Box>
                <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom={!isMobile}>
                  {profileData?.username}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 2, sm: 0 } }}>
                  {profileData?.bio || 'No bio available'}
                </Typography>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ 
                display: 'flex', 
                gap: 2,
                width: { xs: '100%', sm: 'auto' }
              }}>
                {isProfileOwner ? (
                  <>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => setIsEditProfileOpen(true)}
                      startIcon={<EditIcon />}
                      fullWidth={isMobile}
                    >
                      Edit Profile
                    </Button>
                    <Button
                    variant="outlined"
                    color="secondary" 
                    onClick={() => setIsChangePasswordOpen(true)}
                    startIcon={<EditIcon />}
                    fullWidth={isMobile}
                    >
                    Change Password
                  </Button>
                  </>
       
                ) : isLoggedIn ? (
                  <Button
                    variant={isFollowing ? "outlined" : "contained"}
                    color={isFollowing ? "primary" : "primary"}
                    onClick={handleFollowUser}
                    disabled={isCheckingFollow || followPending}
                    fullWidth={isMobile}
                    sx={{ minWidth: 120 }}
                  >
                    {isCheckingFollow || followPending ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      isFollowing ? 'Unfollow' : 'Follow'
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => navigate('/login')}
                    fullWidth={isMobile}
                  >
                    Log in to follow
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Stats Summary - Quick overview */}
      <Paper elevation={1} sx={{ mb: 3, p: 2, borderRadius: 2 }}>
        <Grid container spacing={3} justifyContent="center">
          {[
            { label: 'Posts', value: flattenedImages.length || 0 },
            { label: 'Followers', value: profileData?.followerCount || 0 },
            { label: 'Following', value: profileData?.followingCount || 0 },
          ].map((stat) => (
            <Grid item xs={4} key={stat.label} sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="medium" color="primary">
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Gallery Section */}
        <Grid item xs={12} md={8}>
          <Paper elevation={1} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight="medium">
              Uploads
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {flattenedImages.length === 0 && !isLoadingImages ? (
              <Box sx={{ 
                textAlign: 'center', 
                py: 6,
                color: 'text.secondary',
                bgcolor: alpha(theme.palette.background.default, 0.5),
                borderRadius: 1
              }}>
                <Typography variant="body1">
                  {isProfileOwner ? 'You haven\'t uploaded any images yet.' : 'This user hasn\'t uploaded any images yet.'}
                </Typography>
              </Box>
            ) : (
              <Gallery
                images={flattenedImages}
                fetchNextPage={fetchNextPage}
                hasNextPage={!!hasNextPage}
                isFetchingNext={isFetchingNextPage}
                isLoadingAll={isLoadingAll}
              />
            )}
          </Paper>
        </Grid>

        {/* About + Stats Section */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* About Section */}
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom fontWeight="medium">
                About
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {profileData?.bio || 'This user hasn\'t added a bio yet.'}
              </Typography>
            </Paper>

            {/* Additional Info (maybe should expand)*/}
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom fontWeight="medium">
                User Stats
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Join date:</Typography>
                  <Typography variant="body2">
                    {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'Unknown'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Total uploads:</Typography>
                  <Typography variant="body2">{flattenedImages.length || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Followers:</Typography>
                  <Typography variant="body2">{profileData?.followerCount || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Following:</Typography>
                  <Typography variant="body2">{profileData?.followingCount || 0}</Typography>
                </Box>
              </Box>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Container>

    {/* Avatar Edit Modal */}
    <Modal 
      open={isAvatarModalOpen} 
      onClose={() => setIsAvatarModalOpen(false)} 
      aria-labelledby="avatar-modal"
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 2
      }}
    >
      <Paper 
        elevation={24} 
        sx={{ 
          p: 3, 
          borderRadius: 2, 
          maxWidth: '90vw', 
          maxHeight: '90vh',
          overflowY: 'auto',
          width: { xs: '100%', sm: 500 }
        }}
      >
        <Typography variant="h6" gutterBottom>Update Profile Picture</Typography>
        <Divider sx={{ mb: 2 }} />
        <ImageEditor
          type='avatar'
          onImageUpload={handleAvatarUpload}
          onClose={() => setIsAvatarModalOpen(false)}
        />
      </Paper>
    </Modal>

    {/* Cover Edit Modal */}
    <Modal 
      open={isCoverModalOpen} 
      onClose={() => setIsCoverModalOpen(false)} 
      aria-labelledby="cover-modal"
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 2
      }}
    >
      <Paper 
        elevation={24} 
        sx={{ 
          p: 3, 
          borderRadius: 2, 
          maxWidth: '95vw', 
          maxHeight: '90vh',
          overflowY: 'auto',
          width: { xs: '100%', sm: 700 }
        }}
      >
        <Typography variant="h6" gutterBottom>Update Cover Photo</Typography>
        <Divider sx={{ mb: 2 }} />
        <ImageEditor
          type='cover'
          aspectRatio={3}
          onImageUpload={handleCoverUpload}
          onClose={() => setIsCoverModalOpen(false)}
        />
      </Paper>
    </Modal>

    {/* Edit Profile Modal */}
    <Modal 
      open={isEditProfileOpen} 
      onClose={() => setIsEditProfileOpen(false)} 
      aria-labelledby="edit-profile-modal"
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 2
      }}
    >
      <Paper 
        elevation={24} 
        sx={{ 
          p: 3, 
          borderRadius: 2, 
          maxWidth: '90vw', 
          maxHeight: '90vh',
          overflowY: 'auto',
          width: { xs: '100%', sm: 600 }
        }}
      >
        <Typography variant="h6" gutterBottom>Edit Your Profile</Typography>
        <Divider sx={{ mb: 2 }} />
        <EditProfile
          onComplete={() => setIsEditProfileOpen(false)}
          notifySuccess={notifySuccess}
          notifyError={notifyError}
          initialData={profileData}
        />
      </Paper>
    </Modal>

    {/* Change Password Modal */}
    <Modal
      open={isChangePasswordOpen}
      onClose={() => setIsChangePasswordOpen(false)}
      aria-labelledby="change-password-modal"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
    >
      <Paper elevation={24} sx={{ 
          p: 3, 
          borderRadius: 2, 
          maxWidth: '90vw', 
          maxHeight: '90vh',
          overflowY: 'auto',
          width: { xs: '100%', sm: 600 }
        }} >
        {/* Maybe add a Title and Divider */}
        <ChangePassword
          onComplete={() => setIsChangePasswordOpen(false)}
          notifySuccess={notifySuccess}
          notifyError={notifyError}
        />
      </Paper>
    </Modal>

    <ToastContainer position="bottom-right" autoClose={3000} theme={theme.palette.mode === 'dark' ? 'dark' : 'light'} />
  </Box>
  );
};

export default Profile;