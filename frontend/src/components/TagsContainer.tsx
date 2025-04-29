import { Box, Chip, Skeleton, Typography } from "@mui/material";
import { useGallery } from "../context/GalleryContext";
import { useTags } from "../hooks/images/useImages";

export const Tags = () => {
  const { selectedTags, setSelectedTags } = useGallery();
  const tagsQuery  = useTags();
  const { data: tags, isPending } = tagsQuery;

  const handleTagClick = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  if (isPending) {
  
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" width={80} height={32} />
        ))}
      </Box>
    );
  }
  
  if (!tags || tags.length === 0) {
    return <Typography variant="body2" color="text.secondary">No tags found.</Typography>;
  }

  console.log(tags)

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
    {tags.map((tag) => {
      const isSelected = selectedTags.includes(tag.tag);
      return (
        <Chip
          key={tag._id} 
          label={tag.tag}
          onClick={() => handleTagClick(tag.tag)}
          variant={isSelected ? "filled" : "outlined"}
          color={isSelected ? "primary" : "default"}
          clickable 
          size="small" 
           sx={{
             
             borderColor: 'divider', 
             '&:hover': {
               borderColor: isSelected ? 'primary.main' : 'text.secondary', 
               bgcolor: isSelected ? 'primary.dark' : 'action.hover'
             }
          }}
        />
      );
    })}
  </Box>
  );
};
