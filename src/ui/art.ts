// Only decorative images belong here; game state, labels and controls stay in DOM/canvas.
const images = {
  logo: new URL('../../assets/ui/facebook-casual/04-levels/logo.png', import.meta.url).href,
  campaignTower: new URL('../../assets/ui/facebook-casual/07-campaign-complete/tower-and-island.png', import.meta.url).href,
  reset: new URL('../../assets/ui/facebook-casual/08-reset-confirmation/dialog-icon.png', import.meta.url).href,
  storage: new URL('../../assets/ui/facebook-casual/09-storage-recovery/storage-icon.png', import.meta.url).href,
  loading: new URL('../../assets/ui/facebook-casual/10-service-states/loading-tower.png', import.meta.url).href,
  graphics: new URL('../../assets/ui/facebook-casual/10-service-states/graphics-illustration.png', import.meta.url).href,
} as const;

export function artImage(name: keyof typeof images, className: string): HTMLImageElement {
  const image = document.createElement('img');
  image.src = images[name]; image.className = className; image.alt = '';
  if (name !== 'logo' && name !== 'loading') image.loading = 'lazy';
  image.draggable = false; image.setAttribute('aria-hidden', 'true');
  return image;
}
