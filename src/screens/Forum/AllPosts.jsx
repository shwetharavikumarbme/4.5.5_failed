import React from 'react';
import BaseForumComponent from './BaseForumComponent';

const AllPosts = ({ isPageFocused, scrollRef }) => (
  <BaseForumComponent 
    fetchCommand="getAllForumPosts"
    searchCommand="searchLatestForumPosts"
    type="All"
    isPageFocused={isPageFocused}
    scrollRef={scrollRef}
    showPostButton={true}
  />
);

export default AllPosts;