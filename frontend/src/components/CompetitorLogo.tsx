import { useState } from 'react';

interface Props {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const COLORS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-emerald-500 to-emerald-600',
  'from-rose-500 to-rose-600',
  'from-amber-500 to-amber-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
  'from-orange-500 to-orange-600',
];

/** Extract domain from a URL or competitor name for logo lookup */
function getDomain(name: string, url?: string | null): string | null {
  // If we have a URL, extract domain
  if (url) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace('www.', '');
    } catch {
      // fall through
    }
  }
  // Guess domain from name: "Salesforce" -> "salesforce.com"
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (slug.length > 0) {
    return `${slug}.com`;
  }
  return null;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
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
      <div className={`${sizeClass} rounded-xl overflow-hidden flex-shrink-0 bg-white border border-gray-100 flex items-center justify-center ${className}`}>
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

  // Fallback: gradient initials
  return (
    <div className={`${sizeClass} rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm ${className}`}>
      {initials}
    </div>
  );
}

/** Smaller inline logo for use in tables and lists */
export function CompetitorLogoInline({ name, url }: { name: string; url?: string | null }) {
  return <CompetitorLogo name={name} url={url} size="sm" />;
}
