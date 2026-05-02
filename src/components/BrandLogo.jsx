import { APP_CONFIG } from '../config.js';

const assetModules = {
  ...import.meta.glob('../assets/*.{png,jpg,jpeg,svg,webp,avif}', { eager: true, import: 'default' }),
  ...import.meta.glob('../Assets/*.{png,jpg,jpeg,svg,webp,avif}', { eager: true, import: 'default' }),
  ...import.meta.glob('../../assets/*.{png,jpg,jpeg,svg,webp,avif}', { eager: true, import: 'default' }),
  ...import.meta.glob('../../Assets/*.{png,jpg,jpeg,svg,webp,avif}', { eager: true, import: 'default' })
};

const logoSrc = pickLogoSrc(assetModules);

export function BrandLogo({ className = '', textClassName = '', imageClassName = '', compact = false, showText = true }) {
  return (
    <span className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${className}`.trim()}>
      {logoSrc ? (
        <img className={`brand-logo__image ${imageClassName}`.trim()} src={logoSrc} alt={`Logo ${APP_CONFIG.appName}`} />
      ) : (
        <span className="brand__mark brand-logo__fallback" aria-hidden="true">SD</span>
      )}

      {showText ? (
        <span className={`brand-logo__text ${textClassName}`.trim()}>
          <strong>{APP_CONFIG.appName}</strong>
          <small>{APP_CONFIG.moduleName}</small>
        </span>
      ) : null}
    </span>
  );
}

function pickLogoSrc(modules) {
  const entries = Object.entries(modules || {});
  if (!entries.length) return '';

  const sorted = entries.sort(([leftPath], [rightPath]) => scorePath(rightPath) - scorePath(leftPath));
  return sorted[0]?.[1] || '';
}

function scorePath(pathname = '') {
  const normalized = pathname.toLowerCase();
  let score = 0;

  if (normalized.includes('sementes')) score += 5;
  if (normalized.includes('logo')) score += 4;
  if (normalized.includes('simulados')) score += 2;
  if (normalized.includes('brand')) score += 1;

  return score;
}
