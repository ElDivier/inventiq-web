import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  ADMIN_EMAILS,
  IMPORT_BATCH_SIZE,
  PRODUCT_SEARCH_LIMIT,
  MAX_LABELS_WITHOUT_CONFIRM,
} from './config/constants';
import { businessTypes, getBusinessConfig } from './config/businessTypes';
import { getRequiredDataForSection } from './config/sectionData';
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
  chunkArray,
  validateExcelFile,
} from './utils/products';
import { exportToCSV } from './utils/csv';
import {
  looksLikeBarcodeSearch,
  filterProductsForBarcodeSearch,
} from './utils/productSearch';
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
import {
  toMoneyNumber,
  isSplitPaymentAvailable,
  getSplitPaymentAmounts,
  getSplitPaymentTotal,
} from './utils/payments';
import {
  normalizeSaleCartItem,
  calculateSalePreview as buildSalePreview,
} from './utils/sales';
import {
  createEmptyExpenseForm,
  getTodayInputDate,
  mapExpenseFromDb,
  mapExpenseToDb,
} from './utils/expenses';
import {
  isCustomerAccountsAvailable,
  safeJsonArray,
  makeLocalId,
  mapClientWithAccountsFromDb,
} from './utils/clientAccounts';

import {
  normalizeEcuadorPhone,
  buildProviderOrder,
  getProviderEmail,
} from './utils/providers';

import {
  isInventiQAdmin,
  validatePasswordSecurity,
} from './utils/auth';
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
import SplashScreen from './components/SplashScreen';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomNav from './components/MobileBottomNav';
import DesktopSidebar from './components/DesktopSidebar';
import PageHeader from './components/PageHeader';
import AppRoutes from './components/AppRoutes';
import BarcodeScanner from './components/BarcodeScanner';
import ReceiptModal from './components/ReceiptModal';
import ExcelImportPreviewModal from './components/ExcelImportPreviewModal';
import ProductTable from './components/ProductTable';
import ProductForm from './components/ProductForm';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import CashPage from './pages/CashPage';
import DailyCashPage from './pages/DailyCashPage';
import ReportsPage from './pages/ReportsPage';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import FoodSalesPage from './pages/FoodSalesPage';
import SalesPage from './pages/SalesPage';
import FoodProductsPage from './pages/FoodProductsPage';
import ProductsPage from './pages/ProductsPage';
import PurchasesPage from './pages/PurchasesPage';
import ProvidersPage from './pages/ProvidersPage';
import ExpensesPage from './pages/ExpensesPage';
import InventoryPage from './pages/InventoryPage';
import ClientsPage from './pages/ClientsPage';
import { menu } from './config/menu';
import {
  Home,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  BarChart3,
  Settings,
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
  Lock,
  User,
  MoreHorizontal,
  Download,
  Camera,
  Printer,
  Upload,
} from 'lucide-react';

function getAvatarLetter(user) {
  const source = String(user?.store || user?.name || user?.email || 'InventiQ').trim();
  return source.charAt(0).toUpperCase() || 'I';
}

function getAccountAccessBlockReason(profile, email) {
  const currentEmail = String(email || '').trim().toLowerCase();
  const adminEmails = ADMIN_EMAILS.map(adminEmail =>
    String(adminEmail || '').trim().toLowerCase()
  );

  if (adminEmails.includes(currentEmail)) {
    return null;
  }

  if (!profile) {
    return null;
  }

  const status = String(profile.subscription_status || '').trim().toLowerCase();

  if (profile.is_suspended || status === 'suspendido') {
    return 'Tu cuenta de InventiQ está suspendida. Comunícate con InventiQ para reactivar tu acceso.';
  }

  if (status === 'vencido') {
    return 'Tu plan de InventiQ está vencido. Comunícate con InventiQ para renovar tu acceso.';
  }

  if (profile.subscription_end) {
    const today = new Date();
    const endDate = new Date(profile.subscription_end);

    today.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (!Number.isNaN(endDate.getTime()) && endDate < today) {
      return 'Tu plan de InventiQ ha vencido. Comunícate con InventiQ para renovar tu acceso.';
    }
  }

  return null;
}

function getUsersFromStorage() {
  return loadFromStorage(STORAGE_KEYS.users, initialUsers);
}

function getEnhancedClientFromDb(row = {}) {
  const base = mapClientFromDb(row);

  return {
    ...base,
    creditEnabled: Boolean(row.credit_enabled),
    creditLimit: Number(row.credit_limit || 0),
    creditBalance: Number(row.credit_balance || 0),
    loyaltyEnabled: Boolean(row.loyalty_enabled),
    loyaltyTotal: Number(row.loyalty_total || 0),
    loyaltyNotes: row.loyalty_notes || '',
  };
}

function mapEnhancedClientToDb(clientData, userId) {
  return {
    ...mapClientToDb(clientData, userId),
    credit_enabled: Boolean(clientData.creditEnabled),
    credit_limit: Number(clientData.creditLimit || 0),
    credit_balance: Number(clientData.creditBalance || 0),
    loyalty_enabled: Boolean(clientData.loyaltyEnabled),
    loyalty_total: Number(clientData.loyaltyTotal || 0),
    loyalty_notes: clientData.loyaltyNotes || '',
  };
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
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [customProductCategories, setCustomProductCategories] = useState([]);
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
  const [expensesLoading, setExpensesLoading] = useState(false);
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
  const [expenseForm, setExpenseForm] = useState(() => createEmptyExpenseForm());
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [pendingDeleteExpenseId, setPendingDeleteExpenseId] = useState(null);
  const [expenseNotice, setExpenseNotice] = useState(null);
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

  const loadedDataRef = useRef({
    products: false,
    sales: false,
    clients: false,
    providers: false,
    purchases: false,
    expenses: false,
  });

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
            splitPaymentEnabled: false,
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
            splitPaymentEnabled: false,
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
      setExpenseForm(loadDraft(currentUser.id, 'expenseForm', createEmptyExpenseForm()));
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

  useEffect(() => {
    if (!currentUser?.id) return;
    saveDraft(currentUser.id, 'expenseForm', expenseForm);
  }, [currentUser?.id, expenseForm]);

  // Configuración no se guarda como borrador para evitar sobrescribir datos reales de la tienda.
  // Siempre se carga desde currentUser / Supabase.

  useEffect(() => {
    loadedDataRef.current = {
      products: false,
      sales: false,
      clients: false,
      providers: false,
      purchases: false,
      expenses: false,
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    let cancelled = false;
    const activeSection = active;
    const requiredData = getRequiredDataForSection(activeSection);

    const needsProducts = requiredData.has('products');
    const needsSales = requiredData.has('sales');
    const needsClients = requiredData.has('clients');
    const needsProviders = requiredData.has('providers');
    const needsPurchases = requiredData.has('purchases');
    const needsExpenses = requiredData.has('expenses');

    async function loadOnlyNeededData() {
      const loaded = loadedDataRef.current;

      if (needsProducts && !loaded.products && !cancelled) {
        await loadProductsFromSupabase(currentUser.id);
      }

      if (needsSales && !loaded.sales && !cancelled) {
        await loadSalesFromSupabase(currentUser.id);
      }

      if (needsClients && !loaded.clients && !cancelled) {
        await loadClientsFromSupabase(currentUser.id);
      }

      if (needsProviders && !loaded.providers && !cancelled) {
        await loadProvidersFromSupabase(currentUser.id);
      }

      if (needsPurchases && !loaded.purchases && !cancelled) {
        await loadPurchasesFromSupabase(currentUser.id);
      }

      if (needsExpenses && !loaded.expenses && !cancelled) {
        await loadExpensesFromSupabase(currentUser.id);
      }
    }

    loadOnlyNeededData();

    return () => {
      cancelled = true;
    };
  }, [active, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const activeSection = active;
    const subscriptions = [];
    const requiredData = getRequiredDataForSection(activeSection);

    const watchProducts = requiredData.has('products');
    const watchSales = requiredData.has('sales');
    const watchClients = requiredData.has('clients');
    const watchProviders = requiredData.has('providers');
    const watchPurchases = requiredData.has('purchases');
    const watchExpenses = requiredData.has('expenses');

    if (watchProducts) {
      subscriptions.push({
        name: `products-${currentUser.id}-${activeSection}`,
        table: 'products',
        refresh: () => loadProductsFromSupabase(currentUser.id, false),
      });
    }

    if (watchSales) {
      subscriptions.push({
        name: `sales-${currentUser.id}-${activeSection}`,
        table: 'sales',
        refresh: async () => {
          await loadSalesFromSupabase(currentUser.id, false);
          if (watchProducts) await loadProductsFromSupabase(currentUser.id, false);
        },
      });
    }

    if (watchClients) {
      subscriptions.push({
        name: `clients-${currentUser.id}-${activeSection}`,
        table: 'clients',
        refresh: () => loadClientsFromSupabase(currentUser.id, false),
      });
    }

    if (watchProviders) {
      subscriptions.push({
        name: `providers-${currentUser.id}-${activeSection}`,
        table: 'providers',
        refresh: () => loadProvidersFromSupabase(currentUser.id, false),
      });
    }

    if (watchPurchases) {
      subscriptions.push({
        name: `purchases-${currentUser.id}-${activeSection}`,
        table: 'purchases',
        refresh: async () => {
          await loadPurchasesFromSupabase(currentUser.id, false);
          if (watchProducts) await loadProductsFromSupabase(currentUser.id, false);
        },
      });
    }

    if (watchExpenses) {
      subscriptions.push({
        name: `expenses-${currentUser.id}-${activeSection}`,
        table: 'expenses',
        refresh: () => loadExpensesFromSupabase(currentUser.id, false),
      });
    }

    const channels = subscriptions.map(subscription => (
      supabase
        .channel(subscription.name)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: subscription.table,
            filter: `user_id=eq.${currentUser.id}`,
          },
          subscription.refresh
        )
        .subscribe()
    ));

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [active, currentUser?.id]);

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

    const accessBlockReason = getAccountAccessBlockReason(profile, sessionUser.email);

    if (accessBlockReason) {
      await supabase.auth.signOut();
      localStorage.removeItem(STORAGE_KEYS.currentUser);
      setCurrentUser(null);
      setActive('Inicio');
      setAuthMode('login');
      setAuthNotice({
        type: 'error',
        message: accessBlockReason,
      });
      return;
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
      plan: profile?.plan || 'anual',
      subscriptionStatus: profile?.subscription_status || 'activo',
      subscriptionStart: profile?.subscription_start || '',
      subscriptionEnd: profile?.subscription_end || '',
      isSuspended: Boolean(profile?.is_suspended),
      maxProducts: profile?.max_products || 2000,
      splitPaymentEnabled: Boolean(profile?.split_payment_enabled),
      customerAccountsEnabled: Boolean(profile?.customer_accounts_enabled),
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

  const categories = useMemo(() => {
    const productCategoryNames = storeProducts
      .map(product => product.category)
      .filter(Boolean);

    return [
      'Todas',
      ...Array.from(new Set([...customProductCategories, ...productCategoryNames])),
    ];
  }, [storeProducts, customProductCategories]);

  const productCategories = useMemo(
    () => categories.filter(cat => cat !== 'Todas'),
    [categories]
  );

  useEffect(() => {
    if (!currentUser?.id) return;

    const savedCategories = loadFromStorage(
      `inventiq_custom_categories_${currentUser.id}`,
      []
    );

    setCustomProductCategories(Array.isArray(savedCategories) ? savedCategories : []);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    saveToStorage(
      `inventiq_custom_categories_${currentUser.id}`,
      customProductCategories
    );
  }, [currentUser?.id, customProductCategories]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    const searchLooksLikeCode = looksLikeBarcodeSearch(search);

    return storeProducts.filter(product => {
      const matchCategory = category === 'Todas' || product.category === category;

      if (!text) {
        return matchCategory;
      }

      const matchSearch = searchLooksLikeCode
        ? (
          String(product.barcode || '').trim().toLowerCase() === text ||
          String(product.sku || '').trim().toLowerCase() === text
        )
        : [
          product.name,
          product.sku,
          product.barcode,
          product.brand,
          product.size,
          product.color,
          product.category,
        ].some(value => String(value || '').toLowerCase().includes(text));

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
    const completedSales = storeSales.filter(sale => sale.status !== 'Anulada');
    const totalSales = completedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalProfit = completedSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
    const totalDiscount = completedSales.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
    const totalUnitsSold = completedSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
    const topProduct = completedSales.reduce((acc, sale) => {
      acc[sale.product] = (acc[sale.product] || 0) + Number(sale.quantity || 0);
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

  function validateProduct(finalCategory, price, cost, stock, minStock, options = {}) {
    const isFoodIngredient = Boolean(options.isFoodIngredient);

    if (!form.name.trim()) {
      return isFoodIngredient ? 'Ingresa el nombre del insumo.' : 'Ingresa el nombre del producto.';
    }

    if (!finalCategory.trim()) return 'Selecciona o crea una categoría.';

    if (isFoodIngredient) {
      if (Number.isNaN(price) || price < 0) return 'El precio referencial no puede ser negativo.';
    } else if (Number.isNaN(price) || price <= 0) {
      return 'El precio de venta debe ser mayor a 0.';
    }

    if (Number.isNaN(cost) || cost < 0) return 'El costo no puede ser negativo. Si no lo conoces, déjalo vacío.';
    if (Number.isNaN(stock) || stock < 0) return 'El stock no puede ser negativo.';
    if (Number.isNaN(minStock) || minStock < 0) return 'El stock mínimo no puede ser negativo.';
    if (!isFoodIngredient && cost > 0 && cost > price) return 'El costo no debería ser mayor al precio de venta.';

    return null;
  }

  async function loadProductsFromSupabase(userId, showLoader = true) {
    if (showLoader) setProductsLoading(true);

    try {
      const pageSize = 1000;
      let from = 0;
      let to = pageSize - 1;
      let allProducts = [];
      let keepLoading = true;

      while (keepLoading) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          throw error;
        }

        const currentBatch = data || [];
        allProducts = [...allProducts, ...currentBatch];

        if (currentBatch.length < pageSize) {
          keepLoading = false;
        } else {
          from += pageSize;
          to += pageSize;
        }
      }

      setProducts(allProducts.map(mapProductFromDb));
      loadedDataRef.current.products = true;
    } catch (error) {
      console.error('Error cargando productos:', error);

      setNotice({
        type: 'error',
        message: `No se pudieron cargar los productos desde Supabase: ${error.message}`,
      });
    } finally {
      if (showLoader) setProductsLoading(false);
    }
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

    setSales((data || []).map(sale => ({
      ...mapSaleFromDb(sale),
      cashAmount: Number(sale.cash_amount || 0),
      cardAmount: Number(sale.card_amount || 0),
      transferAmount: Number(sale.transfer_amount || 0),
      items: itemsBySale[sale.id] || [],
    })));
    loadedDataRef.current.sales = true;
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

    setClients((data || []).map(mapClientWithAccountsFromDb));
    loadedDataRef.current.clients = true;
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
    loadedDataRef.current.providers = true;
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
    loadedDataRef.current.purchases = true;
    if (showLoader) setPurchasesLoading(false);
  }

  async function saveProduct(e) {
    e.preventDefault();

    const finalCategory = form.category === '__new__' ? form.customCategory.trim() : form.category.trim();
    const categoryText = finalCategory.toLowerCase();
    const isFoodIngredient = currentUser?.businessType === 'cafeteria' && (
      categoryText.startsWith('insumos -') || categoryText.includes('insumos')
    );
    const price = isFoodIngredient ? Number(form.price || 0) : Number(form.price);
    const cost = Number(form.cost || 0);
    const stock = Number(form.stock);
    const minStock = Number(form.minStock || 0);
    const validationError = validateProduct(finalCategory, price, cost, stock, minStock, { isFoodIngredient });

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

    setCustomProductCategories(prev =>
      Array.from(new Set([...prev, finalCategory].filter(Boolean)))
    );

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
      const optimizedFile = await optimizeImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.72 });
      const previewUrl = await fileToDataUrl(optimizedFile);
      setForm(prev => ({ ...prev, imageUrl: previewUrl, imageFile: optimizedFile }));
      setNotice({ type: 'success', message: `Imagen optimizada. Peso final: ${(optimizedFile.size / 1024).toFixed(0)} KB.` });
    } catch (error) {
      console.error('Error optimizando imagen:', error);
      setNotice({ type: 'error', message: 'No se pudo optimizar la imagen. Intenta con otra foto.' });
    }
  }

  function updateSaleItemDiscount(productId, changes) {
    setSaleCart(currentCart => currentCart.map(item => {
      if (String(item.productId) !== String(productId)) return item;
      return normalizeSaleCartItem({ ...item, ...changes });
    }));
  }

  function calculateSalePreview() {
    return buildSalePreview({
      businessConfig,
      storeProducts,
      saleForm,
      saleCart,
    });
  }

  function addSaleItem(productIdOverride = null, quantityOverride = null) {
    const receivedEvent = Boolean(
      productIdOverride &&
      typeof productIdOverride === 'object' &&
      typeof productIdOverride.preventDefault === 'function'
    );
    const selectedProductId = receivedEvent ? saleForm.productId : productIdOverride ?? saleForm.productId;
    const selectedQuantity = receivedEvent ? saleForm.quantity : quantityOverride ?? saleForm.quantity;
    const product = storeProducts.find(p => String(p.id) === String(selectedProductId));
    const quantity = Number(selectedQuantity || 0);

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
        ? normalizeSaleCartItem({
          ...item,
          quantity: item.quantity + quantity,
        })
        : item
      ));
    } else {
      setSaleCart([
        ...saleCart,
        normalizeSaleCartItem({
          productId: product.id,
          product: getProductDisplayName(product),
          quantity,
          price: product.price,
          cost: product.cost,
          discountType: 'percent',
          discountValue: '',
        }),
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

  async function loadExpensesFromSupabase(userId, showLoader = true) {
    if (!userId) return;
    if (showLoader) setExpensesLoading(true);

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('due_day', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando gastos:', error);
      setExpenseNotice({ type: 'error', message: `No se pudieron cargar los gastos: ${error.message}` });
    } else {
      setExpenses((data || []).map(mapExpenseFromDb));
      loadedDataRef.current.expenses = true;
    }

    if (showLoader) setExpensesLoading(false);
  }

  function resetExpenseForm() {
    setExpenseForm(createEmptyExpenseForm());
    setEditingExpenseId(null);
    clearDraft(currentUser?.id, 'expenseForm');
  }

  async function saveExpense(event) {
    event?.preventDefault?.();
    setExpenseNotice(null);

    const description = expenseForm.description.trim();
    const amount = Number(expenseForm.amount || 0);
    const dueDay = Number(expenseForm.dueDay || 0);

    if (!description) {
      setExpenseNotice({ type: 'error', message: 'Escribe una descripción del gasto.' });
      return;
    }

    if (!amount || amount <= 0) {
      setExpenseNotice({ type: 'error', message: 'El valor estimado debe ser mayor a 0.' });
      return;
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setExpenseNotice({ type: 'error', message: 'El día de pago debe estar entre 1 y 31.' });
      return;
    }

    const expenseData = {
      storeId: storeKey,
      storeName: currentUser?.store || 'Mi Tienda',
      category: expenseForm.category || 'Otros gastos',
      description,
      amount,
      paymentMethod: expenseForm.paymentMethod || 'Efectivo',
      expenseDate: getTodayInputDate(),
      dueDay,
      isActive: expenseForm.isActive !== false,
      lastPaidMonth: expenseForm.lastPaidMonth || '',
      paymentHistory: Array.isArray(expenseForm.paymentHistory) ? expenseForm.paymentHistory : [],
      notes: String(expenseForm.notes || '').trim(),
    };

    const payload = mapExpenseToDb(expenseData, currentUser.id);

    if (editingExpenseId) {
      const { data, error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', editingExpenseId)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) {
        setExpenseNotice({ type: 'error', message: error.message });
        return;
      }

      const updatedExpense = mapExpenseFromDb(data);
      setExpenses(expenses.map(expense => expense.id === editingExpenseId ? updatedExpense : expense));
      setExpenseNotice({ type: 'success', message: 'Gasto fijo actualizado correctamente.' });
    } else {
      const { data, error } = await supabase
        .from('expenses')
        .insert([payload])
        .select()
        .single();

      if (error) {
        setExpenseNotice({ type: 'error', message: error.message });
        return;
      }

      setExpenses([mapExpenseFromDb(data), ...expenses]);
      setExpenseNotice({ type: 'success', message: 'Gasto fijo registrado correctamente.' });
    }

    resetExpenseForm();
  }

  async function markExpensePaid(expense, paymentData = {}) {
    if (!expense?.id || !currentUser?.id) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paidAmount = Number(paymentData.amount ?? expense.amount ?? 0);

    if (!paidAmount || paidAmount <= 0) {
      setExpenseNotice({ type: 'error', message: 'El monto pagado debe ser mayor a 0.' });
      return;
    }

    const payment = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      month: currentMonth,
      amount: paidAmount,
      paymentMethod: paymentData.paymentMethod || expense.paymentMethod || 'Efectivo',
      paidAt: now.toISOString(),
      description: expense.description || '',
      category: expense.category || 'Otros gastos fijos',
      notes: String(paymentData.notes || '').trim(),
    };
    const updatedHistory = [...(Array.isArray(expense.paymentHistory) ? expense.paymentHistory : []), payment];

    const { data, error } = await supabase
      .from('expenses')
      .update({
        last_paid_month: currentMonth,
        payment_history: updatedHistory,
      })
      .eq('id', expense.id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) {
      setExpenseNotice({ type: 'error', message: error.message });
      return;
    }

    const updatedExpense = mapExpenseFromDb(data);
    setExpenses(expenses.map(item => item.id === expense.id ? updatedExpense : item));
    setExpenseNotice({ type: 'success', message: `Pago de ${expense.description} registrado correctamente.` });
  }

  function editExpense(expense) {
    setEditingExpenseId(expense.id);
    setExpenseNotice(null);
    setExpenseForm({
      category: expense.category || 'Otros gastos',
      description: expense.description || '',
      amount: expense.amount || '',
      dueDay: String(expense.dueDay || 1),
      paymentMethod: expense.paymentMethod || 'Efectivo',
      isActive: expense.isActive !== false,
      lastPaidMonth: expense.lastPaidMonth || '',
      paymentHistory: Array.isArray(expense.paymentHistory) ? expense.paymentHistory : [],
      notes: expense.notes || '',
    });
  }

  async function deleteExpense(id) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) {
      setExpenseNotice({ type: 'error', message: error.message });
      return;
    }

    setExpenses(expenses.filter(expense => expense.id !== id));
    setPendingDeleteExpenseId(null);
    setExpenseNotice({ type: 'success', message: 'Gasto fijo eliminado correctamente.' });
  }


  function resetPurchaseForm() {
    setPurchaseForm(emptyPurchaseForm);
    setPurchaseCart([]);
    setPurchaseNotice(null);
    clearDraft(currentUser?.id, 'purchaseForm');
    clearDraft(currentUser?.id, 'purchaseCart');
  }

  function normalizeRecipeUnit(unit) {
    const text = String(unit || '').trim().toLowerCase();

    if (!text) return '';
    if (text.includes('mililitro') || text === 'ml' || text.endsWith(' ml')) return 'ml';
    if (text.includes('litro') || text === 'l' || text.endsWith(' l') || /\d+l$/.test(text)) return 'l';
    if (text.includes('kilogramo') || text === 'kg' || text.endsWith(' kg')) return 'kg';
    if (text.includes('gramo') || text === 'g' || text === 'gr' || text.endsWith(' g') || text.endsWith(' gr')) return 'g';
    if (text.includes('miligramo') || text === 'mg' || text.endsWith(' mg')) return 'mg';
    if (text.includes('unidad') || text.includes('unid') || text === 'u' || text === 'und' || text.includes('pieza') || text.includes('pz')) return 'unidad';

    return text;
  }

  function getUnitFamily(unit) {
    if (['ml', 'l'].includes(unit)) return 'volume';
    if (['mg', 'g', 'kg'].includes(unit)) return 'mass';
    if (['unidad'].includes(unit)) return 'unit';
    return 'custom';
  }

  function getUnitFactor(unit) {
    const factors = {
      ml: 1,
      l: 1000,
      mg: 1,
      g: 1000,
      kg: 1000000,
      unidad: 1,
    };

    return factors[unit] || 1;
  }

  function convertRecipeQuantityToStockUnit(quantity, recipeUnit, stockUnit) {
    const normalizedRecipeUnit = normalizeRecipeUnit(recipeUnit);
    const normalizedStockUnit = normalizeRecipeUnit(stockUnit);

    if (!normalizedRecipeUnit || !normalizedStockUnit || normalizedRecipeUnit === normalizedStockUnit) {
      return quantity;
    }

    const recipeFamily = getUnitFamily(normalizedRecipeUnit);
    const stockFamily = getUnitFamily(normalizedStockUnit);

    if (recipeFamily === 'custom' || stockFamily === 'custom' || recipeFamily !== stockFamily) {
      return null;
    }

    return (quantity * getUnitFactor(normalizedRecipeUnit)) / getUnitFactor(normalizedStockUnit);
  }

  async function buildRecipeIngredientAdjustments(cartItems, sourceProducts, direction = 'subtract') {
    const isCafeteria = currentUser?.businessType === 'cafeteria';

    if (!isCafeteria || !Array.isArray(cartItems) || cartItems.length === 0) {
      return { updates: [], errorMessage: '' };
    }

    const menuProductIds = Array.from(new Set(
      cartItems
        .map(item => item.productId)
        .filter(Boolean)
        .map(String)
    ));

    if (menuProductIds.length === 0) {
      return { updates: [], errorMessage: '' };
    }

    const { data: recipeRows, error: recipeError } = await supabase
      .from('product_recipes')
      .select('*')
      .eq('user_id', currentUser.id)
      .in('menu_product_id', menuProductIds);

    if (recipeError) {
      return {
        updates: [],
        errorMessage: `No se pudieron cargar las recetas: ${recipeError.message}`,
      };
    }

    if (!recipeRows?.length) {
      return { updates: [], errorMessage: '' };
    }

    const quantityByMenuProduct = cartItems.reduce((acc, item) => {
      const key = String(item.productId || '');
      acc[key] = (acc[key] || 0) + Number(item.quantity || 0);
      return acc;
    }, {});

    const requiredByIngredient = {};

    for (const recipe of recipeRows) {
      const menuQuantity = quantityByMenuProduct[String(recipe.menu_product_id)] || 0;
      const ingredientId = String(recipe.ingredient_product_id || '');
      const ingredient = sourceProducts.find(product => String(product.id) === String(ingredientId));

      if (!ingredientId || menuQuantity <= 0) continue;

      if (!ingredient) {
        return {
          updates: [],
          errorMessage: 'No se encontró uno de los insumos de la receta. Revisa la receta antes de vender.',
        };
      }

      const recipeQuantity = Number(recipe.quantity || 0);
      const stockUnit = ingredient.unit || ingredient.size || '';
      const convertedQuantity = convertRecipeQuantityToStockUnit(recipeQuantity, recipe.unit, stockUnit);

      if (convertedQuantity === null) {
        return {
          updates: [],
          errorMessage: `No se pudo convertir la unidad de ${ingredient.name}. Receta: ${recipe.quantity} ${recipe.unit || ''}, stock en: ${stockUnit || 'sin unidad'}.`,
        };
      }

      const requiredQuantity = convertedQuantity * menuQuantity;

      if (requiredQuantity <= 0) continue;

      requiredByIngredient[ingredientId] = (requiredByIngredient[ingredientId] || 0) + requiredQuantity;
    }

    const updates = [];

    for (const [ingredientId, requiredQuantity] of Object.entries(requiredByIngredient)) {
      const ingredient = sourceProducts.find(product => String(product.id) === String(ingredientId));

      if (!ingredient) {
        return {
          updates: [],
          errorMessage: 'No se encontró uno de los insumos de la receta. Revisa la receta antes de vender.',
        };
      }

      const currentStock = Number(ingredient.stock || 0);
      const nextStock = direction === 'restore'
        ? currentStock + requiredQuantity
        : currentStock - requiredQuantity;

      if (direction !== 'restore' && nextStock < 0) {
        return {
          updates: [],
          errorMessage: `Stock insuficiente del insumo "${ingredient.name}". Necesitas ${requiredQuantity}, disponible: ${currentStock}.`,
        };
      }

      updates.push({
        product: ingredient,
        requiredQuantity,
        nextStock,
        nextStatus: nextStock === 0 ? 'Inactivo' : 'Activo',
      });
    }

    return { updates, errorMessage: '' };
  }

  function buildFoodOrderCustomer() {
    if (currentUser?.businessType !== 'cafeteria') return null;

    const labels = {
      local: 'En local',
      takeaway: 'Para llevar',
      delivery: 'Delivery',
    };

    const orderType = saleForm.orderType || 'local';
    const parts = [labels[orderType] || 'En local'];
    const reference = String(saleForm.orderReference || '').trim();
    const notes = String(saleForm.orderNotes || '').trim();

    if (reference) {
      parts.push(reference);
    }

    if (notes) {
      parts.push(`Nota: ${notes}`);
    }

    return parts.join(' · ');
  }

  async function registerSale(e) {
    e.preventDefault();
    const preview = calculateSalePreview();
    const { discount, discountPercent, subtotal, total, profit, error } = preview;
    const splitPaymentEnabled = isSplitPaymentAvailable(currentUser);
    const isSplitPayment = splitPaymentEnabled && saleForm.paymentMethod === 'Mixto';
    const splitAmounts = isSplitPayment ? getSplitPaymentAmounts(saleForm) : { cashAmount: 0, cardAmount: 0, transferAmount: 0 };
    const splitTotal = isSplitPayment ? getSplitPaymentTotal(saleForm) : 0;

    if (saleCart.length === 0) {
      setSaleNotice({ type: 'error', message: 'Agrega al menos un producto al carrito.' });
      return;
    }

    if (error) {
      setSaleNotice({ type: 'error', message: error });
      return;
    }

    if (isSplitPayment) {
      if (splitTotal <= 0) {
        setSaleNotice({ type: 'error', message: 'Ingresa al menos un valor para el pago mixto.' });
        return;
      }

      if (Math.abs(splitTotal - toMoneyNumber(total)) > 0.01) {
        setSaleNotice({ type: 'error', message: `El pago mixto debe sumar exactamente $${toMoneyNumber(total).toFixed(2)}. Actualmente suma $${splitTotal.toFixed(2)}.` });
        return;
      }
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

    const { updates: recipeStockUpdates, errorMessage: recipeErrorMessage } = await buildRecipeIngredientAdjustments(saleCart, storeProducts, 'subtract');

    if (recipeErrorMessage) {
      setSaleNotice({ type: 'error', message: recipeErrorMessage });
      return;
    }

    const normalizedSaleCart = businessConfig.salesMode === 'food' ? saleCart : saleCart.map(normalizeSaleCartItem);
    const totalQuantity = normalizedSaleCart.reduce((sum, item) => sum + item.quantity, 0);
    const productSummary = normalizedSaleCart.length === 1 ? normalizedSaleCart[0].product : `${normalizedSaleCart.length} productos`;

    const newSale = {
      code: `V-${String(storeSales.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      storeName: currentUser.store,
      productId: normalizedSaleCart.length === 1 ? normalizedSaleCart[0].productId : null,
      product: productSummary,
      customer: buildFoodOrderCustomer() || (saleForm.saleType === 'factura' ? (saleForm.customer || saleForm.invoiceName || 'Cliente con factura') : 'Consumidor final'),
      paymentMethod: isSplitPayment ? 'Mixto' : saleForm.paymentMethod,
      cashAmount: splitAmounts.cashAmount,
      cardAmount: splitAmounts.cardAmount,
      transferAmount: splitAmounts.transferAmount,
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

    const salePayload = {
      ...mapSaleToDb(newSale, currentUser.id),
      cash_amount: newSale.cashAmount || 0,
      card_amount: newSale.cardAmount || 0,
      transfer_amount: newSale.transferAmount || 0,
    };

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert(salePayload)
      .select()
      .single();

    if (saleError) {
      console.error('Error registrando venta:', saleError);
      setSaleNotice({ type: 'error', message: `No se pudo registrar la venta: ${saleError.message}` });
      return;
    }

    const itemsPayload = normalizedSaleCart.map(item => mapSaleItemToDb(item, saleData.id, currentUser.id));
    const { error: itemsError } = await supabase.from('sale_items').insert(itemsPayload);

    if (itemsError) {
      console.error('Error guardando detalle de venta:', itemsError);
      setSaleNotice({ type: 'error', message: `La venta se creó, pero no se guardó el detalle: ${itemsError.message}` });
      return;
    }

    for (const item of normalizedSaleCart) {
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

    for (const ingredientUpdate of recipeStockUpdates) {
      const { product, nextStock, nextStatus } = ingredientUpdate;

      const { error: ingredientError } = await supabase
        .from('products')
        .update({ stock: nextStock, status: nextStatus })
        .eq('id', product.id)
        .eq('user_id', currentUser.id);

      if (ingredientError) {
        console.error('Error descontando insumo:', ingredientError);
        setSaleNotice({ type: 'error', message: `La venta se registró, pero no se pudo descontar el insumo ${product.name}: ${ingredientError.message}` });
        await loadSalesFromSupabase(currentUser.id, false);
        await loadProductsFromSupabase(currentUser.id, false);
        return;
      }
    }

    setSaleForm(emptySaleForm);
    setSaleCart([]);
    clearDraft(currentUser?.id, 'saleForm');
    clearDraft(currentUser?.id, 'saleCart');

    const recipeMessage = recipeStockUpdates.length > 0
      ? ` También se descontaron ${recipeStockUpdates.length} insumo(s) de recetas.`
      : '';

    setSaleNotice({ type: 'success', message: `Venta ${newSale.code} registrada correctamente con ${normalizedSaleCart.length} producto(s).${recipeMessage}` });
    await loadSalesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
  }

  async function cancelSale(id) {
    const sale = storeSales.find(s => s.id === id);
    if (!sale || !currentUser?.id) return;

    const items = sale.items?.length > 0
      ? sale.items
      : [{ productId: sale.productId, product: sale.product, quantity: sale.quantity }];

    const { updates: recipeRestoreUpdates, errorMessage: recipeRestoreError } = await buildRecipeIngredientAdjustments(items, products, 'restore');

    if (recipeRestoreError) {
      setSaleNotice({ type: 'error', message: recipeRestoreError });
      return;
    }

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

    for (const ingredientUpdate of recipeRestoreUpdates) {
      const { product, nextStock } = ingredientUpdate;

      const { error: ingredientError } = await supabase
        .from('products')
        .update({ stock: nextStock, status: 'Activo' })
        .eq('id', product.id)
        .eq('user_id', currentUser.id);

      if (ingredientError) {
        console.error('Error devolviendo insumo:', ingredientError);
        setSaleNotice({ type: 'error', message: `Venta anulada, pero no se pudo devolver el insumo ${product.name}: ${ingredientError.message}` });
        await loadSalesFromSupabase(currentUser.id, false);
        await loadProductsFromSupabase(currentUser.id, false);
        return;
      }
    }

    await loadSalesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);

    const recipeMessage = recipeRestoreUpdates.length > 0
      ? ` También se devolvieron ${recipeRestoreUpdates.length} insumo(s) de recetas.`
      : '';

    setSaleNotice({ type: 'success', message: `Venta anulada y stock devuelto correctamente.${recipeMessage}` });
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

      const updatedClient = mapClientWithAccountsFromDb(data);
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

      setClients([mapClientWithAccountsFromDb(data), ...clients]);
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

  async function createCustomerAccountPaymentSale({ client, item, amount, paymentMethod, note }) {
    const safeAmount = toMoneyNumber(amount);
    if (!currentUser?.id || safeAmount <= 0) return null;

    const method = paymentMethod || 'Efectivo';
    const cashAmount = method === 'Efectivo' ? safeAmount : 0;
    const cardAmount = method === 'Tarjeta' ? safeAmount : 0;
    const transferAmount = method === 'Transferencia' ? safeAmount : 0;
    const typeLabel = item.type === 'fiado' ? 'fiado' : 'plan acumulativo';

    const newSale = {
      code: `V-${String(storeSales.length + 1).padStart(4, '0')}`,
      storeId: storeKey,
      storeName: currentUser.store,
      productId: null,
      product: `Abono ${typeLabel}: ${item.productName}`,
      customer: client.name || 'Cliente',
      paymentMethod: method,
      cashAmount,
      cardAmount,
      transferAmount,
      invoiceEnabled: false,
      invoiceName: '',
      invoiceIdentification: '',
      invoiceAddress: '',
      invoiceEmail: '',
      quantity: 0,
      subtotal: safeAmount,
      discount: 0,
      discountPercent: 0,
      total: safeAmount,
      profit: 0,
      status: 'Completada',
    };

    const salePayload = {
      ...mapSaleToDb(newSale, currentUser.id),
      cash_amount: cashAmount,
      card_amount: cardAmount,
      transfer_amount: transferAmount,
    };

    const { data, error } = await supabase
      .from('sales')
      .insert(salePayload)
      .select()
      .single();

    if (error) {
      console.error('Error registrando abono como ingreso:', error);
      throw new Error(`No se pudo registrar el abono en ventas/caja: ${error.message}`);
    }

    return {
      ...mapSaleFromDb(data),
      cashAmount,
      cardAmount,
      transferAmount,
      items: [],
      accountPaymentNote: note || '',
    };
  }

  async function addClientAccountItem(clientId, accountForm) {
    if (!isCustomerAccountsAvailable(currentUser)) {
      setClientNotice({ type: 'error', message: 'Esta función está disponible solo para KUEHNS 5.' });
      return false;
    }

    const client = storeClients.find(item => String(item.id) === String(clientId));
    const productSearch = String(accountForm.productSearch || '').trim().toLowerCase();
    const product = storeProducts.find(item => String(item.id) === String(accountForm.productId)) || storeProducts.find(item => {
      if (!productSearch) return false;
      const exactValues = [item.barcode, item.sku, item.code].filter(Boolean).map(value => String(value).trim().toLowerCase());
      if (exactValues.includes(productSearch)) return true;
      return getProductDisplayName(item).toLowerCase().includes(productSearch);
    });
    const quantity = Number(accountForm.quantity || 0);
    const unitPrice = Number(accountForm.unitPrice || 0);
    const initialPayment = toMoneyNumber(accountForm.initialPayment);
    const total = toMoneyNumber(quantity * unitPrice);

    if (!client) {
      setClientNotice({ type: 'error', message: 'No se encontró el cliente.' });
      return false;
    }

    if (!product) {
      setClientNotice({ type: 'error', message: 'Selecciona la prenda que quedará pendiente.' });
      return false;
    }

    if (quantity <= 0 || Number.isNaN(quantity)) {
      setClientNotice({ type: 'error', message: 'La cantidad debe ser mayor a 0.' });
      return false;
    }

    if (unitPrice <= 0 || Number.isNaN(unitPrice)) {
      setClientNotice({ type: 'error', message: 'Ingresa el valor acordado de la prenda.' });
      return false;
    }

    if (initialPayment < 0 || initialPayment > total) {
      setClientNotice({ type: 'error', message: 'El abono inicial no puede ser negativo ni mayor al total.' });
      return false;
    }

    if (initialPayment >= total && Number(product.stock || 0) < quantity) {
      setClientNotice({ type: 'error', message: `No hay stock suficiente para completar la venta de ${product.name}. Disponible: ${product.stock}.` });
      return false;
    }

    const now = new Date().toISOString();
    const paid = toMoneyNumber(initialPayment);
    const status = paid >= total ? 'Pagado' : 'Pendiente';
    const newItem = {
      id: makeLocalId('cuenta'),
      type: accountForm.type === 'fiado' ? 'fiado' : 'acumulativo',
      productId: product.id,
      productName: getProductDisplayName(product),
      quantity,
      unitPrice: toMoneyNumber(unitPrice),
      total,
      paid,
      status,
      note: accountForm.note || '',
      createdAt: now,
      completedAt: status === 'Pagado' ? now : '',
      payments: paid > 0 ? [{
        id: makeLocalId('abono'),
        amount: paid,
        paymentMethod: accountForm.paymentMethod || 'Efectivo',
        note: accountForm.note || 'Abono inicial',
        createdAt: now,
      }] : [],
    };

    const nextItems = [newItem, ...safeJsonArray(client.accountItems)];
    const nextHistory = paid > 0
      ? [{
        id: makeLocalId('historial'),
        itemId: newItem.id,
        itemName: newItem.productName,
        amount: paid,
        paymentMethod: accountForm.paymentMethod || 'Efectivo',
        note: accountForm.note || 'Abono inicial',
        createdAt: now,
      }, ...safeJsonArray(client.paymentHistory)]
      : safeJsonArray(client.paymentHistory);

    try {
      if (paid > 0) {
        await createCustomerAccountPaymentSale({
          client,
          item: newItem,
          amount: paid,
          paymentMethod: accountForm.paymentMethod || 'Efectivo',
          note: accountForm.note || 'Abono inicial',
        });
      }

      if (status === 'Pagado') {
        const nextStock = Number(product.stock || 0) - quantity;
        const { error: productError } = await supabase
          .from('products')
          .update({ stock: nextStock, status: nextStock === 0 ? 'Inactivo' : 'Activo' })
          .eq('id', product.id)
          .eq('user_id', currentUser.id);

        if (productError) {
          throw new Error(`El abono se registró, pero no se pudo descontar stock: ${productError.message}`);
        }
      }

      const { data, error } = await supabase
        .from('clients')
        .update({ account_items: nextItems, payment_history: nextHistory })
        .eq('id', client.id)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      setClients(prev => prev.map(item => String(item.id) === String(client.id) ? mapClientWithAccountsFromDb(data) : item));
      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
      setClientNotice({ type: 'success', message: status === 'Pagado' ? 'Prenda pagada y stock descontado correctamente.' : 'Prenda agregada al cliente correctamente.' });
      return true;
    } catch (error) {
      console.error('Error guardando prenda pendiente:', error);
      setClientNotice({ type: 'error', message: error.message || 'No se pudo guardar la prenda pendiente.' });
      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
      return false;
    }
  }

  async function addClientAccountPayment(clientId, accountItemId, paymentForm) {
    if (!isCustomerAccountsAvailable(currentUser)) {
      setClientNotice({ type: 'error', message: 'Esta función está disponible solo para KUEHNS 5.' });
      return false;
    }

    const client = storeClients.find(item => String(item.id) === String(clientId));
    if (!client) {
      setClientNotice({ type: 'error', message: 'No se encontró el cliente.' });
      return false;
    }

    const currentItems = safeJsonArray(client.accountItems);
    const accountItem = currentItems.find(item => String(item.id) === String(accountItemId));
    if (!accountItem) {
      setClientNotice({ type: 'error', message: 'No se encontró la prenda pendiente.' });
      return false;
    }

    if (accountItem.status === 'Pagado' || accountItem.status === 'Cancelado') {
      setClientNotice({ type: 'error', message: 'Esta prenda ya no tiene saldo pendiente.' });
      return false;
    }

    const amount = toMoneyNumber(paymentForm.amount);
    const pending = toMoneyNumber(Number(accountItem.total || 0) - Number(accountItem.paid || 0));

    if (amount <= 0) {
      setClientNotice({ type: 'error', message: 'El abono debe ser mayor a 0.' });
      return false;
    }

    if (amount > pending) {
      setClientNotice({ type: 'error', message: `El abono no puede ser mayor al saldo pendiente de $${pending.toFixed(2)}.` });
      return false;
    }

    const willComplete = amount >= pending - 0.01;
    const product = storeProducts.find(item => String(item.id) === String(accountItem.productId));

    if (willComplete) {
      if (!product) {
        setClientNotice({ type: 'error', message: 'No se encontró el producto para descontar del inventario.' });
        return false;
      }

      if (Number(product.stock || 0) < Number(accountItem.quantity || 0)) {
        setClientNotice({ type: 'error', message: `No hay stock suficiente para completar la venta de ${accountItem.productName}. Disponible: ${product.stock}.` });
        return false;
      }
    }

    const now = new Date().toISOString();
    const payment = {
      id: makeLocalId('abono'),
      amount,
      paymentMethod: paymentForm.paymentMethod || 'Efectivo',
      note: paymentForm.note || '',
      createdAt: now,
    };

    const nextItems = currentItems.map(item => {
      if (String(item.id) !== String(accountItemId)) return item;
      const paid = toMoneyNumber(Number(item.paid || 0) + amount);
      const status = paid >= Number(item.total || 0) - 0.01 ? 'Pagado' : 'Pendiente';
      return {
        ...item,
        paid,
        status,
        completedAt: status === 'Pagado' ? now : item.completedAt || '',
        payments: [...safeJsonArray(item.payments), payment],
      };
    });

    const nextHistory = [{
      id: makeLocalId('historial'),
      itemId: accountItem.id,
      itemName: accountItem.productName,
      amount,
      paymentMethod: payment.paymentMethod,
      note: payment.note,
      createdAt: now,
    }, ...safeJsonArray(client.paymentHistory)];

    try {
      await createCustomerAccountPaymentSale({
        client,
        item: accountItem,
        amount,
        paymentMethod: payment.paymentMethod,
        note: payment.note,
      });

      if (willComplete) {
        const nextStock = Number(product.stock || 0) - Number(accountItem.quantity || 0);
        const { error: productError } = await supabase
          .from('products')
          .update({ stock: nextStock, status: nextStock === 0 ? 'Inactivo' : 'Activo' })
          .eq('id', product.id)
          .eq('user_id', currentUser.id);

        if (productError) {
          throw new Error(`El abono se registró, pero no se pudo descontar stock: ${productError.message}`);
        }
      }

      const { data, error } = await supabase
        .from('clients')
        .update({ account_items: nextItems, payment_history: nextHistory })
        .eq('id', client.id)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      setClients(prev => prev.map(item => String(item.id) === String(client.id) ? mapClientWithAccountsFromDb(data) : item));
      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
      setClientNotice({ type: 'success', message: willComplete ? 'Abono registrado. La prenda quedó pagada y se descontó del inventario.' : 'Abono registrado correctamente.' });
      return true;
    } catch (error) {
      console.error('Error registrando abono:', error);
      setClientNotice({ type: 'error', message: error.message || 'No se pudo registrar el abono.' });
      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
      return false;
    }
  }

  async function cancelClientAccountItem(clientId, accountItemId) {
    if (!isCustomerAccountsAvailable(currentUser)) return false;

    const client = storeClients.find(item => String(item.id) === String(clientId));
    if (!client) return false;

    const currentItems = safeJsonArray(client.accountItems);
    const accountItem = currentItems.find(item => String(item.id) === String(accountItemId));

    if (!accountItem) {
      setClientNotice({ type: 'error', message: 'No se encontró la prenda pendiente.' });
      return false;
    }

    if (accountItem.status === 'Pagado') {
      setClientNotice({ type: 'error', message: 'Esta prenda ya está pagada. Si hubo devolución, anula la venta desde el historial correspondiente.' });
      return false;
    }

    const paid = Number(accountItem.paid || 0);
    const confirmMessage = paid > 0
      ? `Esta prenda tiene $${toMoneyNumber(paid).toFixed(2)} en abonos registrados. Se quitará de los pendientes del cliente, pero los abonos quedarán en el historial de pagos/ingresos. ¿Deseas continuar?`
      : '¿Deseas quitar esta prenda fiada o en plan acumulativo?';

    if (!window.confirm(confirmMessage)) {
      return false;
    }

    const nextItems = currentItems.map(item => String(item.id) === String(accountItemId) ? { ...item, status: 'Cancelado', canceledAt: new Date().toISOString() } : item);

    const { data, error } = await supabase
      .from('clients')
      .update({ account_items: nextItems })
      .eq('id', client.id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) {
      setClientNotice({ type: 'error', message: `No se pudo cancelar: ${error.message}` });
      return false;
    }

    setClients(prev => prev.map(item => String(item.id) === String(client.id) ? mapClientWithAccountsFromDb(data) : item));
    setClientNotice({ type: 'success', message: 'Prenda quitada de fiado / plan acumulativo.' });
    return true;
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

  const businessConfig = getBusinessConfig(currentUser?.businessType);

  const pageInfo = {
    Inicio: { title: 'Inicio', subtitle: 'Resumen general de tu tienda.', icon: Home },
    Ventas: { title: 'Ventas', subtitle: 'Registra ventas y revisa el historial reciente.', icon: ShoppingCart },
    Caja: { title: 'Caja', subtitle: 'Controla cierres, cortes y métodos de pago por periodo.', icon: DollarSign },
    'Gastos fijos': { title: 'Gastos fijos', subtitle: 'Controla pagos mensuales como arriendo, servicios, sueldos y suscripciones.', icon: ReceiptText },
    Compras: { title: 'Compras', subtitle: 'Registra compras a proveedores y aumenta stock.', icon: ClipboardList },
    Productos: {
      title: businessConfig.productMode === 'menu-inventory' ? 'Menú e insumos' : 'Productos',
      subtitle: businessConfig.productMode === 'menu-inventory'
        ? 'Administra productos del menú e insumos de cocina.'
        : 'Administra los productos de tu tienda fácilmente.',
      icon: Package,
    },
    Inventario: { title: 'Inventario', subtitle: 'Controla stock, alertas y valor de inventario.', icon: Boxes },
    Clientes: { title: 'Clientes', subtitle: 'Administra clientes frecuentes de la tienda.', icon: Users },
    Proveedores: { title: 'Proveedores', subtitle: 'Organiza proveedores y entregas estimadas.', icon: Truck },
    Reportes: { title: 'Reportes', subtitle: 'Analiza ventas, utilidad y decisiones de compra.', icon: BarChart3 },
    Configuración: { title: 'Configuración', subtitle: 'Ajusta datos generales de la tienda.', icon: Settings },
    Admin: { title: 'Panel administrador', subtitle: 'Crea y controla cuentas de clientes de InventiQ.', icon: UserPlus },
  }[active] || { title: 'Inicio', subtitle: 'Resumen general de tu tienda.', icon: Home };

  const menuWithExpenses = menu.some(item => item.label === 'Gastos fijos')
    ? menu
    : menu.flatMap(item => item.label === 'Caja' ? [item, { label: 'Gastos fijos', icon: ReceiptText }] : [item]);

  const visibleMenu = isInventiQAdmin(currentUser) ? [...menuWithExpenses, { label: 'Admin', icon: UserPlus }] : menuWithExpenses;


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
        <DesktopSidebar
          menu={visibleMenu}
          active={active}
          setActive={setActive}
          setMobileMoreOpen={setMobileMoreOpen}
          currentUser={currentUser}
          logout={logout}
        />

        <main className="p-3 pb-32 pt-[calc(env(safe-area-inset-top)+5.25rem)] sm:p-6 sm:pb-28 sm:pt-20 lg:p-8 lg:pb-8 lg:pt-8">
          <PageHeader
            pageInfo={pageInfo}
            currentUser={currentUser}
            onAddProduct={() => setActive('Productos')}
          />

          <AppRoutes
            active={active}
            businessConfig={businessConfig}
            currentUser={currentUser}
            totalSales={totalSales}
            totalProducts={totalProducts}
            lowStock={lowStock}
            noStock={noStock}
            inventoryValue={inventoryValue}
            storeSales={storeSales}
            storeProducts={storeProducts}
            bestSeller={bestSeller}
            totalProfit={totalProfit}
            setActive={setActive}
            expirationText={expirationText}
            storeClients={storeClients}
            saleForm={saleForm}
            setSaleForm={setSaleForm}
            saleCart={saleCart}
            setSaleCart={setSaleCart}
            addSaleItem={addSaleItem}
            removeSaleItem={removeSaleItem}
            updateSaleItemDiscount={updateSaleItemDiscount}
            clearSaleCart={clearSaleCart}
            registerSale={registerSale}
            resetSaleForm={resetSaleForm}
            cancelSale={cancelSale}
            totalDiscount={totalDiscount}
            totalUnitsSold={totalUnitsSold}
            saleNotice={saleNotice}
            salePreview={calculateSalePreview()}
            salesLoading={salesLoading}
            setReceiptSale={setReceiptSale}
            purchases={purchases}
            expenses={expenses}
            expenseForm={expenseForm}
            setExpenseForm={setExpenseForm}
            saveExpense={saveExpense}
            resetExpenseForm={resetExpenseForm}
            editExpense={editExpense}
            deleteExpense={deleteExpense}
            markExpensePaid={markExpensePaid}
            editingExpenseId={editingExpenseId}
            pendingDeleteExpenseId={pendingDeleteExpenseId}
            setPendingDeleteExpenseId={setPendingDeleteExpenseId}
            expenseNotice={expenseNotice}
            expensesLoading={expensesLoading}
            storeProviders={storeProviders}
            purchaseForm={purchaseForm}
            setPurchaseForm={setPurchaseForm}
            purchaseCart={purchaseCart}
            addPurchaseItem={addPurchaseItem}
            removePurchaseItem={removePurchaseItem}
            clearPurchaseCart={clearPurchaseCart}
            registerPurchase={registerPurchase}
            resetPurchaseForm={resetPurchaseForm}
            purchaseNotice={purchaseNotice}
            purchasesLoading={purchasesLoading}
            setEditingId={setEditingId}
            setNotice={setNotice}
            setProducts={setProducts}
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            categories={categories}
            productCategories={productCategories}
            customProductCategories={customProductCategories}
            setCustomProductCategories={setCustomProductCategories}
            category={category}
            setCategory={setCategory}
            form={form}
            setForm={setForm}
            saveProduct={saveProduct}
            resetForm={resetForm}
            editProduct={editProduct}
            editingId={editingId}
            notice={notice}
            deleteProduct={deleteProduct}
            pendingDeleteId={pendingDeleteId}
            setPendingDeleteId={setPendingDeleteId}
            statusText={statusText}
            handleProductImage={handleProductImage}
            productsLoading={productsLoading}
            importProductsFromExcel={importProductsFromExcel}
            excelImportPreview={excelImportPreview}
            confirmExcelImport={confirmExcelImport}
            cancelExcelImport={cancelExcelImport}
            excelImportProgress={excelImportProgress}
            potentialProfit={potentialProfit}
            adjustProductStock={adjustProductStock}
            clientForm={clientForm}
            setClientForm={setClientForm}
            saveClient={saveClient}
            resetClientForm={resetClientForm}
            editClient={editClient}
            deleteClient={deleteClient}
            editingClientId={editingClientId}
            pendingDeleteClientId={pendingDeleteClientId}
            setPendingDeleteClientId={setPendingDeleteClientId}
            clientNotice={clientNotice}
            clientsLoading={clientsLoading}
            addClientAccountItem={addClientAccountItem}
            addClientAccountPayment={addClientAccountPayment}
            cancelClientAccountItem={cancelClientAccountItem}
            providerForm={providerForm}
            setProviderForm={setProviderForm}
            saveProvider={saveProvider}
            resetProviderForm={resetProviderForm}
            editProvider={editProvider}
            deleteProvider={deleteProvider}
            editingProviderId={editingProviderId}
            pendingDeleteProviderId={pendingDeleteProviderId}
            setPendingDeleteProviderId={setPendingDeleteProviderId}
            providerNotice={providerNotice}
            providersLoading={providersLoading}
            settingsForm={settingsForm}
            setSettingsForm={setSettingsForm}
            saveSettings={saveSettings}
            settingsNotice={settingsNotice}
            handleStoreLogo={handleStoreLogo}
            adminCreateUserForm={adminCreateUserForm}
            setAdminCreateUserForm={setAdminCreateUserForm}
            adminNotice={adminNotice}
            createClientAccount={createClientAccount}
          />
        </main>
      </div>
      <MobileBottomNav menu={visibleMenu} active={active} setActive={setActive} mobileMoreOpen={mobileMoreOpen} setMobileMoreOpen={setMobileMoreOpen} logout={logout} />
      {/* Botón flotante retirado: el menú inferior ya cubre la navegación móvil. */}
      {receiptSale && <ReceiptModal sale={receiptSale} currentUser={currentUser} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}

export default App;
