import { MapPin, Plus, Store } from 'lucide-react';

export default function PageHeader({ pageInfo, currentUser, onAddProduct }) {
  const HeaderIcon = pageInfo.icon;
  const storeName = currentUser?.store || 'Mi negocio';
  const cityName = currentUser?.city && currentUser.city !== 'Sin ciudad registrada'
    ? currentUser.city
    : 'Ubicación pendiente';

  return (
    <header className="iq-page-header">
      <div className="iq-page-header-main">
        <div className="iq-page-header-icon">
          <HeaderIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>

        <div className="min-w-0">
          <p className="iq-page-header-kicker">Panel de gestión</p>
          <h2 className="iq-page-header-title">{pageInfo.title}</h2>
          <p className="iq-page-header-subtitle">{pageInfo.subtitle}</p>
        </div>
      </div>

      <div className="iq-page-header-side">
        <div className="iq-page-context">
          <span className="iq-page-context-item" title={storeName}>
            <Store className="h-4 w-4" />
            <span className="truncate">{storeName}</span>
          </span>
          <span className="iq-page-context-item iq-page-context-muted" title={cityName}>
            <MapPin className="h-4 w-4" />
            <span className="truncate">{cityName}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onAddProduct}
          className="iq-page-primary-action"
        >
          <Plus className="h-5 w-5" />
          <span>{pageInfo.actionLabel || 'Agregar producto'}</span>
        </button>
      </div>
    </header>
  );
}
