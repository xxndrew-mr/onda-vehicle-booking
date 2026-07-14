import Avatar from './Avatar';
import { useAuth } from './AuthContext';

/**
 * Nama + foto profil inline. openId dipakai mencari avatar dari direktori
 * (avatarOf); avatarSrc opsional untuk menimpa (mis. requester_avatar).
 */
export default function Person({ name, openId, avatarSrc, size = 20, className = '' }) {
  const { avatarOf } = useAuth();
  const src = avatarSrc || avatarOf(openId);
  if (!name) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      <Avatar src={src} name={name} size={size} />
      <span>{name}</span>
    </span>
  );
}
