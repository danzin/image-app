import { Skeleton } from "@mui/material";
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

  
  console.log(tags)

  return (
    <>
    {isPending && <Skeleton variant="rounded" width={210} height={60} />}
    <div className="tags-container h-1/2 overflow-y-auto p-4 rounded-lg">
      {tags?.map((tag, index) => (
        <span
        key={index}
        className={`tag ${
          selectedTags.includes(tag.tag)
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700'
        } rounded-full p-1 py-1 m-1 inline-block cursor-pointer transition-colors`}
        onClick={() => handleTagClick(tag.tag)}
        >
          {tag.tag}
        </span>
      ))}
    </div>
      </>
  );
};
