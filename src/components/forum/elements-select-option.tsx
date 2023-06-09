import React from 'react';

const PostFilter: React.FC = () => {
  return (
    <div>
      <select className="block bg-gray-300 text-gray-700 py-2 px-4 rounded-lg focus:outline-none md:py-3">
        <option>Latest</option>
        <option>Last Week</option>
      </select>
    </div>
  );
};

export default PostFilter;