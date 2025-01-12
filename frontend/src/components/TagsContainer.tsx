import React from 'react';

const tags = ['Nature', 'Animals', 'Technology', 'People', 'Travel', 'Food', 'Sports', 'Art'];

const Tags: React.FC = () => {
  return (
    <div className="tags-container h-1/2 overflow-y-auto p-4 rounded-lg">
      {tags.map((tag, index) => (
        <span key={index} className="tag bg-gray-200 text-gray-700 rounded-full px-3 py-1 m-1 inline-block">
          {tag}
        </span>
      ))}
    </div>
  );
};

export default Tags;