import { useGallery } from "../context/GalleryContext";
import { useImages } from "../hooks/useImages";

export const Tags = () => {
  const { selectedTags, setSelectedTags } = useGallery();
  const { tagsQuery } = useImages();
  const { data: tags, isLoading } = tagsQuery;

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };


  return (
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
  );
};
