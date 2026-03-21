import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import type { LinkPreview } from '../utils/extractLinkPreviews';

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export interface SearchResultsCarouselProps {
  linkPreviews: LinkPreview[];
}

/**
 * Horizontally scrolling cards for search / link-preview JSON extracted from gateway content.
 */
export const SearchResultsCarousel: React.FC<SearchResultsCarouselProps> = ({ linkPreviews }) => {
  if (!linkPreviews.length) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 1.25,
        mt: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        width: '100%',
        maxWidth: '100%',
        pb: 0.5,
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {linkPreviews.map((preview) => (
        <Box
          key={preview.url}
          sx={{
            flex: '0 0 auto',
            width: 'min(280px, 75vw)',
            maxWidth: '100%',
            scrollSnapAlign: 'start',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.25,
            bgcolor: 'background.paper',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          <Link
            href={preview.url}
            target="_blank"
            rel="noreferrer noopener"
            underline="hover"
            sx={{
              fontWeight: 600,
              fontSize: '0.875rem',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview.title || preview.url}
          </Link>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {hostnameFromUrl(preview.url)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
