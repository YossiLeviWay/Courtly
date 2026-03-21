const EMOJI_AVATARS = ['🦁', '🐯', '🦅', '🐺', '🦊', '🐻', '🦋', '🦈', '🐬', '🦁', '🏀', '⚡', '🔥', '💎', '👑'];

export default function PlayerAvatar({ player, size = 'md', className = '' }) {
  const sizes = { sm: 32, md: 40, lg: 56, xl: 80 };
  const px = sizes[size] || 40;
  const fontSize = px * 0.4;
  const initials = player?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?';
  const emoji = player?.avatar?.emoji;

  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      style={{ width: px, height: px, fontSize: emoji ? px * 0.55 : fontSize }}
    >
      {emoji || initials}
    </div>
  );
}
