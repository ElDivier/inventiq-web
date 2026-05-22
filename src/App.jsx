import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
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
  Download,
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
  imageUrl: '',
  imageFile: null,
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
  saleType: 'consumidor',
  customer: '',
  customerId: '',
  invoiceEnabled: false,
  invoiceName: '',
  invoiceIdentification: '',
  invoiceAddress: '',
  invoiceEmail: '',
  paymentMethod: 'Efectivo',
};

const menu = [
  { label: 'Inicio', icon: Home },
  { label: 'Ventas', icon: ShoppingCart },
  { label: 'Compras', icon: ClipboardList },
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
  identification: '',
  address: '',
  invoiceName: '',
  wantsInvoice: false,
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
  businessId: '',
  address: '',
  phone: '',
  commercialEmail: '',
  receiptFooter: '',
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

const emptyPurchaseForm = {
  productId: '',
  providerId: '',
  quantity: 1,
  unitCost: '',
  note: '',
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

function mapProductFromDb(product) {
  return {
    id: product.id,
    storeId: product.user_id,
    storeName: '',
    sku: product.sku || '',
    name: product.name || '',
    category: product.category || '',
    price: Number(product.price || 0),
    cost: Number(product.cost || 0),
    stock: Number(product.stock || 0),
    minStock: Number(product.min_stock || 0),
    status: product.status || 'Activo',
    description: product.description || '',
    imageUrl: product.image_url || '',
  };
}

function mapProductToDb(product, userId) {
  return {
    user_id: userId,
    sku: product.sku,
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    min_stock: product.minStock,
    status: product.status,
    description: product.description,
    image_url: product.imageUrl || '',
  };
}

function mapSaleFromDb(sale) {
  return {
    id: sale.id,
    storeId: sale.user_id,
    productId: sale.product_id,
    code: sale.code || '',
    product: sale.product || '',
    customer: sale.customer || 'Consumidor final',
    paymentMethod: sale.payment_method || 'Efectivo',
    invoiceEnabled: Boolean(sale.invoice_enabled),
    invoiceName: sale.invoice_name || '',
    invoiceIdentification: sale.invoice_identification || '',
    invoiceAddress: sale.invoice_address || '',
    invoiceEmail: sale.invoice_email || '',
    quantity: Number(sale.quantity || 0),
    subtotal: Number(sale.subtotal || 0),
    discountPercent: Number(sale.discount_percent || 0),
    discount: Number(sale.discount || 0),
    total: Number(sale.total || 0),
    profit: Number(sale.profit || 0),
    status: sale.status || 'Completada',
    date: sale.created_at ? new Date(sale.created_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha',
  };
}

function mapSaleToDb(sale, userId) {
  return {
    user_id: userId,
    product_id: sale.productId,
    code: sale.code,
    product: sale.product,
    customer: sale.customer,
    payment_method: sale.paymentMethod,
    invoice_enabled: sale.invoiceEnabled,
    invoice_name: sale.invoiceName,
    invoice_identification: sale.invoiceIdentification,
    invoice_address: sale.invoiceAddress,
    invoice_email: sale.invoiceEmail,
    quantity: sale.quantity,
    subtotal: sale.subtotal,
    discount_percent: sale.discountPercent,
    discount: sale.discount,
    total: sale.total,
    profit: sale.profit,
    status: sale.status,
  };
}

function mapClientFromDb(client) {
  return {
    id: client.id,
    storeId: client.user_id,
    name: client.name || '',
    phone: client.phone || 'Sin teléfono',
    type: client.type || 'Nuevo',
    email: client.email || '',
    identification: client.identification || '',
    address: client.address || '',
    invoiceName: client.invoice_name || '',
    wantsInvoice: Boolean(client.wants_invoice),
    notes: client.notes || '',
    purchases: Number(client.purchases || 0),
  };
}

function mapClientToDb(client, userId) {
  return {
    user_id: userId,
    name: client.name,
    phone: client.phone,
    type: client.type,
    email: client.email,
    identification: client.identification,
    address: client.address,
    invoice_name: client.invoiceName,
    wants_invoice: client.wantsInvoice,
    notes: client.notes,
    purchases: client.purchases,
  };
}

function mapProviderFromDb(provider) {
  return {
    id: provider.id,
    storeId: provider.user_id,
    name: provider.name || '',
    category: provider.category || '',
    contact: provider.contact || 'Sin contacto',
    delivery: provider.delivery || 'No definido',
    notes: provider.notes || '',
  };
}

function mapProviderToDb(provider, userId) {
  return {
    user_id: userId,
    name: provider.name,
    category: provider.category,
    contact: provider.contact,
    delivery: provider.delivery,
    notes: provider.notes,
  };
}

function mapPurchaseFromDb(purchase) {
  return {
    id: purchase.id,
    storeId: purchase.user_id,
    productId: purchase.product_id,
    providerId: purchase.provider_id,
    code: purchase.code || '',
    product: purchase.product || '',
    provider: purchase.provider || 'Sin proveedor',
    quantity: Number(purchase.quantity || 0),
    unitCost: Number(purchase.unit_cost || 0),
    total: Number(purchase.total || 0),
    note: purchase.note || '',
    date: purchase.created_at ? new Date(purchase.created_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha',
  };
}

function mapPurchaseToDb(purchase, userId) {
  return {
    user_id: userId,
    product_id: purchase.productId,
    provider_id: purchase.providerId || null,
    code: purchase.code,
    product: purchase.product,
    provider: purchase.provider,
    quantity: purchase.quantity,
    unit_cost: purchase.unitCost,
    total: purchase.total,
    note: purchase.note,
  };
}

function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) {
    alert('No existen datos para exportar.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map(row => headers.map(header => {
      const value = row[header] ?? '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(';')),
  ].join('\n');

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [users, setUsers] = useState(() => getUsersFromStorage());
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [authNotice, setAuthNotice] = useState(null);
  const [active, setActive] = useState('Inicio');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [saleNotice, setSaleNotice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
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
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [purchaseNotice, setPurchaseNotice] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);

  useEffect(() => {
    async function initSupabaseSession() {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user;

        if (sessionUser) {
          setCurrentUser({
            id: sessionUser.id,
            email: sessionUser.email,
            username: sessionUser.email,
            name: sessionUser.email,
            store: 'Mi Tienda',
            city: 'Sin ciudad registrada',
            businessId: '',
            address: '',
            phone: '',
            commercialEmail: '',
            receiptFooter: 'Gracias por su compra.',
          });
          loadUserProfile(sessionUser);
        }
      } catch (error) {
        console.error('Error iniciando sesión de Supabase:', error);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    initSupabaseSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            username: session.user.email,
            name: session.user.email,
            store: 'Mi Tienda',
            city: 'Sin ciudad registrada',
            businessId: '',
            address: '',
            phone: '',
            commercialEmail: '',
            receiptFooter: 'Gracias por su compra.',
          });
          loadUserProfile(session.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error escuchando sesión de Supabase:', error);
        setCurrentUser(null);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

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
    if (currentUser?.id) {
      loadProductsFromSupabase(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const refreshProducts = () => loadProductsFromSupabase(currentUser.id, false);

    const channel = supabase
      .channel(`products-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          refreshProducts();
        }
      )
      .subscribe(status => {
        console.log('Realtime products status:', status);
      });

    // Respaldo fuerte para celular: sincroniza cada 2 segundos aunque el WebSocket se pause.
    const syncInterval = setInterval(refreshProducts, 2000);

    // También sincroniza cuando el celular vuelve a enfocar la pestaña.
    window.addEventListener('focus', refreshProducts);
    document.addEventListener('visibilitychange', refreshProducts);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshProducts);
      document.removeEventListener('visibilitychange', refreshProducts);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (active === 'Productos' && currentUser?.id) {
      loadProductsFromSupabase(currentUser.id);
    }

    if (active === 'Ventas' && currentUser?.id) {
      loadSalesFromSupabase(currentUser.id);
      loadProductsFromSupabase(currentUser.id, false);
    }
  }, [active, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      loadSalesFromSupabase(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const refreshSales = async () => {
      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
    };

    const channel = supabase
      .channel(`sales-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          refreshSales();
        }
      )
      .subscribe(status => {
        console.log('Realtime sales status:', status);
      });

    // Respaldo fuerte para celular: sincroniza ventas y stock aunque el WebSocket se pause.
    const syncInterval = setInterval(refreshSales, 2000);

    window.addEventListener('focus', refreshSales);
    document.addEventListener('visibilitychange', refreshSales);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshSales);
      document.removeEventListener('visibilitychange', refreshSales);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      loadClientsFromSupabase(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const refreshClients = () => loadClientsFromSupabase(currentUser.id, false);

    const channel = supabase
      .channel(`clients-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          refreshClients();
        }
      )
      .subscribe(status => {
        console.log('Realtime clients status:', status);
      });

    const syncInterval = setInterval(refreshClients, 3000);

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      loadProvidersFromSupabase(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      loadPurchasesFromSupabase(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const refreshProviders = () => loadProvidersFromSupabase(currentUser.id, false);

    const channel = supabase
      .channel(`providers-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'providers',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          refreshProviders();
        }
      )
      .subscribe(status => {
        console.log('Realtime providers status:', status);
      });

    const syncInterval = setInterval(refreshProviders, 3000);

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const refreshPurchases = async () => {
      await loadPurchasesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
    };

    const channel = supabase
      .channel(`purchases-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          refreshPurchases();
        }
      )
      .subscribe(status => {
        console.log('Realtime purchases status:', status);
      });

    const syncInterval = setInterval(refreshPurchases, 3000);

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      setSettingsForm({
        name: currentUser.name || '',
        store: currentUser.store || '',
        city: currentUser.city || '',
        businessId: currentUser.businessId || '',
        address: currentUser.address || '',
        phone: currentUser.phone || '',
        commercialEmail: currentUser.commercialEmail || '',
        receiptFooter: currentUser.receiptFooter || 'Gracias por su compra.',
        username: currentUser.username || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [currentUser]);

  async function loadUserProfile(sessionUser) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error cargando perfil:', error);
    }

    setCurrentUser({
      id: sessionUser.id,
      email: sessionUser.email,
      username: sessionUser.email,
      name: profile?.owner_name || sessionUser.email,
      store: profile?.store_name || 'Mi Tienda',
      city: profile?.city || 'Sin ciudad registrada',
      businessId: profile?.business_id || '',
      address: profile?.address || '',
      phone: profile?.phone || '',
      commercialEmail: profile?.commercial_email || '',
      receiptFooter: profile?.receipt_footer || 'Gracias por su compra.',
    });
  }

  async function login(e) {
    e.preventDefault();
    const email = loginForm.username.trim();
    const password = loginForm.password.trim();

    if (!email || !password) {
      setAuthNotice({ type: 'error', message: 'Ingresa correo y contraseña.' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error de login Supabase:', error);
      setAuthNotice({ type: 'error', message: error.message || 'Correo o contraseña incorrectos.' });
      return;
    }

    if (data?.user) {
      await loadUserProfile(data.user);
      setAuthNotice(null);
      setLoginForm(emptyLoginForm);
    }
  }

  async function register(e) {
    e.preventDefault();
    const name = registerForm.name.trim();
    const store = registerForm.store.trim();
    const city = registerForm.city.trim();
    const email = registerForm.username.trim();
    const password = registerForm.password.trim();
    const confirmPassword = registerForm.confirmPassword.trim();

    if (!name || !store || !email || !password || !confirmPassword) {
      setAuthNotice({ type: 'error', message: 'Completa todos los campos obligatorios.' });
      return;
    }

    if (!email.includes('@')) {
      setAuthNotice({ type: 'error', message: 'Ingresa un correo electrónico válido.' });
      return;
    }

    if (password !== confirmPassword) {
      setAuthNotice({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthNotice({ type: 'error', message: error.message });
      return;
    }

    if (data?.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        store_name: store,
        owner_name: name,
        city: city || 'Sin ciudad registrada',
      });

      if (profileError) {
        setAuthNotice({ type: 'error', message: 'La cuenta se creó, pero no se pudo guardar el perfil. Revisa si la confirmación por correo está desactivada.' });
        return;
      }
    }

    setRegisterForm(emptyRegisterForm);
    setAuthMode('login');
    setAuthNotice({ type: 'success', message: 'Cuenta creada correctamente. Ahora inicia sesión con tu correo.' });
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    setCurrentUser(null);
    setActive('Inicio');
    setAuthMode('login');
    setAuthNotice(null);
  }

  const storeKey = currentUser?.id || 'demo';
  const storeProducts = products.filter(product => (product.storeId || 'demo') === storeKey);
  const storeSales = sales.filter(sale => (sale.storeId || 'demo') === storeKey);
  const storeClients = clients.filter(client => (client.storeId || 'demo') === storeKey);
  const storeProviders = providers.filter(provider => (provider.storeId || 'demo') === storeKey);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(storeProducts.map(p => p.category)))], [storeProducts]);
  const productCategories = categories.filter(cat => cat !== 'Todas');

  const filtered = storeProducts.filter(p => {
    const text = search.toLowerCase();
    const productName = String(p.name || '').toLowerCase();
    const productSku = String(p.sku || '').toLowerCase();
    const productCategory = String(p.category || '').toLowerCase();
    const matchSearch =
      productName.includes(text) ||
      productSku.includes(text) ||
      productCategory.includes(text);
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

  async function loadProductsFromSupabase(userId, showLoader = true) {
    if (showLoader) setProductsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando productos:', error);
      setNotice({ type: 'error', message: 'No se pudieron cargar los productos desde Supabase.' });
      if (showLoader) setProductsLoading(false);
      return;
    }

    setProducts((data || []).map(mapProductFromDb));
    if (showLoader) setProductsLoading(false);
  }

  async function loadSalesFromSupabase(userId, showLoader = true) {
    if (showLoader) setSalesLoading(true);

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando ventas:', error);
      setSaleNotice({ type: 'error', message: `No se pudieron cargar las ventas: ${error.message}` });
      if (showLoader) setSalesLoading(false);
      return;
    }

    setSales((data || []).map(mapSaleFromDb));
    if (showLoader) setSalesLoading(false);
  }

  async function loadClientsFromSupabase(userId, showLoader = true) {
    if (showLoader) setClientsLoading(true);

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando clientes:', error);
      setClientNotice({ type: 'error', message: `No se pudieron cargar los clientes: ${error.message}` });
      if (showLoader) setClientsLoading(false);
      return;
    }

    setClients((data || []).map(mapClientFromDb));
    if (showLoader) setClientsLoading(false);
  }

  async function loadProvidersFromSupabase(userId, showLoader = true) {
    if (showLoader) setProvidersLoading(true);

    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando proveedores:', error);
      setProviderNotice({ type: 'error', message: `No se pudieron cargar los proveedores: ${error.message}` });
      if (showLoader) setProvidersLoading(false);
      return;
    }

    setProviders((data || []).map(mapProviderFromDb));
    if (showLoader) setProvidersLoading(false);
  }

  async function loadPurchasesFromSupabase(userId, showLoader = true) {
    if (showLoader) setPurchasesLoading(true);

    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando compras:', error);
      setPurchaseNotice({ type: 'error', message: `No se pudieron cargar las compras: ${error.message}` });
      if (showLoader) setPurchasesLoading(false);
      return;
    }

    setPurchases((data || []).map(mapPurchaseFromDb));
    if (showLoader) setPurchasesLoading(false);
  }

  async function saveProduct(e) {
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

    if (!currentUser?.id) {
      setNotice({ type: 'error', message: 'No existe una sesión activa.' });
      return;
    }

    let uploadedImageUrl = form.imageUrl || '';

    if (form.imageFile) {
      try {
        setNotice({ type: 'success', message: 'Subiendo imagen del producto...' });
        uploadedImageUrl = await uploadProductImage(form.imageFile, form.name.trim());
      } catch (error) {
        setNotice({ type: 'error', message: `No se pudo subir la imagen: ${error.message}` });
        return;
      }
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
      imageUrl: uploadedImageUrl,
    };

    const productPayload = mapProductToDb(productData, currentUser.id);

    if (editingId) {
      const { data, error } = await supabase
        .from('products')
        .update(productPayload)
        .eq('id', editingId)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando producto:', error);
        setNotice({ type: 'error', message: `No se pudo actualizar el producto: ${error.message}` });
        return;
      }

      const updatedProduct = mapProductFromDb(data);
      setProducts(products.map(product => product.id === editingId ? updatedProduct : product));
      setNotice({ type: 'success', message: 'Producto actualizado correctamente en Supabase.' });
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert(productPayload)
        .select()
        .single();

      if (error) {
        console.error('Error guardando producto:', error);
        setNotice({ type: 'error', message: `No se pudo guardar el producto: ${error.message}` });
        return;
      }

      setProducts([mapProductFromDb(data), ...products]);
      setNotice({ type: 'success', message: 'Producto guardado correctamente en Supabase.' });
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
      imageUrl: product.imageUrl || '',
      imageFile: null,
    });
  }

  async function uploadProductImage(file, productName) {
    if (!file) return form.imageUrl || '';

    const extension = file.name.split('.').pop() || 'png';
    const safeName = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'producto';
    const filePath = `${currentUser.id}/${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error subiendo imagen:', uploadError);
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function handleProductImage(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', message: 'Selecciona un archivo de imagen válido.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotice({ type: 'error', message: 'La imagen no debe superar los 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, imageUrl: reader.result, imageFile: file }));
    };
    reader.readAsDataURL(file);
  }

  function calculateSalePreview() {
    const product = storeProducts.find(p => String(p.id) === String(saleForm.productId));
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

  async function registerPurchase(e) {
    e.preventDefault();

    const product = storeProducts.find(p => String(p.id) === String(purchaseForm.productId));
    const provider = storeProviders.find(p => String(p.id) === String(purchaseForm.providerId));
    const quantity = Number(purchaseForm.quantity || 0);
    const unitCost = Number(purchaseForm.unitCost || 0);

    if (!product) {
      setPurchaseNotice({ type: 'error', message: 'Selecciona un producto para registrar la compra.' });
      return;
    }

    if (quantity <= 0 || Number.isNaN(quantity)) {
      setPurchaseNotice({ type: 'error', message: 'La cantidad comprada debe ser mayor a 0.' });
      return;
    }

    if (unitCost < 0 || Number.isNaN(unitCost)) {
      setPurchaseNotice({ type: 'error', message: 'El costo unitario no puede ser negativo.' });
      return;
    }

    if (!currentUser?.id) {
      setPurchaseNotice({ type: 'error', message: 'No existe una sesión activa.' });
      return;
    }

    const newStock = product.stock + quantity;
    const newStatus = newStock === 0 ? 'Inactivo' : 'Activo';
    const total = quantity * unitCost;

    const newPurchase = {
      code: `C-${String(purchases.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      productId: product.id,
      providerId: provider?.id || null,
      product: product.name,
      provider: provider?.name || 'Sin proveedor',
      quantity,
      unitCost,
      total,
      note: purchaseForm.note.trim(),
    };

    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert(mapPurchaseToDb(newPurchase, currentUser.id))
      .select()
      .single();

    if (purchaseError) {
      console.error('Error registrando compra:', purchaseError);
      setPurchaseNotice({ type: 'error', message: `No se pudo registrar la compra: ${purchaseError.message}` });
      return;
    }

    const { error: productError } = await supabase
      .from('products')
      .update({ stock: newStock, cost: unitCost || product.cost, status: newStatus })
      .eq('id', product.id)
      .eq('user_id', currentUser.id);

    if (productError) {
      console.error('Error actualizando stock por compra:', productError);
      setPurchaseNotice({ type: 'error', message: `La compra se registró, pero no se pudo actualizar el stock: ${productError.message}` });
      await loadPurchasesFromSupabase(currentUser.id, false);
      return;
    }

    setPurchases([mapPurchaseFromDb(purchaseData), ...purchases]);
    setProducts(products.map(p => p.id === product.id ? { ...p, stock: newStock, cost: unitCost || p.cost, status: newStatus } : p));
    setPurchaseForm(emptyPurchaseForm);
    setPurchaseNotice({ type: 'success', message: `Compra ${newPurchase.code} registrada. Stock actualizado en Supabase.` });
    await loadPurchasesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
  }

  function resetPurchaseForm() {
    setPurchaseForm(emptyPurchaseForm);
    setPurchaseNotice(null);
  }

  async function registerSale(e) {
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

    if (!currentUser?.id) {
      setSaleNotice({ type: 'error', message: 'No existe una sesión activa.' });
      return;
    }

    const newStock = product.stock - quantity;
    const newStatus = newStock === 0 ? 'Inactivo' : 'Activo';

    const newSale = {
      code: `V-${String(storeSales.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      storeName: currentUser.store,
      productId: product.id,
      product: product.name,
      customer: saleForm.saleType === 'factura' ? (saleForm.customer || saleForm.invoiceName || 'Cliente con factura') : 'Consumidor final',
      paymentMethod: saleForm.paymentMethod,
      invoiceEnabled: saleForm.saleType === 'factura' && saleForm.invoiceEnabled,
      invoiceName: saleForm.saleType === 'factura' ? (saleForm.invoiceName || saleForm.customer || '') : '',
      invoiceIdentification: saleForm.saleType === 'factura' ? (saleForm.invoiceIdentification || '') : '',
      invoiceAddress: saleForm.saleType === 'factura' ? (saleForm.invoiceAddress || '') : '',
      invoiceEmail: saleForm.saleType === 'factura' ? (saleForm.invoiceEmail || '') : '',
      quantity,
      subtotal,
      discount,
      discountPercent,
      total,
      profit,
      status: 'Completada',
    };

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert(mapSaleToDb(newSale, currentUser.id))
      .select()
      .single();

    if (saleError) {
      console.error('Error registrando venta:', saleError);
      setSaleNotice({ type: 'error', message: `No se pudo registrar la venta: ${saleError.message}` });
      return;
    }

    const { error: productError } = await supabase
      .from('products')
      .update({ stock: newStock, status: newStatus })
      .eq('id', product.id)
      .eq('user_id', currentUser.id);

    if (productError) {
      console.error('Error actualizando stock:', productError);
      setSaleNotice({ type: 'error', message: `La venta se registró, pero no se pudo actualizar el stock: ${productError.message}` });
      await loadSalesFromSupabase(currentUser.id, false);
      return;
    }

    setSales([mapSaleFromDb(saleData), ...sales]);
    setProducts(products.map(p => p.id === product.id ? { ...p, stock: newStock, status: newStatus } : p));
    setSaleForm(emptySaleForm);
    setSaleNotice({ type: 'success', message: `Venta ${newSale.code} registrada correctamente. Stock actualizado en Supabase.` });
    await loadSalesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
  }

  async function cancelSale(id) {
    const sale = storeSales.find(s => s.id === id);
    if (!sale || !currentUser?.id) return;

    const product = products.find(p => String(p.id) === String(sale.productId));

    const { error: saleError } = await supabase
      .from('sales')
      .update({ status: 'Anulada' })
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (saleError) {
      console.error('Error anulando venta:', saleError);
      setSaleNotice({ type: 'error', message: `No se pudo anular la venta: ${saleError.message}` });
      return;
    }

    if (product) {
      const restoredStock = product.stock + sale.quantity;
      const { error: productError } = await supabase
        .from('products')
        .update({ stock: restoredStock, status: 'Activo' })
        .eq('id', product.id)
        .eq('user_id', currentUser.id);

      if (productError) {
        console.error('Error devolviendo stock:', productError);
        setSaleNotice({ type: 'error', message: `Venta anulada, pero no se pudo devolver stock: ${productError.message}` });
        await loadSalesFromSupabase(currentUser.id, false);
        return;
      }
    }

    await loadSalesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
    setSaleNotice({ type: 'success', message: 'Venta anulada y stock devuelto correctamente.' });
  }

  function resetSaleForm() {
    setSaleForm(emptySaleForm);
    setSaleNotice(null);
  }

  async function deleteProduct(id) {
    if (!currentUser?.id) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error eliminando producto:', error);
      setNotice({ type: 'error', message: `No se pudo eliminar el producto: ${error.message}` });
      return;
    }

    setProducts(products.filter(p => p.id !== id));
    await loadProductsFromSupabase(currentUser.id, false);
    setPendingDeleteId(null);
    if (editingId === id) resetForm();
  }

  function resetClientForm() {
    setClientForm(emptyClientForm);
    setEditingClientId(null);
    setClientNotice(null);
  }

  async function saveClient(e) {
    e.preventDefault();
    const name = clientForm.name.trim();
    const phone = clientForm.phone.trim();

    if (!name) {
      setClientNotice({ type: 'error', message: 'Ingresa el nombre del cliente.' });
      return;
    }

    if (!currentUser?.id) {
      setClientNotice({ type: 'error', message: 'No existe una sesión activa.' });
      return;
    }

    const clientData = {
      storeId: storeKey,
      storeName: currentUser.store,
      name,
      phone: phone || 'Sin teléfono',
      type: clientForm.type,
      email: clientForm.email.trim(),
      identification: clientForm.identification.trim(),
      address: clientForm.address.trim(),
      invoiceName: clientForm.invoiceName.trim(),
      wantsInvoice: Boolean(clientForm.wantsInvoice),
      notes: clientForm.notes.trim(),
      purchases: editingClientId ? Number(clients.find(c => c.id === editingClientId)?.purchases || 0) : 0,
    };

    const payload = mapClientToDb(clientData, currentUser.id);

    if (editingClientId) {
      const { data, error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', editingClientId)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando cliente:', error);
        setClientNotice({ type: 'error', message: `No se pudo actualizar el cliente: ${error.message}` });
        return;
      }

      const updatedClient = mapClientFromDb(data);
      setClients(clients.map(client => client.id === editingClientId ? updatedClient : client));
      setClientNotice({ type: 'success', message: 'Cliente actualizado correctamente en Supabase.' });
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Error guardando cliente:', error);
        setClientNotice({ type: 'error', message: `No se pudo guardar el cliente: ${error.message}` });
        return;
      }

      setClients([mapClientFromDb(data), ...clients]);
      setClientNotice({ type: 'success', message: 'Cliente guardado correctamente en Supabase.' });
    }

    setClientForm(emptyClientForm);
    setEditingClientId(null);
    await loadClientsFromSupabase(currentUser.id, false);
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
      identification: client.identification || '',
      address: client.address || '',
      invoiceName: client.invoiceName || '',
      wantsInvoice: Boolean(client.wantsInvoice),
      notes: client.notes || '',
    });
  }

  async function deleteClient(id) {
    if (!currentUser?.id) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error eliminando cliente:', error);
      setClientNotice({ type: 'error', message: `No se pudo eliminar el cliente: ${error.message}` });
      return;
    }

    setClients(clients.filter(client => client.id !== id));
    setPendingDeleteClientId(null);
    if (editingClientId === id) resetClientForm();
    await loadClientsFromSupabase(currentUser.id, false);
  }

  function resetProviderForm() {
    setProviderForm(emptyProviderForm);
    setEditingProviderId(null);
    setProviderNotice(null);
  }

  async function saveProvider(e) {
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

    if (!currentUser?.id) {
      setProviderNotice({ type: 'error', message: 'No existe una sesión activa.' });
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

    const payload = mapProviderToDb(providerData, currentUser.id);

    if (editingProviderId) {
      const { data, error } = await supabase
        .from('providers')
        .update(payload)
        .eq('id', editingProviderId)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando proveedor:', error);
        setProviderNotice({ type: 'error', message: `No se pudo actualizar el proveedor: ${error.message}` });
        return;
      }

      const updatedProvider = mapProviderFromDb(data);
      setProviders(providers.map(provider => provider.id === editingProviderId ? updatedProvider : provider));
      setProviderNotice({ type: 'success', message: 'Proveedor actualizado correctamente en Supabase.' });
    } else {
      const { data, error } = await supabase
        .from('providers')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Error guardando proveedor:', error);
        setProviderNotice({ type: 'error', message: `No se pudo guardar el proveedor: ${error.message}` });
        return;
      }

      setProviders([mapProviderFromDb(data), ...providers]);
      setProviderNotice({ type: 'success', message: 'Proveedor guardado correctamente en Supabase.' });
    }

    setProviderForm(emptyProviderForm);
    setEditingProviderId(null);
    await loadProvidersFromSupabase(currentUser.id, false);
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

  async function deleteProvider(id) {
    if (!currentUser?.id) return;

    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error eliminando proveedor:', error);
      setProviderNotice({ type: 'error', message: `No se pudo eliminar el proveedor: ${error.message}` });
      return;
    }

    setProviders(providers.filter(provider => provider.id !== id));
    setPendingDeleteProviderId(null);
    if (editingProviderId === id) resetProviderForm();
    await loadProvidersFromSupabase(currentUser.id, false);
  }

  async function saveSettings(e) {
    e.preventDefault();
    const name = settingsForm.name.trim();
    const store = settingsForm.store.trim();
    const city = settingsForm.city.trim();
    const email = settingsForm.username.trim();
    const businessId = settingsForm.businessId.trim();
    const address = settingsForm.address.trim();
    const phone = settingsForm.phone.trim();
    const commercialEmail = settingsForm.commercialEmail.trim();
    const receiptFooter = settingsForm.receiptFooter.trim();
    const currentPassword = settingsForm.currentPassword.trim();
    const newPassword = settingsForm.newPassword.trim();
    const confirmNewPassword = settingsForm.confirmNewPassword.trim();

    if (!name || !store || !city || !email) {
      setSettingsNotice({ type: 'error', message: 'Completa nombre, tienda, ciudad y correo.' });
      return;
    }

    if (!email.includes('@')) {
      setSettingsNotice({ type: 'error', message: 'Ingresa un correo electrónico válido.' });
      return;
    }

    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword) {
        setSettingsNotice({ type: 'error', message: 'Ingresa la contraseña actual para cambiar la contraseña.' });
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

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (reauthError) {
        setSettingsNotice({ type: 'error', message: 'La contraseña actual no es correcta.' });
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        setSettingsNotice({ type: 'error', message: passwordError.message });
        return;
      }
    }

    if (email !== currentUser.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        setSettingsNotice({ type: 'error', message: emailError.message });
        return;
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        store_name: store,
        owner_name: name,
        city,
        business_id: businessId,
        address,
        phone,
        commercial_email: commercialEmail,
        receipt_footer: receiptFooter || 'Gracias por su compra.',
      });

    if (profileError) {
      setSettingsNotice({ type: 'error', message: profileError.message });
      return;
    }

    const updatedUser = {
      ...currentUser,
      name,
      store,
      city,
      businessId,
      address,
      phone,
      commercialEmail,
      receiptFooter: receiptFooter || 'Gracias por su compra.',
      email,
      username: email,
    };

    setCurrentUser(updatedUser);
    setSettingsForm({
      name,
      store,
      city,
      businessId,
      address,
      phone,
      commercialEmail,
      receiptFooter: receiptFooter || 'Gracias por su compra.',
      username: email,
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    });
    setSettingsNotice({ type: 'success', message: 'Configuración actualizada correctamente.' });
  }

  const pageInfo = {
    Inicio: { title: 'Inicio', subtitle: 'Resumen general de tu tienda.', icon: Home },
    Ventas: { title: 'Ventas', subtitle: 'Registra ventas y revisa el historial reciente.', icon: ShoppingCart },
    Compras: { title: 'Compras', subtitle: 'Registra compras a proveedores y aumenta stock.', icon: ClipboardList },
    Productos: { title: 'Productos', subtitle: 'Administra los productos de tu tienda fácilmente.', icon: Package },
    Inventario: { title: 'Inventario', subtitle: 'Controla stock, alertas y valor de inventario.', icon: Boxes },
    Clientes: { title: 'Clientes', subtitle: 'Administra clientes frecuentes de la tienda.', icon: Users },
    Proveedores: { title: 'Proveedores', subtitle: 'Organiza proveedores y tiempos de entrega.', icon: Truck },
    Reportes: { title: 'Reportes', subtitle: 'Analiza ventas, utilidad y decisiones de compra.', icon: BarChart3 },
    Configuración: { title: 'Configuración', subtitle: 'Ajusta datos generales de la tienda.', icon: Settings },
  }[active];

  const HeaderIcon = pageInfo.icon;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="font-bold">Cargando InventiQ...</p>
        </div>
      </div>
    );
  }

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
          {active === 'Ventas' && <SalesPage sales={storeSales} products={storeProducts} clients={storeClients} saleForm={saleForm} setSaleForm={setSaleForm} registerSale={registerSale} resetSaleForm={resetSaleForm} cancelSale={cancelSale} totalSales={totalSales} totalProfit={totalProfit} totalDiscount={totalDiscount} totalUnitsSold={totalUnitsSold} saleNotice={saleNotice} salePreview={calculateSalePreview()} salesLoading={salesLoading} setReceiptSale={setReceiptSale} />}
          {active === 'Compras' && <PurchasesPage purchases={purchases} products={storeProducts} providers={storeProviders} purchaseForm={purchaseForm} setPurchaseForm={setPurchaseForm} registerPurchase={registerPurchase} resetPurchaseForm={resetPurchaseForm} purchaseNotice={purchaseNotice} purchasesLoading={purchasesLoading} />}
          {active === 'Productos' && <ProductsPage products={storeProducts} filtered={filtered} categories={categories} productCategories={productCategories} category={category} setCategory={setCategory} form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editProduct={editProduct} editingId={editingId} notice={notice} deleteProduct={deleteProduct} pendingDeleteId={pendingDeleteId} setPendingDeleteId={setPendingDeleteId} statusText={statusText} totalProducts={totalProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} handleProductImage={handleProductImage} productsLoading={productsLoading} />}
          {active === 'Inventario' && <InventoryPage products={storeProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} potentialProfit={potentialProfit} statusText={statusText} />}
          {active === 'Clientes' && <ClientsPage clients={storeClients} clientForm={clientForm} setClientForm={setClientForm} saveClient={saveClient} resetClientForm={resetClientForm} editClient={editClient} deleteClient={deleteClient} editingClientId={editingClientId} pendingDeleteClientId={pendingDeleteClientId} setPendingDeleteClientId={setPendingDeleteClientId} clientNotice={clientNotice} clientsLoading={clientsLoading} />}
          {active === 'Proveedores' && <ProvidersPage providers={storeProviders} providerForm={providerForm} setProviderForm={setProviderForm} saveProvider={saveProvider} resetProviderForm={resetProviderForm} editProvider={editProvider} deleteProvider={deleteProvider} editingProviderId={editingProviderId} pendingDeleteProviderId={pendingDeleteProviderId} setPendingDeleteProviderId={setPendingDeleteProviderId} providerNotice={providerNotice} productCategories={productCategories} products={storeProducts} providersLoading={providersLoading} />}
          {active === 'Reportes' && <ReportsPage products={storeProducts} sales={storeSales} purchases={purchases} clients={storeClients} providers={storeProviders} totalSales={totalSales} inventoryValue={inventoryValue} potentialProfit={potentialProfit} bestSeller={bestSeller} totalProfit={totalProfit} />}
          {active === 'Configuración' && <SettingsPage currentUser={currentUser} settingsForm={settingsForm} setSettingsForm={setSettingsForm} saveSettings={saveSettings} settingsNotice={settingsNotice} />}
        </main>
      </div>
      <MobileBottomNav menu={menu} active={active} setActive={setActive} mobileMoreOpen={mobileMoreOpen} setMobileMoreOpen={setMobileMoreOpen} />
      <MobileFloatingButton setActive={setActive} />
      {receiptSale && <ReceiptModal sale={receiptSale} currentUser={currentUser} onClose={() => setReceiptSale(null)} />}
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
  const moreLabels = ['Compras', 'Reportes', 'Clientes', 'Proveedores', 'Configuración'];
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
              <Field label="Correo electrónico" type="email" value={loginForm.username} onChange={v => setLoginForm({ ...loginForm, username: v })} placeholder="Ej: tienda@email.com" />
              <Field label="Contraseña" type="password" value={loginForm.password} onChange={v => setLoginForm({ ...loginForm, password: v })} placeholder="Tu contraseña" />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Ingresar</button>
              <p className="text-center text-sm text-slate-500">¿No tienes cuenta?</p>
              <button type="button" onClick={() => switchMode('register')} className="w-full rounded-2xl border border-emerald-200 px-5 py-3 font-bold text-emerald-700 hover:bg-emerald-50">Registrarse</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">Ahora el acceso funciona con Supabase: usa correo electrónico y contraseña.</p>
            </form>
          ) : (
            <form onSubmit={register} className="space-y-4">
              <Field label="Nombre del encargado" value={registerForm.name} onChange={v => setRegisterForm({ ...registerForm, name: v })} placeholder="Ej: Ana Rodríguez" />
              <Field label="Nombre de la tienda" value={registerForm.store} onChange={v => setRegisterForm({ ...registerForm, store: v })} placeholder="Ej: Minimarket La Esquina" />
              <Field label="Ciudad" value={registerForm.city} onChange={v => setRegisterForm({ ...registerForm, city: v })} placeholder="Ej: Ibarra" />
              <Field label="Correo electrónico" type="email" value={registerForm.username} onChange={v => setRegisterForm({ ...registerForm, username: v })} placeholder="Ej: tienda@email.com" />
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
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="mb-3 h-12 w-12 rounded-xl object-cover shadow-sm" />
              ) : (
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl">📦</div>
              )}
              <p className="font-bold">{product.name}</p>
              <p className="text-sm text-slate-500">Stock: {product.stock}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PurchasesPage({ purchases, products, providers, purchaseForm, setPurchaseForm, registerPurchase, resetPurchaseForm, purchaseNotice, purchasesLoading }) {
  const selectedProduct = products.find(product => String(product.id) === String(purchaseForm.productId));
  const suggestedProvider = selectedProduct ? providers.find(provider => String(provider.category || '').toLowerCase() === String(selectedProduct.category || '').toLowerCase()) : null;
  const quantity = Number(purchaseForm.quantity || 0);
  const unitCost = Number(purchaseForm.unitCost || selectedProduct?.cost || 0);
  const total = quantity > 0 && unitCost >= 0 ? quantity * unitCost : 0;

  function selectProduct(productId) {
    const product = products.find(item => String(item.id) === String(productId));
    const provider = product ? providers.find(item => String(item.category || '').toLowerCase() === String(product.category || '').toLowerCase()) : null;

    setPurchaseForm({
      ...purchaseForm,
      productId,
      providerId: provider?.id || '',
      unitCost: product?.cost || '',
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric icon={ClipboardList} label="Compras registradas" value={purchases.length} note="historial" color="emerald" />
        <Metric icon={DollarSign} label="Total comprado" value={`$${purchases.reduce((sum, item) => sum + item.total, 0).toFixed(2)}`} note="inversión" color="blue" />
        <Metric icon={Truck} label="Proveedores" value={providers.length} note="registrados" color="amber" />
      </section>

      {purchasesLoading && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando compras desde Supabase...</div>}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5 text-emerald-600" /> Historial de compras</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {purchases.length === 0 && <p className="p-5 text-sm text-slate-500">Todavía no existen compras registradas.</p>}
            {purchases.map(purchase => (
              <div key={purchase.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{purchase.code}</p>
                  <p className="text-sm text-slate-500">{purchase.product} · {purchase.quantity} unidades · {purchase.date}</p>
                  <p className="text-xs text-slate-400">Proveedor: {purchase.provider} {purchase.note ? `· ${purchase.note}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">${purchase.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Costo unitario: ${purchase.unitCost.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={registerPurchase} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Registrar compra</h3>
              <p className="text-sm text-slate-500">Aumenta el stock cuando compras mercadería.</p>
            </div>
            <button type="button" onClick={resetPurchaseForm} className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"><RotateCcw className="h-5 w-5" /></button>
          </div>

          {purchaseNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${purchaseNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {purchaseNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Producto comprado</span>
              <select value={purchaseForm.productId} onChange={e => selectProduct(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                <option value="">Seleccionar producto</option>
                {products.map(product => <option key={product.id} value={product.id}>{product.name} · Stock actual {product.stock}</option>)}
              </select>
            </label>

            {selectedProduct && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{selectedProduct.name}</p>
                <p className="text-sm text-slate-500">Categoría: {selectedProduct.category} · Stock actual: {selectedProduct.stock}</p>
                {suggestedProvider && <p className="mt-2 text-sm font-semibold text-emerald-700">Proveedor sugerido: {suggestedProvider.name}</p>}
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Proveedor</span>
              <select value={purchaseForm.providerId} onChange={e => setPurchaseForm({ ...purchaseForm, providerId: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                <option value="">Sin proveedor / compra directa</option>
                {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name} · {provider.category}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" type="number" min="1" value={purchaseForm.quantity} onChange={v => setPurchaseForm({ ...purchaseForm, quantity: v })} placeholder="1" />
              <Field label="Costo unitario" type="number" min="0" step="0.01" value={purchaseForm.unitCost} onChange={v => setPurchaseForm({ ...purchaseForm, unitCost: v })} placeholder="0.00" />
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Nota</span>
              <textarea value={purchaseForm.note} onChange={e => setPurchaseForm({ ...purchaseForm, note: e.target.value })} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Factura, pedido, observaciones..." />
            </label>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Total de compra</p>
              <p className="text-3xl font-extrabold text-emerald-900">${total.toFixed(2)}</p>
            </div>

            <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">Registrar compra y aumentar stock</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SalesPage({ sales, products, clients, saleForm, setSaleForm, registerSale, resetSaleForm, cancelSale, totalSales, totalProfit, totalDiscount, totalUnitsSold, saleNotice, salePreview, salesLoading, setReceiptSale }) {
  const { product, subtotal, discount, discountPercent, total, profit, error } = salePreview;

  function setSaleType(type) {
    if (type === 'consumidor') {
      setSaleForm({
        ...saleForm,
        saleType: 'consumidor',
        customerId: '',
        customer: '',
        invoiceEnabled: false,
        invoiceName: '',
        invoiceIdentification: '',
        invoiceAddress: '',
        invoiceEmail: '',
      });
      return;
    }

    setSaleForm({
      ...saleForm,
      saleType: 'factura',
      invoiceEnabled: true,
      customer: saleForm.customer || '',
    });
  }

  function selectClient(clientId) {
    const client = clients.find(item => String(item.id) === String(clientId));
    if (!client) {
      setSaleForm({
        ...saleForm,
        customerId: '',
        customer: '',
        invoiceEnabled: true,
        invoiceName: '',
        invoiceIdentification: '',
        invoiceAddress: '',
        invoiceEmail: '',
      });
      return;
    }

    setSaleForm({
      ...saleForm,
      saleType: 'factura',
      customerId: client.id,
      customer: client.name,
      invoiceEnabled: true,
      invoiceName: client.invoiceName || client.name,
      invoiceIdentification: client.identification || '',
      invoiceAddress: client.address || '',
      invoiceEmail: client.email || '',
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} note="total" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad estimada" value={`$${totalProfit.toFixed(2)}`} note="ganancia" color="blue" />
        <Metric icon={Percent} label="Descuentos" value={`$${totalDiscount.toFixed(2)}`} note="aplicados" color="amber" />
        <Metric icon={Boxes} label="Unidades vendidas" value={totalUnitsSold} note="productos" color="red" />
      </section>

      {salesLoading && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando ventas desde Supabase...</div>}

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
                      <p className="text-xs text-slate-400">Cliente: {sale.customer || 'Consumidor final'} · Pago: {sale.paymentMethod || 'Efectivo'} {sale.invoiceEnabled ? '· Factura' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <div className="text-right">
                      <p className="font-bold">${sale.total.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">Utilidad: ${(sale.profit || 0).toFixed(2)}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sale.status === 'Anulada' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{sale.status}</span>
                    </div>
                    <button type="button" onClick={() => setReceiptSale(sale)} className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50">
                      Comprobante
                    </button>
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

            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de venta</span>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSaleType('consumidor')} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${saleForm.saleType === 'consumidor' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Consumidor final
                </button>
                <button type="button" onClick={() => setSaleType('factura')} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${saleForm.saleType === 'factura' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Factura
                </button>
              </div>
            </div>

            {saleForm.saleType === 'factura' && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <h4 className="mb-3 font-bold text-emerald-900">Factura rápida</h4>
                <label className="mb-3 block">
                  <span className="mb-2 block text-sm font-semibold text-emerald-900">Buscar cliente guardado</span>
                  <select value={saleForm.customerId} onChange={e => selectClient(e.target.value)} className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                    <option value="">Persona no registrada / llenar manual</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name} {client.wantsInvoice ? '· cliente frecuente' : ''}</option>)}
                  </select>
                </label>

                <label className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-semibold text-emerald-800">
                  <input type="checkbox" checked={saleForm.invoiceEnabled} onChange={e => setSaleForm({ ...saleForm, invoiceEnabled: e.target.checked })} className="h-4 w-4" />
                  Crear factura para esta venta
                </label>

                {saleForm.invoiceEnabled && (
                  <div>
                    <h4 className="mb-3 font-bold text-emerald-900">Datos de facturación</h4>
                    <div className="space-y-3">
                      <Field label="Nombre / Razón social" value={saleForm.invoiceName} onChange={v => setSaleForm({ ...saleForm, invoiceName: v, customer: v })} placeholder="Nombre para la factura" />
                      <Field label="Cédula / RUC" value={saleForm.invoiceIdentification} onChange={v => setSaleForm({ ...saleForm, invoiceIdentification: v })} placeholder="Ej: 1000000001" />
                      <Field label="Dirección" value={saleForm.invoiceAddress} onChange={v => setSaleForm({ ...saleForm, invoiceAddress: v })} placeholder="Dirección del cliente" />
                      <Field label="Correo para factura" type="email" value={saleForm.invoiceEmail} onChange={v => setSaleForm({ ...saleForm, invoiceEmail: v })} placeholder="cliente@email.com" />
                    </div>
                  </div>
                )}
              </div>
            )}

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

function ReceiptModal({ sale, currentUser, onClose }) {
  const isInvoice = sale.invoiceEnabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">{isInvoice ? 'Factura / comprobante' : 'Comprobante de venta'}</h3>
            <p className="text-sm text-slate-500">{sale.code} · {sale.date}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
        </div>

        <div className="p-6" id="receipt-print-area">
          <div className="mb-6 rounded-3xl bg-emerald-50 p-5">
            <h2 className="text-2xl font-extrabold text-emerald-900">{currentUser.store}</h2>
            <p className="text-sm text-emerald-800">Atendido por: {currentUser.name}</p>
            <p className="text-sm text-emerald-800">Ciudad: {currentUser.city}</p>
            {currentUser.businessId && <p className="text-sm text-emerald-800">RUC/ID: {currentUser.businessId}</p>}
            {currentUser.address && <p className="text-sm text-emerald-800">Dirección: {currentUser.address}</p>}
            {currentUser.phone && <p className="text-sm text-emerald-800">Teléfono: {currentUser.phone}</p>}
            {currentUser.commercialEmail && <p className="text-sm text-emerald-800">Correo: {currentUser.commercialEmail}</p>}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Comprobante</p>
              <p className="mt-1 font-bold text-slate-900">{sale.code}</p>
              <p className="text-sm text-slate-500">Estado: {sale.status}</p>
              <p className="text-sm text-slate-500">Pago: {sale.paymentMethod}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Cliente</p>
              <p className="mt-1 font-bold text-slate-900">{sale.customer || 'Consumidor final'}</p>
              {isInvoice ? (
                <div className="mt-1 text-sm text-slate-500">
                  <p>Cédula/RUC: {sale.invoiceIdentification || 'No registrado'}</p>
                  <p>Dirección: {sale.invoiceAddress || 'No registrada'}</p>
                  <p>Correo: {sale.invoiceEmail || 'No registrado'}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Venta a consumidor final</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Cant.</th>
                  <th className="px-4 py-3">Subtotal</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-4 font-bold text-slate-900">{sale.product}</td>
                  <td className="px-4 py-4">{sale.quantity}</td>
                  <td className="px-4 py-4">${sale.subtotal.toFixed(2)}</td>
                  <td className="px-4 py-4 font-bold">${sale.total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-5">
            <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><strong>${sale.subtotal.toFixed(2)}</strong></div>
            <div className="mt-2 flex justify-between text-sm text-slate-600"><span>Descuento</span><strong>-${sale.discount.toFixed(2)}</strong></div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-lg font-extrabold text-slate-900"><span>Total</span><span>${sale.total.toFixed(2)}</span></div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">{currentUser.receiptFooter || 'Gracias por su compra.'}</p>
          <p className="mt-2 text-center text-xs text-slate-400">Documento generado por InventiQ. Comprobante referencial para control interno.</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Cerrar</button>
          <button onClick={() => window.print()} className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Imprimir / guardar PDF</button>
        </div>
      </div>
    </div>
  );
}

function ProductsPage({ products, filtered, categories, productCategories, category, setCategory, form, setForm, saveProduct, resetForm, editProduct, editingId, notice, deleteProduct, pendingDeleteId, setPendingDeleteId, statusText, totalProducts, lowStock, noStock, inventoryValue, handleProductImage, productsLoading }) {
  return (
    <>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Package} label="Total productos" value={totalProducts} note="activos" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
        <Metric icon={DollarSign} label="Valor total inventario" value={`$${inventoryValue.toFixed(2)}`} note="valor aproximado" color="blue" />
      </section>

      {productsLoading && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando productos desde Supabase...</div>}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <ProductTable products={products} filtered={filtered} categories={categories} category={category} setCategory={setCategory} deleteProduct={deleteProduct} editProduct={editProduct} pendingDeleteId={pendingDeleteId} setPendingDeleteId={setPendingDeleteId} statusText={statusText} />
        <ProductForm form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editingId={editingId} notice={notice} productCategories={productCategories} handleProductImage={handleProductImage} />
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
  const criticalProducts = products.filter(p => p.stock === 0);
  const availableProducts = products.filter(p => p.stock > p.minStock);

  function exportInventory() {
    exportToCSV('inventiq_inventario.csv', products.map(product => ({
      SKU: product.sku,
      Producto: product.name,
      Categoria: product.category,
      Precio_venta: product.price,
      Costo: product.cost,
      Stock_actual: product.stock,
      Stock_minimo: product.minStock,
      Estado: statusText(product).label,
      Valor_inventario: (product.cost * product.stock).toFixed(2),
      Ganancia_potencial: ((product.price - product.cost) * product.stock).toFixed(2),
    })));
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric icon={DollarSign} label="Valor inventario" value={`$${inventoryValue.toFixed(2)}`} note="actual" color="blue" />
        <Metric icon={TrendingUp} label="Ganancia potencial" value={`$${potentialProfit.toFixed(2)}`} note="estimada" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-emerald-900">Control de inventario</h3>
            <p className="text-sm text-emerald-800">{availableProducts.length} productos disponibles, {alerts.length} con alerta y {criticalProducts.length} sin stock.</p>
          </div>
          <button onClick={exportInventory} className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
            <Download className="mr-2 inline h-5 w-5" />Exportar inventario
          </button>
        </div>
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

function ClientsPage({ clients, clientForm, setClientForm, saveClient, resetClientForm, editClient, deleteClient, editingClientId, pendingDeleteClientId, setPendingDeleteClientId, clientNotice, clientsLoading }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {clientsLoading && <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando clientes desde Supabase...</div>}
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
                  <p className="text-xs text-slate-400">{client.email || 'Sin correo'} · {client.purchases || 0} compras {client.wantsInvoice ? '· pide factura' : ''}</p>
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
          <Field label="Cédula / RUC" value={clientForm.identification} onChange={v => setClientForm({ ...clientForm, identification: v })} placeholder="Ej: 1000000001" />
          <Field label="Dirección" value={clientForm.address} onChange={v => setClientForm({ ...clientForm, address: v })} placeholder="Dirección para factura" />
          <Field label="Nombre para factura" value={clientForm.invoiceName} onChange={v => setClientForm({ ...clientForm, invoiceName: v })} placeholder="Nombre o razón social" />
          <label className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <input type="checkbox" checked={clientForm.wantsInvoice} onChange={e => setClientForm({ ...clientForm, wantsInvoice: e.target.checked })} className="h-4 w-4" />
            Cliente frecuente que solicita factura
          </label>
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

function ProvidersPage({ providers, providerForm, setProviderForm, saveProvider, resetProviderForm, editProvider, deleteProvider, editingProviderId, pendingDeleteProviderId, setPendingDeleteProviderId, providerNotice, productCategories, products, providersLoading }) {
  const lowStockProducts = products.filter(product => product.stock <= product.minStock);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-900"><AlertTriangle className="h-5 w-5" /> Proveedores sugeridos para reposición</h3>
        {lowStockProducts.length === 0 && <p className="text-sm text-amber-800">No existen productos con necesidad de reposición.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lowStockProducts.map(product => {
            const provider = providers.find(item => String(item.category || '').toLowerCase() === String(product.category || '').toLowerCase());
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
          {providersLoading && <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando proveedores desde Supabase...</div>}
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

function ReportsPage({ products, sales, purchases, clients, providers, totalSales, inventoryValue, potentialProfit, bestSeller, totalProfit }) {
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
    const category = String(product.category || '').toLowerCase();
    const name = String(product.name || '').toLowerCase();
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
  const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const netBalance = totalSales - totalPurchases;

  function exportSales() {
    exportToCSV('inventiq_ventas.csv', sales.map(sale => ({
      Codigo: sale.code,
      Producto: sale.product,
      Cliente: sale.customer,
      Cantidad: sale.quantity,
      Subtotal: sale.subtotal,
      Descuento: sale.discount,
      Total: sale.total,
      Utilidad: sale.profit,
      Estado: sale.status,
      Factura: sale.invoiceEnabled ? 'Si' : 'No',
      Fecha: sale.date,
    })));
  }

  function exportPurchases() {
    exportToCSV('inventiq_compras.csv', purchases.map(purchase => ({
      Codigo: purchase.code,
      Producto: purchase.product,
      Proveedor: purchase.provider,
      Cantidad: purchase.quantity,
      Costo_unitario: purchase.unitCost,
      Total: purchase.total,
      Nota: purchase.note,
      Fecha: purchase.date,
    })));
  }

  function exportRecommendations() {
    exportToCSV('inventiq_recomendaciones.csv', salesByProduct.map(product => ({
      Producto: product.name,
      Categoria: product.category,
      ABC: product.abc,
      Unidades_vendidas: product.unitsSold,
      Ingresos: product.revenue.toFixed(2),
      Utilidad: product.profit.toFixed(2),
      Stock: product.stock,
      Stock_minimo: product.minStock,
      Compra_sugerida: product.suggestedPurchase,
      Decision_compra: product.recommendation,
      Marketing: product.marketing,
    })));
  }

  function exportDirectory() {
    exportToCSV('inventiq_clientes_proveedores.csv', [
      ...clients.map(client => ({
        Tipo: 'Cliente',
        Nombre: client.name,
        Categoria: client.type,
        Contacto: client.phone,
        Correo: client.email,
        Identificacion: client.identification,
        Direccion: client.address,
        Observaciones: client.notes,
      })),
      ...providers.map(provider => ({
        Tipo: 'Proveedor',
        Nombre: provider.name,
        Categoria: provider.category,
        Contacto: provider.contact,
        Correo: '',
        Identificacion: '',
        Direccion: '',
        Observaciones: `Entrega: ${provider.delivery}. ${provider.notes || ''}`,
      })),
    ]);
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas" value={`$${totalSales.toFixed(2)}`} note="acumuladas" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad registrada" value={`$${totalProfit.toFixed(2)}`} note="estimada" color="blue" />
        <Metric icon={Package} label="Producto estrella" value={bestSeller} note="más vendido" color="amber" />
        <Metric icon={BarChart3} label="ABC" value={`A:${typeA} B:${typeB} C:${typeC}`} note="clasificación" color="red" />
        <Metric icon={ClipboardList} label="Compras" value={`$${totalPurchases.toFixed(2)}`} note="registradas" color="amber" />
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-emerald-900">Reportes exportables</h3>
            <p className="text-sm text-emerald-800">Descarga ventas, compras, recomendaciones y directorio de clientes/proveedores.</p>
            <p className={`mt-2 text-sm font-bold ${netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Balance ventas - compras: ${netBalance.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button onClick={exportSales} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Ventas</button>
            <button onClick={exportPurchases} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Compras</button>
            <button onClick={exportRecommendations} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Recomendaciones</button>
            <button onClick={exportDirectory} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Directorio</button>
          </div>
        </div>
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
          <Field label="RUC / identificación de la tienda" value={settingsForm.businessId} onChange={v => setSettingsForm({ ...settingsForm, businessId: v })} placeholder="Ej: 1000000001001" />
          <Field label="Dirección comercial" value={settingsForm.address} onChange={v => setSettingsForm({ ...settingsForm, address: v })} placeholder="Ej: Av. Principal y Calle 10" />
          <Field label="Teléfono de la tienda" value={settingsForm.phone} onChange={v => setSettingsForm({ ...settingsForm, phone: v })} placeholder="Ej: 099 000 0000" />
          <Field label="Correo comercial" type="email" value={settingsForm.commercialEmail} onChange={v => setSettingsForm({ ...settingsForm, commercialEmail: v })} placeholder="Ej: ventas@mitienda.com" />
          <Field label="Correo de acceso" type="email" value={settingsForm.username} onChange={v => setSettingsForm({ ...settingsForm, username: v })} placeholder="Correo electrónico" />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Texto al pie del comprobante</span>
            <textarea value={settingsForm.receiptFooter} onChange={e => setSettingsForm({ ...settingsForm, receiptFooter: e.target.value })} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Ej: Gracias por su compra." />
          </label>

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
          <p className="rounded-2xl bg-slate-50 p-4"><strong>Correo actual:</strong> {currentUser.email}</p>
          <p className="rounded-2xl bg-slate-50 p-4"><strong>RUC/ID:</strong> {currentUser.businessId || 'No registrado'}</p>
          <p className="rounded-2xl bg-slate-50 p-4"><strong>Dirección:</strong> {currentUser.address || 'No registrada'}</p>
          <p className="rounded-2xl bg-slate-50 p-4"><strong>Teléfono:</strong> {currentUser.phone || 'No registrado'}</p>
          <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">Estos datos aparecerán en el comprobante visual de ventas y facturas.</p>
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
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">📦</div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{product.category}</td>
                    <td className="px-5 py-4 font-medium">${Number(product.price || 0).toFixed(2)}</td>
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

function ProductForm({ form, setForm, saveProduct, resetForm, editingId, notice, productCategories, handleProductImage }) {
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          {form.imageUrl ? (
            <div className="space-y-3">
              <img src={form.imageUrl} alt="Vista previa del producto" className="mx-auto h-32 w-32 rounded-2xl object-cover shadow-sm" />
              <button type="button" onClick={() => setForm({ ...form, imageUrl: '', imageFile: null })} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Quitar imagen</button>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-700">Subir imagen</p>
              <p>PNG, JPG hasta 2MB</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={e => handleProductImage(e.target.files?.[0])} className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
        </div>
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
