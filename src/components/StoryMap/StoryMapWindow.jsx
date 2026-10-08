import React from 'react';

/**
 * Window chrome placeholder for the story map.
 * Future stories will add the floating toolbar, panels, and modal hosts here.
 */
export function StoryMapWindow({ children }) {
  return (
    <div className="storymap-window" data-testid="storymap-window">
      {children}
    </div>
  );
}
