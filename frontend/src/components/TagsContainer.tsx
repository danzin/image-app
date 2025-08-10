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
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton 
            key={index} 
            variant="rounded" 
            width={80} 
            height={32} 
            sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)' }}
          />
        ))}
      </Box>
    );
  }
  
  if (!tags || tags.length === 0) {
    return (
      <Typography variant="body2" sx={{ 
        color: 'text.secondary',
        textAlign: 'center',
        py: 2,
        fontStyle: 'italic'
      }}>
        No tags found.
      </Typography>
    );
  }

  console.log(tags)

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag.tag);
        return (
          <Chip
            key={tag._id} 
            label={tag.tag}
            onClick={() => handleTagClick(tag.tag)}
            variant={isSelected ? "filled" : "outlined"}
            size="small" 
            clickable 
            sx={{
              background: isSelected 
                ? 'linear-gradient(45deg, #6366f1, #8b5cf6)'
                : 'transparent',
              borderColor: isSelected 
                ? 'transparent' 
                : 'rgba(99, 102, 241, 0.3)',
              color: isSelected 
                ? 'white' 
                : 'text.primary',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: isSelected 
                  ? 'linear-gradient(45deg, #4f46e5, #7c3aed)'
                  : 'rgba(99, 102, 241, 0.1)',
                borderColor: '#6366f1',
                transform: 'scale(1.05)'
              }
            }}
          />
        );
      })}
    </Box>
  );
};
