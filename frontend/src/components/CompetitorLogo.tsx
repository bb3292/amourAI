import { useState } from 'react';

interface Props {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-lg',
};

const COLORS = [
  'from-brand-500 to-purple-500',
  'from-purple-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-red-500',
  'from-amber-500 to-orange-500',
  'from-cyan-500 to-blue-500',
  'from-brand-400 to-brand-600',
  'from-pink-500 to-rose-500',
  'from-teal-500 to-emerald-500',
  'from-orange-500 to-amber-500',
];

function getDomain(name: string, url?: string | null): string | null {
  if (url) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace('www.', '');
    } catch { /* fall through */ }
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (slug.length > 0) return `${slug}.com`;
  return null;
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function CompetitorLogo({ name, url, size = 'md', className = '' }: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState<'clearbit' | 'favicon' | 'none'>('clearbit');

  const domain = getDomain(name, url);
  const sizeClass = SIZES[size];
  const initials = getInitials(name);
  const colorClass = hashColor(name);

  const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : null;
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;

  const handleError = () => {
    if (imgSrc === 'clearbit' && faviconUrl) {
      setImgSrc('favicon');
    } else {
      setImgSrc('none');
      setImgError(true);
    }
  };

  const currentUrl =
    imgSrc === 'clearbit' ? clearbitUrl :
    imgSrc === 'favicon' ? faviconUrl :
    null;

  if (!imgError && currentUrl) {
    return (
      <div className={`${sizeClass} rounded-xl overflow-hidden flex-shrink-0 bg-surface border border-white/[0.08] flex items-center justify-center ${className}`}>
        <img
          src={currentUrl}
          alt={`${name} logo`}
          className="w-full h-full object-contain p-0.5"
          onError={handleError}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm ${className}`}>
      {initials}
    </div>
  );
}

export function CompetitorLogoInline({ name, url }: { name: string; url?: string | null }) {
  return <CompetitorLogo name={name} url={url} size="sm" />;
}
