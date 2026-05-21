import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  BarChart3,
  Settings,
  Plus,
  Search,
  Bell,
  Edit,
  Trash2,
  Store,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ClipboardList,
  UserPlus,
  Save,
  CalendarDays,
  Activity,
  ReceiptText,
  Percent,
  RotateCcw,
  LogOut,
  Lock,
  User,
  MoreHorizontal,
} from 'lucide-react';

const emptyForm = {
  name: '',
  category: '',
  customCategory: '',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  sku: '',
  description: '',
};

const initialProducts = [
  { id: 1, sku: 'BEB001', name: 'Coca Cola 600ml', category: 'Bebidas', price: 1.25, cost: 0.75, stock: 25, minStock: 8, status: 'Activo', description: 'Bebida gaseosa personal.' },
  { id: 2, sku: 'SNA002', name: 'Papas Lays Clásicas', category: 'Snacks', price: 1.1, cost: 0.65, stock: 7, minStock: 10, status: 'Activo', description: 'Snack de alta rotación.' },
  { id: 3, sku: 'LIM003', name: 'Jabón Protex', category: 'Limpieza', price: 1.75, cost: 1.05, stock: 0, minStock: 5, status: 'Inactivo', description: 'Producto de limpieza y cuidado.' },
  { id: 4, sku: 'LAC004', name: 'Leche Entera 1L', category: 'Lácteos', price: 1.5, cost: 0.95, stock: 12, minStock: 6, status: 'Activo', description: 'Producto lácteo de consumo diario.' },
  { id: 5, sku: 'PER005', name: 'Colgate Triple Acción', category: 'Cuidado personal', price: 2.2, cost: 1.35, stock: 18, minStock: 7, status: 'Activo', description: 'Producto de cuidado personal.' },
];

const initialSales = [
  { id: 1, code: 'V-0001', productId: 1, product: 'Coca Cola 600ml', quantity: 3, subtotal: 3.75, discount: 0, total: 3.75, profit: 1.5, date: 'Hoy, 09:15 AM', status: 'Completada' },
  { id: 2, code: 'V-0002', productId: 2, product: 'Papas Lays Clásicas', quantity: 2, subtotal: 2.2, discount: 0, total: 2.2, profit: 0.9, date: 'Hoy, 10:20 AM', status: 'Completada' },
  { id: 3, code: 'V-0003', productId: 4, product: 'Leche Entera 1L', quantity: 1, subtotal: 1.5, discount: 0, total: 1.5, profit: 0.55, date: 'Ayer, 05:30 PM', status: 'Completada' },
];

const initialClients = [
  { id: 1, name: 'Ana Rodríguez', phone: '099 123 4567', type: 'Frecuente', purchases: 12 },
  { id: 2, name: 'Carlos Mejía', phone: '098 765 4321', type: 'Regular', purchases: 5 },
  { id: 3, name: 'María López', phone: '097 111 2222', type: 'Nuevo', purchases: 1 },
];

const initialProviders = [
  { id: 1, name: 'Distribuidora Norte', category: 'Bebidas', contact: 'ventas@disnorte.com', delivery: '2 días' },
  { id: 2, name: 'Comercial Andina', category: 'Snacks', contact: '099 222 3333', delivery: '1 día' },
  { id: 3, name: 'Lácteos San Miguel', category: 'Lácteos', contact: '098 555 7777', delivery: '3 días' },
];

const emptySaleForm = {
  productId: '',
  quantity: 1,
  discount: 0,
  customer: '',
  paymentMethod: 'Efectivo',
};

const menu = [
  { label: 'Inicio', icon: Home },
  { label: 'Ventas', icon: ShoppingCart },
  { label: 'Productos', icon: Package },
  { label: 'Inventario', icon: Boxes },
  { label: 'Clientes', icon: Users },
  { label: 'Proveedores', icon: Truck },
  { label: 'Reportes', icon: BarChart3 },
  { label: 'Configuración', icon: Settings },
];

const initialUsers = [
  {
    id: 1,
    name: 'Ana Rodríguez',
    store: 'Mi Tienda',
    city: 'Cuenca',
    username: 'demo',
    password: '1234',
  },
];

const emptyLoginForm = {
  username: '',
  password: '',
};

const emptyRegisterForm = {
  name: '',
  store: '',
  city: '',
  username: '',
  password: '',
  confirmPassword: '',
};

const emptyClientForm = {
  name: '',
  phone: '',
  type: 'Nuevo',
  email: '',
  notes: '',
};

const emptyProviderForm = {
  name: '',
  category: '',
  contact: '',
  delivery: '',
  notes: '',
};

const emptySettingsForm = {
  name: '',
  store: '',
  city: '',
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

const STORAGE_KEYS = {
  users: 'inventiq_users',
  currentUser: 'inventiq_current_user',
  products: 'inventiq_products',
  sales: 'inventiq_sales',
  clients: 'inventiq_clients',
  providers: 'inventiq_providers',
};

function loadFromStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('No se pudo guardar en localStorage:', error);
  }
}

function getUsersFromStorage() {
  const storedUsers = loadFromStorage(STORAGE_KEYS.users, null);
  if (Array.isArray(storedUsers) && storedUsers.length > 0) {
    const hasDemo = storedUsers.some(user => user.username === 'demo');
    return hasDemo ? storedUsers : [...initialUsers, ...storedUsers];
  }
  return initialUsers;
}

export default function App() {
  const [users, setUsers] = useState(() => getUsersFromStorage());
  const [currentUser, setCurrentUser] = useState(() => loadFromStorage(STORAGE_KEYS.currentUser, null));
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [authNotice, setAuthNotice] = useState(null);
  const [active, setActive] = useState('Inicio');
  const [products, setProducts] = useState(() => loadFromStorage(STORAGE_KEYS.products, initialProducts));
  const [sales, setSales] = useState(() => loadFromStorage(STORAGE_KEYS.sales, initialSales));
  const [clients, setClients] = useState(() => loadFromStorage(STORAGE_KEYS.clients, initialClients));
  const [providers, setProviders] = useState(() => loadFromStorage(STORAGE_KEYS.providers, initialProviders));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [saleNotice, setSaleNotice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [editingClientId, setEditingClientId] = useState(null);
  const [pendingDeleteClientId, setPendingDeleteClientId] = useState(null);
  const [clientNotice, setClientNotice] = useState(null);
  const [providerForm, setProviderForm] = useState(emptyProviderForm);
  const [editingProviderId, setEditingProviderId] = useState(null);
  const [pendingDeleteProviderId, setPendingDeleteProviderId] = useState(null);
  const [providerNotice, setProviderNotice] = useState(null);
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm);
  const [settingsNotice, setSettingsNotice] = useState(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.users, users);
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      saveToStorage(STORAGE_KEYS.currentUser, currentUser);
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.sales, sales);
  }, [sales]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.clients, clients);
  }, [clients]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.providers, providers);
  }, [providers]);

  useEffect(() => {
    if (currentUser) {
      setSettingsForm({
        name: currentUser.name || '',
        store: currentUser.store || '',
        city: currentUser.city || '',
        username: currentUser.username || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [currentUser]);

  function login(e) {
    e.preventDefault();
    const username = loginForm.username.trim();
    const password = loginForm.password.trim();

    if (!username || !password) {
      setAuthNotice({ type: 'error', message: 'Ingresa usuario y contraseña.' });
      return;
    }

    const foundUser = users.find(user => user.username === username && user.password === password);

    if (!foundUser) {
      setAuthNotice({ type: 'error', message: 'Usuario o contraseña incorrectos.' });
      return;
    }

    setCurrentUser(foundUser);
    saveToStorage(STORAGE_KEYS.currentUser, foundUser);
    setAuthNotice(null);
    setLoginForm(emptyLoginForm);
  }

  function register(e) {
    e.preventDefault();
    const name = registerForm.name.trim();
    const store = registerForm.store.trim();
    const city = registerForm.city.trim();
    const username = registerForm.username.trim();
    const password = registerForm.password.trim();
    const confirmPassword = registerForm.confirmPassword.trim();

    if (!name || !store || !username || !password || !confirmPassword) {
      setAuthNotice({ type: 'error', message: 'Completa todos los campos obligatorios.' });
      return;
    }

    if (password !== confirmPassword) {
      setAuthNotice({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    if (users.some(user => user.username === username)) {
      setAuthNotice({ type: 'error', message: 'Ese usuario ya existe. Elige otro.' });
      return;
    }

    const newUser = {
      id: Date.now(),
      name,
      store,
      city: city || 'Sin ciudad registrada',
      username,
      password,
    };

    const updatedUsers = [...users, newUser];
    saveToStorage(STORAGE_KEYS.users, updatedUsers);
    setUsers(updatedUsers);
    setRegisterForm(emptyRegisterForm);
    setAuthMode('login');
    setAuthNotice({ type: 'success', message: 'Cuenta creada correctamente. Ahora inicia sesión.' });
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    setCurrentUser(null);
    setActive('Inicio');
    setAuthMode('login');
    setAuthNotice(null);
  }

  const storeKey = currentUser?.username || 'demo';
  const storeProducts = products.filter(product => (product.storeId || 'demo') === storeKey);
  const storeSales = sales.filter(sale => (sale.storeId || 'demo') === storeKey);
  const storeClients = clients.filter(client => (client.storeId || 'demo') === storeKey);
  const storeProviders = providers.filter(provider => (provider.storeId || 'demo') === storeKey);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(storeProducts.map(p => p.category)))], [storeProducts]);
  const productCategories = categories.filter(cat => cat !== 'Todas');

  const filtered = storeProducts.filter(p => {
    const text = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(text) ||
      p.sku.toLowerCase().includes(text) ||
      p.category.toLowerCase().includes(text);
    const matchCategory = category === 'Todas' || p.category === category;
    return matchSearch && matchCategory;
  });

  const totalProducts = storeProducts.length;
  const lowStock = storeProducts.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const noStock = storeProducts.filter(p => p.stock === 0).length;
  const inventoryValue = storeProducts.reduce((sum, p) => sum + p.cost * p.stock, 0);
  const potentialProfit = storeProducts.reduce((sum, p) => sum + (p.price - p.cost) * p.stock, 0);
  const totalSales = storeSales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = storeSales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const totalDiscount = storeSales.reduce((sum, s) => sum + (s.discount || 0), 0);
  const totalUnitsSold = storeSales.reduce((sum, s) => sum + s.quantity, 0);
  const topProduct = storeSales.reduce((acc, sale) => {
    acc[sale.product] = (acc[sale.product] || 0) + sale.quantity;
    return acc;
  }, {});
  const bestSeller = Object.entries(topProduct).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin ventas';

  function statusText(product) {
    if (product.stock === 0) return { label: 'Sin stock', color: 'text-red-600', badge: 'bg-red-50 text-red-700' };
    if (product.stock <= product.minStock) return { label: 'Stock bajo', color: 'text-amber-600', badge: 'bg-amber-50 text-amber-700' };
    return { label: 'Disponible', color: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700' };
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setNotice(null);
  }

  function validateProduct(finalCategory, price, cost, stock, minStock) {
    if (!form.name.trim()) return 'Ingresa el nombre del producto.';
    if (!finalCategory.trim()) return 'Selecciona o crea una categoría.';
    if (Number.isNaN(price) || price <= 0) return 'El precio de venta debe ser mayor a 0.';
    if (Number.isNaN(cost) || cost < 0) return 'El costo no puede ser negativo.';
    if (Number.isNaN(stock) || stock < 0) return 'El stock no puede ser negativo.';
    if (Number.isNaN(minStock) || minStock < 0) return 'El stock mínimo no puede ser negativo.';
    if (cost > price) return 'El costo no debería ser mayor al precio de venta.';
    return null;
  }

  function saveProduct(e) {
    e.preventDefault();

    const finalCategory = form.category === '__new__' ? form.customCategory.trim() : form.category.trim();
    const price = Number(form.price);
    const cost = Number(form.cost || 0);
    const stock = Number(form.stock);
    const minStock = Number(form.minStock || 0);
    const validationError = validateProduct(finalCategory, price, cost, stock, minStock);

    if (validationError) {
      setNotice({ type: 'error', message: validationError });
      return;
    }

    const productData = {
      storeId: storeKey,
      storeName: currentUser.store,
      sku: form.sku.trim() || `SKU${storeProducts.length + 1}`,
      name: form.name.trim(),
      category: finalCategory,
      price,
      cost,
      stock,
      minStock,
      status: stock === 0 ? 'Inactivo' : 'Activo',
      description: form.description.trim(),
    };

    if (editingId) {
      setProducts(products.map(product => product.id === editingId ? { ...product, ...productData } : product));
      setNotice({ type: 'success', message: 'Producto actualizado correctamente.' });
    } else {
      setProducts([{ id: Date.now(), ...productData }, ...products]);
      setNotice({ type: 'success', message: 'Producto guardado correctamente.' });
    }

    setForm(emptyForm);
    setEditingId(null);
  }

  function editProduct(product) {
    setActive('Productos');
    setEditingId(product.id);
    setPendingDeleteId(null);
    setNotice(null);
    setForm({
      name: product.name,
      category: product.category,
      customCategory: '',
      price: String(product.price),
      cost: String(product.cost),
      stock: String(product.stock),
      minStock: String(product.minStock),
      sku: product.sku,
      description: product.description || '',
    });
  }

  function calculateSalePreview() {
    const product = storeProducts.find(p => p.id === Number(saleForm.productId));
    const quantity = Number(saleForm.quantity || 0);
    const discountPercent = Number(saleForm.discount || 0);

    if (!product || quantity <= 0) {
      return { product: null, quantity, subtotal: 0, discountPercent, discount: 0, total: 0, profit: 0, error: null };
    }

    const subtotal = product.price * quantity;
    const safeDiscountPercent = Math.min(Math.max(discountPercent, 0), 100);
    const discountAmount = subtotal * (safeDiscountPercent / 100);
    const total = subtotal - discountAmount;
    const profit = total - product.cost * quantity;

    let error = null;
    if (quantity > product.stock) error = `No puedes vender ${quantity} unidades. Stock disponible: ${product.stock}.`;
    if (discountPercent < 0) error = 'El descuento no puede ser negativo.';
    if (discountPercent > 100) error = 'El descuento no puede ser mayor al 100%.';

    return { product, quantity, subtotal, discountPercent: safeDiscountPercent, discount: discountAmount, total, profit, error };
  }

  function registerSale(e) {
    e.preventDefault();
    const preview = calculateSalePreview();
    const { product, quantity, discount, discountPercent, subtotal, total, profit, error } = preview;

    if (!product) {
      setSaleNotice({ type: 'error', message: 'Selecciona un producto para registrar la venta.' });
      return;
    }

    if (quantity <= 0 || Number.isNaN(quantity)) {
      setSaleNotice({ type: 'error', message: 'La cantidad debe ser mayor a 0.' });
      return;
    }

    if (error) {
      setSaleNotice({ type: 'error', message: error });
      return;
    }

    const newSale = {
      id: Date.now(),
      code: `V-${String(sales.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      storeName: currentUser.store,
      productId: product.id,
      product: product.name,
      customer: saleForm.customer || 'Consumidor final',
      paymentMethod: saleForm.paymentMethod,
      quantity,
      subtotal,
      discount,
      discountPercent,
      total,
      profit,
      date: 'Hoy, ahora',
      status: 'Completada',
    };

    setSales([newSale, ...sales]);
    setProducts(products.map(p => p.id === product.id ? { ...p, stock: p.stock - quantity, status: p.stock - quantity === 0 ? 'Inactivo' : 'Activo' } : p));
    setSaleForm(emptySaleForm);
    setSaleNotice({ type: 'success', message: `Venta ${newSale.code} registrada correctamente. Stock actualizado.` });
  }

  function cancelSale(id) {
    const sale = storeSales.find(s => s.id === id);
    if (!sale) return;

    setSales(sales.map(s => s.id === id ? { ...s, status: 'Anulada' } : s));
    setProducts(products.map(p => p.id === sale.productId ? { ...p, stock: p.stock + sale.quantity, status: 'Activo' } : p));
  }

  function resetSaleForm() {
    setSaleForm(emptySaleForm);
    setSaleNotice(null);
  }

  function deleteProduct(id) {
    setProducts(products.filter(p => p.id !== id));
    setPendingDeleteId(null);
    if (editingId === id) resetForm();
  }

  function resetClientForm() {
    setClientForm(emptyClientForm);
    setEditingClientId(null);
    setClientNotice(null);
  }

  function saveClient(e) {
    e.preventDefault();
    const name = clientForm.name.trim();
    const phone = clientForm.phone.trim();

    if (!name) {
      setClientNotice({ type: 'error', message: 'Ingresa el nombre del cliente.' });
      return;
    }

    const clientData = {
      storeId: storeKey,
      storeName: currentUser.store,
      name,
      phone: phone || 'Sin teléfono',
      type: clientForm.type,
      email: clientForm.email.trim(),
      notes: clientForm.notes.trim(),
      purchases: editingClientId ? Number(clients.find(c => c.id === editingClientId)?.purchases || 0) : 0,
    };

    if (editingClientId) {
      setClients(clients.map(client => client.id === editingClientId ? { ...client, ...clientData } : client));
      setClientNotice({ type: 'success', message: 'Cliente actualizado correctamente.' });
    } else {
      setClients([{ id: Date.now(), ...clientData }, ...clients]);
      setClientNotice({ type: 'success', message: 'Cliente registrado correctamente.' });
    }

    setClientForm(emptyClientForm);
    setEditingClientId(null);
  }

  function editClient(client) {
    setEditingClientId(client.id);
    setPendingDeleteClientId(null);
    setClientNotice(null);
    setClientForm({
      name: client.name || '',
      phone: client.phone || '',
      type: client.type || 'Nuevo',
      email: client.email || '',
      notes: client.notes || '',
    });
  }

  function deleteClient(id) {
    setClients(clients.filter(client => client.id !== id));
    setPendingDeleteClientId(null);
    if (editingClientId === id) resetClientForm();
  }

  function resetProviderForm() {
    setProviderForm(emptyProviderForm);
    setEditingProviderId(null);
    setProviderNotice(null);
  }

  function saveProvider(e) {
    e.preventDefault();
    const name = providerForm.name.trim();
    const categoryValue = providerForm.category.trim();

    if (!name) {
      setProviderNotice({ type: 'error', message: 'Ingresa el nombre del proveedor.' });
      return;
    }

    if (!categoryValue) {
      setProviderNotice({ type: 'error', message: 'Ingresa la categoría que abastece.' });
      return;
    }

    const providerData = {
      storeId: storeKey,
      storeName: currentUser.store,
      name,
      category: categoryValue,
      contact: providerForm.contact.trim() || 'Sin contacto',
      delivery: providerForm.delivery.trim() || 'No definido',
      notes: providerForm.notes.trim(),
    };

    if (editingProviderId) {
      setProviders(providers.map(provider => provider.id === editingProviderId ? { ...provider, ...providerData } : provider));
      setProviderNotice({ type: 'success', message: 'Proveedor actualizado correctamente.' });
    } else {
      setProviders([{ id: Date.now(), ...providerData }, ...providers]);
      setProviderNotice({ type: 'success', message: 'Proveedor registrado correctamente.' });
    }

    setProviderForm(emptyProviderForm);
    setEditingProviderId(null);
  }

  function editProvider(provider) {
    setEditingProviderId(provider.id);
    setPendingDeleteProviderId(null);
    setProviderNotice(null);
    setProviderForm({
      name: provider.name || '',
      category: provider.category || '',
      contact: provider.contact || '',
      delivery: provider.delivery || '',
      notes: provider.notes || '',
    });
  }

  function deleteProvider(id) {
    setProviders(providers.filter(provider => provider.id !== id));
    setPendingDeleteProviderId(null);
    if (editingProviderId === id) resetProviderForm();
  }

  function saveSettings(e) {
    e.preventDefault();
    const name = settingsForm.name.trim();
    const store = settingsForm.store.trim();
    const city = settingsForm.city.trim();
    const username = settingsForm.username.trim();
    const currentPassword = settingsForm.currentPassword.trim();
    const newPassword = settingsForm.newPassword.trim();
    const confirmNewPassword = settingsForm.confirmNewPassword.trim();

    if (!name || !store || !city || !username) {
      setSettingsNotice({ type: 'error', message: 'Completa nombre, tienda, ciudad y usuario.' });
      return;
    }

    const usernameTaken = users.some(user => user.username === username && user.id !== currentUser.id);
    if (usernameTaken) {
      setSettingsNotice({ type: 'error', message: 'Ese usuario ya existe. Elige otro.' });
      return;
    }

    let updatedPassword = currentUser.password;

    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword) {
        setSettingsNotice({ type: 'error', message: 'Ingresa la contraseña actual para cambiar la contraseña.' });
        return;
      }

      if (currentPassword !== currentUser.password) {
        setSettingsNotice({ type: 'error', message: 'La contraseña actual no es correcta.' });
        return;
      }

      if (!newPassword || !confirmNewPassword) {
        setSettingsNotice({ type: 'error', message: 'Ingresa y confirma la nueva contraseña.' });
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setSettingsNotice({ type: 'error', message: 'La nueva contraseña y la confirmación no coinciden.' });
        return;
      }

      updatedPassword = newPassword;
    }

    const updatedUser = {
      ...currentUser,
      name,
      store,
      city,
      username,
      password: updatedPassword,
    };

    const updatedUsers = users.map(user => user.id === currentUser.id ? updatedUser : user);

    setUsers(updatedUsers);
    setCurrentUser(updatedUser);
    saveToStorage(STORAGE_KEYS.users, updatedUsers);
    saveToStorage(STORAGE_KEYS.currentUser, updatedUser);
    setSettingsForm({
      name: updatedUser.name,
      store: updatedUser.store,
      city: updatedUser.city,
      username: updatedUser.username,
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    });
    setSettingsNotice({ type: 'success', message: 'Configuración actualizada correctamente.' });
  }

  const pageInfo = {
    Inicio: { title: 'Inicio', subtitle: 'Resumen general de tu tienda.', icon: Home },
    Ventas: { title: 'Ventas', subtitle: 'Registra ventas y revisa el historial reciente.', icon: ShoppingCart },
    Productos: { title: 'Productos', subtitle: 'Administra los productos de tu tienda fácilmente.', icon: Package },
    Inventario: { title: 'Inventario', subtitle: 'Controla stock, alertas y valor de inventario.', icon: Boxes },
    Clientes: { title: 'Clientes', subtitle: 'Administra clientes frecuentes de la tienda.', icon: Users },
    Proveedores: { title: 'Proveedores', subtitle: 'Organiza proveedores y tiempos de entrega.', icon: Truck },
    Reportes: { title: 'Reportes', subtitle: 'Analiza ventas, utilidad y decisiones de compra.', icon: BarChart3 },
    Configuración: { title: 'Configuración', subtitle: 'Ajusta datos generales de la tienda.', icon: Settings },
  }[active];

  const HeaderIcon = pageInfo.icon;

  if (!currentUser) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        registerForm={registerForm}
        setRegisterForm={setRegisterForm}
        authNotice={authNotice}
        setAuthNotice={setAuthNotice}
        login={login}
        register={register}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MobileTopBar currentUser={currentUser} logout={logout} />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-b from-emerald-950 to-teal-950 text-white p-6">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3"><Store className="h-8 w-8" /></div>
              <div>
                <h1 className="text-2xl font-bold">InventiQ</h1>
                <p className="text-sm text-emerald-100">Controla tu inventario</p>
              </div>
            </div>
            <nav className="space-y-2">
              {menu.map(item => {
                const Icon = item.icon;
                const isActive = active === item.label;
                return (
                  <button key={item.label} onClick={() => { setActive(item.label); setMobileMoreOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${isActive ? 'bg-emerald-500/80 shadow-lg' : 'text-emerald-50 hover:bg-white/10'}`}>
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              </div>
              <h3 className="font-bold">Ahorra tiempo</h3>
              <p className="mt-2 text-sm text-emerald-100">Automatiza tu inventario y evita quedarte sin stock.</p>
              <button onClick={() => setActive('Reportes')} className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white">Ver reportes</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-400 text-lg font-bold">A</div>
              <div>
                <p className="font-semibold">{currentUser.name}</p>
                <p className="text-sm text-emerald-100">{currentUser.store}</p>
              </div>
            </div>
            <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-emerald-50 hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="p-4 pb-28 pt-20 sm:p-6 sm:pb-28 sm:pt-20 lg:p-8 lg:pb-8 lg:pt-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><HeaderIcon className="h-8 w-8" /></div>
              <div>
                <h2 className="text-3xl font-extrabold lg:text-4xl">{pageInfo.title}</h2>
                <p className="text-slate-500">{pageInfo.subtitle}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{currentUser.store} · {currentUser.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Buscar producto, SKU o categoría..." />
              </div>
              <button className="hidden rounded-2xl bg-white p-3 shadow-sm sm:block"><Bell className="h-5 w-5" /></button>
              <button onClick={() => setActive('Productos')} className="hidden rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 sm:inline-flex sm:items-center"><Plus className="mr-2 h-5 w-5" />Agregar producto</button>
            </div>
          </header>

          {active === 'Inicio' && <HomePage totalSales={totalSales} totalProducts={totalProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} sales={storeSales} products={storeProducts} bestSeller={bestSeller} totalProfit={totalProfit} />}
          {active === 'Ventas' && <SalesPage sales={storeSales} products={storeProducts} saleForm={saleForm} setSaleForm={setSaleForm} registerSale={registerSale} resetSaleForm={resetSaleForm} cancelSale={cancelSale} totalSales={totalSales} totalProfit={totalProfit} totalDiscount={totalDiscount} totalUnitsSold={totalUnitsSold} saleNotice={saleNotice} salePreview={calculateSalePreview()} />}
          {active === 'Productos' && <ProductsPage products={storeProducts} filtered={filtered} categories={categories} productCategories={productCategories} category={category} setCategory={setCategory} form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editProduct={editProduct} editingId={editingId} notice={notice} deleteProduct={deleteProduct} pendingDeleteId={pendingDeleteId} setPendingDeleteId={setPendingDeleteId} statusText={statusText} totalProducts={totalProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} />}
          {active === 'Inventario' && <InventoryPage products={storeProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} potentialProfit={potentialProfit} statusText={statusText} />}
          {active === 'Clientes' && <ClientsPage clients={storeClients} clientForm={clientForm} setClientForm={setClientForm} saveClient={saveClient} resetClientForm={resetClientForm} editClient={editClient} deleteClient={deleteClient} editingClientId={editingClientId} pendingDeleteClientId={pendingDeleteClientId} setPendingDeleteClientId={setPendingDeleteClientId} clientNotice={clientNotice} />}
          {active === 'Proveedores' && <ProvidersPage providers={storeProviders} providerForm={providerForm} setProviderForm={setProviderForm} saveProvider={saveProvider} resetProviderForm={resetProviderForm} editProvider={editProvider} deleteProvider={deleteProvider} editingProviderId={editingProviderId} pendingDeleteProviderId={pendingDeleteProviderId} setPendingDeleteProviderId={setPendingDeleteProviderId} providerNotice={providerNotice} productCategories={productCategories} products={storeProducts} />}
          {active === 'Reportes' && <ReportsPage products={storeProducts} sales={storeSales} totalSales={totalSales} inventoryValue={inventoryValue} potentialProfit={potentialProfit} bestSeller={bestSeller} totalProfit={totalProfit} />}
          {active === 'Configuración' && <SettingsPage currentUser={currentUser} settingsForm={settingsForm} setSettingsForm={setSettingsForm} saveSettings={saveSettings} settingsNotice={settingsNotice} />}
        </main>
      </div>
      <MobileBottomNav menu={menu} active={active} setActive={setActive} mobileMoreOpen={mobileMoreOpen} setMobileMoreOpen={setMobileMoreOpen} />
      <MobileFloatingButton setActive={setActive} />
    </div>
  );
}

function MobileTopBar({ currentUser, logout }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-900 p-2 text-white"><Store className="h-6 w-6" /></div>
          <div>
            <p className="text-lg font-extrabold leading-5">InventiQ</p>
            <p className="text-xs font-semibold text-emerald-700">{currentUser.store}</p>
          </div>
        </div>
        <button onClick={logout} className="rounded-2xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function MobileBottomNav({ menu, active, setActive, mobileMoreOpen, setMobileMoreOpen }) {
  const primaryLabels = ['Inicio', 'Ventas', 'Productos', 'Inventario'];
  const moreLabels = ['Reportes', 'Clientes', 'Proveedores', 'Configuración'];
  const primaryMenu = menu.filter(item => primaryLabels.includes(item.label));
  const moreMenu = menu.filter(item => moreLabels.includes(item.label));
  const isMoreActive = moreLabels.includes(active);

  function goTo(label) {
    setActive(label);
    setMobileMoreOpen(false);
  }

  return (
    <>
      {mobileMoreOpen && (
        <div className="fixed inset-x-3 bottom-24 z-40 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900">Más opciones</h3>
            <button onClick={() => setMobileMoreOpen(false)} className="rounded-xl px-3 py-1 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {moreMenu.map(item => {
              const Icon = item.icon;
              const selected = active === item.label;
              return (
                <button key={item.label} onClick={() => goTo(item.label)} className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-bold transition ${selected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_25px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {primaryMenu.map(item => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <button key={item.label} onClick={() => goTo(item.label)} className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Icon className="mb-1 h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button onClick={() => setMobileMoreOpen(!mobileMoreOpen)} className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${isMoreActive || mobileMoreOpen ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <MoreHorizontal className="mb-1 h-5 w-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function MobileFloatingButton({ setActive }) {
  return (
    <button onClick={() => setActive('Productos')} className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-200 hover:bg-emerald-700 sm:hidden">
      <Plus className="h-7 w-7" />
    </button>
  );
}

function AuthPage({ authMode, setAuthMode, loginForm, setLoginForm, registerForm, setRegisterForm, authNotice, setAuthNotice, login, register }) {
  const isLogin = authMode === 'login';

  function switchMode(mode) {
    setAuthMode(mode);
    setAuthNotice(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-800 to-emerald-500 p-4 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden text-white lg:block">
          <div className="mb-8 flex items-center gap-4">
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur"><Store className="h-12 w-12" /></div>
            <div>
              <h1 className="text-5xl font-extrabold">InventiQ</h1>
              <p className="mt-2 text-lg text-emerald-100">Gestión inteligente de inventarios para tiendas.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur"><Package className="mb-3 h-7 w-7 text-emerald-200" /><h3 className="font-bold">Inventario</h3><p className="mt-2 text-sm text-emerald-50">Controla productos, stock y alertas.</p></div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur"><ShoppingCart className="mb-3 h-7 w-7 text-emerald-200" /><h3 className="font-bold">Ventas</h3><p className="mt-2 text-sm text-emerald-50">Registra ventas y descuenta stock.</p></div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur"><BarChart3 className="mb-3 h-7 w-7 text-emerald-200" /><h3 className="font-bold">Reportes</h3><p className="mt-2 text-sm text-emerald-50">Analiza rotación, utilidad y compras.</p></div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-7 shadow-2xl sm:p-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-900 text-white shadow-lg">
              {isLogin ? <Lock className="h-9 w-9" /> : <UserPlus className="h-9 w-9" />}
            </div>
            <h2 className="text-3xl font-extrabold">{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
            <p className="mt-2 text-sm text-slate-500">{isLogin ? 'Ingresa para acceder al panel de tu tienda.' : 'Registra tu tienda para usar InventiQ.'}</p>
          </div>

          {authNotice && (
            <div className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${authNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {authNotice.message}
            </div>
          )}

          {isLogin ? (
            <form onSubmit={login} className="space-y-4">
              <Field label="Usuario" value={loginForm.username} onChange={v => setLoginForm({ ...loginForm, username: v })} placeholder="Ej: demo" />
              <Field label="Contraseña" type="password" value={loginForm.password} onChange={v => setLoginForm({ ...loginForm, password: v })} placeholder="Ej: 1234" />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Ingresar</button>
              <p className="text-center text-sm text-slate-500">¿No tienes cuenta?</p>
              <button type="button" onClick={() => switchMode('register')} className="w-full rounded-2xl border border-emerald-200 px-5 py-3 font-bold text-emerald-700 hover:bg-emerald-50">Registrarse</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">Usuario de prueba: <strong>demo</strong> · Contraseña: <strong>1234</strong></p>
            </form>
          ) : (
            <form onSubmit={register} className="space-y-4">
              <Field label="Nombre del encargado" value={registerForm.name} onChange={v => setRegisterForm({ ...registerForm, name: v })} placeholder="Ej: Ana Rodríguez" />
              <Field label="Nombre de la tienda" value={registerForm.store} onChange={v => setRegisterForm({ ...registerForm, store: v })} placeholder="Ej: Minimarket La Esquina" />
              <Field label="Ciudad" value={registerForm.city} onChange={v => setRegisterForm({ ...registerForm, city: v })} placeholder="Ej: Ibarra" />
              <Field label="Usuario" value={registerForm.username} onChange={v => setRegisterForm({ ...registerForm, username: v })} placeholder="Ej: tienda1" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Contraseña" type="password" value={registerForm.password} onChange={v => setRegisterForm({ ...registerForm, password: v })} placeholder="Contraseña" />
                <Field label="Confirmar" type="password" value={registerForm.confirmPassword} onChange={v => setRegisterForm({ ...registerForm, confirmPassword: v })} placeholder="Repetir" />
              </div>
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Listo</button>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function HomePage({ totalSales, totalProducts, lowStock, noStock, inventoryValue, sales, products, bestSeller, totalProfit }) {
  const topProducts = products.slice(0, 4);
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} note="registradas" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad registrada" value={`$${totalProfit.toFixed(2)}`} note="estimada" color="blue" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="por revisar" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="requiere compra" color="red" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-7 text-white shadow-lg">
          <p className="text-sm text-emerald-100">Resumen de tienda</p>
          <h3 className="mt-2 text-3xl font-extrabold">Inventario valorizado en ${inventoryValue.toFixed(2)}</h3>
          <p className="mt-3 max-w-2xl text-emerald-50">Producto estrella: <strong>{bestSeller}</strong>. Revisa los productos con stock bajo para evitar pérdidas de ventas.</p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            <MiniStat label="Ventas" value={`$${totalSales.toFixed(2)}`} />
            <MiniStat label="Productos" value={totalProducts} />
            <MiniStat label="Alertas" value={lowStock + noStock} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xl font-bold">Ventas recientes</h3>
          <div className="space-y-3">
            {sales.slice(0, 4).map(sale => (
              <div key={sale.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="font-semibold">{sale.code}</p>
                  <p className="text-sm text-slate-500">{sale.product} · {sale.date}</p>
                </div>
                <p className="font-bold text-emerald-700">${sale.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xl font-bold">Productos principales</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {topProducts.map(product => (
            <div key={product.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl">📦</div>
              <p className="font-bold">{product.name}</p>
              <p className="text-sm text-slate-500">Stock: {product.stock}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SalesPage({ sales, products, saleForm, setSaleForm, registerSale, resetSaleForm, cancelSale, totalSales, totalProfit, totalDiscount, totalUnitsSold, saleNotice, salePreview }) {
  const { product, subtotal, discount, discountPercent, total, profit, error } = salePreview;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} note="total" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad estimada" value={`$${totalProfit.toFixed(2)}`} note="ganancia" color="blue" />
        <Metric icon={Percent} label="Descuentos" value={`$${totalDiscount.toFixed(2)}`} note="aplicados" color="amber" />
        <Metric icon={Boxes} label="Unidades vendidas" value={totalUnitsSold} note="productos" color="red" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="flex items-center gap-2 text-xl font-bold"><ReceiptText className="h-5 w-5 text-emerald-600" /> Historial de ventas</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {sales.map(sale => (
                <div key={sale.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><ShoppingCart className="h-5 w-5" /></div>
                    <div>
                      <p className="font-bold">{sale.code}</p>
                      <p className="text-sm text-slate-500">{sale.product} · {sale.quantity} unidades · {sale.date}</p>
                      <p className="text-xs text-slate-400">Cliente: {sale.customer || 'Consumidor final'} · Pago: {sale.paymentMethod || 'Efectivo'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <div className="text-right">
                      <p className="font-bold">${sale.total.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">Utilidad: ${(sale.profit || 0).toFixed(2)}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sale.status === 'Anulada' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{sale.status}</span>
                    </div>
                    {sale.status !== 'Anulada' && (
                      <button onClick={() => cancelSale(sale.id)} className="rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50">
                        Anular
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <form onSubmit={registerSale} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Registrar nueva venta</h3>
              <p className="text-sm text-slate-500">Selecciona producto, cantidad y descuento porcentual.</p>
            </div>
            <button type="button" onClick={resetSaleForm} className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"><RotateCcw className="h-5 w-5" /></button>
          </div>

          {saleNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${saleNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {saleNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Producto</span>
              <select value={saleForm.productId} onChange={e => setSaleForm({ ...saleForm, productId: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                <option value="">Seleccionar producto</option>
                {products.filter(p => p.stock > 0).map(product => <option key={product.id} value={product.id}>{product.name} · Stock {product.stock}</option>)}
              </select>
            </label>

            {product && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{product.name}</p>
                <p className="text-sm text-slate-500">Precio: ${product.price.toFixed(2)} · Costo: ${product.cost.toFixed(2)} · Stock disponible: {product.stock}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" type="number" value={saleForm.quantity} onChange={v => setSaleForm({ ...saleForm, quantity: v })} placeholder="1" min="1" />
              <Field label="Descuento %" type="number" value={saleForm.discount} onChange={v => setSaleForm({ ...saleForm, discount: v })} placeholder="Ej: 10" min="0" step="0.01" />
            </div>

            <Field label="Cliente" value={saleForm.customer} onChange={v => setSaleForm({ ...saleForm, customer: v })} placeholder="Consumidor final" />

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Método de pago</span>
              <select value={saleForm.paymentMethod} onChange={e => setSaleForm({ ...saleForm, paymentMethod: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
                <option>Crédito</option>
              </select>
            </label>

            {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

            <div className="rounded-2xl bg-emerald-50 p-4">
              <div className="space-y-2 text-sm text-emerald-800">
                <div className="flex justify-between"><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Descuento ({discountPercent.toFixed(2)}%)</span><strong>-${discount.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Utilidad estimada</span><strong>${profit.toFixed(2)}</strong></div>
              </div>
              <div className="mt-3 border-t border-emerald-100 pt-3">
                <p className="text-sm text-emerald-700">Total a cobrar</p>
                <p className="text-3xl font-extrabold text-emerald-900">${total.toFixed(2)}</p>
              </div>
            </div>

            <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">Registrar venta</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProductsPage({ products, filtered, categories, productCategories, category, setCategory, form, setForm, saveProduct, resetForm, editProduct, editingId, notice, deleteProduct, pendingDeleteId, setPendingDeleteId, statusText, totalProducts, lowStock, noStock, inventoryValue }) {
  return (
    <>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Package} label="Total productos" value={totalProducts} note="activos" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
        <Metric icon={DollarSign} label="Valor total inventario" value={`$${inventoryValue.toFixed(2)}`} note="valor aproximado" color="blue" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <ProductTable products={products} filtered={filtered} categories={categories} category={category} setCategory={setCategory} deleteProduct={deleteProduct} editProduct={editProduct} pendingDeleteId={pendingDeleteId} setPendingDeleteId={setPendingDeleteId} statusText={statusText} />
        <ProductForm form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editingId={editingId} notice={notice} productCategories={productCategories} />
      </section>

      <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <h3 className="mb-4 text-lg font-bold text-emerald-900">¿Por qué usar InventiQ?</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Benefit icon={Package} title="Controla tu inventario" text="en tiempo real" />
          <Benefit icon={AlertTriangle} title="Evita pérdidas" text="por falta de stock" />
          <Benefit icon={CheckCircle2} title="Ahorra tiempo" text="en tus procesos" />
          <Benefit icon={BarChart3} title="Toma mejores decisiones" text="con datos claros" />
        </div>
      </section>
    </>
  );
}

function InventoryPage({ products, lowStock, noStock, inventoryValue, potentialProfit, statusText }) {
  const alerts = products.filter(p => p.stock <= p.minStock);
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric icon={DollarSign} label="Valor inventario" value={`$${inventoryValue.toFixed(2)}`} note="actual" color="blue" />
        <Metric icon={TrendingUp} label="Ganancia potencial" value={`$${potentialProfit.toFixed(2)}`} note="estimada" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold">Alertas de inventario</h3>
        <div className="space-y-3">
          {alerts.length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">No existen alertas críticas de inventario.</p>}
          {alerts.map(product => {
            const s = statusText(product);
            return (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                <div>
                  <p className="font-bold">{product.name}</p>
                  <p className={`text-sm ${s.color}`}>{s.label} · Stock actual {product.stock} · Mínimo {product.minStock}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ClientsPage({ clients, clientForm, setClientForm, saveClient, resetClientForm, editClient, deleteClient, editingClientId, pendingDeleteClientId, setPendingDeleteClientId, clientNotice }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-emerald-600" /> Clientes registrados</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {clients.length === 0 && <p className="p-5 text-sm text-slate-500">Todavía no existen clientes registrados para esta tienda.</p>}
          {clients.map(client => {
            const isDeleting = pendingDeleteClientId === client.id;
            return (
              <div key={client.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{client.name}</p>
                  <p className="text-sm text-slate-500">{client.phone} · {client.type}</p>
                  <p className="text-xs text-slate-400">{client.email || 'Sin correo'} · {client.purchases || 0} compras</p>
                </div>
                {isDeleting ? (
                  <div className="flex gap-2">
                    <button onClick={() => deleteClient(client.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Confirmar</button>
                    <button onClick={() => setPendingDeleteClientId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => editClient(client)} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => setPendingDeleteClientId(client.id)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <form onSubmit={saveClient} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">{editingClientId ? 'Editar cliente' : 'Registrar cliente'}</h3>
            <p className="text-sm text-slate-500">Administra tus clientes frecuentes.</p>
          </div>
          <button type="button" onClick={resetClientForm} className="rounded-xl p-2 hover:bg-slate-50">×</button>
        </div>

        {clientNotice && (
          <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${clientNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {clientNotice.message}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Nombre del cliente" value={clientForm.name} onChange={v => setClientForm({ ...clientForm, name: v })} placeholder="Ej: Juan Pérez" />
          <Field label="Teléfono" value={clientForm.phone} onChange={v => setClientForm({ ...clientForm, phone: v })} placeholder="Ej: 099 000 0000" />
          <Field label="Correo" value={clientForm.email} onChange={v => setClientForm({ ...clientForm, email: v })} placeholder="Ej: cliente@email.com" />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de cliente</span>
            <select value={clientForm.type} onChange={e => setClientForm({ ...clientForm, type: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
              <option>Nuevo</option>
              <option>Regular</option>
              <option>Frecuente</option>
              <option>Mayorista</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Observaciones</span>
            <textarea value={clientForm.notes} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Preferencias, horarios, notas..." />
          </label>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={resetClientForm} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">{editingClientId ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ProvidersPage({ providers, providerForm, setProviderForm, saveProvider, resetProviderForm, editProvider, deleteProvider, editingProviderId, pendingDeleteProviderId, setPendingDeleteProviderId, providerNotice, productCategories, products }) {
  const lowStockProducts = products.filter(product => product.stock <= product.minStock);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-900"><AlertTriangle className="h-5 w-5" /> Proveedores sugeridos para reposición</h3>
        {lowStockProducts.length === 0 && <p className="text-sm text-amber-800">No existen productos con necesidad de reposición.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lowStockProducts.map(product => {
            const provider = providers.find(item => item.category?.toLowerCase() === product.category?.toLowerCase());
            return (
              <div key={product.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-bold text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-500">Stock {product.stock} · mínimo {product.minStock}</p>
                <p className="mt-2 text-sm font-semibold text-amber-700">Proveedor: {provider ? provider.name : 'Sin proveedor asignado'}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Truck className="h-5 w-5 text-emerald-600" /> Proveedores registrados</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {providers.length === 0 && <p className="p-5 text-sm text-slate-500">Todavía no existen proveedores registrados para esta tienda.</p>}
            {providers.map(provider => {
              const isDeleting = pendingDeleteProviderId === provider.id;
              return (
                <div key={provider.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{provider.name}</p>
                    <p className="text-sm text-slate-500">{provider.category} · {provider.contact}</p>
                    <p className="text-xs text-slate-400">Tiempo de entrega: {provider.delivery}</p>
                  </div>
                  {isDeleting ? (
                    <div className="flex gap-2">
                      <button onClick={() => deleteProvider(provider.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Confirmar</button>
                      <button onClick={() => setPendingDeleteProviderId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => editProvider(provider)} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setPendingDeleteProviderId(provider.id)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <form onSubmit={saveProvider} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{editingProviderId ? 'Editar proveedor' : 'Registrar proveedor'}</h3>
              <p className="text-sm text-slate-500">Asocia proveedores con categorías de productos.</p>
            </div>
            <button type="button" onClick={resetProviderForm} className="rounded-xl p-2 hover:bg-slate-50">×</button>
          </div>

          {providerNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${providerNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {providerNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <Field label="Nombre del proveedor" value={providerForm.name} onChange={v => setProviderForm({ ...providerForm, name: v })} placeholder="Ej: Distribuidora Norte" />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Categoría que abastece</span>
              <select value={providerForm.category} onChange={e => setProviderForm({ ...providerForm, category: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                <option value="">Seleccionar categoría</option>
                {productCategories.map(category => <option key={category} value={category}>{category}</option>)}
                <option value="General">General</option>
              </select>
            </label>
            <Field label="Contacto" value={providerForm.contact} onChange={v => setProviderForm({ ...providerForm, contact: v })} placeholder="Teléfono o correo" />
            <Field label="Tiempo de entrega" value={providerForm.delivery} onChange={v => setProviderForm({ ...providerForm, delivery: v })} placeholder="Ej: 2 días" />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Observaciones</span>
              <textarea value={providerForm.notes} onChange={e => setProviderForm({ ...providerForm, notes: e.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Condiciones, horarios, productos principales..." />
            </label>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={resetProviderForm} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">{editingProviderId ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReportsPage({ products, sales, totalSales, inventoryValue, potentialProfit, bestSeller, totalProfit }) {
  const completedSales = sales.filter(s => s.status !== 'Anulada');

  const salesByProduct = products.map(product => {
    const productSales = completedSales.filter(s => s.productId === product.id || s.product === product.name);
    const unitsSold = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const revenue = productSales.reduce((sum, sale) => sum + sale.total, 0);
    const profit = productSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const suggestedPurchase = Math.max(product.minStock + unitsSold - product.stock, 0);

    let abc = 'C';
    if (revenue >= totalSales * 0.4 && revenue > 0) abc = 'A';
    else if (revenue >= totalSales * 0.15 && revenue > 0) abc = 'B';

    let recommendation = 'Mantener compra moderada';
    if (product.stock === 0) recommendation = 'Comprar urgente: producto sin stock';
    else if (product.stock <= product.minStock && unitsSold > 0) recommendation = 'Comprar más: stock bajo y tiene ventas';
    else if (unitsSold === 0) recommendation = 'Comprar menos o promocionar';
    else if (unitsSold >= 3) recommendation = 'Mantener stock alto';

    let marketing = 'Mantener ubicación actual';
    const category = product.category.toLowerCase();
    const name = product.name.toLowerCase();
    if (unitsSold === 0) marketing = 'Mover a zona visible y aplicar promoción';
    else if (category.includes('snack') || name.includes('papas') || name.includes('coca')) marketing = 'Ubicar cerca de caja como producto de impulso';
    else if (category.includes('bebida') || category.includes('lácteo')) marketing = 'Colocar cerca de productos complementarios';
    else if (product.stock <= product.minStock) marketing = 'Ubicar en zona visible hasta reponer stock';

    return {
      ...product,
      unitsSold,
      revenue,
      profit,
      suggestedPurchase,
      abc,
      recommendation,
      marketing,
    };
  });

  const topSold = [...salesByProduct].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
  const lowRotation = [...salesByProduct].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);
  const topProfit = [...salesByProduct].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const purchaseSuggestions = salesByProduct.filter(p => p.suggestedPurchase > 0).sort((a, b) => b.suggestedPurchase - a.suggestedPurchase);
  const typeA = salesByProduct.filter(p => p.abc === 'A').length;
  const typeB = salesByProduct.filter(p => p.abc === 'B').length;
  const typeC = salesByProduct.filter(p => p.abc === 'C').length;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas" value={`$${totalSales.toFixed(2)}`} note="acumuladas" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad registrada" value={`$${totalProfit.toFixed(2)}`} note="estimada" color="blue" />
        <Metric icon={Package} label="Producto estrella" value={bestSeller} note="más vendido" color="amber" />
        <Metric icon={BarChart3} label="ABC" value={`A:${typeA} B:${typeB} C:${typeC}`} note="clasificación" color="red" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="h-5 w-5 text-emerald-600" /> Productos más vendidos</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {topSold.map(product => (
              <ReportRow key={product.id} title={product.name} subtitle={`${product.category} · ${product.unitsSold} unidades vendidas`} right={`$${product.revenue.toFixed(2)}`} badge={`ABC ${product.abc}`} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Activity className="h-5 w-5 text-emerald-600" /> Baja rotación o sin movimiento</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {lowRotation.map(product => (
              <ReportRow key={product.id} title={product.name} subtitle={`${product.category} · stock actual ${product.stock}`} right={product.unitsSold === 0 ? 'Sin ventas' : `${product.unitsSold} ventas`} badge="Promocionar" />
            ))}
          </div>
        </section>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><DollarSign className="h-5 w-5 text-emerald-600" /> Utilidad por producto</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {topProfit.map(product => (
              <ReportRow key={product.id} title={product.name} subtitle={`Ventas: $${product.revenue.toFixed(2)} · unidades: ${product.unitsSold}`} right={`Utilidad $${product.profit.toFixed(2)}`} badge={`ABC ${product.abc}`} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5 text-emerald-600" /> Compra sugerida</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {purchaseSuggestions.length === 0 && <p className="p-5 text-sm text-slate-500">No existen compras sugeridas por el momento.</p>}
            {purchaseSuggestions.map(product => (
              <ReportRow key={product.id} title={product.name} subtitle={`Stock ${product.stock} · mínimo ${product.minStock} · vendido ${product.unitsSold}`} right={`Comprar ${product.suggestedPurchase}`} badge="Reposición" />
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="flex items-center gap-2 text-xl font-bold"><BarChart3 className="h-5 w-5 text-emerald-600" /> Matriz de recomendaciones inteligentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">ABC</th>
                <th className="px-5 py-4">Ventas</th>
                <th className="px-5 py-4">Stock</th>
                <th className="px-5 py-4">Compra sugerida</th>
                <th className="px-5 py-4">Decisión de compra</th>
                <th className="px-5 py-4">Marketing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesByProduct.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.category}</p>
                  </td>
                  <td className="px-5 py-4"><AbcBadge value={product.abc} /></td>
                  <td className="px-5 py-4">{product.unitsSold} unidades<br /><span className="text-xs text-slate-500">${product.revenue.toFixed(2)}</span></td>
                  <td className="px-5 py-4">{product.stock}<br /><span className="text-xs text-slate-500">mín. {product.minStock}</span></td>
                  <td className="px-5 py-4 font-bold text-emerald-700">{product.suggestedPurchase}</td>
                  <td className="px-5 py-4 text-slate-600">{product.recommendation}</td>
                  <td className="px-5 py-4 text-slate-600">{product.marketing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <h3 className="mb-3 text-lg font-bold text-emerald-900">Lectura rápida</h3>
        <p className="text-sm leading-6 text-emerald-900">
          Los productos tipo <strong>A</strong> son los más importantes para la tienda y deben mantenerse con stock suficiente.
          Los tipo <strong>B</strong> requieren control periódico. Los tipo <strong>C</strong> pueden necesitar promoción, menor compra o mejor ubicación.
          La compra sugerida considera stock mínimo, ventas registradas y stock actual.
        </p>
      </section>
    </div>
  );
}

function SettingsPage({ currentUser, settingsForm, setSettingsForm, saveSettings, settingsNotice }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form onSubmit={saveSettings} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-5 flex items-center gap-2 text-xl font-bold"><Settings className="h-5 w-5 text-emerald-600" /> Datos de la tienda</h3>

        {settingsNotice && (
          <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${settingsNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {settingsNotice.message}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Nombre de la tienda" value={settingsForm.store} onChange={v => setSettingsForm({ ...settingsForm, store: v })} placeholder="Nombre de la tienda" />
          <Field label="Propietario / encargado" value={settingsForm.name} onChange={v => setSettingsForm({ ...settingsForm, name: v })} placeholder="Nombre del encargado" />
          <Field label="Ciudad" value={settingsForm.city} onChange={v => setSettingsForm({ ...settingsForm, city: v })} placeholder="Ciudad" />
          <Field label="Usuario" value={settingsForm.username} onChange={v => setSettingsForm({ ...settingsForm, username: v })} placeholder="Usuario" />

          <div className="rounded-2xl bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-slate-800">Cambiar contraseña</h4>
            <div className="space-y-3">
              <Field label="Contraseña actual" type="password" value={settingsForm.currentPassword} onChange={v => setSettingsForm({ ...settingsForm, currentPassword: v })} placeholder="Contraseña actual" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nueva contraseña" type="password" value={settingsForm.newPassword} onChange={v => setSettingsForm({ ...settingsForm, newPassword: v })} placeholder="Nueva contraseña" />
                <Field label="Confirmar nueva" type="password" value={settingsForm.confirmNewPassword} onChange={v => setSettingsForm({ ...settingsForm, confirmNewPassword: v })} placeholder="Confirmar" />
              </div>
            </div>
          </div>

          <button type="submit" className="rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"><Save className="mr-2 inline h-5 w-5" />Guardar cambios</button>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-5 flex items-center gap-2 text-xl font-bold"><UserPlus className="h-5 w-5 text-emerald-600" /> Información de acceso</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <p className="rounded-2xl bg-slate-50 p-4"><strong>Tienda:</strong> {currentUser.store}</p>
          <p className="rounded-2xl bg-slate-50 p-4"><strong>Encargado:</strong> {currentUser.name}</p>
          <p className="rounded-2xl bg-slate-50 p-4"><strong>Usuario actual:</strong> {currentUser.username}</p>
          <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">Los cambios se guardan en el navegador mediante localStorage. Si cambias el usuario, la información seguirá asociada a ese nuevo usuario.</p>
        </div>
      </section>
    </div>
  );
}

function ProductTable({ products, filtered, categories, category, setCategory, deleteProduct, editProduct, pendingDeleteId, setPendingDeleteId, statusText }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Package className="h-5 w-5 text-emerald-600" /> Lista de productos</h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
          <h4 className="mb-4 font-semibold">Categorías</h4>
          <div className="space-y-2">
            {categories.map(cat => {
              const count = cat === 'Todas' ? products.length : products.filter(p => p.category === cat).length;
              const selected = category === cat;
              return (
                <button key={cat} onClick={() => setCategory(cat)} className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm ${selected ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'}`}>
                  <span>{cat}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-500 shadow-sm">{count}</span>
                </button>
              );
            })}
          </div>
          <button className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium hover:bg-slate-50"><Plus className="mr-2 inline h-4 w-4" />Nueva categoría</button>
        </aside>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4">Precio</th>
                <th className="px-5 py-4">Stock</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => {
                const s = statusText(product);
                const isDeleting = pendingDeleteId === product.id;
                return (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">📦</div>
                        <div>
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{product.category}</td>
                    <td className="px-5 py-4 font-medium">${product.price.toFixed(2)}</td>
                    <td className="px-5 py-4"><p className="font-bold">{product.stock}</p><p className={`text-xs ${s.color}`}>{s.label}</p></td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>{product.status}</span></td>
                    <td className="px-5 py-4">
                      {isDeleting ? (
                        <div className="flex gap-2">
                          <button onClick={() => deleteProduct(product.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Confirmar</button>
                          <button onClick={() => setPendingDeleteId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => editProduct(product)} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => setPendingDeleteId(product.id)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">Mostrando {filtered.length} de {products.length} productos</div>
        </div>
      </div>
    </div>
  );
}

function ProductForm({ form, setForm, saveProduct, resetForm, editingId, notice, productCategories }) {
  const isNewCategory = form.category === '__new__';

  return (
    <form onSubmit={saveProduct} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{editingId ? 'Editar producto' : 'Agregar nuevo producto'}</h3>
          <p className="text-sm text-slate-500">{editingId ? 'Actualiza la información del producto seleccionado.' : 'Registra un producto nuevo en el inventario.'}</p>
        </div>
        <button type="button" onClick={resetForm} className="rounded-xl p-2 hover:bg-slate-50">×</button>
      </div>

      {notice && (
        <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      <div className="space-y-4">
        <Field label="Nombre del producto" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Ej: Arroz 1kg" />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Categoría</span>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
            <option value="">Seleccionar categoría</option>
            {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            <option value="__new__">+ Crear nueva categoría</option>
          </select>
        </label>

        {isNewCategory && (
          <Field label="Nueva categoría" value={form.customCategory} onChange={v => setForm({ ...form, customCategory: v })} placeholder="Ej: Mascotas" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta" type="number" min="0" step="0.01" value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="$ 0.00" />
          <Field label="Costo" type="number" min="0" step="0.01" value={form.cost} onChange={v => setForm({ ...form, cost: v })} placeholder="$ 0.00" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual" type="number" min="0" value={form.stock} onChange={v => setForm({ ...form, stock: v })} placeholder="0" />
          <Field label="Stock mínimo" type="number" min="0" value={form.minStock} onChange={v => setForm({ ...form, minStock: v })} placeholder="5" />
        </div>
        <Field label="Código / SKU" value={form.sku} onChange={v => setForm({ ...form, sku: v })} placeholder="Ej: ARROZ001" />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Descripción</span>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Descripción del producto..." />
        </label>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Subir imagen<br />PNG, JPG hasta 2MB</div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
          <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">{editingId ? 'Actualizar producto' : 'Guardar producto'}</button>
        </div>
      </div>
    </form>
  );
}

function Metric({ icon: Icon, label, value, note, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-500',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
  };
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${colors[color]}`}><Icon className="h-8 w-8" /></div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-3xl font-extrabold text-slate-900">{value}</p>
          <p className="text-sm text-emerald-600">{note}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', min, step }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input type={type} min={min} step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" />
    </label>
  );
}

function Benefit({ icon: Icon, title, text }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-white p-3 text-emerald-600"><Icon className="h-6 w-6" /></div>
      <div><p className="font-semibold text-slate-900">{title}</p><p className="text-sm text-slate-600">{text}</p></div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-sm text-emerald-100">{label}</p>
      <p className="text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}

function TableCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Icon className="h-5 w-5 text-emerald-600" />{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function ListRow({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between p-5">
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{right}</span>
    </div>
  );
}

function ReportRow({ title, subtitle, right, badge }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-slate-900">{right}</p>
        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{badge}</span>
      </div>
    </div>
  );
}

function AbcBadge({ value }) {
  const styles = {
    A: 'bg-emerald-50 text-emerald-700',
    B: 'bg-blue-50 text-blue-700',
    C: 'bg-amber-50 text-amber-700',
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[value] || styles.C}`}>Tipo {value}</span>;
}
