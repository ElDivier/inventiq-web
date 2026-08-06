import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Grid2X2,
  Link,
  MapPin,
  Move,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Unlink,
  User,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import {
  RESTAURANT_TABLE_SHAPES,
  RESTAURANT_TABLE_STATUSES,
  createRestaurantArea,
  createRestaurantTable,
  clearRestaurantFloor,
  fetchRestaurantFloor,
  formatReservedFor,
  getOpenDurationLabel,
  getRestaurantTableStatusMeta,
  joinRestaurantTables,
  openRestaurantTable,
  releaseRestaurantTable,
  reorderRestaurantTables,
  seedRestaurantFloor,
  subscribeRestaurantFloor,
  transferRestaurantTable,
  unjoinRestaurantTable,
  updateRestaurantArea,
  updateRestaurantTable,
  updateRestaurantTableService,
} from '../utils/restaurantTables';

const emptyAreaForm = { id: '', name: '' };
const emptyTableForm = {
  id: '',
  areaId: '',
  name: '',
  capacity: 4,
  shape: 'square',
};

function getServiceFormFromTable(table) {
  if (!table) {
    return {
      guestCount: 1,
      waiterName: '',
      notes: '',
      reservationName: '',
      reservedFor: '',
    };
  }

  return {
    guestCount: table.guestCount || 1,
    waiterName: table.waiterName || '',
    notes: table.notes || '',
    reservationName: table.reservationName || '',
    reservedFor: toLocalDateTimeInput(table.reservedFor),
  };
}

function toLocalDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function TableShape({ shape = 'square', status = 'libre', joined = false }) {
  const meta = getRestaurantTableStatusMeta(status);
  const shapeClass = {
    round: 'rounded-full aspect-square w-16',
    rectangle: 'rounded-2xl h-12 w-24',
    bar: 'rounded-xl h-10 w-28',
    square: 'rounded-2xl aspect-square w-16',
  }[shape] || 'rounded-2xl aspect-square w-16';

  return (
    <div className="relative flex min-h-20 items-center justify-center">
      <div className={`flex items-center justify-center border-2 bg-white shadow-sm ${shapeClass} ${meta.badgeClass}`}>
        <Utensils className="h-5 w-5" />
      </div>
      {joined && (
        <span className="absolute right-0 top-0 rounded-full bg-slate-900 p-1.5 text-white" title="Mesa unida">
          <Link className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status, compact = false }) {
  const meta = getRestaurantTableStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-black ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} ${meta.badgeClass}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className="rounded-2xl bg-cyan-50 p-2.5 text-cyan-700">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function TableCard({ table, areaName, selected, organizeMode, onSelect, onEdit, onDelete, onDragStart, onDrop, now }) {
  const meta = getRestaurantTableStatusMeta(table.status);
  const isOpen = Boolean(table.openedAt) && !['libre', 'reservada', 'limpieza'].includes(table.status);

  return (
    <article
      draggable={organizeMode}
      onDragStart={(event) => onDragStart(event, table)}
      onDragOver={(event) => organizeMode && event.preventDefault()}
      onDrop={(event) => onDrop(event, table)}
      className={`group relative rounded-3xl border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-150 ${
        selected
          ? 'border-cyan-500 ring-2 ring-cyan-100 ring-offset-2 shadow-md'
          : 'border-slate-200 hover:border-cyan-200 hover:shadow-md'
      } ${organizeMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <button type="button" aria-pressed={selected} onClick={() => onSelect(table)} className="w-full text-left focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <TableShape shape={table.shape} status={table.status} joined={Boolean(table.joinedTo)} />
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={table.status} compact />
            {selected && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-800">
                <CheckCircle className="h-3 w-3" /> Seleccionada
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-900">{table.name}</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-400">{areaName}</p>
          </div>
          {organizeMode && <Move className="h-4 w-4 shrink-0 text-slate-300" />}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {table.guestCount > 0 ? `${table.guestCount}/${table.capacity}` : `${table.capacity} puestos`}
          </span>
          <span className="inline-flex items-center justify-end gap-1.5 text-right">
            <Clock className="h-3.5 w-3.5" />
            {isOpen ? getOpenDurationLabel(table.openedAt, now) : table.status === 'reservada' ? formatReservedFor(table.reservedFor) : 'Disponible'}
          </span>
        </div>

        {(table.waiterName || table.reservationName) && (
          <p className="mt-3 truncate rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
            {table.status === 'reservada' ? `Reserva: ${table.reservationName}` : `Mesero: ${table.waiterName}`}
          </p>
        )}
      </button>

      {!organizeMode && (
        <div className="absolute left-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onEdit(table); }}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:text-cyan-700"
            title="Editar mesa"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {table.status === 'libre' && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onDelete(table); }}
              className="rounded-xl border border-red-100 bg-white p-2 text-red-500 shadow-sm hover:bg-red-50"
              title="Desactivar mesa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <span className={`absolute inset-y-4 right-0 w-1 rounded-l-full ${meta.dotClass}`} />
    </article>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-slate-900">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function RestaurantTablesPage({ currentUser, setActive, setSaleForm, clearSaleCart }) {
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [organizeMode, setOrganizeMode] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState('');
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [areaForm, setAreaForm] = useState(emptyAreaForm);
  const [tableForm, setTableForm] = useState(emptyTableForm);
  const [serviceForm, setServiceForm] = useState(() => getServiceFormFromTable(null));
  const [transferTargetId, setTransferTargetId] = useState('');
  const [joinTargetId, setJoinTargetId] = useState('');
  const [floorDeleteModalOpen, setFloorDeleteModalOpen] = useState(false);
  const [floorDeleteConfirmation, setFloorDeleteConfirmation] = useState('');
  const [occupyConfirmOpen, setOccupyConfirmOpen] = useState(false);
  const [pendingOccupyTableId, setPendingOccupyTableId] = useState('');
  const [now, setNow] = useState(Date.now());

  const loadFloor = useCallback(async ({ quiet = false } = {}) => {
    if (!currentUser?.id) return;
    try {
      if (!quiet) setLoading(true);
      const floor = await fetchRestaurantFloor(currentUser.id);
      setAreas(floor.areas);
      setTables(floor.tables);
      setSelectedAreaId((current) => {
        if (current && floor.areas.some((area) => area.id === current)) return current;
        return floor.areas[0]?.id || '';
      });
      setSelectedTableId((current) => current && floor.tables.some((table) => table.id === current) ? current : '');
    } catch (error) {
      console.error('Error cargando mesas:', error);
      setNotice({ type: 'error', message: `No se pudo cargar el salón: ${error.message}` });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadFloor();
  }, [loadFloor]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeRestaurantFloor(currentUser.id, () => loadFloor({ quiet: true }));
  }, [currentUser?.id, loadFloor]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, tables]
  );

  const visibleTables = useMemo(
    () => tables
      .filter((table) => table.areaId === selectedAreaId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [selectedAreaId, tables]
  );

  const tableStats = useMemo(() => {
    const byStatus = Object.fromEntries(RESTAURANT_TABLE_STATUSES.map((status) => [status.value, 0]));
    tables.forEach((table) => {
      byStatus[table.status] = (byStatus[table.status] || 0) + 1;
    });
    return {
      total: tables.length,
      free: byStatus.libre || 0,
      active: (byStatus.ocupada || 0) + (byStatus.preparacion || 0) + (byStatus.servida || 0),
      bill: byStatus.cobrar || 0,
      cleaning: byStatus.limpieza || 0,
      reserved: byStatus.reservada || 0,
      byStatus,
    };
  }, [tables]);

  const availableTransferTargets = useMemo(
    () => tables.filter((table) => table.id !== selectedTable?.id && table.status === 'libre' && !table.joinedTo),
    [selectedTable?.id, tables]
  );

  const availableJoinTargets = useMemo(
    () => tables.filter((table) => table.id !== selectedTable?.id && table.status === 'libre' && !table.joinedTo),
    [selectedTable?.id, tables]
  );

  const selectTable = useCallback((table) => {
    if (!table) return;

    // Seleccionar es una acción exclusivamente visual. No llama ninguna función
    // de Supabase ni modifica el estado operativo de la mesa.
    setOccupyConfirmOpen(false);
    setPendingOccupyTableId('');
    setServiceForm(getServiceFormFromTable(table));
    setTransferTargetId('');
    setJoinTargetId('');
    setSelectedTableId(table.id);
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    setServiceForm((current) => {
      const next = getServiceFormFromTable(selectedTable);
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [selectedTable?.id]);

  function areaName(areaId) {
    return areas.find((area) => area.id === areaId)?.name || 'Sin área';
  }

  async function handleSeedFloor() {
    try {
      setSaving(true);
      setNotice(null);
      await seedRestaurantFloor();
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: 'Se creó un salón inicial con 12 mesas. Puedes editarlo libremente.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo crear el salón inicial: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleClearFloor() {
    if (floorDeleteConfirmation.trim().toUpperCase() !== 'ELIMINAR') return;

    try {
      setSaving(true);
      setNotice(null);
      await clearRestaurantFloor();
      setFloorDeleteModalOpen(false);
      setFloorDeleteConfirmation('');
      setSelectedAreaId('');
      setSelectedTableId('');
      setServiceForm(getServiceFormFromTable(null));
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: 'El plano operativo fue eliminado. Puedes crear uno nuevo cuando lo necesites.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo eliminar el plano: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  function openAreaModal(area = null) {
    setAreaForm(area ? { id: area.id, name: area.name } : emptyAreaForm);
    setAreaModalOpen(true);
  }

  function openTableModal(table = null) {
    setTableForm(table
      ? {
          id: table.id,
          areaId: table.areaId,
          name: table.name,
          capacity: table.capacity,
          shape: table.shape,
        }
      : {
          ...emptyTableForm,
          areaId: selectedAreaId || areas[0]?.id || '',
          name: `Mesa ${tables.length + 1}`,
        });
    setTableModalOpen(true);
  }

  async function saveArea(event) {
    event.preventDefault();
    const name = areaForm.name.trim();
    if (!name) {
      setNotice({ type: 'error', message: 'Escribe el nombre del área.' });
      return;
    }

    try {
      setSaving(true);
      setNotice(null);
      if (areaForm.id) {
        await updateRestaurantArea(areaForm.id, { name });
      } else {
        await createRestaurantArea({ userId: currentUser.id, name, sortOrder: areas.length + 1 });
      }
      setAreaModalOpen(false);
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: areaForm.id ? 'Área actualizada.' : 'Área creada.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo guardar el área: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function saveTable(event) {
    event.preventDefault();
    if (!tableForm.areaId || !tableForm.name.trim()) {
      setNotice({ type: 'error', message: 'Selecciona un área y escribe el nombre de la mesa.' });
      return;
    }

    try {
      setSaving(true);
      setNotice(null);
      if (tableForm.id) {
        await updateRestaurantTable(tableForm.id, {
          areaId: tableForm.areaId,
          name: tableForm.name,
          capacity: tableForm.capacity,
          shape: tableForm.shape,
        });
      } else {
        const sameAreaTables = tables.filter((table) => table.areaId === tableForm.areaId);
        await createRestaurantTable({
          userId: currentUser.id,
          areaId: tableForm.areaId,
          name: tableForm.name,
          capacity: tableForm.capacity,
          shape: tableForm.shape,
          sortOrder: sameAreaTables.length + 1,
        });
      }
      setTableModalOpen(false);
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: tableForm.id ? 'Mesa actualizada.' : 'Mesa creada.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo guardar la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function deactivateTable(table) {
    const confirmed = window.confirm(`¿Desactivar ${table.name}? No se eliminarán ventas ni registros históricos.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await updateRestaurantTable(table.id, { isActive: false });
      if (selectedTableId === table.id) setSelectedTableId('');
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: `${table.name} fue retirada del plano.` });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo desactivar la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  function requestOccupySelectedTable() {
    if (!selectedTable) return;
    if (!['libre', 'reservada'].includes(selectedTable.status)) {
      setNotice({ type: 'error', message: `${selectedTable.name} ya no está libre.` });
      return;
    }
    setPendingOccupyTableId(selectedTable.id);
    setOccupyConfirmOpen(true);
  }

  async function confirmOccupySelectedTable() {
    const tableToOpen = tables.find((table) => table.id === pendingOccupyTableId);
    if (!tableToOpen || tableToOpen.id !== selectedTable?.id) {
      setOccupyConfirmOpen(false);
      setPendingOccupyTableId('');
      setNotice({ type: 'error', message: 'La selección cambió. Vuelve a elegir la mesa.' });
      return;
    }
    if (!['libre', 'reservada'].includes(tableToOpen.status)) {
      setOccupyConfirmOpen(false);
      setPendingOccupyTableId('');
      setNotice({ type: 'error', message: `${tableToOpen.name} ya no está libre.` });
      return;
    }

    try {
      setSaving(true);
      await openRestaurantTable({
        tableId: tableToOpen.id,
        guestCount: serviceForm.guestCount,
        waiterName: serviceForm.waiterName,
        notes: serviceForm.notes,
      });
      setOccupyConfirmOpen(false);
      setPendingOccupyTableId('');
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: `${tableToOpen.name} quedó ocupada.` });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo ocupar la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function reserveSelectedTable() {
    if (!selectedTable) return;
    if (!serviceForm.reservationName.trim() || !serviceForm.reservedFor) {
      setNotice({ type: 'error', message: 'Registra el nombre y la fecha de la reserva.' });
      return;
    }
    try {
      setSaving(true);
      await updateRestaurantTableService({
        tableId: selectedTable.id,
        status: 'reservada',
        guestCount: serviceForm.guestCount,
        waiterName: '',
        notes: serviceForm.notes,
        reservationName: serviceForm.reservationName,
        reservedFor: new Date(serviceForm.reservedFor).toISOString(),
      });
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: `${selectedTable.name} quedó reservada.` });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo guardar la reserva: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function saveServiceData(status = selectedTable?.status) {
    if (!selectedTable) return;
    try {
      setSaving(true);
      await updateRestaurantTableService({
        tableId: selectedTable.id,
        status,
        guestCount: serviceForm.guestCount,
        waiterName: serviceForm.waiterName,
        notes: serviceForm.notes,
        reservationName: serviceForm.reservationName,
        reservedFor: serviceForm.reservedFor ? new Date(serviceForm.reservedFor).toISOString() : null,
      });
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: `${selectedTable.name} fue actualizada.` });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo actualizar la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function releaseSelectedTable(nextStatus = 'libre') {
    if (!selectedTable) return;
    try {
      setSaving(true);
      await releaseRestaurantTable(selectedTable.id, nextStatus);
      await loadFloor({ quiet: true });
      setNotice({
        type: 'success',
        message: nextStatus === 'limpieza'
          ? `${selectedTable.name} quedó pendiente de limpieza.`
          : `${selectedTable.name} está disponible.`,
      });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo liberar la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleTransfer() {
    if (!selectedTable || !transferTargetId) return;
    try {
      setSaving(true);
      await transferRestaurantTable(selectedTable.id, transferTargetId);
      setSelectedTableId(transferTargetId);
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: 'La ocupación fue transferida a la nueva mesa.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo transferir la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin() {
    if (!selectedTable || !joinTargetId) return;
    try {
      setSaving(true);
      await joinRestaurantTables(selectedTable.id, joinTargetId);
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: 'Las mesas quedaron unidas visualmente para el servicio.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudieron unir las mesas: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnjoin(tableId) {
    try {
      setSaving(true);
      await unjoinRestaurantTable(tableId);
      await loadFloor({ quiet: true });
      setNotice({ type: 'success', message: 'La mesa fue separada del grupo.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo separar la mesa: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  function goToOrder(table) {
    if (typeof clearSaleCart === 'function') clearSaleCart();
    if (typeof setSaleForm === 'function') {
      setSaleForm((current) => ({
        ...current,
        orderType: 'local',
        orderReference: table.name,
        restaurantTableId: table.id,
        restaurantAreaId: table.areaId,
      }));
    }
    setActive('Ventas');
  }

  function handleDragStart(event, table) {
    if (!organizeMode) return;
    setDraggedTableId(table.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', table.id);
  }

  async function handleDrop(event, targetTable) {
    if (!organizeMode) return;
    event.preventDefault();
    const sourceId = draggedTableId || event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetTable.id) return;

    const ordered = [...visibleTables];
    const sourceIndex = ordered.findIndex((table) => table.id === sourceId);
    const targetIndex = ordered.findIndex((table) => table.id === targetTable.id);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    setTables((current) => current.map((table) => {
      const index = ordered.findIndex((item) => item.id === table.id);
      return index >= 0 ? { ...table, sortOrder: index + 1 } : table;
    }));

    try {
      await reorderRestaurantTables(ordered);
      setNotice({ type: 'success', message: 'Orden del salón actualizado.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo guardar el orden: ${error.message}` });
      await loadFloor({ quiet: true });
    } finally {
      setDraggedTableId('');
    }
  }

  if (currentUser?.businessType !== 'restaurante') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <Grid2X2 className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-xl font-black text-slate-900">Mesas disponibles para Restaurante</h3>
        <p className="mt-2 text-sm text-slate-500">Este módulo se activa únicamente en cuentas configuradas como Restaurante.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
              <MapPin className="h-4 w-4" />
              Operación del salón
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Mesas y áreas de servicio</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Organiza el salón, abre mesas, asigna responsables y controla el estado del servicio desde una sola vista.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadFloor()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setOrganizeMode((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ${organizeMode ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Move className="h-4 w-4" />
              {organizeMode ? 'Terminar organización' : 'Organizar mesas'}
            </button>
            {areas.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFloorDeleteConfirmation('');
                  setFloorDeleteModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar plano
              </button>
            )}
            <button type="button" onClick={() => openAreaModal()} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 hover:bg-cyan-100">
              <Plus className="h-4 w-4" />
              Nueva área
            </button>
            <button type="button" onClick={() => openTableModal()} disabled={!areas.length} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-700 px-4 py-2.5 text-sm font-black text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" />
              Nueva mesa
            </button>
          </div>
        </div>
      </section>

      {notice && (
        <div className={`rounded-3xl border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard icon={Grid2X2} label="Mesas" value={tableStats.total} helper={`${areas.length} área${areas.length === 1 ? '' : 's'}`} />
        <MetricCard icon={CheckCircle} label="Disponibles" value={tableStats.free} helper="Listas para recibir clientes" />
        <MetricCard icon={Users} label="En servicio" value={tableStats.active} helper="Ocupadas o con pedido" />
        <MetricCard icon={DollarSign} label="Por cobrar" value={tableStats.bill} helper="Cuenta solicitada" />
        <MetricCard icon={RefreshCw} label="Por limpiar" value={tableStats.cleaning} helper={`${tableStats.reserved} reservada${tableStats.reserved === 1 ? '' : 's'}`} />
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-500">
          Cargando distribución del restaurante...
        </div>
      ) : areas.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-cyan-200 bg-cyan-50/60 p-8 text-center sm:p-12">
          <Grid2X2 className="mx-auto h-12 w-12 text-cyan-600" />
          <h3 className="mt-4 text-2xl font-black text-slate-900">Configura tu primer salón</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Puedes crear la estructura inicial con un Salón principal y 12 mesas, o comenzar desde cero agregando tus propias áreas.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={handleSeedFloor} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50">
              <Grid2X2 className="h-4 w-4" />
              Crear estructura inicial
            </button>
            <button type="button" onClick={() => openAreaModal()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" />
              Crear área manualmente
            </button>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
              {areas.map((area) => {
                const count = tables.filter((table) => table.areaId === area.id).length;
                return (
                  <div key={area.id} className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAreaId(area.id);
                        setSelectedTableId('');
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${selectedAreaId === area.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {area.name} <span className="ml-1 opacity-60">({count})</span>
                    </button>
                    {selectedAreaId === area.id && (
                      <button type="button" onClick={() => openAreaModal(area)} className="ml-1 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-cyan-700" title="Editar área">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="restaurant-floor-grid rounded-[32px] border border-slate-200 bg-slate-50/70 p-4 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plano operativo</p>
                  <h3 className="mt-1 text-xl font-black text-slate-900">{areaName(selectedAreaId)}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RESTAURANT_TABLE_STATUSES.slice(0, 5).map((status) => (
                    <span key={status.value} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">
                      <span className={`h-2 w-2 rounded-full ${status.dotClass}`} />
                      {tableStats.byStatus[status.value] || 0}
                    </span>
                  ))}
                </div>
              </div>

              {organizeMode && (
                <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">
                  Arrastra las mesas para cambiar su orden dentro del área. Los cambios se guardan automáticamente.
                </div>
              )}

              {visibleTables.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
                  <Grid2X2 className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-500">Esta área todavía no tiene mesas.</p>
                  <button type="button" onClick={() => openTableModal()} className="mt-4 rounded-2xl bg-cyan-700 px-4 py-2 text-sm font-black text-white hover:bg-cyan-800">
                    Agregar primera mesa
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {visibleTables.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      areaName={areaName(table.areaId)}
                      selected={selectedTableId === table.id}
                      organizeMode={organizeMode}
                      onSelect={selectTable}
                      onEdit={openTableModal}
                      onDelete={deactivateTable}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                      now={now}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-[210px] xl:sticky xl:top-24 xl:self-start">
            {!selectedTable ? (
              <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-center shadow-sm">
                <Settings className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 text-lg font-black text-slate-900">Selecciona una mesa</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">Al seleccionarla verás sus opciones. La selección no cambia el estado de la mesa hasta que pulses una acción.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Mesa seleccionada</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-900">{selectedTable.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{areaName(selectedTable.areaId)} · {selectedTable.capacity} puestos</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={selectedTable.status} compact />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTableId('');
                          setOccupyConfirmOpen(false);
                          setPendingOccupyTableId('');
                        }}
                        className="text-xs font-black text-slate-400 hover:text-slate-700"
                      >
                        Cerrar selección
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                    Seleccionar una mesa no la ocupa. Su estado solo cambia mediante los botones de servicio.
                  </p>

                  {selectedTable.openedAt && !['libre', 'reservada', 'limpieza'].includes(selectedTable.status) && (
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
                      <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-300"><Clock className="h-4 w-4" /> Tiempo abierta</span>
                      <span className="font-black text-cyan-300">{getOpenDurationLabel(selectedTable.openedAt, now)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Comensales</span>
                      <input type="number" min="1" max={Math.max(selectedTable.capacity * 2, 1)} value={serviceForm.guestCount} onChange={(event) => setServiceForm((current) => ({ ...current, guestCount: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Mesero</span>
                      <input value={serviceForm.waiterName} onChange={(event) => setServiceForm((current) => ({ ...current, waiterName: event.target.value }))} placeholder="Nombre" className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Nota de servicio</span>
                    <textarea rows="2" value={serviceForm.notes} onChange={(event) => setServiceForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej: cliente con silla de bebé, celebración, ubicación preferida" className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
                  </label>

                  {selectedTable.status === 'libre' && (
                    <div className="space-y-3">
                      <button type="button" onClick={requestOccupySelectedTable} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50">
                        <Users className="h-4 w-4" />
                        Marcar como ocupada
                      </button>

                      <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-indigo-700">Crear reserva</p>
                        <div className="mt-3 space-y-3">
                          <input value={serviceForm.reservationName} onChange={(event) => setServiceForm((current) => ({ ...current, reservationName: event.target.value }))} placeholder="Nombre de la reserva" className="w-full rounded-2xl border border-indigo-100 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
                          <input type="datetime-local" value={serviceForm.reservedFor} onChange={(event) => setServiceForm((current) => ({ ...current, reservedFor: event.target.value }))} className="w-full rounded-2xl border border-indigo-100 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
                          <button type="button" onClick={reserveSelectedTable} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-800 disabled:opacity-50">
                            <Calendar className="h-4 w-4" /> Reservar mesa
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedTable.status === 'reservada' && (
                    <div className="space-y-3">
                      <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
                        <p className="font-black text-indigo-900">{selectedTable.reservationName || 'Reserva'}</p>
                        <p className="mt-1 text-sm text-indigo-700">{formatReservedFor(selectedTable.reservedFor)}</p>
                      </div>
                      <button type="button" onClick={requestOccupySelectedTable} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50">
                        <Users className="h-4 w-4" /> Recibir clientes y marcar ocupada
                      </button>
                      <button type="button" onClick={() => releaseSelectedTable('libre')} disabled={saving} className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        Marcar como libre
                      </button>
                    </div>
                  )}

                  {!['libre', 'reservada', 'limpieza'].includes(selectedTable.status) && (
                    <>
                      <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Estado del servicio</p>
                        <div className="grid grid-cols-2 gap-2">
                          {RESTAURANT_TABLE_STATUSES.filter((status) => ['ocupada', 'preparacion', 'servida', 'cobrar'].includes(status.value)).map((status) => (
                            <button key={status.value} type="button" onClick={() => saveServiceData(status.value)} disabled={saving} className={`rounded-2xl border px-3 py-2.5 text-xs font-black transition ${selectedTable.status === status.value ? status.badgeClass : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}>
                              {status.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button type="button" onClick={() => saveServiceData()} disabled={saving} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 hover:bg-cyan-100 disabled:opacity-50">
                        Guardar datos de servicio
                      </button>

                      <button type="button" onClick={() => goToOrder(selectedTable)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
                        <Utensils className="h-4 w-4" /> Tomar pedido
                      </button>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><ArrowRightLeft className="h-4 w-4" /> Transferir ocupación</p>
                        <div className="mt-3 flex gap-2">
                          <select value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none">
                            <option value="">Seleccionar mesa libre</option>
                            {availableTransferTargets.map((table) => <option key={table.id} value={table.id}>{table.name} · {areaName(table.areaId)}</option>)}
                          </select>
                          <button type="button" onClick={handleTransfer} disabled={!transferTargetId || saving} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-cyan-700 ring-1 ring-slate-200 disabled:opacity-40">Mover</button>
                        </div>
                      </div>

                      {!selectedTable.joinedTo && (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><Link className="h-4 w-4" /> Unir otra mesa</p>
                          <div className="mt-3 flex gap-2">
                            <select value={joinTargetId} onChange={(event) => setJoinTargetId(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none">
                              <option value="">Seleccionar mesa libre</option>
                              {availableJoinTargets.map((table) => <option key={table.id} value={table.id}>{table.name} · {areaName(table.areaId)}</option>)}
                            </select>
                            <button type="button" onClick={handleJoin} disabled={!joinTargetId || saving} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-cyan-700 ring-1 ring-slate-200 disabled:opacity-40">Unir</button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => releaseSelectedTable('limpieza')} disabled={saving} className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:opacity-50">Enviar a limpieza</button>
                        <button type="button" onClick={() => releaseSelectedTable('libre')} disabled={saving} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Marcar libre</button>
                      </div>
                    </>
                  )}

                  {selectedTable.status === 'limpieza' && (
                    <button type="button" onClick={() => releaseSelectedTable('libre')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                      <CheckCircle className="h-4 w-4" /> Marcar como libre
                    </button>
                  )}

                  {selectedTable.joinedTo && (
                    <button type="button" onClick={() => handleUnjoin(selectedTable.id)} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      <Unlink className="h-4 w-4" /> Separar mesa del grupo
                    </button>
                  )}

                  {tables.filter((table) => table.joinedTo === selectedTable.id).length > 0 && (
                    <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="font-black text-slate-700">Mesas unidas</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tables.filter((table) => table.joinedTo === selectedTable.id).map((table) => (
                          <button key={table.id} type="button" onClick={() => handleUnjoin(table.id)} className="inline-flex items-center gap-1 rounded-xl bg-white px-2 py-1 font-bold ring-1 ring-slate-200">
                            {table.name} <X className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      {occupyConfirmOpen && selectedTable && pendingOccupyTableId === selectedTable.id && (
        <ModalShell
          title={`Ocupar ${selectedTable.name}`}
          subtitle="La mesa seguirá libre hasta que confirmes esta acción."
          onClose={() => {
            if (saving) return;
            setOccupyConfirmOpen(false);
            setPendingOccupyTableId('');
          }}
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-cyan-950">{selectedTable.name}</p>
                  <p className="mt-1 text-sm text-cyan-800">{areaName(selectedTable.areaId)} · {serviceForm.guestCount || 1} comensal(es)</p>
                  {serviceForm.waiterName && <p className="mt-1 text-sm text-cyan-800">Mesero: {serviceForm.waiterName}</p>}
                </div>
                <StatusBadge status={selectedTable.status} compact />
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Confirmar cambiará el estado de la mesa a <strong>Ocupada</strong>. Seleccionarla o abrir este cuadro no modifica ningún dato.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOccupyConfirmOpen(false);
                  setPendingOccupyTableId('');
                }}
                disabled={saving}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmOccupySelectedTable}
                disabled={saving}
                className="rounded-2xl bg-cyan-700 px-5 py-2.5 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Confirmar mesa ocupada'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {floorDeleteModalOpen && (
        <ModalShell
          title="Eliminar plano operativo"
          subtitle="Esta acción retirará todas las áreas y mesas activas para que puedas configurar el salón nuevamente."
          onClose={() => {
            if (saving) return;
            setFloorDeleteModalOpen(false);
            setFloorDeleteConfirmation('');
          }}
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-800">
              El plano solo puede eliminarse cuando no existen mesas con servicio activo. Los registros se desactivarán para conservar la trazabilidad y no se borrarán ventas históricas.
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Escribe ELIMINAR para confirmar</span>
              <input
                autoFocus
                value={floorDeleteConfirmation}
                onChange={(event) => setFloorDeleteConfirmation(event.target.value)}
                placeholder="ELIMINAR"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black uppercase outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setFloorDeleteModalOpen(false);
                  setFloorDeleteConfirmation('');
                }}
                disabled={saving}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearFloor}
                disabled={saving || floorDeleteConfirmation.trim().toUpperCase() !== 'ELIMINAR'}
                className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Eliminando...' : 'Eliminar plano completo'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {areaModalOpen && (
        <ModalShell title={areaForm.id ? 'Editar área' : 'Nueva área'} subtitle="Organiza el restaurante por salón, terraza, barra u otros espacios." onClose={() => setAreaModalOpen(false)}>
          <form onSubmit={saveArea} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Nombre del área</span>
              <input autoFocus value={areaForm.name} onChange={(event) => setAreaForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Salón principal, Terraza, Barra" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setAreaModalOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-2xl bg-cyan-700 px-5 py-2.5 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50">Guardar área</button>
            </div>
          </form>
        </ModalShell>
      )}

      {tableModalOpen && (
        <ModalShell title={tableForm.id ? 'Editar mesa' : 'Nueva mesa'} subtitle="Define su ubicación, capacidad y forma para el plano operativo." onClose={() => setTableModalOpen(false)}>
          <form onSubmit={saveTable} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-black text-slate-700">Área</span>
                <select value={tableForm.areaId} onChange={(event) => setTableForm((current) => ({ ...current, areaId: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100">
                  <option value="">Seleccionar área</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Nombre</span>
                <input value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Mesa 1" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Capacidad</span>
                <input type="number" min="1" max="30" value={tableForm.capacity} onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-black text-slate-700">Forma</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RESTAURANT_TABLE_SHAPES.map((shape) => (
                    <button key={shape.value} type="button" onClick={() => setTableForm((current) => ({ ...current, shape: shape.value }))} className={`rounded-2xl border px-3 py-3 text-sm font-black ${tableForm.shape === shape.value ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {shape.label}
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setTableModalOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-2xl bg-cyan-700 px-5 py-2.5 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50">Guardar mesa</button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
