import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import { Box, Link, useTheme } from '@mui/material';

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'data'],
  },
};

export type MarkdownTone = 'assistant' | 'user' | 'thinking';

export interface MarkdownMessageProps {
  children: string;
  tone?: MarkdownTone;
  isError?: boolean;
  fontSize?: string;
  lineHeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  children,
  tone = 'assistant',
  isError,
  fontSize,
  lineHeight,
  textAlign,
  color,
}) => {
  const theme = useTheme();
  const isUser = tone === 'user';
  const isThinking = tone === 'thinking';

  const textColor = isUser
    ? theme.palette.primary.contrastText
    : isThinking
      ? theme.palette.text.secondary
      : isError
        ? theme.palette.error.dark
        : theme.palette.text.primary;

  const linkColor = isUser
    ? 'rgba(255,255,255,0.92)'
    : theme.palette.primary.main;

  const codeBg = isUser ? 'rgba(0,0,0,0.18)' : theme.palette.action.hover;
  const preBg = isUser ? 'rgba(0,0,0,0.22)' : theme.palette.grey[100];

  const components: Components = {
    a: ({ href, children: c }) => (
      <Link href={href} target="_blank" rel="noreferrer noopener" sx={{ color: linkColor }}>
        {c}
      </Link>
    ),
    img: ({ src, alt }) => (
      <Box
        component="img"
        src={src}
        alt={alt ?? ''}
        sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1, display: 'block', my: 0.5 }}
      />
    ),
    p: ({ children: c }) => (
      <Box component="p" sx={{ m: 0, mb: 1, '&:last-child': { mb: 0 } }}>
        {c}
      </Box>
    ),
    ul: ({ children: c }) => (
      <Box component="ul" sx={{ m: 0, mb: 1, pl: 2.5 }}>
        {c}
      </Box>
    ),
    ol: ({ children: c }) => (
      <Box component="ol" sx={{ m: 0, mb: 1, pl: 2.5 }}>
        {c}
      </Box>
    ),
    li: ({ children: c }) => (
      <Box component="li" sx={{ mb: 0.25 }}>
        {c}
      </Box>
    ),
    h1: ({ children: c }) => (
      <Box component="h1" sx={{ fontSize: '1.25rem', fontWeight: 600, m: 0, mb: 0.75 }}>
        {c}
      </Box>
    ),
    h2: ({ children: c }) => (
      <Box component="h2" sx={{ fontSize: '1.15rem', fontWeight: 600, m: 0, mb: 0.5 }}>
        {c}
      </Box>
    ),
    h3: ({ children: c }) => (
      <Box component="h3" sx={{ fontSize: '1.05rem', fontWeight: 600, m: 0, mb: 0.5 }}>
        {c}
      </Box>
    ),
    code: ({ className, children: c }) => {
      const inline = !className;
      if (inline) {
        return (
          <Box
            component="code"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.9em',
              px: 0.5,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: codeBg,
            }}
          >
            {c}
          </Box>
        );
      }
      return (
        <Box
          component="code"
          className={className}
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            display: 'block',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            maxWidth: '100%',
          }}
        >
          {c}
        </Box>
      );
    },
    pre: ({ children: c }) => (
      <Box
        component="pre"
        sx={{
          m: 0,
          mb: 1,
          p: 1.25,
          borderRadius: 1,
          bgcolor: preBg,
          overflowX: 'auto',
          overflowY: 'hidden',
          maxWidth: '100%',
          '&:last-child': { mb: 0 },
        }}
      >
        {c}
      </Box>
    ),
    blockquote: ({ children: c }) => (
      <Box
        component="blockquote"
        sx={{
          m: 0,
          mb: 1,
          pl: 1.5,
          borderLeft: `3px solid ${theme.palette.divider}`,
          color: isUser ? 'rgba(255,255,255,0.88)' : theme.palette.text.secondary,
        }}
      >
        {c}
      </Box>
    ),
    table: ({ children: c }) => (
      <Box sx={{ overflow: 'auto', maxWidth: '100%', mb: 1 }}>
        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
          {c}
        </Box>
      </Box>
    ),
    th: ({ children: c }) => (
      <Box
        component="th"
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          px: 1,
          py: 0.5,
          textAlign: 'left',
          bgcolor: isUser ? 'rgba(0,0,0,0.12)' : theme.palette.grey[100],
        }}
      >
        {c}
      </Box>
    ),
    td: ({ children: c }) => (
      <Box component="td" sx={{ border: `1px solid ${theme.palette.divider}`, px: 1, py: 0.5 }}>
        {c}
      </Box>
    ),
  };

  const src = (children || '').trim();
  if (!src) return null;

  return (
    <Box
      sx={{
        color: color ?? textColor,
        fontSize: fontSize ?? theme.typography.body1.fontSize,
        lineHeight: lineHeight ?? theme.typography.body1.lineHeight,
        textAlign: textAlign ?? undefined,
        fontStyle: isThinking ? 'italic' : 'normal',
        maxWidth: '100%',
        minWidth: 0,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        '& strong': { fontWeight: 600 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, sanitizeSchema]]} components={components}>
        {src}
      </ReactMarkdown>
    </Box>
  );
};
