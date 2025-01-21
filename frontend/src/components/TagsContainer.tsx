import { useImages } from "../hooks/useImages";
import { TagsProps } from "../types";

export const Tags = ({ selectedTags, onSelectTags }: TagsProps) => {
  const { tagsQuery } = useImages();
  const { data: tags, isLoading } = tagsQuery;

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onSelectTags(selectedTags.filter(t => t !== tag));
    } else {
      onSelectTags([...selectedTags, tag]);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

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
