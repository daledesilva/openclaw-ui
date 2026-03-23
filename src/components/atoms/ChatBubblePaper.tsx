import { Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

/** Same values as `Message.role` in `chatThreadTypes` (drives bubble colours and corner radii only). */
export type ChatBubbleMessageRole = 'user' | 'ai';

/** Shared MUI `Paper` shell for chat bubbles; visuals depend only on `messageRole`. */
export const ChatBubblePaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'messageRole',
})<{
  messageRole: ChatBubbleMessageRole;
}>(({ theme, messageRole }) => {
  const isUserMessage = messageRole === 'user';

  let backgroundColor: string;
  let color: string;
  if (isUserMessage) {
    backgroundColor = theme.palette.primary.main;
    color = theme.palette.primary.contrastText;
  } else {
    backgroundColor = theme.palette.background.paper;
    color = theme.palette.text.primary;
  }

  let borderBottomRightRadius: number;
  let borderTopLeftRadius: number;
  let borderBottomLeftRadius: number;
  if (isUserMessage) {
    borderBottomRightRadius = 4;
    borderTopLeftRadius = 16;
    borderBottomLeftRadius = 16;
  } else {
    borderBottomRightRadius = 16;
    borderTopLeftRadius = 16;
    borderBottomLeftRadius = 4;
  }

  return {
    padding: theme.spacing(1.5, 2),
    maxWidth: '85%',
    width: '100%',
    minWidth: 0,
    borderRadius: '16px',
    backgroundColor,
    color,
    borderBottomRightRadius,
    borderBottomLeftRadius,
    borderTopLeftRadius,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    cursor: 'default',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.spacing(0.75),
  };
});
