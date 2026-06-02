import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  ADMIN_EMAILS,
  IMPORT_BATCH_SIZE,
  PRODUCT_SEARCH_LIMIT,
  MAX_LABELS_WITHOUT_CONFIRM,
} from './config/constants';
import { businessTypes, getBusinessConfig } from './config/businessTypes';
import {
  STORAGE_KEYS,
  loadFromStorage,
  saveToStorage,
  saveDraft,
  loadDraft,
  clearDraft,
} from './utils/storage';
import {
  getProductDisplayName,
  getProductVariantText,
  productMatchesSearch,
  searchProductsForPicker,
  chunkArray,
  validateExcelFile,
} from './utils/products';
import { exportToCSV } from './utils/csv';
import {
  generateInternalBarcode,
  printProductBarcodeLabel,
  printSelectedBarcodeLabels,
} from './utils/barcode';
import {
  normalizeExcelRow,
  getExcelValue,
  excelText,
  excelNumber,
  excelDate,
  downloadProductExcelTemplate,
} from './utils/excel';
import {
  fileToDataUrl,
  optimizeImageFile,
} from './utils/images';
import {
  parseInventiqDate,
  getPeriodRange,
  isRecordInPeriod,
  formatPeriodDate,
} from './utils/dates';

import {
  statusText,
  expirationText,
} from './utils/inventory';

import { validatePasswordSecurity } from './utils/auth';
import {
  mapProductFromDb,
  mapProductToDb,
  mapSaleFromDb,
  mapSaleToDb,
  mapSaleItemFromDb,
  mapSaleItemToDb,
  mapClientFromDb,
  mapClientToDb,
  mapProviderFromDb,
  mapProviderToDb,
  mapPurchaseFromDb,
  mapPurchaseToDb,
  mapPurchaseItemFromDb,
  mapPurchaseItemToDb,
} from './utils/mappers';

import {
  emptyForm,
  initialProducts,
  initialSales,
  initialClients,
  initialProviders,
  initialUsers,
  emptyLoginForm,
  emptyRegisterForm,
  emptyAdminCreateUserForm,
  emptyClientForm,
  emptyProviderForm,
  emptySettingsForm,
  emptyPurchaseForm,
  emptySaleForm,
} from './data/initialData';
import Field from './components/Field';
import Metric from './components/Metric';
import EmptyState from './components/EmptyState';
import PasswordSecurityHint from './components/PasswordSecurityHint';
import Benefit from './components/Benefit';
import MiniStat from './components/MiniStat';
import TableCard from './components/TableCard';
import ListRow from './components/ListRow';
import ReportRow from './components/ReportRow';
import DashboardKpi from './components/DashboardKpi';
import DashboardMiniStat from './components/DashboardMiniStat';
import QuickAction from './components/QuickAction';
import SummaryBox from './components/SummaryBox';
import DashboardListCard from './components/DashboardListCard';
import EmptyDashboardMessage from './components/EmptyDashboardMessage';
import AbcBadge from './components/AbcBadge';
import InventiQIcon from './components/InventiQIcon';
import SplashScreen from './components/SplashScreen';
import StoreAvatar from './components/StoreAvatar';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomNav from './components/MobileBottomNav';
import BarcodeScanner from './components/BarcodeScanner';
import ReceiptModal from './components/ReceiptModal';
import ExcelImportPreviewModal from './components/ExcelImportPreviewModal';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
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
  Camera,
  Printer,
  Upload,
} from 'lucide-react';


function isInventiQAdmin(user) {
  const email = String(user?.email || user?.username || '').trim().toLowerCase();
  return ADMIN_EMAILS.includes(email);
}

const menu = [
  { label: 'Inicio', icon: Home },
  { label: 'Ventas', icon: ShoppingCart },
  { label: 'Caja', icon: DollarSign },
  { label: 'Compras', icon: ClipboardList },
  { label: 'Productos', icon: Package },
  { label: 'Inventario', icon: Boxes },
  { label: 'Clientes', icon: Users },
  { label: 'Proveedores', icon: Truck },
  { label: 'Reportes', icon: BarChart3 },
  { label: 'Configuración', icon: Settings },
];

function getAvatarLetter(user) {
  const source = String(user?.store || user?.name || user?.email || 'InventiQ').trim();
  return source.charAt(0).toUpperCase() || 'I';
}

function getUsersFromStorage() {
  return loadFromStorage(STORAGE_KEYS.users, initialUsers);
}

function App() {
  const [users, setUsers] = useState(() => getUsersFromStorage());
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirmPassword: '' });
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
  const [saleCart, setSaleCart] = useState([]);
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
  const [purchaseCart, setPurchaseCart] = useState([]);
  const [purchaseNotice, setPurchaseNotice] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const [excelImportPreview, setExcelImportPreview] = useState(null);
  const [excelImportProgress, setExcelImportProgress] = useState(null);
  const [adminCreateUserForm, setAdminCreateUserForm] = useState(emptyAdminCreateUserForm);
  const [adminNotice, setAdminNotice] = useState(null);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, [showSplash]);

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
            logoUrl: '',
            businessType: 'general',
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
        if (_event === 'PASSWORD_RECOVERY') {
          setAuthMode('update-password');
          setAuthNotice({ type: 'success', message: 'Enlace validado. Ingresa tu nueva contraseña.' });
        }

        if (session?.user && _event !== 'PASSWORD_RECOVERY') {
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
            logoUrl: '',
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
      setForm(loadDraft(currentUser.id, 'productForm', emptyForm));
      setClientForm(loadDraft(currentUser.id, 'clientForm', emptyClientForm));
      setProviderForm(loadDraft(currentUser.id, 'providerForm', emptyProviderForm));
      setSaleForm(loadDraft(currentUser.id, 'saleForm', emptySaleForm));
      setSaleCart(loadDraft(currentUser.id, 'saleCart', []));
      setPurchaseForm(loadDraft(currentUser.id, 'purchaseForm', emptyPurchaseForm));
      setPurchaseCart(loadDraft(currentUser.id, 'purchaseCart', []));
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'productForm', form);
  }, [currentUser?.id, form]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'clientForm', clientForm);
  }, [currentUser?.id, clientForm]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'providerForm', providerForm);
  }, [currentUser?.id, providerForm]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'saleForm', saleForm);
  }, [currentUser?.id, saleForm]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'saleCart', saleCart);
  }, [currentUser?.id, saleCart]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'purchaseForm', purchaseForm);
  }, [currentUser?.id, purchaseForm]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'purchaseCart', purchaseCart);
  }, [currentUser?.id, purchaseCart]);

  // Configuración no se guarda como borrador para evitar sobrescribir datos reales de la tienda.
  // Siempre se carga desde currentUser / Supabase.

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
      .subscribe();

    // Respaldo liviano: si Realtime se pausa, sincroniza cada 45 segundos.
    const syncInterval = setInterval(refreshProducts, 45000);

    // También sincroniza cuando el usuario vuelve a la pestaña.
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshProducts();
    };
    window.addEventListener('focus', refreshProducts);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshProducts);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
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
      .subscribe();

    // Respaldo liviano: si Realtime se pausa, sincroniza cada 45 segundos.
    const syncInterval = setInterval(refreshSales, 45000);

    const refreshWhenVisible = () => {
      if (!document.hidden) refreshSales();
    };
    window.addEventListener('focus', refreshSales);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshSales);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
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
      .subscribe();

    const syncInterval = setInterval(refreshClients, 60000);
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshClients();
    };
    window.addEventListener('focus', refreshClients);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshClients);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
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
      .subscribe();

    const syncInterval = setInterval(refreshProviders, 60000);
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshProviders();
    };
    window.addEventListener('focus', refreshProviders);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshProviders);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
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
      .subscribe();

    const syncInterval = setInterval(refreshPurchases, 60000);
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshPurchases();
    };
    window.addEventListener('focus', refreshPurchases);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', refreshPurchases);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      clearDraft(currentUser.id, 'settingsForm');
      setSettingsForm({
        name: currentUser.name || '',
        store: currentUser.store || '',
        city: currentUser.city || '',
        businessType: currentUser.businessType || 'general',
        businessId: currentUser.businessId || '',
        address: currentUser.address || '',
        phone: currentUser.phone || '',
        commercialEmail: currentUser.commercialEmail || '',
        receiptFooter: currentUser.receiptFooter || 'Gracias por su compra.',
        logoUrl: currentUser.logoUrl || '',
        logoFile: null,
        username: currentUser.username || currentUser.email || '',
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
      logoUrl: profile?.logo_url || '',
      businessType: profile?.business_type || 'general',
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
      setAuthMode('login');
      setAuthNotice(null);
      setLoginForm(emptyLoginForm);
    }
  }

  async function register(e) {
    e.preventDefault();
    setAuthNotice({ type: 'error', message: 'El registro público está desactivado. Solicita la creación de tu cuenta al administrador de InventiQ.' });
  }

  async function createClientAccount(e) {
    e.preventDefault();

    if (!isInventiQAdmin(currentUser)) {
      setAdminNotice({ type: 'error', message: 'No tienes permisos para crear cuentas.' });
      return;
    }

    const name = adminCreateUserForm.name.trim();
    const store = adminCreateUserForm.store.trim();
    const city = adminCreateUserForm.city.trim();
    const businessType = adminCreateUserForm.businessType || 'general';
    const email = adminCreateUserForm.email.trim().toLowerCase();
    const password = adminCreateUserForm.password.trim();
    const confirmPassword = adminCreateUserForm.confirmPassword.trim();

    if (!name || !store || !city || !email || !password || !confirmPassword) {
      setAdminNotice({ type: 'error', message: 'Completa todos los campos para crear la cuenta del cliente.' });
      return;
    }

    if (!email.includes('@')) {
      setAdminNotice({ type: 'error', message: 'Ingresa un correo electrónico válido para el cliente.' });
      return;
    }

    if (password !== confirmPassword) {
      setAdminNotice({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    const passwordError = validatePasswordSecurity(password);
    if (passwordError) {
      setAdminNotice({ type: 'error', message: passwordError });
      return;
    }

    try {
      setAdminNotice({ type: 'success', message: 'Creando cuenta del cliente...' });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            owner_name: name,
            store_name: store,
            city,
            business_type: businessType,
          },
        },
      });

      if (error) {
        setAdminNotice({ type: 'error', message: error.message });
        return;
      }

      if (data?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          store_name: store,
          owner_name: name,
          city,
          business_type: businessType,
        });

        if (profileError) {
          setAdminNotice({ type: 'error', message: `La cuenta se creó, pero no se pudo guardar el perfil: ${profileError.message}` });
          return;
        }
      }

      setAdminCreateUserForm(emptyAdminCreateUserForm);
      setAdminNotice({ type: 'success', message: `Cuenta creada para ${store}. El cliente podrá ingresar con ${email}.` });
    } catch (error) {
      console.error('Error creando cuenta de cliente:', error);
      setAdminNotice({ type: 'error', message: `No se pudo crear la cuenta: ${error.message}` });
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    const email = resetEmail.trim();

    if (!email || !email.includes('@')) {
      setAuthNotice({ type: 'error', message: 'Ingresa un correo electrónico válido para recuperar tu contraseña.' });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setAuthNotice({ type: 'error', message: error.message || 'No se pudo enviar el correo de recuperación.' });
      return;
    }

    setAuthMode('login');
    setLoginForm({ ...loginForm, username: email });
    setResetEmail('');
    setAuthNotice({ type: 'success', message: 'Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.' });
  }

  async function updateRecoveredPassword(e) {
    e.preventDefault();
    const password = resetPasswordForm.password.trim();
    const confirmPassword = resetPasswordForm.confirmPassword.trim();

    if (!password || !confirmPassword) {
      setAuthNotice({ type: 'error', message: 'Ingresa y confirma la nueva contraseña.' });
      return;
    }

    const passwordError = validatePasswordSecurity(password);
    if (passwordError) {
      setAuthNotice({ type: 'error', message: passwordError });
      return;
    }

    if (password !== confirmPassword) {
      setAuthNotice({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setAuthNotice({ type: 'error', message: error.message || 'No se pudo actualizar la contraseña.' });
      return;
    }

    setResetPasswordForm({ password: '', confirmPassword: '' });
    setAuthMode('login');
    setAuthNotice({ type: 'success', message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    await supabase.auth.signOut();
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
  const storeProducts = useMemo(() => products.filter(product => (product.storeId || 'demo') === storeKey), [products, storeKey]);
  const storeSales = useMemo(() => sales.filter(sale => (sale.storeId || 'demo') === storeKey), [sales, storeKey]);
  const storeClients = useMemo(() => clients.filter(client => (client.storeId || 'demo') === storeKey), [clients, storeKey]);
  const storeProviders = useMemo(() => providers.filter(provider => (provider.storeId || 'demo') === storeKey), [providers, storeKey]);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(storeProducts.map(p => p.category).filter(Boolean)))], [storeProducts]);
  const productCategories = useMemo(() => categories.filter(cat => cat !== 'Todas'), [categories]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();

    return storeProducts.filter(p => {
      const matchSearch = !text || [
        p.name,
        p.sku,
        p.barcode,
        p.brand,
        p.size,
        p.color,
        p.category,
      ].some(value => String(value || '').toLowerCase().includes(text));
      const matchCategory = category === 'Todas' || p.category === category;
      return matchSearch && matchCategory;
    });
  }, [storeProducts, search, category]);

  const inventoryStats = useMemo(() => {
    const totalProducts = storeProducts.length;
    const lowStock = storeProducts.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const noStock = storeProducts.filter(p => p.stock === 0).length;
    const inventoryValue = storeProducts.reduce((sum, p) => sum + p.cost * p.stock, 0);
    const potentialProfit = storeProducts.reduce((sum, p) => sum + (p.price - p.cost) * p.stock, 0);
    return { totalProducts, lowStock, noStock, inventoryValue, potentialProfit };
  }, [storeProducts]);

  const salesStats = useMemo(() => {
    const totalSales = storeSales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = storeSales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalDiscount = storeSales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const totalUnitsSold = storeSales.reduce((sum, s) => sum + s.quantity, 0);
    const topProduct = storeSales.reduce((acc, sale) => {
      acc[sale.product] = (acc[sale.product] || 0) + sale.quantity;
      return acc;
    }, {});
    const bestSeller = Object.entries(topProduct).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin ventas';
    return { totalSales, totalProfit, totalDiscount, totalUnitsSold, bestSeller };
  }, [storeSales]);

  const { totalProducts, lowStock, noStock, inventoryValue, potentialProfit } = inventoryStats;
  const { totalSales, totalProfit, totalDiscount, totalUnitsSold, bestSeller } = salesStats;

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setNotice(null);
    clearDraft(currentUser?.id, 'productForm');
  }

  function validateProduct(finalCategory, price, cost, stock, minStock) {
    if (!form.name.trim()) return 'Ingresa el nombre del producto.';
    if (!finalCategory.trim()) return 'Selecciona o crea una categoría.';
    if (Number.isNaN(price) || price <= 0) return 'El precio de venta debe ser mayor a 0.';
    if (Number.isNaN(cost) || cost < 0) return 'El costo no puede ser negativo. Si no lo conoces, déjalo vacío.';
    if (Number.isNaN(stock) || stock < 0) return 'El stock no puede ser negativo.';
    if (Number.isNaN(minStock) || minStock < 0) return 'El stock mínimo no puede ser negativo.';
    if (cost > 0 && cost > price) return 'El costo no debería ser mayor al precio de venta.';
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

    const saleIds = (data || []).map(sale => sale.id);
    let itemsBySale = {};

    if (saleIds.length > 0) {
      const { data: itemData, error: itemError } = await supabase
        .from('sale_items')
        .select('*')
        .in('sale_id', saleIds);

      if (!itemError) {
        itemsBySale = (itemData || []).reduce((acc, item) => {
          const mapped = mapSaleItemFromDb(item);
          acc[mapped.saleId] = acc[mapped.saleId] || [];
          acc[mapped.saleId].push(mapped);
          return acc;
        }, {});
      } else {
        console.error('Error cargando detalle de ventas:', itemError);
      }
    }

    setSales((data || []).map(sale => ({ ...mapSaleFromDb(sale), items: itemsBySale[sale.id] || [] })));
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

    const purchaseIds = (data || []).map(purchase => purchase.id);
    let itemsByPurchase = {};

    if (purchaseIds.length > 0) {
      const { data: itemData, error: itemError } = await supabase
        .from('purchase_items')
        .select('*')
        .in('purchase_id', purchaseIds);

      if (!itemError) {
        itemsByPurchase = (itemData || []).reduce((acc, item) => {
          const mapped = mapPurchaseItemFromDb(item);
          acc[mapped.purchaseId] = acc[mapped.purchaseId] || [];
          acc[mapped.purchaseId].push(mapped);
          return acc;
        }, {});
      } else {
        console.error('Error cargando detalle de compras:', itemError);
      }
    }

    setPurchases((data || []).map(purchase => ({ ...mapPurchaseFromDb(purchase), items: itemsByPurchase[purchase.id] || [] })));
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
      barcode: form.barcode.trim(),
      brand: form.brand.trim(),
      size: form.size.trim(),
      color: form.color.trim(),
      name: form.name.trim(),
      category: finalCategory,
      price,
      cost,
      stock,
      minStock,
      status: stock === 0 ? 'Inactivo' : 'Activo',
      description: form.description.trim(),
      batchNumber: form.batchNumber.trim(),
      entryDate: form.entryDate || '',
      expirationDate: form.expirationDate || '',
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
    clearDraft(currentUser?.id, 'productForm');
  }

  async function importProductsFromExcel(file) {
    if (!file || !currentUser?.id) return;

    const fileError = validateExcelFile(file);
    if (fileError) {
      setNotice({ type: 'error', message: fileError });
      return;
    }

    try {
      setNotice({ type: 'success', message: 'Leyendo Excel de productos...' });
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const businessType = currentUser.businessType || 'general';
      const businessConfig = getBusinessConfig(businessType);
      const normalizedRows = rawRows.map(normalizeExcelRow);
      const existingCodes = new Set(storeProducts.flatMap(product => [product.sku, product.barcode]).filter(Boolean).map(value => String(value).trim().toLowerCase()));
      const productsToImport = [];
      const skippedRows = [];

      normalizedRows.forEach((row, index) => {
        const name = excelText(getExcelValue(row, ['nombre del producto', 'producto', 'nombre', 'nombre_producto']));
        const category = excelText(getExcelValue(row, ['categoria', 'categoría', 'category'], businessType === 'ropa' ? 'Ropa' : 'General'));
        const price = excelNumber(getExcelValue(row, ['precio de venta', 'precio venta', 'precio_venta', 'precio', 'pvp']), 0);
        const cost = excelNumber(getExcelValue(row, ['costo unitario', 'costo', 'costo opcional', 'precio costo', 'precio_costo']), 0);
        const stock = excelNumber(getExcelValue(row, ['stock actual', 'stock', 'cantidad', 'existencia']), 0);
        const minStock = excelNumber(getExcelValue(row, ['stock minimo', 'stock mínimo', 'minimo', 'mínimo', 'stock_minimo']), 1);
        const skuRaw = excelText(getExcelValue(row, ['sku', 'codigo almacen', 'código almacén', 'codigo', 'código', 'codigo interno', 'codigo sku']));
        const barcodeRaw = excelText(getExcelValue(row, ['codigo de barras', 'código de barras', 'barcode', 'barra']));
        const generatedCode = skuRaw || barcodeRaw || generateInternalBarcode(businessType);
        const sku = skuRaw || generatedCode;
        const barcode = barcodeRaw || generatedCode;

        if (!name) {
          skippedRows.push(`Fila ${index + 2}: sin nombre de producto`);
          return;
        }

        if (!category) {
          skippedRows.push(`Fila ${index + 2}: sin categoría`);
          return;
        }

        if (price <= 0) {
          skippedRows.push(`Fila ${index + 2}: precio de venta inválido`);
          return;
        }

        const codeKey = String(barcode || sku).trim().toLowerCase();
        if (codeKey && existingCodes.has(codeKey)) {
          skippedRows.push(`Fila ${index + 2}: código duplicado (${barcode || sku})`);
          return;
        }
        if (codeKey) existingCodes.add(codeKey);

        productsToImport.push({
          storeId: storeKey,
          storeName: currentUser.store,
          sku,
          barcode,
          brand: excelText(getExcelValue(row, ['marca', 'brand'])),
          size: excelText(getExcelValue(row, ['talla', 'medida', 'presentacion', 'presentación', 'size'])),
          color: excelText(getExcelValue(row, ['color', 'modelo', 'especificacion', 'especificación'])),
          name,
          category,
          price,
          cost,
          stock,
          minStock,
          status: stock === 0 ? 'Inactivo' : 'Activo',
          description: excelText(getExcelValue(row, ['descripcion', 'descripción', 'detalle', 'description'])),
          batchNumber: excelText(getExcelValue(row, ['lote', 'batch', 'batch number'])),
          entryDate: excelDate(getExcelValue(row, ['fecha de ingreso', 'fecha ingreso', 'ingreso'])),
          expirationDate: businessConfig.usesExpiration ? excelDate(getExcelValue(row, ['fecha de caducidad', 'fecha caducidad', 'caducidad', 'vencimiento'])) : '',
          imageUrl: excelText(getExcelValue(row, ['foto producto', 'foto', 'imagen', 'image_url', 'url imagen'])),
        });
      });

      if (productsToImport.length === 0) {
        setExcelImportPreview(null);
        setNotice({ type: 'error', message: `No se encontró ningún producto válido. ${skippedRows.slice(0, 3).join(' · ')}` });
        return;
      }

      setExcelImportPreview({
        fileName: file.name,
        totalRows: rawRows.length,
        products: productsToImport,
        skippedRows,
      });
      setNotice({ type: 'success', message: `Vista previa lista: ${productsToImport.length} producto(s) válidos. Revisa y confirma antes de importar.` });
    } catch (error) {
      console.error('Error leyendo Excel:', error);
      setExcelImportPreview(null);
      setNotice({ type: 'error', message: `No se pudo leer el Excel. Revisa el formato del archivo o instala la librería xlsx. Detalle: ${error.message}` });
    }
  }

  async function confirmExcelImport() {
    if (!excelImportPreview?.products?.length || !currentUser?.id) return;

    const total = excelImportPreview.products.length;
    const chunks = chunkArray(excelImportPreview.products, IMPORT_BATCH_SIZE);
    let imported = 0;

    try {
      setExcelImportProgress({ imported: 0, total, batch: 0, batches: chunks.length });
      setNotice({ type: 'success', message: `Importando ${total} producto(s) por bloques...` });

      for (let index = 0; index < chunks.length; index += 1) {
        const payload = chunks[index].map(product => mapProductToDb(product, currentUser.id));
        const { error } = await supabase.from('products').insert(payload);

        if (error) {
          console.error('Error importando bloque:', error);
          setNotice({ type: 'error', message: `No se pudo importar el bloque ${index + 1} de ${chunks.length}: ${error.message}. Productos importados antes del error: ${imported}.` });
          setExcelImportProgress(null);
          await loadProductsFromSupabase(currentUser.id, false);
          return;
        }

        imported += chunks[index].length;
        setExcelImportProgress({ imported, total, batch: index + 1, batches: chunks.length });
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      await loadProductsFromSupabase(currentUser.id, false);
      const skippedMessage = excelImportPreview.skippedRows.length > 0 ? ` Se omitieron ${excelImportPreview.skippedRows.length} fila(s).` : '';
      setNotice({ type: 'success', message: `Se importaron ${imported} producto(s) correctamente por bloques.${skippedMessage}` });
      setExcelImportPreview(null);
      setExcelImportProgress(null);
    } catch (error) {
      console.error('Error confirmando importación:', error);
      setExcelImportProgress(null);
      setNotice({ type: 'error', message: `No se pudo completar la importación: ${error.message}` });
    }
  }

  function cancelExcelImport() {
    setExcelImportPreview(null);
    setExcelImportProgress(null);
    setNotice({ type: 'success', message: 'Importación cancelada. No se guardó ningún producto.' });
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
      barcode: product.barcode || '',
      brand: product.brand || '',
      size: product.size || '',
      color: product.color || '',
      description: product.description || '',
      batchNumber: product.batchNumber || '',
      entryDate: product.entryDate || '',
      expirationDate: product.expirationDate || '',
      imageUrl: product.imageUrl || '',
      imageFile: null,
    });
  }

  async function uploadStoreLogo(file) {
    if (!file) return settingsForm.logoUrl || currentUser.logoUrl || '';

    const extension = file.name.split('.').pop() || 'png';
    const filePath = `${currentUser.id}/logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('store-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error subiendo logo:', uploadError);
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from('store-logos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleStoreLogo(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSettingsNotice({ type: 'error', message: 'Selecciona una imagen válida para el logo.' });
      return;
    }

    try {
      setSettingsNotice({ type: 'success', message: 'Optimizando logo...' });
      const optimizedFile = await optimizeImageFile(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 });
      const previewUrl = await fileToDataUrl(optimizedFile);
      setSettingsForm(prev => ({ ...prev, logoUrl: previewUrl, logoFile: optimizedFile }));
      setSettingsNotice({ type: 'success', message: `Logo optimizado. Peso final: ${(optimizedFile.size / 1024).toFixed(0)} KB.` });
    } catch (error) {
      console.error('Error optimizando logo:', error);
      setSettingsNotice({ type: 'error', message: 'No se pudo optimizar el logo. Intenta con otra imagen.' });
    }
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

  async function handleProductImage(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', message: 'Selecciona un archivo de imagen válido.' });
      return;
    }

    try {
      setNotice({ type: 'success', message: 'Optimizando imagen del producto...' });
      const optimizedFile = await optimizeImageFile(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.82 });
      const previewUrl = await fileToDataUrl(optimizedFile);
      setForm(prev => ({ ...prev, imageUrl: previewUrl, imageFile: optimizedFile }));
      setNotice({ type: 'success', message: `Imagen optimizada. Peso final: ${(optimizedFile.size / 1024).toFixed(0)} KB.` });
    } catch (error) {
      console.error('Error optimizando imagen:', error);
      setNotice({ type: 'error', message: 'No se pudo optimizar la imagen. Intenta con otra foto.' });
    }
  }

  function calculateSalePreview() {
    const selectedProduct = storeProducts.find(p => String(p.id) === String(saleForm.productId));
    const quantity = Number(saleForm.quantity || 0);
    const discountValue = Number(saleForm.discount || 0);
    const discountType = saleForm.discountType || 'percent';

    const subtotal = saleCart.reduce((sum, item) => sum + item.subtotal, 0);
    let discountAmount = 0;
    let safeDiscountPercent = 0;

    if (discountType === 'fixed') {
      discountAmount = Math.min(Math.max(discountValue, 0), subtotal);
      safeDiscountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    } else {
      safeDiscountPercent = Math.min(Math.max(discountValue, 0), 100);
      discountAmount = subtotal * (safeDiscountPercent / 100);
    }

    const total = subtotal - discountAmount;
    const cartCost = saleCart.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const profit = total - cartCost;

    let error = null;
    if (discountValue < 0) error = 'El descuento no puede ser negativo.';
    if (discountType === 'percent' && discountValue > 100) error = 'El descuento porcentual no puede ser mayor al 100%.';
    if (discountType === 'fixed' && discountValue > subtotal) error = 'El descuento en dólares no puede ser mayor al subtotal.';

    return { product: selectedProduct || null, quantity, subtotal, discountType, discountPercent: safeDiscountPercent, discount: discountAmount, total, profit, error };
  }

  function addSaleItem() {
    const product = storeProducts.find(p => String(p.id) === String(saleForm.productId));
    const quantity = Number(saleForm.quantity || 0);

    if (!product) {
      setSaleNotice({ type: 'error', message: 'Selecciona un producto para agregar al carrito.' });
      return;
    }

    if (quantity <= 0 || Number.isNaN(quantity)) {
      setSaleNotice({ type: 'error', message: 'La cantidad debe ser mayor a 0.' });
      return;
    }

    const currentInCart = saleCart
      .filter(item => String(item.productId) === String(product.id))
      .reduce((sum, item) => sum + item.quantity, 0);

    if (quantity + currentInCart > product.stock) {
      setSaleNotice({ type: 'error', message: `No puedes agregar ${quantity} unidades. Stock disponible: ${product.stock - currentInCart}.` });
      return;
    }

    const existing = saleCart.find(item => String(item.productId) === String(product.id));

    if (existing) {
      setSaleCart(saleCart.map(item => String(item.productId) === String(product.id)
        ? {
          ...item,
          quantity: item.quantity + quantity,
          subtotal: product.price * (item.quantity + quantity),
          profit: (product.price - product.cost) * (item.quantity + quantity),
        }
        : item
      ));
    } else {
      setSaleCart([
        ...saleCart,
        {
          productId: product.id,
          product: getProductDisplayName(product),
          quantity,
          price: product.price,
          cost: product.cost,
          subtotal: product.price * quantity,
          profit: (product.price - product.cost) * quantity,
        },
      ]);
    }

    setSaleForm({ ...saleForm, productId: '', quantity: 1 });
    setSaleNotice(null);
  }

  function removeSaleItem(productId) {
    setSaleCart(saleCart.filter(item => String(item.productId) !== String(productId)));
  }

  function clearSaleCart() {
    setSaleCart([]);
  }

  function addPurchaseItem() {
    const product = storeProducts.find(p => String(p.id) === String(purchaseForm.productId));
    const quantity = Number(purchaseForm.quantity || 0);
    const unitCost = Number(purchaseForm.unitCost || product?.cost || 0);

    if (!product) {
      setPurchaseNotice({ type: 'error', message: 'Selecciona un producto para agregar a la compra.' });
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

    const existing = purchaseCart.find(item => String(item.productId) === String(product.id));

    if (existing) {
      setPurchaseCart(purchaseCart.map(item => String(item.productId) === String(product.id)
        ? {
          ...item,
          quantity: item.quantity + quantity,
          unitCost,
          total: (item.quantity + quantity) * unitCost,
        }
        : item
      ));
    } else {
      setPurchaseCart([
        ...purchaseCart,
        {
          productId: product.id,
          product: getProductDisplayName(product),
          quantity,
          unitCost,
          total: quantity * unitCost,
        },
      ]);
    }

    setPurchaseForm({ ...purchaseForm, productId: '', quantity: 1, unitCost: '' });
    setPurchaseNotice(null);
  }

  function removePurchaseItem(productId) {
    setPurchaseCart(purchaseCart.filter(item => String(item.productId) !== String(productId)));
  }

  function clearPurchaseCart() {
    setPurchaseCart([]);
  }

  async function registerPurchase(e) {
    e.preventDefault();

    const provider = storeProviders.find(p => String(p.id) === String(purchaseForm.providerId));

    if (purchaseCart.length === 0) {
      setPurchaseNotice({ type: 'error', message: 'Agrega al menos un producto a la compra.' });
      return;
    }

    if (!currentUser?.id) {
      setPurchaseNotice({ type: 'error', message: 'No existe una sesión activa.' });
      return;
    }

    const totalQuantity = purchaseCart.reduce((sum, item) => sum + item.quantity, 0);
    const total = purchaseCart.reduce((sum, item) => sum + item.total, 0);
    const productSummary = purchaseCart.length === 1 ? purchaseCart[0].product : `${purchaseCart.length} productos`;

    const newPurchase = {
      code: `C-${String(purchases.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      productId: purchaseCart.length === 1 ? purchaseCart[0].productId : null,
      providerId: provider?.id || null,
      product: productSummary,
      provider: provider?.name || 'Sin proveedor',
      quantity: totalQuantity,
      unitCost: purchaseCart.length === 1 ? purchaseCart[0].unitCost : 0,
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

    const itemsPayload = purchaseCart.map(item => mapPurchaseItemToDb(item, purchaseData.id, currentUser.id));
    const { error: itemsError } = await supabase.from('purchase_items').insert(itemsPayload);

    if (itemsError) {
      console.error('Error guardando detalle de compra:', itemsError);
      setPurchaseNotice({ type: 'error', message: `La compra se creó, pero no se guardó el detalle: ${itemsError.message}` });
      return;
    }

    for (const item of purchaseCart) {
      const product = storeProducts.find(p => String(p.id) === String(item.productId));
      if (!product) continue;

      const newStock = product.stock + item.quantity;
      const newStatus = newStock === 0 ? 'Inactivo' : 'Activo';

      const { error: productError } = await supabase
        .from('products')
        .update({ stock: newStock, cost: item.unitCost || product.cost, status: newStatus })
        .eq('id', product.id)
        .eq('user_id', currentUser.id);

      if (productError) {
        console.error('Error actualizando stock por compra:', productError);
        setPurchaseNotice({ type: 'error', message: `La compra se registró, pero no se pudo actualizar el stock de ${product.name}: ${productError.message}` });
        await loadPurchasesFromSupabase(currentUser.id, false);
        await loadProductsFromSupabase(currentUser.id, false);
        return;
      }
    }

    setPurchaseForm(emptyPurchaseForm);
    setPurchaseCart([]);
    clearDraft(currentUser?.id, 'purchaseForm');
    clearDraft(currentUser?.id, 'purchaseCart');
    setPurchaseNotice({ type: 'success', message: `Compra ${newPurchase.code} registrada con ${purchaseCart.length} producto(s). Stock actualizado en Supabase.` });
    await loadPurchasesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
  }

  function resetPurchaseForm() {
    setPurchaseForm(emptyPurchaseForm);
    setPurchaseCart([]);
    setPurchaseNotice(null);
    clearDraft(currentUser?.id, 'purchaseForm');
    clearDraft(currentUser?.id, 'purchaseCart');
  }

  async function registerSale(e) {
    e.preventDefault();
    const preview = calculateSalePreview();
    const { discount, discountPercent, subtotal, total, profit, error } = preview;

    if (saleCart.length === 0) {
      setSaleNotice({ type: 'error', message: 'Agrega al menos un producto al carrito.' });
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

    for (const item of saleCart) {
      const product = storeProducts.find(p => String(p.id) === String(item.productId));
      if (!product) {
        setSaleNotice({ type: 'error', message: `No se encontró el producto ${item.product}.` });
        return;
      }
      if (item.quantity > product.stock) {
        setSaleNotice({ type: 'error', message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}.` });
        return;
      }
    }

    const totalQuantity = saleCart.reduce((sum, item) => sum + item.quantity, 0);
    const productSummary = saleCart.length === 1 ? saleCart[0].product : `${saleCart.length} productos`;

    const newSale = {
      code: `V-${String(storeSales.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      storeName: currentUser.store,
      productId: saleCart.length === 1 ? saleCart[0].productId : null,
      product: productSummary,
      customer: saleForm.saleType === 'factura' ? (saleForm.customer || saleForm.invoiceName || 'Cliente con factura') : 'Consumidor final',
      paymentMethod: saleForm.paymentMethod,
      invoiceEnabled: saleForm.saleType === 'factura' && saleForm.invoiceEnabled,
      invoiceName: saleForm.saleType === 'factura' ? (saleForm.invoiceName || saleForm.customer || '') : '',
      invoiceIdentification: saleForm.saleType === 'factura' ? (saleForm.invoiceIdentification || '') : '',
      invoiceAddress: saleForm.saleType === 'factura' ? (saleForm.invoiceAddress || '') : '',
      invoiceEmail: saleForm.saleType === 'factura' ? (saleForm.invoiceEmail || '') : '',
      quantity: totalQuantity,
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

    const itemsPayload = saleCart.map(item => mapSaleItemToDb(item, saleData.id, currentUser.id));
    const { error: itemsError } = await supabase.from('sale_items').insert(itemsPayload);

    if (itemsError) {
      console.error('Error guardando detalle de venta:', itemsError);
      setSaleNotice({ type: 'error', message: `La venta se creó, pero no se guardó el detalle: ${itemsError.message}` });
      return;
    }

    for (const item of saleCart) {
      const product = storeProducts.find(p => String(p.id) === String(item.productId));
      const newStock = product.stock - item.quantity;
      const newStatus = newStock === 0 ? 'Inactivo' : 'Activo';

      const { error: productError } = await supabase
        .from('products')
        .update({ stock: newStock, status: newStatus })
        .eq('id', product.id)
        .eq('user_id', currentUser.id);

      if (productError) {
        console.error('Error actualizando stock:', productError);
        setSaleNotice({ type: 'error', message: `La venta se registró, pero no se pudo actualizar el stock de ${product.name}: ${productError.message}` });
        await loadSalesFromSupabase(currentUser.id, false);
        await loadProductsFromSupabase(currentUser.id, false);
        return;
      }
    }

    setSaleForm(emptySaleForm);
    setSaleCart([]);
    clearDraft(currentUser?.id, 'saleForm');
    clearDraft(currentUser?.id, 'saleCart');
    setSaleNotice({ type: 'success', message: `Venta ${newSale.code} registrada correctamente con ${saleCart.length} producto(s).` });
    await loadSalesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
  }

  async function cancelSale(id) {
    const sale = storeSales.find(s => s.id === id);
    if (!sale || !currentUser?.id) return;

    const items = sale.items?.length > 0
      ? sale.items
      : [{ productId: sale.productId, product: sale.product, quantity: sale.quantity }];

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

    for (const item of items) {
      const product = products.find(p => String(p.id) === String(item.productId));
      if (!product) continue;

      const restoredStock = product.stock + item.quantity;
      const { error: productError } = await supabase
        .from('products')
        .update({ stock: restoredStock, status: 'Activo' })
        .eq('id', product.id)
        .eq('user_id', currentUser.id);

      if (productError) {
        console.error('Error devolviendo stock:', productError);
        setSaleNotice({ type: 'error', message: `Venta anulada, pero no se pudo devolver stock de ${product.name}: ${productError.message}` });
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
    setSaleCart([]);
    setSaleNotice(null);
    clearDraft(currentUser?.id, 'saleForm');
    clearDraft(currentUser?.id, 'saleCart');
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

  async function adjustProductStock(productId, newStockValue, reason) {
    if (!currentUser?.id) throw new Error('No existe una sesión activa.');

    const stock = Number(newStockValue);
    if (Number.isNaN(stock) || stock < 0) {
      throw new Error('El stock contado debe ser un número igual o mayor a 0.');
    }

    const status = stock === 0 ? 'Inactivo' : 'Activo';
    const { error } = await supabase
      .from('products')
      .update({ stock, status })
      .eq('id', productId)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error ajustando stock:', error);
      throw new Error(error.message);
    }

    await loadProductsFromSupabase(currentUser.id, false);
    return reason;
  }

  function resetClientForm() {
    setClientForm(emptyClientForm);
    setEditingClientId(null);
    setClientNotice(null);
    clearDraft(currentUser?.id, 'clientForm');
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
    clearDraft(currentUser?.id, 'clientForm');
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
    clearDraft(currentUser?.id, 'providerForm');
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
      contact: providerForm.contact.trim() || 'Sin teléfono',
      email: providerForm.email.trim(),
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
    clearDraft(currentUser?.id, 'providerForm');
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
      email: provider.email || '',
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
    const businessType = settingsForm.businessType || 'general';
    const email = settingsForm.username.trim();
    const businessId = settingsForm.businessId.trim();
    const address = settingsForm.address.trim();
    const phone = settingsForm.phone.trim();
    const commercialEmail = settingsForm.commercialEmail.trim();
    const receiptFooter = settingsForm.receiptFooter.trim();
    const currentPassword = settingsForm.currentPassword.trim();
    let logoUrl = settingsForm.logoUrl || currentUser.logoUrl || '';

    if (settingsForm.logoFile) {
      try {
        setSettingsNotice({ type: 'success', message: 'Subiendo logo de la tienda...' });
        logoUrl = await uploadStoreLogo(settingsForm.logoFile);
      } catch (error) {
        setSettingsNotice({ type: 'error', message: `No se pudo subir el logo: ${error.message}` });
        return;
      }
    }
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

      const passwordValidationError = validatePasswordSecurity(newPassword);
      if (passwordValidationError) {
        setSettingsNotice({ type: 'error', message: passwordValidationError });
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

      const { error: updatePasswordError } = await supabase.auth.updateUser({ password: newPassword });
      if (updatePasswordError) {
        setSettingsNotice({ type: 'error', message: updatePasswordError.message });
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
        business_type: businessType,
        business_id: businessId,
        address,
        phone,
        commercial_email: commercialEmail,
        receipt_footer: receiptFooter || 'Gracias por su compra.',
        logo_url: logoUrl,
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
      businessType,
      businessId,
      address,
      phone,
      commercialEmail,
      receiptFooter: receiptFooter || 'Gracias por su compra.',
      logoUrl,
      email,
      username: email,
    };

    setCurrentUser(updatedUser);
    setSettingsForm({
      name,
      store,
      city,
      businessType,
      businessId,
      address,
      phone,
      commercialEmail,
      receiptFooter: receiptFooter || 'Gracias por su compra.',
      logoUrl,
      logoFile: null,
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
    Caja: { title: 'Caja', subtitle: 'Controla cierres, cortes y métodos de pago por periodo.', icon: DollarSign },
    Compras: { title: 'Compras', subtitle: 'Registra compras a proveedores y aumenta stock.', icon: ClipboardList },
    Productos: { title: 'Productos', subtitle: 'Administra los productos de tu tienda fácilmente.', icon: Package },
    Inventario: { title: 'Inventario', subtitle: 'Controla stock, alertas y valor de inventario.', icon: Boxes },
    Clientes: { title: 'Clientes', subtitle: 'Administra clientes frecuentes de la tienda.', icon: Users },
    Proveedores: { title: 'Proveedores', subtitle: 'Organiza proveedores y entregas estimadas.', icon: Truck },
    Reportes: { title: 'Reportes', subtitle: 'Analiza ventas, utilidad y decisiones de compra.', icon: BarChart3 },
    Configuración: { title: 'Configuración', subtitle: 'Ajusta datos generales de la tienda.', icon: Settings },
    Admin: { title: 'Panel administrador', subtitle: 'Crea y controla cuentas de clientes de InventiQ.', icon: UserPlus },
  }[active] || { title: 'Inicio', subtitle: 'Resumen general de tu tienda.', icon: Home };

  const visibleMenu = isInventiQAdmin(currentUser) ? [...menu, { label: 'Admin', icon: UserPlus }] : menu;

  const HeaderIcon = pageInfo.icon;

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!currentUser || authMode === 'update-password') {
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
        resetEmail={resetEmail}
        setResetEmail={setResetEmail}
        resetPassword={resetPassword}
        resetPasswordForm={resetPasswordForm}
        setResetPasswordForm={setResetPasswordForm}
        updateRecoveredPassword={updateRecoveredPassword}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MobileTopBar currentUser={currentUser} logout={logout} active={active} />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="sticky top-0 hidden h-screen overflow-y-auto lg:flex flex-col bg-gradient-to-b from-emerald-950 to-teal-950 text-white p-6">
          <div className="flex-1">
            <div className="mb-10 flex items-center gap-3">
              <InventiQIcon className="h-14 w-14 rounded-2xl object-cover shadow-md" />
              <div>
                <h1 className="text-2xl font-bold">InventiQ</h1>
                <p className="text-sm text-emerald-100">Controla tu inventario</p>
              </div>
            </div>
            <nav className="space-y-2">
              {visibleMenu.map(item => {
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

          <div className="sticky bottom-0 mt-6 space-y-5 border-t border-white/10 bg-teal-950/95 pt-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <StoreAvatar currentUser={currentUser} size="md" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{currentUser.name}</p>
                <p className="truncate text-sm text-emerald-100">{currentUser.store}</p>
              </div>
            </div>
            <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-emerald-50 hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="p-3 pb-32 pt-[calc(env(safe-area-inset-top)+5.25rem)] sm:p-6 sm:pb-28 sm:pt-20 lg:p-8 lg:pb-8 lg:pt-8">
          <header className="mb-5 flex flex-col gap-4 rounded-[1.5rem] bg-white/70 p-3 shadow-sm backdrop-blur sm:mb-8 sm:bg-transparent sm:p-0 sm:shadow-none lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><HeaderIcon className="h-8 w-8" /></div>
              <div>
                <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{pageInfo.title}</h2>
                <p className="text-sm text-slate-500 sm:text-base">{pageInfo.subtitle}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{currentUser.store} · {currentUser.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setActive('Productos')} className="hidden rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 sm:inline-flex sm:items-center"><Plus className="mr-2 h-5 w-5" />Agregar producto</button>
            </div>
          </header>

          {active === 'Inicio' && <HomePage currentUser={currentUser} totalSales={totalSales} totalProducts={totalProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} sales={storeSales} products={storeProducts} bestSeller={bestSeller} totalProfit={totalProfit} setActive={setActive} expirationText={expirationText} />}
          {active === 'Ventas' && <SalesPage sales={storeSales} products={storeProducts} clients={storeClients} saleForm={saleForm} setSaleForm={setSaleForm} saleCart={saleCart} addSaleItem={addSaleItem} removeSaleItem={removeSaleItem} clearSaleCart={clearSaleCart} registerSale={registerSale} resetSaleForm={resetSaleForm} cancelSale={cancelSale} totalSales={totalSales} totalProfit={totalProfit} totalDiscount={totalDiscount} totalUnitsSold={totalUnitsSold} saleNotice={saleNotice} salePreview={calculateSalePreview()} salesLoading={salesLoading} setReceiptSale={setReceiptSale} />}
          {active === 'Caja' && <CashPage sales={storeSales} purchases={purchases} />}
          {active === 'Compras' && <PurchasesPage purchases={purchases} products={storeProducts} providers={storeProviders} purchaseForm={purchaseForm} setPurchaseForm={setPurchaseForm} purchaseCart={purchaseCart} addPurchaseItem={addPurchaseItem} removePurchaseItem={removePurchaseItem} clearPurchaseCart={clearPurchaseCart} registerPurchase={registerPurchase} resetPurchaseForm={resetPurchaseForm} purchaseNotice={purchaseNotice} purchasesLoading={purchasesLoading} />}
          {active === 'Productos' && <ProductsPage currentUser={currentUser} products={storeProducts} filtered={filtered} categories={categories} productCategories={productCategories} category={category} setCategory={setCategory} form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editProduct={editProduct} editingId={editingId} notice={notice} deleteProduct={deleteProduct} pendingDeleteId={pendingDeleteId} setPendingDeleteId={setPendingDeleteId} statusText={statusText} expirationText={expirationText} totalProducts={totalProducts} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} handleProductImage={handleProductImage} productsLoading={productsLoading} importProductsFromExcel={importProductsFromExcel} excelImportPreview={excelImportPreview} confirmExcelImport={confirmExcelImport} cancelExcelImport={cancelExcelImport} excelImportProgress={excelImportProgress} />}
          {active === 'Inventario' && <InventoryPage currentUser={currentUser} products={storeProducts} sales={storeSales} purchases={purchases} lowStock={lowStock} noStock={noStock} inventoryValue={inventoryValue} potentialProfit={potentialProfit} statusText={statusText} expirationText={expirationText} adjustProductStock={adjustProductStock} />}
          {active === 'Clientes' && <ClientsPage clients={storeClients} sales={storeSales} clientForm={clientForm} setClientForm={setClientForm} saveClient={saveClient} resetClientForm={resetClientForm} editClient={editClient} deleteClient={deleteClient} editingClientId={editingClientId} pendingDeleteClientId={pendingDeleteClientId} setPendingDeleteClientId={setPendingDeleteClientId} clientNotice={clientNotice} clientsLoading={clientsLoading} setActive={setActive} setSaleForm={setSaleForm} />}
          {active === 'Proveedores' && <ProvidersPage providers={storeProviders} providerForm={providerForm} setProviderForm={setProviderForm} saveProvider={saveProvider} resetProviderForm={resetProviderForm} editProvider={editProvider} deleteProvider={deleteProvider} editingProviderId={editingProviderId} pendingDeleteProviderId={pendingDeleteProviderId} setPendingDeleteProviderId={setPendingDeleteProviderId} providerNotice={providerNotice} productCategories={productCategories} products={storeProducts} providersLoading={providersLoading} setActive={setActive} setPurchaseForm={setPurchaseForm} />}
          {active === 'Reportes' && <ReportsPage currentUser={currentUser} products={storeProducts} sales={storeSales} purchases={purchases} clients={storeClients} providers={storeProviders} totalSales={totalSales} inventoryValue={inventoryValue} potentialProfit={potentialProfit} bestSeller={bestSeller} totalProfit={totalProfit} expirationText={expirationText} />}
          {active === 'Configuración' && <SettingsPage currentUser={currentUser} settingsForm={settingsForm} setSettingsForm={setSettingsForm} saveSettings={saveSettings} settingsNotice={settingsNotice} handleStoreLogo={handleStoreLogo} />}
          {active === 'Admin' && isInventiQAdmin(currentUser) && <AdminPage form={adminCreateUserForm} setForm={setAdminCreateUserForm} notice={adminNotice} createClientAccount={createClientAccount} />}
        </main>
      </div>
      <MobileBottomNav menu={visibleMenu} active={active} setActive={setActive} mobileMoreOpen={mobileMoreOpen} setMobileMoreOpen={setMobileMoreOpen} logout={logout} />
      {/* Botón flotante retirado: el menú inferior ya cubre la navegación móvil. */}
      {receiptSale && <ReceiptModal sale={receiptSale} currentUser={currentUser} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}

function AuthPage({ authMode, setAuthMode, loginForm, setLoginForm, registerForm, setRegisterForm, authNotice, setAuthNotice, login, register, resetEmail, setResetEmail, resetPassword, resetPasswordForm, setResetPasswordForm, updateRecoveredPassword }) {
  const isLogin = authMode === 'login';
  const isReset = authMode === 'reset';
  const isUpdatePassword = authMode === 'update-password';
  const [privacyOpen, setPrivacyOpen] = useState(false);

  function switchMode(mode) {
    setAuthMode(mode);
    setAuthNotice(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-800 to-emerald-500 p-4 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden text-white lg:block">
          <div className="mb-8 flex items-center gap-4">
            <InventiQIcon className="h-20 w-20 rounded-3xl object-cover shadow-xl" />
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
            <div className="mx-auto mb-4 flex justify-center">
              <InventiQIcon className="h-24 w-24 rounded-3xl object-cover shadow-lg" />
            </div>
            <h2 className="text-3xl font-extrabold">{isUpdatePassword ? 'Crear nueva contraseña' : isReset ? 'Recuperar contraseña' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
            <p className="mt-2 text-sm text-slate-500">{isUpdatePassword ? 'Ingresa una nueva contraseña para recuperar el acceso.' : isReset ? 'Ingresa tu correo y te enviaremos un enlace de recuperación.' : isLogin ? 'Ingresa para acceder al panel de tu tienda.' : 'Registra tu tienda para usar InventiQ.'}</p>
          </div>

          {authNotice && (
            <div className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${authNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {authNotice.message}
            </div>
          )}

          {isUpdatePassword ? (
            <form onSubmit={updateRecoveredPassword} className="space-y-4">
              <Field label="Nueva contraseña" type="password" value={resetPasswordForm.password} onChange={v => setResetPasswordForm({ ...resetPasswordForm, password: v })} placeholder="Mínimo 8 caracteres" />
              <Field label="Confirmar nueva contraseña" type="password" value={resetPasswordForm.confirmPassword} onChange={v => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: v })} placeholder="Repetir contraseña" />
              <PasswordSecurityHint />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Actualizar contraseña</button>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">Después de actualizarla, vuelve a iniciar sesión con tu nueva contraseña.</p>
            </form>
          ) : isReset ? (
            <form onSubmit={resetPassword} className="space-y-4">
              <Field label="Correo electrónico" type="email" value={resetEmail} onChange={setResetEmail} placeholder="Ej: tienda@email.com" />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Enviar enlace de recuperación</button>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">El correo puede tardar unos minutos. Revisa también la carpeta de spam.</p>
            </form>
          ) : isLogin ? (
            <form onSubmit={login} className="space-y-4">
              <Field label="Correo electrónico" type="email" value={loginForm.username} onChange={v => setLoginForm({ ...loginForm, username: v })} placeholder="Ej: tienda@email.com" />
              <Field label="Contraseña" type="password" value={loginForm.password} onChange={v => setLoginForm({ ...loginForm, password: v })} placeholder="Tu contraseña" />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Ingresar</button>
              <button type="button" onClick={() => { setResetEmail(loginForm.username || ''); switchMode('reset'); }} className="w-full rounded-2xl border border-transparent px-5 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">¿Olvidaste tu contraseña?</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">El registro público está desactivado. Las cuentas son creadas por el administrador de InventiQ.</p>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                El registro público está desactivado. Solicita al administrador de InventiQ la creación de tu cuenta.
              </div>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500">
            <button type="button" onClick={() => setPrivacyOpen(true)} className="text-emerald-700 hover:underline">Política de privacidad</button>
            <span>·</span>
            <span>InventiQ protege la información por cuenta.</span>
          </div>
        </section>
      </div>

      {privacyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900">Política de privacidad</h3>
                <p className="text-sm text-slate-500">Resumen simple para usuarios de InventiQ.</p>
              </div>
              <button type="button" onClick={() => setPrivacyOpen(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
            </div>
            <div className="space-y-4 text-sm leading-6 text-slate-600">
              <p><strong>Datos que se registran:</strong> productos, inventario, ventas, compras, clientes, proveedores y datos generales de la tienda.</p>
              <p><strong>Uso de la información:</strong> la información se usa para control interno, reportes, comprobantes, inventario, facturación referencial y administración del negocio.</p>
              <p><strong>Separación por cuenta:</strong> cada usuario accede únicamente a la información registrada en su propia cuenta mediante reglas de seguridad en la base de datos.</p>
              <p><strong>Responsabilidad del usuario:</strong> no compartas tu contraseña y registra datos de clientes solo cuando sean necesarios para ventas, facturación o control interno.</p>
              <p><strong>Recuperación de acceso:</strong> usa un correo real para poder restablecer tu contraseña si pierdes el acceso.</p>
            </div>
            <button type="button" onClick={() => setPrivacyOpen(false)} className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HomePage({ currentUser, totalSales, totalProducts, lowStock, noStock, inventoryValue, sales, products, bestSeller, totalProfit, setActive, expirationText }) {
  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const recentSales = completedSales.slice(0, 5);
  const lowStockProducts = products
    .filter(product => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0))
    .slice(0, 5);
  const expiringProducts = businessConfig.usesExpiration
    ? products
      .filter(product => {
        const exp = expirationText ? expirationText(product) : null;
        return exp && ['Por vencer', 'Vence pronto'].includes(exp.label);
      })
      .slice(0, 5)
    : [];

  const soldMap = completedSales.reduce((acc, sale) => {
    if (sale.items?.length > 0) {
      sale.items.forEach(item => {
        const key = item.product || 'Producto';
        acc[key] = acc[key] || { name: key, quantity: 0, total: 0 };
        acc[key].quantity += Number(item.quantity || 0);
        acc[key].total += Number(item.subtotal || 0);
      });
    } else {
      const key = sale.product || 'Producto';
      acc[key] = acc[key] || { name: key, quantity: 0, total: 0 };
      acc[key].quantity += Number(sale.quantity || 0);
      acc[key].total += Number(sale.total || 0);
    }
    return acc;
  }, {});

  const topSoldProducts = Object.values(soldMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const alertCount = lowStock + noStock + expiringProducts.length;
  const stockOk = products.filter(product => Number(product.stock || 0) > Number(product.minStock || 0)).length;
  const inventoryHealth = totalProducts > 0 ? Math.round((stockOk / totalProducts) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-500 p-6 text-white shadow-xl shadow-emerald-100 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-50 backdrop-blur">
              <Activity className="h-4 w-4" /> Dashboard principal
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bienvenido, {currentUser?.name || 'Usuario'}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50 sm:text-base">
              Resumen inteligente de {currentUser?.store || 'tu tienda'}: ventas, inventario, alertas y productos clave en un solo lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[560px]">
            <DashboardMiniStat icon={DollarSign} label="Ventas" value={`$${totalSales.toFixed(2)}`} />
            <DashboardMiniStat icon={TrendingUp} label="Utilidad" value={`$${totalProfit.toFixed(2)}`} />
            <DashboardMiniStat icon={Package} label="Productos" value={totalProducts} />
            <DashboardMiniStat icon={AlertTriangle} label="Alertas" value={alertCount} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardKpi icon={DollarSign} title="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} subtitle="registradas" tone="emerald" />
        <DashboardKpi icon={TrendingUp} title="Utilidad registrada" value={`$${totalProfit.toFixed(2)}`} subtitle="estimada" tone="blue" />
        <DashboardKpi icon={Boxes} title="Stock bajo" value={lowStock} subtitle="por revisar" tone="amber" />
        <DashboardKpi icon={ShoppingCart} title="Sin stock" value={noStock} subtitle="requiere compra" tone="red" />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAction icon={ShoppingCart} label="Nueva venta" onClick={() => setActive('Ventas')} tone="emerald" />
        <QuickAction icon={ClipboardList} label="Registrar compra" onClick={() => setActive('Compras')} tone="teal" />
        <QuickAction icon={Plus} label="Agregar producto" onClick={() => setActive('Productos')} tone="blue" />
        <QuickAction icon={BarChart3} label="Ver reportes" onClick={() => setActive('Reportes')} tone="slate" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900">Resumen de tienda</h3>
              <p className="text-sm text-slate-500">Control general de inventario y rendimiento.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">Salud del inventario: {inventoryHealth}%</span>
          </div>

          <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white">
            <p className="text-sm font-semibold text-emerald-100">Inventario valorizado</p>
            <h4 className="mt-2 text-4xl font-extrabold">${inventoryValue.toFixed(2)}</h4>
            <p className="mt-3 text-sm leading-6 text-emerald-50">
              Producto estrella: <strong>{topSoldProducts[0]?.name || bestSeller || 'Sin ventas'}</strong>. Mantén atención sobre stock bajo, sin stock{businessConfig.usesExpiration ? ' y caducidades próximas' : ''}.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <SummaryBox label="Ventas" value={`$${totalSales.toFixed(2)}`} />
              <SummaryBox label="Productos" value={totalProducts} />
              <SummaryBox label="Alertas" value={alertCount} />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Ventas recientes</h3>
              <p className="text-sm text-slate-500">Últimos movimientos registrados.</p>
            </div>
            <button onClick={() => setActive('Ventas')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Ver todas</button>
          </div>
          <div className="space-y-3">
            {recentSales.length === 0 && <EmptyDashboardMessage text="Todavía no hay ventas registradas." />}
            {recentSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{sale.code}</p>
                  <p className="truncate text-sm text-slate-500">{sale.product} · {sale.date}</p>
                </div>
                <p className="shrink-0 font-extrabold text-emerald-700">${Number(sale.total || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`grid grid-cols-1 gap-5 ${businessConfig.usesExpiration ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
        <DashboardListCard
          title="Productos con stock bajo"
          subtitle="Requieren revisión o reposición"
          empty="No hay productos con stock bajo."
          items={lowStockProducts.map(product => ({
            title: product.name,
            subtitle: `Stock actual: ${product.stock} · mínimo: ${product.minStock}`,
            badge: `${product.stock} unidades`,
            tone: 'amber',
          }))}
        />
        {businessConfig.usesExpiration && <DashboardListCard
          title="Próximos a caducar"
          subtitle="Productos que vencen pronto"
          empty="No hay productos próximos a caducar."
          items={expiringProducts.map(product => {
            const exp = expirationText(product);
            return {
              title: product.name,
              subtitle: `Caduca: ${product.expirationDate || 'Sin fecha'} · ${exp.label}`,
              badge: exp.days !== null ? `${exp.days} días` : 'Revisar',
              tone: 'red',
            };
          })}
        />}
        <DashboardListCard
          title="Productos más vendidos"
          subtitle="Ranking por unidades vendidas"
          empty="Todavía no hay ventas suficientes."
          items={topSoldProducts.map(product => ({
            title: product.name,
            subtitle: `${product.quantity} unidades vendidas`,
            badge: `$${product.total.toFixed(2)}`,
            tone: 'emerald',
          }))}
        />
      </section>
    </div>
  );
}

function PurchasesPage({ purchases, products, providers, purchaseForm, setPurchaseForm, purchaseCart, addPurchaseItem, removePurchaseItem, clearPurchaseCart, registerPurchase, resetPurchaseForm, purchaseNotice, purchasesLoading }) {
  const [productSearch, setProductSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [purchasePage, setPurchasePage] = useState(1);
  const selectedProduct = products.find(product => String(product.id) === String(purchaseForm.productId));
  const filteredProducts = useMemo(() => searchProductsForPicker(products, productSearch, { limit: PRODUCT_SEARCH_LIMIT }), [products, productSearch]);
  const suggestedProvider = selectedProduct ? providers.find(provider => String(provider.category || '').toLowerCase() === String(selectedProduct.category || '').toLowerCase()) : null;
  const quantity = Number(purchaseForm.quantity || 0);
  const unitCost = Number(purchaseForm.unitCost || selectedProduct?.cost || 0);
  const lineTotal = quantity > 0 && unitCost >= 0 ? quantity * unitCost : 0;
  const total = purchaseCart.reduce((sum, item) => sum + item.total, 0);
  const purchasesPerPage = 20;
  const purchaseTotalPages = Math.max(Math.ceil(purchases.length / purchasesPerPage), 1);
  const safePurchasePage = Math.min(purchasePage, purchaseTotalPages);
  const purchaseStartIndex = (safePurchasePage - 1) * purchasesPerPage;
  const paginatedPurchases = purchases.slice(purchaseStartIndex, purchaseStartIndex + purchasesPerPage);

  useEffect(() => {
    setPurchasePage(1);
  }, [purchases.length]);

  function handleProductSearch(value) {
    setProductSearch(value);
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;

    const exactProduct = products.find(product =>
      String(product.barcode || '').trim().toLowerCase() === normalized ||
      String(product.sku || '').trim().toLowerCase() === normalized
    );

    if (exactProduct) {
      selectProduct(exactProduct.id);
    }
  }

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

  async function copyProviderOrder(provider) {
    const { message } = buildProviderOrder(provider, products);
    try {
      await navigator.clipboard.writeText(message);
      alert('Pedido sugerido copiado correctamente.');
    } catch {
      alert(message);
    }
  }

  function openProviderWhatsApp(provider) {
    const phone = normalizeEcuadorPhone(provider.contact);
    const { message } = buildProviderOrder(provider, products);

    if (!phone) {
      alert('Este proveedor no tiene un número válido para WhatsApp.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  function openProviderEmail(provider) {
    const email = String(provider.email || '').trim();
    const { message } = buildProviderOrder(provider, products);

    if (!email.includes('@')) {
      alert('Este proveedor no tiene un correo válido.');
      return;
    }

    window.location.href = `mailto:${email}?subject=${encodeURIComponent('Pedido de reposición')}&body=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <Metric icon={ClipboardList} label="Compras registradas" value={purchases.length} note="historial" color="emerald" />
        <Metric icon={DollarSign} label="Total comprado" value={`$${purchases.reduce((sum, item) => sum + item.total, 0).toFixed(2)}`} note="inversión" color="blue" />
        <Metric icon={Truck} label="Proveedores" value={providers.length} note="registrados" color="amber" />
      </section>

      {purchasesLoading && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando compras desde Supabase...</div>}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <section className="order-2 rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5 text-emerald-600" /> Historial de compras</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {purchases.length === 0 && <div className="p-5"><EmptyState icon={ClipboardList} title="Aún no tienes compras" text="Registra tu primera compra para aumentar stock y controlar mejor tus proveedores." /></div>}
            {paginatedPurchases.map(purchase => (
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
          {purchases.length > purchasesPerPage && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Mostrando {purchaseStartIndex + 1}-{Math.min(purchaseStartIndex + purchasesPerPage, purchases.length)} de {purchases.length} compras</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={safePurchasePage <= 1} onClick={() => setPurchasePage(page => Math.max(page - 1, 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Página {safePurchasePage} de {purchaseTotalPages}</span>
                <button type="button" disabled={safePurchasePage >= purchaseTotalPages} onClick={() => setPurchasePage(page => Math.min(page + 1, purchaseTotalPages))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </section>

        <form onSubmit={registerPurchase} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Registrar compra</h3>
              <p className="text-sm text-slate-500">Agrega varios productos y registra una sola compra.</p>
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
              <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto comprado</span>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input value={productSearch} onChange={e => handleProductSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Buscar o escanear código de barras..." />
              </div>
              <button type="button" onClick={() => setScannerOpen(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                <Camera className="h-4 w-4" /> Escanear con cámara
              </button>
              {scannerOpen && <BarcodeScanner onScan={handleProductSearch} onClose={() => setScannerOpen(false)} />}
              {productSearch && filteredProducts.length > 0 && (
                <div className="mb-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                  {filteredProducts.slice(0, 8).map(product => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => {
                        selectProduct(product.id);
                        setProductSearch(getProductDisplayName(product));
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-emerald-50"
                    >
                      <span>
                        <strong className="text-slate-900">{getProductDisplayName(product)}</strong>
                        <span className="block text-xs text-slate-500">{product.sku || 'Sin SKU'} · {product.category}</span>
                      </span>
                      <span className="text-xs font-bold text-emerald-700">Stock {product.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-emerald-700">Producto seleccionado</p>
                      <p className="mt-1 font-bold text-emerald-950">{getProductDisplayName(selectedProduct)}</p>
                      <p className="text-sm text-emerald-800">{selectedProduct.sku || 'Sin SKU'} · {selectedProduct.category} · Stock actual {selectedProduct.stock}</p>
                    </div>
                    <button type="button" onClick={() => { setPurchaseForm({ ...purchaseForm, productId: '', unitCost: '' }); setProductSearch(''); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Cambiar</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Busca y selecciona un producto para agregarlo a la compra.</div>
              )}
              {productSearch && <p className="mt-2 text-xs text-slate-500">Mostrando máximo {PRODUCT_SEARCH_LIMIT} resultado(s). Escribe al menos 2 letras o escanea el código.</p>}
            </label>

            {selectedProduct && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{getProductDisplayName(selectedProduct)}</p>
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

            <button type="button" onClick={addPurchaseItem} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">Agregar a la compra</button>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Carrito de compra</h4>
                {purchaseCart.length > 0 && <button type="button" onClick={clearPurchaseCart} className="text-xs font-bold text-red-500 hover:underline">Vaciar</button>}
              </div>
              {purchaseCart.length === 0 && <p className="text-sm text-slate-500">Todavía no agregas productos.</p>}
              <div className="space-y-2">
                {purchaseCart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">{item.product}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x ${item.unitCost.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-emerald-700">${item.total.toFixed(2)}</p>
                      <button type="button" onClick={() => removePurchaseItem(item.productId)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Nota</span>
              <textarea value={purchaseForm.note} onChange={e => setPurchaseForm({ ...purchaseForm, note: e.target.value })} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Factura, pedido, observaciones..." />
            </label>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Total de compra</p>
              <p className="text-3xl font-extrabold text-emerald-900">${total.toFixed(2)}</p>
            </div>

            <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">Registrar compra</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SalesPage({ sales, products, clients, saleForm, setSaleForm, saleCart, addSaleItem, removeSaleItem, clearSaleCart, registerSale, resetSaleForm, cancelSale, totalSales, totalProfit, totalDiscount, totalUnitsSold, saleNotice, salePreview, salesLoading, setReceiptSale }) {
  const [productSearch, setProductSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const { product, subtotal, discount, discountType, discountPercent, total, profit, error } = salePreview;
  const filteredProducts = useMemo(() => searchProductsForPicker(products, productSearch, { limit: PRODUCT_SEARCH_LIMIT, onlyWithStock: true }), [products, productSearch]);
  const salesPerPage = 20;
  const salesTotalPages = Math.max(Math.ceil(sales.length / salesPerPage), 1);
  const safeSalesPage = Math.min(salesPage, salesTotalPages);
  const salesStartIndex = (safeSalesPage - 1) * salesPerPage;
  const paginatedSales = sales.slice(salesStartIndex, salesStartIndex + salesPerPage);

  useEffect(() => {
    setSalesPage(1);
  }, [sales.length]);

  function handleProductSearch(value) {
    setProductSearch(value);
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;

    const exactProduct = products.find(product =>
      Number(product.stock || 0) > 0 && (
        String(product.barcode || '').trim().toLowerCase() === normalized ||
        String(product.sku || '').trim().toLowerCase() === normalized
      )
    );

    if (exactProduct) {
      setSaleForm({ ...saleForm, productId: exactProduct.id });
      setProductSearch(getProductDisplayName(exactProduct));
    }
  }

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
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} note="total" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad estimada" value={`$${totalProfit.toFixed(2)}`} note="ganancia" color="blue" />
        <Metric icon={Percent} label="Descuentos" value={`$${totalDiscount.toFixed(2)}`} note="aplicados" color="amber" />
        <Metric icon={Boxes} label="Unidades vendidas" value={totalUnitsSold} note="productos" color="red" />
      </section>

      {salesLoading && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando ventas desde Supabase...</div>}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <div className="order-2 space-y-5 xl:order-1">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="flex items-center gap-2 text-xl font-bold"><ReceiptText className="h-5 w-5 text-emerald-600" /> Historial de ventas</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {sales.length === 0 && <div className="p-5"><EmptyState icon={ShoppingCart} title="Aún no tienes ventas" text="Registra tu primera venta para empezar a medir ingresos, utilidad y rotación." /></div>}
              {paginatedSales.map(sale => (
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
            {sales.length > salesPerPage && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>Mostrando {salesStartIndex + 1}-{Math.min(salesStartIndex + salesPerPage, sales.length)} de {sales.length} ventas</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={safeSalesPage <= 1} onClick={() => setSalesPage(page => Math.max(page - 1, 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Página {safeSalesPage} de {salesTotalPages}</span>
                  <button type="button" disabled={safeSalesPage >= salesTotalPages} onClick={() => setSalesPage(page => Math.min(page + 1, salesTotalPages))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            )}
          </section>
        </div>

        <form onSubmit={registerSale} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Registrar nueva venta</h3>
              <p className="text-sm text-slate-500">Agrega varios productos al carrito y registra una sola venta.</p>
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
              <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto</span>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input value={productSearch} onChange={e => handleProductSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Buscar o escanear código de barras..." />
              </div>
              <button type="button" onClick={() => setScannerOpen(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                <Camera className="h-4 w-4" /> Escanear con cámara
              </button>
              {scannerOpen && <BarcodeScanner onScan={handleProductSearch} onClose={() => setScannerOpen(false)} />}
              {productSearch && filteredProducts.length > 0 && (
                <div className="mb-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                  {filteredProducts.slice(0, 8).map(product => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => {
                        setSaleForm({ ...saleForm, productId: product.id });
                        setProductSearch(getProductDisplayName(product));
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-emerald-50"
                    >
                      <span>
                        <strong className="text-slate-900">{getProductDisplayName(product)}</strong>
                        <span className="block text-xs text-slate-500">{product.sku || 'Sin SKU'} · {product.category}</span>
                      </span>
                      <span className="text-xs font-bold text-emerald-700">Stock {product.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {product ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-emerald-700">Producto seleccionado</p>
                      <p className="mt-1 font-bold text-emerald-950">{getProductDisplayName(product)}</p>
                      <p className="text-sm text-emerald-800">{product.sku || 'Sin SKU'} · Stock disponible {product.stock}</p>
                    </div>
                    <button type="button" onClick={() => { setSaleForm({ ...saleForm, productId: '' }); setProductSearch(''); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Cambiar</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Busca y selecciona un producto para agregarlo a la venta.</div>
              )}
              {productSearch && <p className="mt-2 text-xs text-slate-500">Mostrando máximo {PRODUCT_SEARCH_LIMIT} producto(s) con stock. Escribe al menos 2 letras o escanea el código.</p>}
            </label>

            {product && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{getProductDisplayName(product)}</p>
                <p className="text-sm text-slate-500">Precio: ${product.price.toFixed(2)} · Costo: ${product.cost.toFixed(2)} · Stock disponible: {product.stock}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" type="number" value={saleForm.quantity} onChange={v => setSaleForm({ ...saleForm, quantity: v })} placeholder="1" min="1" />
              <button type="button" onClick={addSaleItem} className="mt-7 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">Agregar al carrito</button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Carrito de venta</h4>
                {saleCart.length > 0 && <button type="button" onClick={clearSaleCart} className="text-xs font-bold text-red-500 hover:underline">Vaciar</button>}
              </div>
              {saleCart.length === 0 && <p className="text-sm text-slate-500">Todavía no agregas productos.</p>}
              <div className="space-y-2">
                {saleCart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">{item.product}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x ${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-emerald-700">${item.subtotal.toFixed(2)}</p>
                      <button type="button" onClick={() => removeSaleItem(item.productId)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <span className="mb-3 block text-sm font-semibold text-slate-700">Descuento general</span>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSaleForm({ ...saleForm, discountType: 'percent', discount: 0 })} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${saleForm.discountType !== 'fixed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  Porcentaje %
                </button>
                <button type="button" onClick={() => setSaleForm({ ...saleForm, discountType: 'fixed', discount: 0 })} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${saleForm.discountType === 'fixed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  Valor $
                </button>
              </div>
              <Field
                label={saleForm.discountType === 'fixed' ? 'Descuento en dólares' : 'Descuento en porcentaje'}
                type="number"
                value={saleForm.discount}
                onChange={v => setSaleForm({ ...saleForm, discount: v })}
                placeholder={saleForm.discountType === 'fixed' ? 'Ej: 2.00' : 'Ej: 10'}
                min="0"
                step="0.01"
              />
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
                <div className="flex justify-between"><span>Descuento {discountType === 'fixed' ? `(valor fijo · ${discountPercent.toFixed(2)}%)` : `(${discountPercent.toFixed(2)}%)`}</span><strong>-${discount.toFixed(2)}</strong></div>
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

function ProductsPage({ currentUser, products, filtered, categories, productCategories, category, setCategory, form, setForm, saveProduct, resetForm, editProduct, editingId, notice, deleteProduct, pendingDeleteId, setPendingDeleteId, statusText, expirationText, totalProducts, lowStock, noStock, inventoryValue, handleProductImage, productsLoading, importProductsFromExcel, excelImportPreview, confirmExcelImport, cancelExcelImport, excelImportProgress }) {
  const businessType = currentUser?.businessType || 'general';
  const businessConfig = getBusinessConfig(businessType);
  const expiringProducts = businessConfig.usesExpiration ? products.filter(product => {
    const exp = expirationText ? expirationText(product) : null;
    return exp && ['Por vencer', 'Vence pronto'].includes(exp.label);
  }) : [];

  return (
    <>
      <section className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${businessConfig.usesExpiration ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        <Metric icon={Package} label="Total productos" value={totalProducts} note="activos" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
        {businessConfig.usesExpiration && <Metric icon={CalendarDays} label="Por vencer" value={expiringProducts.length} note="productos" color="amber" />}
        <Metric icon={DollarSign} label="Valor total inventario" value={`$${inventoryValue.toFixed(2)}`} note="valor aproximado" color="blue" />
      </section>

      {productsLoading && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando productos desde Supabase...</div>}

      <section className="mb-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-emerald-900"><Upload className="h-5 w-5" /> Importar productos desde Excel</h3>
            <p className="mt-1 text-sm text-emerald-800">Carga un archivo .xlsx o .csv con columnas como producto, categoría, precio, stock, marca, talla, color, SKU y código de barras. El costo es opcional. Para inventarios grandes, InventiQ importa por bloques de 200 productos para evitar fallos.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => downloadProductExcelTemplate(businessType)} className="rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50">
              <Download className="mr-2 inline h-4 w-4" />Descargar formato
            </button>
            <label className="cursor-pointer rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700">
              Seleccionar Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) importProductsFromExcel(file); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      </section>

      {excelImportPreview && <ExcelImportPreviewModal preview={excelImportPreview} progress={excelImportProgress} onConfirm={confirmExcelImport} onCancel={cancelExcelImport} />}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <ProductTable businessConfig={businessConfig} products={products} filtered={filtered} categories={categories} category={category} setCategory={setCategory} deleteProduct={deleteProduct} editProduct={editProduct} pendingDeleteId={pendingDeleteId} setPendingDeleteId={setPendingDeleteId} statusText={statusText} expirationText={expirationText} />
        <ProductForm businessConfig={businessConfig} form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editingId={editingId} notice={notice} productCategories={productCategories} handleProductImage={handleProductImage} />
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

function InventoryPage({ currentUser, products, sales, purchases, lowStock, noStock, inventoryValue, potentialProfit, statusText, expirationText, adjustProductStock }) {
  const [inventoryView, setInventoryView] = useState('Alertas');
  const [adjustForm, setAdjustForm] = useState({ productId: '', stock: '', reason: 'Conteo físico' });
  const [adjustNotice, setAdjustNotice] = useState(null);
  const [adjustProductSearch, setAdjustProductSearch] = useState('');

  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const alerts = products.filter(p => p.stock <= p.minStock);
  const criticalProducts = products.filter(p => p.stock === 0);
  const availableProducts = products.filter(p => p.stock > p.minStock);
  const expiredProducts = businessConfig.usesExpiration ? products.filter(p => expirationText(p).label === 'Vencido') : [];
  const expiringProducts = businessConfig.usesExpiration ? products.filter(p => ['Por vencer', 'Vence pronto'].includes(expirationText(p).label)) : [];
  const selectedProduct = products.find(product => String(product.id) === String(adjustForm.productId));
  const adjustSearchResults = useMemo(() => searchProductsForPicker(products, adjustProductSearch, { limit: PRODUCT_SEARCH_LIMIT }), [products, adjustProductSearch]);

  function selectAdjustProduct(productId) {
    const product = products.find(item => String(item.id) === String(productId));
    if (!product) return;
    setAdjustForm({ ...adjustForm, productId: product.id, stock: product.stock });
    setAdjustProductSearch(getProductDisplayName(product));
  }

  function handleAdjustProductSearch(value) {
    setAdjustProductSearch(value);
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;

    const exactProduct = products.find(product =>
      String(product.barcode || '').trim().toLowerCase() === normalized ||
      String(product.sku || '').trim().toLowerCase() === normalized
    );

    if (exactProduct) selectAdjustProduct(exactProduct.id);
  }

  const inventoryMovements = useMemo(() => {
    const purchaseMovements = purchases.flatMap(purchase => {
      const items = purchase.items?.length > 0
        ? purchase.items
        : [{ productId: purchase.productId, product: purchase.product, quantity: purchase.quantity }];

      return items.map(item => ({
        id: `purchase-${purchase.id}-${item.productId || item.product}`,
        date: purchase.date,
        product: item.product,
        type: 'Compra',
        quantity: `+${item.quantity}`,
        detail: `${purchase.code} · ${purchase.provider}`,
        tone: 'emerald',
      }));
    });

    const saleMovements = sales.flatMap(sale => {
      const items = sale.items?.length > 0
        ? sale.items
        : [{ productId: sale.productId, product: sale.product, quantity: sale.quantity }];

      return items.map(item => ({
        id: `sale-${sale.id}-${item.productId || item.product}`,
        date: sale.date,
        product: item.product,
        type: sale.status === 'Anulada' ? 'Anulación' : 'Venta',
        quantity: sale.status === 'Anulada' ? `+${item.quantity}` : `-${item.quantity}`,
        detail: `${sale.code} · ${sale.customer || 'Consumidor final'}`,
        tone: sale.status === 'Anulada' ? 'amber' : 'red',
      }));
    });

    return [...purchaseMovements, ...saleMovements].slice(0, 25);
  }, [purchases, sales]);

  async function submitStockAdjustment(e) {
    e.preventDefault();

    if (!selectedProduct) {
      setAdjustNotice({ type: 'error', message: 'Selecciona un producto para ajustar.' });
      return;
    }

    try {
      await adjustProductStock(selectedProduct.id, adjustForm.stock, adjustForm.reason);
      setAdjustNotice({ type: 'success', message: `Stock de ${selectedProduct.name} ajustado correctamente.` });
      setAdjustForm({ productId: '', stock: '', reason: 'Conteo físico' });
      setAdjustProductSearch('');
    } catch (error) {
      setAdjustNotice({ type: 'error', message: `No se pudo ajustar el stock: ${error.message}` });
    }
  }

  function exportInventory() {
    const extraLabels = businessConfig.extraLabels || {};

    const rows = products.map(product => {
      const baseRow = {
        SKU: product.sku,
        Codigo_barras: product.barcode || '',
        Producto: product.name,
        Categoria: product.category,
        Precio_unitario_venta: Number(product.price || 0).toFixed(2),
        Costo_unitario: Number(product.cost || 0).toFixed(2),
        Stock_actual: product.stock,
        Stock_minimo: product.minStock,
        Estado: statusText(product).label,
        Valor_inventario: (product.cost * product.stock).toFixed(2),
        Ganancia_potencial: ((product.price - product.cost) * product.stock).toFixed(2),
      };

      const extraRow = businessConfig.productExtraFields ? {
        [extraLabels.brand?.label || 'Marca']: product.brand || '',
        [extraLabels.size?.label || 'Talla_medida']: product.size || '',
        [extraLabels.color?.label || 'Color_modelo']: product.color || '',
      } : {};

      const expirationRow = businessConfig.usesExpiration ? {
        Lote: product.batchNumber || '',
        Fecha_ingreso: product.entryDate || '',
        Fecha_caducidad: product.expirationDate || '',
        Estado_caducidad: expirationText(product).label,
      } : {};

      return {
        ...baseRow,
        ...extraRow,
        ...expirationRow,
      };
    });

    exportToCSV(`inventiq_inventario_${currentUser?.businessType || 'general'}.csv`, rows);
  }

  const views = ['Alertas', 'Movimientos', 'Ajuste de stock', 'Resumen'];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric icon={DollarSign} label="Valor inventario" value={`$${inventoryValue.toFixed(2)}`} note="actual" color="blue" />
        <Metric icon={TrendingUp} label="Ganancia potencial" value={`$${potentialProfit.toFixed(2)}`} note="estimada" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-emerald-900">Control de inventario</h3>
            <p className="text-sm text-emerald-800">{alerts.length} productos con alerta, {criticalProducts.length} sin stock{businessConfig.usesExpiration ? `, ${expiringProducts.length} próximos a caducar y ${expiredProducts.length} vencidos` : '. Este tipo de negocio no usa caducidad.'}</p>
          </div>
          <button onClick={exportInventory} className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
            <Download className="mr-2 inline h-5 w-5" />Exportar inventario
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {views.map(view => (
            <button key={view} onClick={() => setInventoryView(view)} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${inventoryView === view ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {view}
            </button>
          ))}
        </div>
      </section>

      {inventoryView === 'Alertas' && (
        <section className={`grid grid-cols-1 gap-5 ${businessConfig.usesExpiration ? 'xl:grid-cols-2' : ''}`}>
          {businessConfig.usesExpiration && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-xl font-bold">Alertas de caducidad</h3>
            <div className="space-y-3">
              {[...expiredProducts, ...expiringProducts].length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">No existen productos vencidos o próximos a caducar.</p>}
              {[...expiredProducts, ...expiringProducts].map(product => {
                const exp = expirationText(product);
                return (
                  <div key={`exp-${product.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                    <div>
                      <p className="font-bold">{product.name}</p>
                      <p className={`text-sm ${exp.color}`}>Caducidad: {product.expirationDate} · {exp.label} {exp.days !== null ? `(${exp.days} días)` : ''}</p>
                      <p className="text-xs text-slate-500">Lote: {product.batchNumber || 'No registrado'} · Stock: {product.stock}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${exp.badge}`}>{exp.label}</span>
                  </div>
                );
              })}
            </div>
          </section>}

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
        </section>
      )}

      {inventoryView === 'Movimientos' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-xl font-bold">Movimientos de inventario</h3>
          <p className="mb-5 text-sm text-slate-500">Entradas por compras, salidas por ventas y devoluciones por anulaciones.</p>
          <div className="space-y-3">
            {inventoryMovements.length === 0 && <EmptyState icon={Activity} title="Sin movimientos" text="Cuando registres compras o ventas, aquí aparecerá la bitácora de inventario." />}
            {inventoryMovements.map(movement => (
              <div key={movement.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{movement.product}</p>
                  <p className="text-sm text-slate-500">{movement.type} · {movement.detail}</p>
                  <p className="text-xs text-slate-400">{movement.date}</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-sm font-extrabold ${movement.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : movement.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                  {movement.quantity}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {inventoryView === 'Ajuste de stock' && (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitStockAdjustment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-bold">Ajuste manual de stock</h3>
            <p className="mb-5 text-sm text-slate-500">Úsalo cuando el conteo físico no coincide con el sistema.</p>

            {adjustNotice && (
              <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${adjustNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {adjustNotice.message}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto</span>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input value={adjustProductSearch} onChange={e => handleAdjustProductSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Buscar por nombre, SKU o código de barras..." />
                </div>
                {adjustProductSearch && adjustSearchResults.length > 0 && !selectedProduct && (
                  <div className="mb-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                    {adjustSearchResults.map(product => (
                      <button type="button" key={product.id} onClick={() => selectAdjustProduct(product.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-emerald-50">
                        <span>
                          <strong className="text-slate-900">{getProductDisplayName(product)}</strong>
                          <span className="block text-xs text-slate-500">{product.sku || 'Sin SKU'} · {product.category}</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-700">Stock {product.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedProduct ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-emerald-700">Producto seleccionado</p>
                        <p className="mt-1 font-bold text-emerald-950">{getProductDisplayName(selectedProduct)}</p>
                        <p className="text-sm text-emerald-800">{selectedProduct.sku || 'Sin SKU'} · Stock actual {selectedProduct.stock}</p>
                      </div>
                      <button type="button" onClick={() => { setAdjustForm({ ...adjustForm, productId: '', stock: '' }); setAdjustProductSearch(''); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Cambiar</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Busca y selecciona un producto para ajustar el stock.</div>
                )}
                {adjustProductSearch && <p className="mt-2 text-xs text-slate-500">Mostrando máximo {PRODUCT_SEARCH_LIMIT} resultado(s). Escribe al menos 2 letras o escanea el código.</p>}
              </label>
              <Field label="Stock contado físicamente" type="number" min="0" value={adjustForm.stock} onChange={v => setAdjustForm({ ...adjustForm, stock: v })} placeholder="Ej: 18" />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Motivo</span>
                <select value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                  <option>Conteo físico</option>
                  <option>Pérdida / daño</option>
                  {businessConfig.usesExpiration && <option>Producto vencido</option>}
                  <option>Corrección de inventario</option>
                  <option>Otro</option>
                </select>
              </label>
              {selectedProduct && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Stock actual en sistema: <strong>{selectedProduct.stock}</strong><br />
                  Diferencia: <strong>{Number(adjustForm.stock || 0) - Number(selectedProduct.stock || 0)}</strong>
                </div>
              )}
              <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Guardar ajuste</button>
            </div>
          </form>

          <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
            <h3 className="mb-3 text-xl font-bold text-amber-900">Uso recomendado</h3>
            <p className="text-sm leading-6 text-amber-900">El ajuste manual debe usarse solo cuando se realiza conteo físico, se identifica pérdida/daño{businessConfig.usesExpiration ? ', producto vencido' : ''} o una corrección puntual. Las compras y ventas deben registrarse desde sus secciones correspondientes para mantener la trazabilidad.</p>
          </section>
        </section>
      )}

      {inventoryView === 'Resumen' && (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <DashboardListCard title="Sin stock" subtitle="Requieren reposición urgente" empty="No hay productos sin stock." items={criticalProducts.slice(0, 8).map(product => ({ title: product.name, subtitle: `${product.category} · mínimo ${product.minStock}`, badge: 'Comprar', tone: 'red' }))} />
          <DashboardListCard title="Stock bajo" subtitle="Debes revisar reposición" empty="No hay stock bajo." items={alerts.filter(product => product.stock > 0).slice(0, 8).map(product => ({ title: product.name, subtitle: `${product.category} · Stock ${product.stock}/${product.minStock}`, badge: 'Alerta', tone: 'amber' }))} />
          {businessConfig.usesExpiration && <DashboardListCard title="Caducidad" subtitle="Vencidos o próximos a caducar" empty="No hay alertas de caducidad." items={[...expiredProducts, ...expiringProducts].slice(0, 8).map(product => { const exp = expirationText(product); return { title: product.name, subtitle: `${product.category} · ${product.expirationDate || 'Sin fecha'}`, badge: exp.label, tone: exp.label === 'Vencido' ? 'red' : 'amber' }; })} />}
        </section>
      )}
    </div>
  );
}

function ClientsPage({ clients, sales, clientForm, setClientForm, saveClient, resetClientForm, editClient, deleteClient, editingClientId, pendingDeleteClientId, setPendingDeleteClientId, clientNotice, clientsLoading, setActive, setSaleForm }) {
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const clientsWithStats = clients.map(client => {
    const clientSales = getClientSales(client);
    const totalPurchased = clientSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const lastSale = clientSales[0];
    return { ...client, clientSales, totalPurchased, lastSale };
  });
  const bestClient = clientsWithStats.sort((a, b) => b.totalPurchased - a.totalPurchased)[0];

  function sellToClient(client) {
    setSaleForm(prev => ({
      ...prev,
      saleType: 'factura',
      customerId: client.id,
      customer: client.name,
      invoiceEnabled: true,
      invoiceName: client.invoiceName || client.name,
      invoiceIdentification: client.identification || '',
      invoiceAddress: client.address || '',
      invoiceEmail: client.email || '',
    }));
    setActive('Ventas');
  }
  function getClientSales(client) {
    return sales.filter(sale => {
      if (sale.status === 'Anulada') return false;
      const saleCustomer = String(sale.customer || '').trim().toLowerCase();
      const saleInvoiceName = String(sale.invoiceName || '').trim().toLowerCase();
      const saleId = String(sale.invoiceIdentification || '').trim();
      const clientName = String(client.name || '').trim().toLowerCase();
      const clientInvoiceName = String(client.invoiceName || '').trim().toLowerCase();
      const clientId = String(client.identification || '').trim();

      return (
        saleCustomer === clientName ||
        saleInvoiceName === clientName ||
        (clientInvoiceName && saleCustomer === clientInvoiceName) ||
        (clientInvoiceName && saleInvoiceName === clientInvoiceName) ||
        (clientId && saleId && saleId === clientId)
      );
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={Users} label="Clientes" value={clients.length} note="registrados" color="emerald" />
        <Metric icon={ShoppingCart} label="Ventas con cliente" value={completedSales.filter(sale => sale.customer && sale.customer !== 'Consumidor final').length} note="factura / nombre" color="blue" />
        <Metric icon={DollarSign} label="Mejor cliente" value={bestClient?.totalPurchased ? `$${bestClient.totalPurchased.toFixed(2)}` : '$0.00'} note={bestClient?.name || 'sin datos'} color="amber" />
        <Metric icon={ReceiptText} label="Facturan" value={clients.filter(client => client.wantsInvoice).length} note="clientes" color="red" />
      </section>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
      <section className="order-2 rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
        {clientsLoading && <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando clientes desde Supabase...</div>}
        <div className="border-b border-slate-100 p-5">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-emerald-600" /> Clientes registrados</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {clients.length === 0 && <div className="p-5"><EmptyState icon={Users} title="Aún no tienes clientes" text="Guarda clientes frecuentes para facturar más rápido y consultar su información." /></div>}
          {clientsWithStats.map(client => {
            const isDeleting = pendingDeleteClientId === client.id;
            const clientSales = client.clientSales;
            const totalPurchased = client.totalPurchased;
            const lastSale = client.lastSale;
            return (
              <div key={client.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{client.name}</p>
                  <p className="text-sm text-slate-500">{client.phone} · {client.type}</p>
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-slate-400">{client.email || 'Sin correo'} {client.wantsInvoice ? '· pide factura' : ''}</p>
                    <p className="text-xs font-semibold text-emerald-700">Historial: {clientSales.length} compra(s) · Total ${totalPurchased.toFixed(2)}</p>
                    {lastSale && <p className="text-xs text-slate-500">Última compra: {lastSale.code} · {lastSale.date} · ${Number(lastSale.total || 0).toFixed(2)}</p>}
                    {client.notes && <p className="text-xs text-slate-500">Nota: {client.notes}</p>}
                  </div>
                </div>
                {isDeleting ? (
                  <div className="flex gap-2">
                    <button onClick={() => deleteClient(client.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Confirmar</button>
                    <button onClick={() => setPendingDeleteClientId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => sellToClient(client)} className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50">Vender</button>
                    <button onClick={() => editClient(client)} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => setPendingDeleteClientId(client.id)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <form onSubmit={saveClient} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
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
            <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">{editingClientId ? 'Actualizar cliente' : 'Guardar cliente'}</button>
          </div>
        </div>
      </form>
    </div>
    </div>
  );
}

function normalizeEcuadorPhone(contact) {
  const digits = String(contact || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('593')) return digits;
  if (digits.startsWith('0')) return `593${digits.slice(1)}`;
  if (digits.length === 9) return `593${digits}`;
  return digits;
}

function buildProviderOrder(provider, products) {
  const lineBreak = String.fromCharCode(10);
  const providerCategory = String(provider.category || '').toLowerCase();
  const pendingProducts = products
    .filter(product => {
      const stock = Number(product.stock || 0);
      const minStock = Number(product.minStock || 0);
      const productCategory = String(product.category || '').toLowerCase();
      const matchesCategory = providerCategory === 'general' || productCategory === providerCategory;
      return matchesCategory && stock <= minStock;
    })
    .map(product => {
      const stock = Number(product.stock || 0);
      const minStock = Number(product.minStock || 0);
      const suggested = Math.max((minStock * 2) - stock, minStock || 1);
      return { ...product, suggested };
    });

  const lines = pendingProducts.map(product => `- ${product.name}: ${product.suggested} unidades sugeridas (stock actual: ${product.stock}, mínimo: ${product.minStock})`);

  const message = lines.length > 0
    ? ['Hola, buen día. Necesito cotizar los siguientes productos para reposición:', '', ...lines, '', 'Quedo atento a su confirmación. Gracias.'].join(lineBreak)
    : `Hola, buen día. Me gustaría consultar disponibilidad y precios para reposición de productos de la categoría ${provider.category || 'general'}. Quedo atento. Gracias.`;

  return { pendingProducts, message };
}

function getProviderEmail(provider) {
  return String(provider?.email || '').trim();
}

function ProvidersPage({ providers, providerForm, setProviderForm, saveProvider, resetProviderForm, editProvider, deleteProvider, editingProviderId, pendingDeleteProviderId, setPendingDeleteProviderId, providerNotice, productCategories, products, providersLoading, setActive, setPurchaseForm }) {
  const lowStockProducts = products.filter(product => product.stock <= product.minStock);
  const providersWithStats = providers.map(provider => {
    const { pendingProducts } = buildProviderOrder(provider, products);
    const suppliedProducts = products.filter(product => {
      const providerCategory = String(provider.category || '').toLowerCase();
      const productCategory = String(product.category || '').toLowerCase();
      return providerCategory === 'general' || providerCategory === productCategory;
    });
    const estimatedRestock = pendingProducts.reduce((sum, product) => sum + (Number(product.cost || 0) * Number(product.suggested || 0)), 0);
    return { ...provider, pendingProducts, suppliedProducts, estimatedRestock };
  });
  const pendingProviders = providersWithStats.filter(provider => provider.pendingProducts.length > 0);

  function purchaseFromProvider(provider) {
    setPurchaseForm(prev => ({ ...prev, providerId: provider.id }));
    setActive('Compras');
  }

  async function copyProviderOrder(provider) {
    const { message } = buildProviderOrder(provider, products);
    try {
      await navigator.clipboard.writeText(message);
      alert('Pedido sugerido copiado correctamente.');
    } catch {
      alert(message);
    }
  }

  function openProviderWhatsApp(provider) {
    const phone = normalizeEcuadorPhone(provider.contact);
    const { message } = buildProviderOrder(provider, products);

    if (!phone) {
      alert('Este proveedor no tiene un número válido para WhatsApp.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  function openProviderEmail(provider) {
    const email = getProviderEmail(provider);
    const { message } = buildProviderOrder(provider, products);

    if (!email) {
      alert('Este proveedor no tiene un correo válido.');
      return;
    }

    window.location.href = `mailto:${email}?subject=${encodeURIComponent('Pedido de reposición')}&body=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={Truck} label="Proveedores" value={providers.length} note="registrados" color="emerald" />
        <Metric icon={AlertTriangle} label="Con reposición" value={pendingProviders.length} note="proveedores" color="amber" />
        <Metric icon={Package} label="Productos bajos" value={lowStockProducts.length} note="pendientes" color="red" />
        <Metric icon={DollarSign} label="Reposición estimada" value={`$${pendingProviders.reduce((sum, provider) => sum + provider.estimatedRestock, 0).toFixed(2)}`} note="aprox." color="blue" />
      </section>

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
        <section className="order-2 rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
          {providersLoading && <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando proveedores desde Supabase...</div>}
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Truck className="h-5 w-5 text-emerald-600" /> Proveedores registrados</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {providers.length === 0 && <div className="p-5"><EmptyState icon={Truck} title="Aún no tienes proveedores" text="Registra proveedores para asociarlos con categorías y facilitar reposiciones." /></div>}
            {providersWithStats.map(provider => {
              const isDeleting = pendingDeleteProviderId === provider.id;
              const pendingProducts = provider.pendingProducts;
              const hasEmail = Boolean(getProviderEmail(provider));
              const hasPhone = Boolean(normalizeEcuadorPhone(provider.contact));
              return (
                <div key={provider.id} className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{provider.name}</p>
                      <p className="text-sm text-slate-500">{provider.category} · Tel: {provider.contact}</p>
                      <p className="text-xs text-slate-400">Correo: {provider.email || 'Sin correo'} · Entrega estimada: {provider.delivery}</p>
                      <p className="text-xs text-slate-400">Productos asociados: {provider.suppliedProducts.length}</p>
                      <p className={`mt-2 text-xs font-bold ${pendingProducts.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {pendingProducts.length > 0 ? `Pedido sugerido: ${pendingProducts.length} producto(s) · $${provider.estimatedRestock.toFixed(2)} aprox.` : 'Sin productos pendientes de reposición'}
                      </p>
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

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {hasPhone && <button type="button" onClick={() => openProviderWhatsApp(provider)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">WhatsApp</button>}
                    {hasEmail && <button type="button" onClick={() => openProviderEmail(provider)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Correo</button>}
                    <button type="button" onClick={() => copyProviderOrder(provider)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Copiar pedido</button>
                    <button type="button" onClick={() => purchaseFromProvider(provider)} className="rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Registrar compra</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <form onSubmit={saveProvider} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
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
            <Field label="Teléfono / WhatsApp" value={providerForm.contact} onChange={v => setProviderForm({ ...providerForm, contact: v })} placeholder="Ej: 0991234567" />
            <Field label="Correo electrónico" type="email" value={providerForm.email} onChange={v => setProviderForm({ ...providerForm, email: v })} placeholder="Ej: ventas@proveedor.com" />
            <Field label="Entrega estimada" value={providerForm.delivery} onChange={v => setProviderForm({ ...providerForm, delivery: v })} placeholder="Ej: 2 días" />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Observaciones</span>
              <textarea value={providerForm.notes} onChange={e => setProviderForm({ ...providerForm, notes: e.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Condiciones, horarios, productos principales..." />
            </label>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={resetProviderForm} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">{editingProviderId ? 'Actualizar proveedor' : 'Guardar proveedor'}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function CashPage({ sales = [], purchases = [] }) {
  const [closePeriod, setClosePeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [cashCounted, setCashCounted] = useState('');
  const [cashNote, setCashNote] = useState('');

  const safeSales = Array.isArray(sales) ? sales : [];
  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const periodRange = getPeriodRange(closePeriod, customStart, customEnd);

  const completedSales = safeSales.filter(sale => sale.status !== 'Anulada');
  const cancelledSales = safeSales.filter(sale => sale.status === 'Anulada');
  const periodSales = completedSales.filter(sale => isRecordInPeriod(sale, periodRange));
  const periodCancelledSales = cancelledSales.filter(sale => isRecordInPeriod(sale, periodRange));
  const periodPurchases = safePurchases.filter(purchase => isRecordInPeriod(purchase, periodRange));

  const periodSalesTotal = periodSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const periodPurchasesTotal = periodPurchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const periodProfit = periodSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const periodDiscount = periodSales.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
  const periodUnits = periodSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const periodBalance = periodSalesTotal - periodPurchasesTotal;
  const cashExpected = periodSales.filter(sale => sale.paymentMethod === 'Efectivo').reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const cashDifference = cashCounted === '' ? 0 : Number(cashCounted || 0) - cashExpected;

  const paymentSummary = periodSales.reduce((acc, sale) => {
    const method = sale.paymentMethod || 'Sin método';
    acc[method] = (acc[method] || 0) + Number(sale.total || 0);
    return acc;
  }, {});

  const closeLabel = `${formatPeriodDate(periodRange.start)} al ${formatPeriodDate(periodRange.end)}`;

  function exportCashCut() {
    const rows = [
      { Concepto: 'Periodo', Valor: closeLabel },
      { Concepto: 'Ventas completadas', Valor: periodSales.length },
      { Concepto: 'Ventas anuladas', Valor: periodCancelledSales.length },
      { Concepto: 'Unidades vendidas', Valor: periodUnits },
      { Concepto: 'Total vendido', Valor: periodSalesTotal.toFixed(2) },
      { Concepto: 'Compras registradas', Valor: periodPurchasesTotal.toFixed(2) },
      { Concepto: 'Balance ventas - compras', Valor: periodBalance.toFixed(2) },
      { Concepto: 'Utilidad estimada', Valor: periodProfit.toFixed(2) },
      { Concepto: 'Descuentos aplicados', Valor: periodDiscount.toFixed(2) },
      { Concepto: 'Efectivo esperado', Valor: cashExpected.toFixed(2) },
      { Concepto: 'Efectivo contado', Valor: cashCounted === '' ? '' : Number(cashCounted || 0).toFixed(2) },
      { Concepto: 'Diferencia de caja', Valor: cashCounted === '' ? '' : cashDifference.toFixed(2) },
      { Concepto: 'Observacion del cierre', Valor: cashNote || '' },
      ...Object.entries(paymentSummary).map(([method, value]) => ({ Concepto: `Pago - ${method}`, Valor: Number(value || 0).toFixed(2) })),
    ];

    exportToCSV(`inventiq_cierre_${closePeriod}.csv`, rows);
  }

  const periodOptions = [
    ['today', 'Hoy'],
    ['week', '7 días'],
    ['15days', '15 días'],
    ['month', 'Este mes'],
    ['previousMonth', 'Mes anterior'],
    ['custom', 'Personalizado'],
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Cierres y cortes por periodo</h3>
            <p className="text-sm text-slate-500">Controla ventas, compras, descuentos, utilidad y métodos de pago por periodo.</p>
            <p className="mt-2 text-sm font-bold text-emerald-700">Periodo seleccionado: {closeLabel}</p>
          </div>
          <button type="button" onClick={exportCashCut} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
            <Download className="mr-2 inline h-4 w-4" />Exportar cierre
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {periodOptions.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setClosePeriod(value)} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${closePeriod === value ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {closePeriod === 'custom' && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Desde" type="date" value={customStart} onChange={setCustomStart} />
            <Field label="Hasta" type="date" value={customEnd} onChange={setCustomEnd} />
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas del periodo" value={`$${periodSalesTotal.toFixed(2)}`} note={`${periodSales.length} venta(s)`} color="emerald" />
        <Metric icon={ClipboardList} label="Compras del periodo" value={`$${periodPurchasesTotal.toFixed(2)}`} note={`${periodPurchases.length} compra(s)`} color="amber" />
        <Metric icon={TrendingUp} label="Utilidad estimada" value={`$${periodProfit.toFixed(2)}`} note="periodo" color="blue" />
        <Metric icon={Percent} label="Descuentos" value={`$${periodDiscount.toFixed(2)}`} note={`${periodCancelledSales.length} anulada(s)`} color="red" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-700">Cierre de efectivo</p>
          <p className="mt-2 text-sm text-slate-500">Compara el efectivo esperado contra el efectivo contado físicamente.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">Efectivo esperado</p>
              <p className="text-2xl font-extrabold text-slate-900">${cashExpected.toFixed(2)}</p>
            </div>
            <Field label="Efectivo contado" type="number" min="0" step="0.01" value={cashCounted} onChange={setCashCounted} placeholder="0.00" />
          </div>
          {cashCounted !== '' && <p className={`mt-3 rounded-2xl p-4 text-sm font-bold ${cashDifference === 0 ? 'bg-emerald-50 text-emerald-700' : cashDifference > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>Diferencia de caja: ${cashDifference.toFixed(2)}</p>}
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Observación del cierre</span>
            <textarea value={cashNote} onChange={e => setCashNote(e.target.value)} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Ej: faltante por cambio, sobrante, retiro de efectivo..." />
          </label>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-700">Balance ventas - compras</p>
          <p className={`mt-2 text-4xl font-extrabold ${periodBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>${periodBalance.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-500">Unidades vendidas: {periodUnits}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-bold text-slate-700">Métodos de pago</p>
          {Object.keys(paymentSummary).length === 0 && <p className="text-sm text-slate-500">Sin ventas en este periodo.</p>}
          <div className="space-y-3">
            {Object.entries(paymentSummary).map(([method, value]) => (
              <div key={method} className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
                <span>{method}</span>
                <strong>${Number(value || 0).toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportsPage({ currentUser, products, sales, purchases, clients, providers, totalSales, inventoryValue, potentialProfit, bestSeller, totalProfit, expirationText }) {
  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const netBalance = totalSales - totalPurchases;
  const lowRotation = products.filter(product => !completedSales.some(sale => String(sale.product || '').includes(product.name))).slice(0, 8);
  const purchaseSuggestions = products.filter(product => Number(product.stock || 0) <= Number(product.minStock || 0)).slice(0, 8);

  function exportSales() {
    exportToCSV('inventiq_ventas.csv', sales.map(sale => ({
      Codigo: sale.code,
      Fecha: sale.date,
      Cliente: sale.customer,
      Producto: sale.product,
      Cantidad: sale.quantity,
      Subtotal: Number(sale.subtotal || 0).toFixed(2),
      Descuento: Number(sale.discount || 0).toFixed(2),
      Total: Number(sale.total || 0).toFixed(2),
      Utilidad: Number(sale.profit || 0).toFixed(2),
      Estado: sale.status,
    })));
  }

  function exportPurchases() {
    exportToCSV('inventiq_compras.csv', purchases.map(purchase => ({
      Codigo: purchase.code,
      Fecha: purchase.date,
      Proveedor: purchase.provider,
      Producto: purchase.product,
      Cantidad: purchase.quantity,
      Costo_unitario: Number(purchase.unitCost || 0).toFixed(2),
      Total: Number(purchase.total || 0).toFixed(2),
      Nota: purchase.note || '',
    })));
  }

  function exportProducts() {
    exportToCSV('inventiq_productos.csv', products.map(product => {
      const baseRow = {
        SKU: product.sku,
        Codigo_barras: product.barcode || '',
        Producto: product.name,
        Categoria: product.category,
        Precio_venta: Number(product.price || 0).toFixed(2),
        Costo_unitario: Number(product.cost || 0).toFixed(2),
        Stock_actual: product.stock,
        Stock_minimo: product.minStock,
        Estado: product.status,
        Marca: product.brand || '',
        Talla_medida: product.size || '',
        Color_modelo: product.color || '',
        Descripcion: product.description || '',
        Valor_inventario: (Number(product.cost || 0) * Number(product.stock || 0)).toFixed(2),
        Ganancia_potencial: ((Number(product.price || 0) - Number(product.cost || 0)) * Number(product.stock || 0)).toFixed(2),
      };

      if (!businessConfig.usesExpiration) return baseRow;

      return {
        ...baseRow,
        Lote: product.batchNumber || '',
        Fecha_ingreso: product.entryDate || '',
        Fecha_caducidad: product.expirationDate || '',
      };
    }));
  }

  function exportClients() {
    exportToCSV('inventiq_clientes.csv', clients.map(client => ({
      Cliente: client.name,
      Telefono: client.phone,
      Correo: client.email || '',
      Cedula_RUC: client.identification || '',
      Direccion: client.address || '',
      Nombre_factura: client.invoiceName || '',
      Solicita_factura: client.wantsInvoice ? 'Sí' : 'No',
      Tipo: client.type,
      Compras_registradas: client.purchases || 0,
      Observaciones: client.notes || '',
    })));
  }

  function exportProviders() {
    exportToCSV('inventiq_proveedores.csv', providers.map(provider => ({
      Proveedor: provider.name,
      Categoria: provider.category,
      Telefono_WhatsApp: provider.contact,
      Correo: provider.email || '',
      Entrega_estimada: provider.delivery || '',
      Observaciones: provider.notes || '',
    })));
  }

  function exportLowStock() {
    exportToCSV('inventiq_reposicion_sugerida.csv', purchaseSuggestions.map(product => ({
      SKU: product.sku,
      Producto: product.name,
      Categoria: product.category,
      Stock_actual: product.stock,
      Stock_minimo: product.minStock,
      Cantidad_sugerida: Math.max((Number(product.minStock || 0) * 2) - Number(product.stock || 0), 1),
      Costo_unitario: Number(product.cost || 0).toFixed(2),
      Inversion_estimada: (Math.max((Number(product.minStock || 0) * 2) - Number(product.stock || 0), 1) * Number(product.cost || 0)).toFixed(2),
    })));
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas" value={`$${totalSales.toFixed(2)}`} note="acumuladas" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad" value={`$${totalProfit.toFixed(2)}`} note="estimada" color="blue" />
        <Metric icon={ClipboardList} label="Compras" value={`$${totalPurchases.toFixed(2)}`} note="registradas" color="amber" />
        <Metric icon={BarChart3} label="Balance" value={`$${netBalance.toFixed(2)}`} note="ventas - compras" color={netBalance >= 0 ? 'emerald' : 'red'} />
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-emerald-900">Reportes exportables</h3>
            <p className="text-sm text-emerald-800">Descarga ventas, compras, productos, clientes, proveedores y reposición sugerida para análisis externo.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button onClick={exportSales} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Ventas</button>
            <button onClick={exportPurchases} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Compras</button>
            <button onClick={exportProducts} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Productos</button>
            <button onClick={exportClients} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Clientes</button>
            <button onClick={exportProviders} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Proveedores</button>
            <button onClick={exportLowStock} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"><Download className="mr-2 inline h-4 w-4" />Reposición</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Activity className="h-5 w-5 text-emerald-600" /> Baja rotación o sin movimiento</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {lowRotation.length === 0 && <p className="p-5 text-sm text-slate-500">No existen productos de baja rotación por el momento.</p>}
            {lowRotation.map(product => (
              <ReportRow key={product.id} title={product.name} subtitle={`${product.category} · stock actual ${product.stock}`} right="Sin ventas" badge="Promocionar" />
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
              <ReportRow key={product.id} title={product.name} subtitle={`Stock ${product.stock} · mínimo ${product.minStock}`} right={`Comprar ${Math.max((Number(product.minStock || 0) * 2) - Number(product.stock || 0), 1)}`} badge="Reposición" />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function ProductTable({ businessConfig, products, filtered, categories, category, setCategory, deleteProduct, editProduct, pendingDeleteId, setPendingDeleteId, statusText, expirationText }) {
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [labelColumns, setLabelColumns] = useState('2');
  const [labelCopies, setLabelCopies] = useState('1');
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 15;
  const totalPages = Math.max(Math.ceil(filtered.length / productsPerPage), 1);
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * productsPerPage;
  const paginatedProducts = filtered.slice(startIndex, startIndex + productsPerPage);
  const selectedProducts = filtered.filter(product => selectedLabelIds.includes(product.id));
  const allVisibleSelected = paginatedProducts.length > 0 && paginatedProducts.every(product => selectedLabelIds.includes(product.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [category, filtered.length]);

  function toggleLabelProduct(productId) {
    setSelectedLabelIds(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  }

  function toggleAllVisibleProducts() {
    if (allVisibleSelected) {
      setSelectedLabelIds(prev => prev.filter(id => !paginatedProducts.some(product => product.id === id)));
      return;
    }

    setSelectedLabelIds(prev => Array.from(new Set([...prev, ...paginatedProducts.map(product => product.id)])));
  }

  function printSelectedLabels() {
    const totalLabels = selectedProducts.length * Math.max(Number(labelCopies || 1), 1);
    if (totalLabels > MAX_LABELS_WITHOUT_CONFIRM && !window.confirm(`Vas a generar ${totalLabels} etiquetas. Esto puede tardar y abrir una impresión pesada. ¿Deseas continuar?`)) return;
    printSelectedBarcodeLabels(selectedProducts, {
      columns: Number(labelColumns || 2),
      copies: Number(labelCopies || 1),
      labelWidth: 44,
      labelHeight: 33,
    });
  }

  return (
    <div className="order-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Package className="h-5 w-5 text-emerald-600" /> Lista de productos</h3>
            <p className="mt-1 text-sm text-slate-500">Selecciona productos y genera etiquetas por columnas.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 xl:w-[520px]">
            <select value={labelColumns} onChange={e => setLabelColumns(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200">
              <option value="1">1 columna</option>
              <option value="2">2 columnas</option>
              <option value="3">3 columnas</option>
            </select>
            <input type="number" min="1" value={labelCopies} onChange={e => setLabelCopies(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Copias" />
            <button type="button" onClick={toggleAllVisibleProducts} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{allVisibleSelected ? 'Quitar página' : 'Seleccionar página'}</button>
            <button type="button" onClick={printSelectedLabels} className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"><Printer className="mr-1 inline h-4 w-4" />Imprimir {selectedProducts.length}</button>
          </div>
        </div>
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
                <th className="px-5 py-4">Etiq.</th>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4">Precio</th>
                <th className="px-5 py-4">Stock</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.map(product => {
                const s = statusText(product);
                const exp = expirationText ? expirationText(product) : null;
                const isDeleting = pendingDeleteId === product.id;
                return (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <input type="checkbox" checked={selectedLabelIds.includes(product.id)} onChange={() => toggleLabelProduct(product.id)} className="h-4 w-4" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-12 w-12 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">📦</div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">SKU: {product.sku}{product.barcode ? ` · Barra: ${product.barcode}` : ''}</p>
                          {businessConfig?.productExtraFields && <p className="text-xs font-semibold text-emerald-700">{getProductVariantText(product) || 'Sin variante'}</p>}
                          {businessConfig?.usesExpiration && product.expirationDate && <p className={`text-xs ${exp?.color}`}>Caduca: {product.expirationDate} · {exp?.label}</p>}
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
                          <button onClick={() => printProductBarcodeLabel(product)} className="rounded-xl border border-emerald-100 p-2 text-emerald-600 hover:bg-emerald-50" title="Imprimir código"><Printer className="h-4 w-4" /></button>
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
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <span>Mostrando {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + productsPerPage, filtered.length)} de {filtered.length} filtrados · Total {products.length} productos · Seleccionados para etiquetas: {selectedProducts.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(page => Math.max(page - 1, 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Página {safePage} de {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductForm({ businessConfig, form, setForm, saveProduct, resetForm, editingId, notice, productCategories, handleProductImage }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const isNewCategory = form.category === '__new__';
  const extraLabels = businessConfig?.extraLabels || {};

  function generateProductBarcode() {
    const businessType = businessConfig?.label === 'Tienda de ropa' ? 'ropa' : 'general';
    const code = generateInternalBarcode(businessType);
    setForm({ ...form, sku: form.sku || code, barcode: code });
  }

  return (
    <form onSubmit={saveProduct} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
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
        <Field label="Nombre del producto" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder={businessConfig?.productNamePlaceholder || 'Ej: Arroz 1kg'} />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Categoría</span>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
            <option value="">Seleccionar categoría</option>
            {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            <option value="__new__">+ Crear nueva categoría</option>
          </select>
        </label>

        {isNewCategory && (
          <Field label="Nueva categoría" value={form.customCategory} onChange={v => setForm({ ...form, customCategory: v })} placeholder={businessConfig?.categoryPlaceholder || 'Ej: Mascotas'} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta" type="number" min="0" step="0.01" value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="$ 0.00" />
          <Field label="Costo (opcional)" type="number" min="0" step="0.01" value={form.cost} onChange={v => setForm({ ...form, cost: v })} placeholder="Puede quedar vacío" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual" type="number" min="0" value={form.stock} onChange={v => setForm({ ...form, stock: v })} placeholder="0" />
          <Field label="Stock mínimo" type="number" min="0" value={form.minStock} onChange={v => setForm({ ...form, minStock: v })} placeholder="5" />
        </div>
        <Field label="Código / SKU" value={form.sku} onChange={v => setForm({ ...form, sku: v })} placeholder="Ej: PROD001" />
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Field label="Código de barras" value={form.barcode} onChange={v => setForm({ ...form, barcode: v })} placeholder="Escribe el código existente o genera uno nuevo" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={generateProductBarcode} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> Generar código
            </button>
            <button type="button" onClick={() => setScannerOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
              <Camera className="h-4 w-4" /> Escanear existente
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Puedes generar un código interno para InventiQ o escribir/escanear el código que el producto ya trae.</p>
          {scannerOpen && <BarcodeScanner onScan={value => setForm({ ...form, barcode: value, sku: form.sku || value })} onClose={() => setScannerOpen(false)} />}
        </div>
        {businessConfig?.productExtraFields && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={extraLabels.brand?.label || 'Marca'} value={form.brand} onChange={v => setForm({ ...form, brand: v })} placeholder={extraLabels.brand?.placeholder || 'Ej: Marca'} />
            <Field label={extraLabels.size?.label || 'Talla / medida'} value={form.size} onChange={v => setForm({ ...form, size: v })} placeholder={extraLabels.size?.placeholder || 'Ej: M / 32 / 1/2'} />
            <Field label={extraLabels.color?.label || 'Color / modelo'} value={form.color} onChange={v => setForm({ ...form, color: v })} placeholder={extraLabels.color?.placeholder || 'Ej: Negro'} />
          </div>
        )}
        {businessConfig?.usesExpiration && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Lote" value={form.batchNumber} onChange={v => setForm({ ...form, batchNumber: v })} placeholder="Ej: LOTE-001" />
            <Field label="Fecha de ingreso" type="date" value={form.entryDate} onChange={v => setForm({ ...form, entryDate: v })} />
            <Field label="Fecha de caducidad" type="date" value={form.expirationDate} onChange={v => setForm({ ...form, expirationDate: v })} />
          </div>
        )}
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
              <p>PNG, JPG o WEBP. InventiQ optimiza la imagen automáticamente.</p>
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

export default App;
