import TravelIllustration from './TravelIllustration'
import type { TravelArt } from './TravelIllustration'
export default function NavigationTile({ label, art, active, onClick }: { label: string; art: TravelArt; active?: boolean; onClick: () => void }) {
  return <button type="button" className={`nav-tile nav-tile--${art}${active ? ' active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} onClick={onClick}>
    <span className="nav-tile-art"><TravelIllustration kind={art} /></span>
    <span className="nav-tile-label">{label.replace(/^[^\p{L}\p{N}]+/u, '')}</span>
    {active && <span className="nav-active-dot" aria-hidden="true" />}
  </button>
}
