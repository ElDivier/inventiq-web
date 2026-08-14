import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { IMPORT_BATCH_SIZE } from './config/constants';
import { getBusinessConfig } from './config/businessTypes';
import { getBusinessProfile } from './config/businessProfiles';
import { getRequiredDataForSection } from './config/sectionData';
import { getPageInfo, getVisibleMenu } from './config/navigation';
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
  chunkArray,
  validateExcelFile,
} from './utils/products';
import { generateInternalBarcode } from './utils/barcode';
import {
  getStoreItems,
  getProductCategories,
  getFilteredProducts,
  getInventoryStats,
  getSalesStats,
} from './utils/appSelectors';
import {
  buildProductData,
  getFinalProductCategory,
  getProductNumericValues,
  isFoodIngredientCategory,
  validateProductForm,
} from './utils/productFormUtils';
import {
  normalizeExcelRow,
  getExcelValue,
  excelText,
  excelNumber,
  excelDate,
  excelList,
} from './utils/excel';
import {
  fileToDataUrl,
  optimizeImageFile,
} from './utils/images';
import {
  statusText,
  expirationText,
} from './utils/inventory';
import { convertRecipeQuantityToStockUnit } from './utils/recipeUnits';
import { inferProductTypeFromCategory } from './config/productTypes';
import { normalizeRestaurantProductMetadata } from './utils/restaurantMenu';
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
  getAccountAccessBlockReason,
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
import SplashScreen from './components/SplashScreen';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomNav from './components/MobileBottomNav';
import DesktopSidebar from './components/DesktopSidebar';
import PageHeader from './components/PageHeader';
import AppRoutes from './components/AppRoutes';
import ReceiptModal from './components/ReceiptModal';
import AuthPage from './pages/AuthPage';
import EmployeeLoginPage from './pages/EmployeeLoginPage';
import LandingPage from './pages/LandingPage';
import RestaurantOperatorSwitcher from './components/RestaurantOperatorSwitcher';
import { hasRestaurantPermission, isGastronomyEmployeeBusiness } from './utils/restaurantPermissions';
import { auditRestaurantAction } from './utils/restaurantStaff';
import {
  clearRestaurantEmployeeBootstrap,
  fetchRestaurantEmployeeSessionContext,
  getRestaurantEmployeeBootstrap,
  saveRestaurantEmployeeBootstrap,
} from './utils/restaurantEmployeeAccess';


function getPublicRoute(pathname = '') {
  const normalized = String(pathname || '/')
    .split('?')[0]
    .replace(/\/+$/, '') || '/';

  if (normalized === '/app') return 'app';
  if (normalized === '/iniciar-sesion' || normalized === '/login') return 'login';
  if (normalized === '/empleados' || normalized === '/equipo') return 'employee';
  return 'landing';
}

function App() {
  const [publicRoute, setPublicRoute] = useState(() => getPublicRoute(typeof window !== 'undefined' ? window.location.pathname : '/'));
  const [users, setUsers] = useState(() => loadFromStorage(STORAGE_KEYS.users, initialUsers));
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = loadFromStorage(STORAGE_KEYS.currentUser, null);
    if (saved?.isEmployeeSession) {
      const key = saved?.authUserId ? `inventiq_employee_unlocked_${saved.authUserId}` : '';
      if (!key || typeof window === 'undefined' || sessionStorage.getItem(key) !== '1') return null;
    }
    return saved;
  });
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
  const [restaurantOperator, setRestaurantOperator] = useState(null);
  const [operatorSwitcherOpen, setOperatorSwitcherOpen] = useState(false);
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
    return getPublicRoute(window.location.pathname) === 'app' && window.innerWidth < 768;
  });
  const [excelImportPreview, setExcelImportPreview] = useState(null);
  const [excelImportProgress, setExcelImportProgress] = useState(null);
  const [adminCreateUserForm, setAdminCreateUserForm] = useState(emptyAdminCreateUserForm);
  const [adminNotice, setAdminNotice] = useState(null);

  const currentUserRef = useRef(currentUser);
  const profileLoadTokenRef = useRef(0);

  const loadedDataRef = useRef({
    products: false,
    sales: false,
    clients: false,
    providers: false,
    purchases: false,
    expenses: false,
  });

  const navigateTo = useCallback((path, options = {}) => {
    if (typeof window === 'undefined') return;
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', path);
    setPublicRoute(getPublicRoute(path));
    window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    function handlePopState() {
      setPublicRoute(getPublicRoute(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!authLoading && currentUser && publicRoute === 'login') {
      navigateTo('/app', { replace: true, instant: true });
    }
  }, [authLoading, currentUser, publicRoute, navigateTo]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);


  useEffect(() => {
    if (!currentUser?.id || !isGastronomyEmployeeBusiness(currentUser?.businessType)) {
      setRestaurantOperator(null);
      return;
    }

    if (currentUser?.isEmployeeSession) {
      setRestaurantOperator(currentUser.restaurantOperator || null);
      return;
    }

    try {
      const saved = sessionStorage.getItem(`inventiq_restaurant_operator_${currentUser.id}`);
      setRestaurantOperator(saved ? JSON.parse(saved) : null);
    } catch {
      setRestaurantOperator(null);
    }
  }, [currentUser?.id, currentUser?.businessType, currentUser?.isEmployeeSession]);

  function handleRestaurantOperatorChange(operator) {
    setRestaurantOperator(operator || null);
    if (currentUser?.id) {
      const key = `inventiq_restaurant_operator_${currentUser.id}`;
      if (operator) sessionStorage.setItem(key, JSON.stringify(operator));
      else sessionStorage.removeItem(key);
    }
    setActive('Inicio');
    setMobileMoreOpen(false);
  }

  useEffect(() => {
    let mounted = true;

    async function initSupabaseSession() {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user;

        if (sessionUser) {
          await loadUserProfile(sessionUser);
        } else if (mounted) {
          profileLoadTokenRef.current += 1;
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error iniciando sesión de Supabase:', error);
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    initSupabaseSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (_event === 'PASSWORD_RECOVERY') {
          setAuthMode('update-password');
          setAuthNotice({ type: 'success', message: 'Enlace validado. Ingresa tu nueva contraseña.' });
          return;
        }

        // La sesión inicial ya se hidrata con getSession() para evitar dos cargas
        // simultáneas del perfil y cualquier salto visual durante el arranque.
        if (_event === 'INITIAL_SESSION') return;

        if (session?.user) {
          // Nunca reemplazar temporalmente el perfil por uno "general". Supabase puede
          // volver a emitir SIGNED_IN/TOKEN_REFRESHED al regresar a la pestaña y ese
          // reemplazo provocaba el cambio visible de interfaz antes de cargar el negocio.
          // La consulta se inicia fuera del ciclo síncrono del listener de autenticación.
          void loadUserProfile(session.user).catch((error) => {
            console.error('Error actualizando perfil de sesión:', error);
          });
        } else {
          profileLoadTokenRef.current += 1;
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error escuchando sesión de Supabase:', error);
        // Si ya existe un perfil válido en pantalla, se conserva ante un fallo transitorio.
        if (!currentUserRef.current) setCurrentUser(null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
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

  async function loadEmployeeUserProfile(sessionUser, bootstrapContext = null) {
    const unlockKey = `inventiq_employee_unlocked_${sessionUser.id}`;
    const isUnlocked = typeof window !== 'undefined' && sessionStorage.getItem(unlockKey) === '1';

    if (!isUnlocked) {
      await supabase.auth.signOut();
      localStorage.removeItem(STORAGE_KEYS.currentUser);
      currentUserRef.current = null;
      setCurrentUser(null);
      setRestaurantOperator(null);
      setAuthMode('employee');
      return null;
    }

    try {
      let context = bootstrapContext || getRestaurantEmployeeBootstrap(sessionUser.id);
      let contextError = null;

      try {
        const freshContext = await fetchRestaurantEmployeeSessionContext();
        if (freshContext?.ownerId && freshContext?.operator?.id) {
          context = freshContext;
          saveRestaurantEmployeeBootstrap(sessionUser.id, freshContext);
        }
      } catch (error) {
        contextError = error;
        console.warn('No se pudo refrescar inmediatamente el contexto del empleado; se usará el contexto seguro del inicio de sesión.', error);
      }

      const operator = context?.operator || null;
      if (!context?.ownerId || !operator?.id) {
        throw contextError || new Error('El perfil del empleado ya no está disponible.');
      }

      const resolvedUser = {
        id: context.ownerId,
        authUserId: sessionUser.id,
        email: sessionUser.email || '',
        username: sessionUser.email || '',
        name: context.ownerName || context.storeName || 'Administrador',
        store: context.storeName || 'Mi negocio',
        city: context.city || 'Sin ciudad registrada',
        businessId: context.businessId || '',
        address: context.address || '',
        phone: context.phone || '',
        commercialEmail: context.commercialEmail || '',
        receiptFooter: context.receiptFooter || 'Gracias por su compra.',
        logoUrl: context.logoUrl || '',
        businessType: context.businessType || 'restaurante',
        plan: context.plan || 'anual',
        subscriptionStatus: context.subscriptionStatus || 'activo',
        subscriptionStart: context.subscriptionStart || '',
        subscriptionEnd: context.subscriptionEnd || '',
        isSuspended: Boolean(context.isSuspended),
        maxProducts: Number(context.maxProducts || 2000),
        splitPaymentEnabled: Boolean(context.splitPaymentEnabled),
        customerAccountsEnabled: Boolean(context.customerAccountsEnabled),
        isEmployeeSession: true,
        restaurantOperator: operator,
        restaurantPermissions: operator.permissions || [],
        restaurantRole: operator.role || 'mesero',
        operatorName: operator.name || 'Empleado',
      };

      currentUserRef.current = resolvedUser;
      setRestaurantOperator(operator);
      setCurrentUser(resolvedUser);
      return resolvedUser;
    } catch (error) {
      console.error('Error cargando sesión de empleado:', error);
      clearRestaurantEmployeeBootstrap(sessionUser.id);
      await supabase.auth.signOut();
      localStorage.removeItem(STORAGE_KEYS.currentUser);
      currentUserRef.current = null;
      setCurrentUser(null);
      setRestaurantOperator(null);
      setAuthMode('employee');
      setAuthNotice({
        type: 'error',
        message: error?.message || 'No se pudo abrir el perfil del empleado.',
      });
      return null;
    }
  }

  async function loadUserProfile(sessionUser, employeeBootstrap = null) {
    if (sessionUser?.user_metadata?.inventiq_employee_session) {
      return loadEmployeeUserProfile(sessionUser, employeeBootstrap);
    }
    if (currentUserRef.current?.id && currentUserRef.current.id !== sessionUser.id) {
      profileLoadTokenRef.current += 1;
    }
    const requestToken = profileLoadTokenRef.current;
    const cachedUser = currentUserRef.current?.id === sessionUser.id
      ? currentUserRef.current
      : loadFromStorage(STORAGE_KEYS.currentUser, null);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error cargando perfil:', error);
    }

    // Evita que una consulta anterior sobrescriba una sesión más reciente.
    if (requestToken !== profileLoadTokenRef.current) return null;

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
      return null;
    }

    const resolvedUser = {
      id: sessionUser.id,
      email: sessionUser.email,
      username: sessionUser.email,
      name: profile?.owner_name || cachedUser?.name || sessionUser.email,
      store: profile?.store_name || cachedUser?.store || 'Mi Tienda',
      city: profile?.city || cachedUser?.city || 'Sin ciudad registrada',
      businessId: profile?.business_id || cachedUser?.businessId || '',
      address: profile?.address || cachedUser?.address || '',
      phone: profile?.phone || cachedUser?.phone || '',
      commercialEmail: profile?.commercial_email || cachedUser?.commercialEmail || '',
      receiptFooter: profile?.receipt_footer || cachedUser?.receiptFooter || 'Gracias por su compra.',
      logoUrl: profile?.logo_url || cachedUser?.logoUrl || '',
      businessType: profile?.business_type || cachedUser?.businessType || 'general',
      plan: profile?.plan || cachedUser?.plan || 'anual',
      subscriptionStatus: profile?.subscription_status || cachedUser?.subscriptionStatus || 'activo',
      subscriptionStart: profile?.subscription_start || cachedUser?.subscriptionStart || '',
      subscriptionEnd: profile?.subscription_end || cachedUser?.subscriptionEnd || '',
      isSuspended: profile?.is_suspended === undefined
        ? Boolean(cachedUser?.isSuspended)
        : Boolean(profile.is_suspended),
      maxProducts: profile?.max_products || cachedUser?.maxProducts || 2000,
      splitPaymentEnabled: profile?.split_payment_enabled === undefined
        ? Boolean(cachedUser?.splitPaymentEnabled)
        : Boolean(profile.split_payment_enabled),
      customerAccountsEnabled: profile?.customer_accounts_enabled === undefined
        ? Boolean(cachedUser?.customerAccountsEnabled)
        : Boolean(profile.customer_accounts_enabled),
    };

    currentUserRef.current = resolvedUser;
    setCurrentUser(resolvedUser);
    return resolvedUser;
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
      navigateTo('/app', { replace: true, instant: true });
    }
  }

  async function register(e) {
    e.preventDefault();
    setAuthNotice({ type: 'error', message: 'El registro público está desactivado. Solicita la creación de tu cuenta al administrador de INVENTIQ.' });
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
      redirectTo: `${window.location.origin}/iniciar-sesion`,
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
    const wasEmployeeSession = Boolean(currentUser?.isEmployeeSession);
    profileLoadTokenRef.current += 1;
    if (currentUser?.id) sessionStorage.removeItem(`inventiq_restaurant_operator_${currentUser.id}`);
    if (currentUser?.authUserId) clearRestaurantEmployeeBootstrap(currentUser.authUserId);
    setRestaurantOperator(null);
    setOperatorSwitcherOpen(false);
    currentUserRef.current = null;
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    setCurrentUser(null);
    setActive('Inicio');
    setAuthMode(wasEmployeeSession ? 'employee' : 'login');
    setAuthNotice(null);
    navigateTo('/iniciar-sesion', { replace: true, instant: true });
  }

  function openRestaurantOperatorControl() {
    if (currentUser?.isEmployeeSession) {
      void logout();
      return;
    }
    setOperatorSwitcherOpen(true);
  }

  const storeKey = currentUser?.id || 'demo';
  const storeProducts = useMemo(() => getStoreItems(products, storeKey), [products, storeKey]);
  const storeSales = useMemo(() => getStoreItems(sales, storeKey), [sales, storeKey]);
  const storeClients = useMemo(() => getStoreItems(clients, storeKey), [clients, storeKey]);
  const storeProviders = useMemo(() => getStoreItems(providers, storeKey), [providers, storeKey]);

  const categories = useMemo(
    () => getProductCategories(storeProducts, customProductCategories),
    [storeProducts, customProductCategories]
  );

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

  const filtered = useMemo(
    () => getFilteredProducts(storeProducts, search, category),
    [storeProducts, search, category]
  );

  const inventoryStats = useMemo(
    () => getInventoryStats(storeProducts),
    [storeProducts]
  );

  const salesStats = useMemo(
    () => getSalesStats(storeSales),
    [storeSales]
  );

  const { totalProducts, lowStock, noStock, inventoryValue, potentialProfit } = inventoryStats;
  const { totalSales, totalProfit, totalDiscount, totalUnitsSold, bestSeller } = salesStats;

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setNotice(null);
    clearDraft(currentUser?.id, 'productForm');
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

    const finalCategory = getFinalProductCategory(form);
    const isFoodIngredient = isFoodIngredientCategory(
      finalCategory,
      currentUser?.businessType
    );
    const { price, cost, stock, minStock } = getProductNumericValues(
      form,
      isFoodIngredient
    );
    const validationError = validateProductForm({
      form,
      finalCategory,
      price,
      cost,
      stock,
      minStock,
      isFoodIngredient,
    });

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

    const productData = buildProductData({
      form,
      storeKey,
      storeName: currentUser.store,
      storeProductsCount: storeProducts.length,
      finalCategory,
      price,
      cost,
      stock,
      minStock,
      uploadedImageUrl,
      businessType: currentUser?.businessType || 'general',
    });

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
      const importBusinessProfile = getBusinessProfile(currentUser.businessProfile || currentUser.businessType || 'general');
      const businessType = importBusinessProfile.businessType || currentUser.businessType || 'general';
      const businessConfig = importBusinessProfile.config || getBusinessConfig(businessType);
      const normalizedRows = rawRows.map(normalizeExcelRow);
      const existingCodes = new Set(storeProducts.flatMap(product => [product.sku, product.barcode]).filter(Boolean).map(value => String(value).trim().toLowerCase()));
      const productsToImport = [];
      const skippedRows = [];

      normalizedRows.forEach((row, index) => {
        const name = excelText(getExcelValue(row, ['nombre del producto', 'producto', 'nombre', 'nombre_producto', 'plato', 'insumo']));
        const defaultCategory = businessConfig.defaultCategories?.[0] || (businessType === 'ropa' ? 'Ropa' : 'General');
        const category = excelText(getExcelValue(row, ['categoria', 'categoría', 'category', 'tipo'], defaultCategory));
        const isIngredientImport = isFoodIngredientCategory(category, businessType);
        const price = excelNumber(getExcelValue(row, ['precio de venta', 'precio venta', 'precio_venta', 'precio', 'pvp']), 0);
        const cost = excelNumber(getExcelValue(row, ['costo unitario', 'costo', 'costo opcional', 'precio costo', 'precio_costo']), 0);
        const stock = excelNumber(getExcelValue(row, ['stock actual', 'stock', 'cantidad', 'existencia']), 0);
        const minStock = excelNumber(getExcelValue(row, ['stock minimo', 'stock mínimo', 'minimo', 'mínimo', 'stock_minimo']), isIngredientImport ? 3 : 0);
        const skuRaw = excelText(getExcelValue(row, ['sku', 'codigo almacen', 'código almacén', 'codigo', 'código', 'codigo interno', 'codigo sku']));
        const barcodeRaw = excelText(getExcelValue(row, ['codigo de barras', 'código de barras', 'barcode', 'barra']));
        const generatedCode = skuRaw || barcodeRaw || generateInternalBarcode(businessType);
        const sku = skuRaw || generatedCode;
        const barcode = barcodeRaw || generatedCode;
        const productType = inferProductTypeFromCategory(category, businessType);
        const stockUnit = excelText(getExcelValue(row, ['unidad de stock', 'stock unit', 'unidad', 'medida', 'presentacion', 'presentación']));
        const restaurantMetadata = businessType === 'restaurante' && productType === 'sale_product'
          ? normalizeRestaurantProductMetadata({
              menuStatus: excelText(getExcelValue(row, ['estado menu', 'estado menú', 'disponibilidad'], 'available')).toLowerCase(),
              kitchenStation: excelText(getExcelValue(row, ['estacion cocina', 'estación cocina', 'estacion', 'estación'], 'cocina')).toLowerCase().replace(/\s+/g, '_'),
              preparationMinutes: excelNumber(getExcelValue(row, ['tiempo preparacion min', 'tiempo preparación min', 'tiempo preparacion', 'tiempo preparación']), 0),
              servicePeriods: excelList(getExcelValue(row, ['horarios de servicio', 'horarios', 'periodos'])).map(value => value.toLowerCase().replace(/\s+/g, '_')),
              orderChannels: excelList(getExcelValue(row, ['canales de venta', 'canales', 'tipo de servicio'])).map(value => value.toLowerCase().replace(/\s+/g, '_')),
              dietaryTags: excelList(getExcelValue(row, ['etiquetas', 'tags'])).map(value => value.toLowerCase().replace(/\s+/g, '_')),
              allergens: excelText(getExcelValue(row, ['alergenos', 'alérgenos', 'advertencias'])),
              preparationNotes: excelText(getExcelValue(row, ['nota preparacion', 'nota preparación', 'indicaciones de cocina'])),
            })
          : {};

        if (!name) {
          skippedRows.push(`Fila ${index + 2}: sin nombre de producto`);
          return;
        }

        if (!category) {
          skippedRows.push(`Fila ${index + 2}: sin categoría`);
          return;
        }

        if (!isIngredientImport && price <= 0) {
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
          productType,
          stockUnit: stockUnit || excelText(getExcelValue(row, ['talla', 'medida', 'presentacion', 'presentación', 'size'])),
          tracksLots: Boolean(excelText(getExcelValue(row, ['lote', 'batch', 'batch number']))),
          tracksExpiration: Boolean(businessConfig.usesExpiration && excelDate(getExcelValue(row, ['fecha de caducidad', 'fecha caducidad', 'caducidad', 'vencimiento']))),
          productMetadata: restaurantMetadata,
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
      stockUnit: product.stockUnit || product.size || '',
      productMetadata: product.productMetadata || {},
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

  async function getCafeteriaRecipeProductIds(cartItems) {
    if (currentUser?.businessType !== 'cafeteria' || !currentUser?.id || !Array.isArray(cartItems) || cartItems.length === 0) {
      return new Set();
    }

    const productIds = Array.from(new Set(
      cartItems
        .map(item => item.productId)
        .filter(Boolean)
        .map(String)
    ));

    if (productIds.length === 0) return new Set();

    const { data, error } = await supabase.rpc('cafeteria_get_recipe_controlled_products', {
      p_product_ids: productIds,
    });

    if (error) {
      throw new Error(`No se pudieron validar las recetas de cafetería: ${error.message}`);
    }

    return new Set((Array.isArray(data) ? data : []).map(String));
  }

  function buildFoodOrderCustomer() {
    if (!['cafeteria', 'restaurante'].includes(currentUser?.businessType)) return null;

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

  function isRecipeControlledProduct(product, cafeteriaRecipeProductIds = new Set()) {
    return currentUser?.businessType === 'cafeteria'
      && Boolean(product?.id)
      && cafeteriaRecipeProductIds.has(String(product.id));
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

    if (isGastronomyEmployeeBusiness(currentUser?.businessType) && Number(discount || 0) > 0 && !hasRestaurantPermission(effectiveCurrentUser, 'discounts.apply')) {
      setSaleNotice({ type: 'error', message: 'El operador actual no tiene permiso para aplicar descuentos.' });
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

    let cafeteriaRecipeProductIds = new Set();
    try {
      cafeteriaRecipeProductIds = await getCafeteriaRecipeProductIds(saleCart);
    } catch (recipeLookupError) {
      setSaleNotice({ type: 'error', message: recipeLookupError.message });
      return;
    }

    for (const item of saleCart) {
      const product = storeProducts.find(p => String(p.id) === String(item.productId));
      if (!product) {
        setSaleNotice({ type: 'error', message: `No se encontró el producto ${item.product}.` });
        return;
      }

      if (isRecipeControlledProduct(product, cafeteriaRecipeProductIds)) {
        continue;
      }

      if (item.quantity > product.stock) {
        setSaleNotice({ type: 'error', message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}.` });
        return;
      }
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
      if (!product || isRecipeControlledProduct(product, cafeteriaRecipeProductIds)) continue;

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

    let cafeteriaOrder = null;
    let cafeteriaQueueWarning = '';
    if (currentUser?.businessType === 'cafeteria') {
      try {
        const { data: queueData, error: queueError } = await supabase.rpc('cafeteria_create_order_from_sale', {
          p_sale_id: saleData.id,
          p_order_type: saleForm.orderType || 'local',
          p_order_reference: saleForm.orderReference || '',
          p_customer_name: saleForm.customer || '',
          p_notes: saleForm.orderNotes || '',
          p_items: normalizedSaleCart.map((item) => ({
            productId: item.productId,
            product: item.product,
            baseProduct: item.baseProduct || item.product,
            quantity: item.quantity,
            price: item.price,
            modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
            variantSummary: item.variantSummary || '',
            station: item.station || '',
            notes: item.notes || '',
          })),
        });
        if (queueError) throw queueError;
        cafeteriaOrder = queueData;
      } catch (queueError) {
        console.error('Venta registrada, pero no se pudo crear el ticket de barra:', queueError);
        cafeteriaQueueWarning = ` La venta quedó registrada, pero no se pudo enviar el ticket a Barra: ${queueError.message}`;
      }
    }

    setSaleForm(emptySaleForm);
    setSaleCart([]);
    clearDraft(currentUser?.id, 'saleForm');
    clearDraft(currentUser?.id, 'saleCart');

    const recipeMessage = currentUser?.businessType === 'cafeteria' && cafeteriaRecipeProductIds.size > 0
      ? ' El consumo de recetas se aplicará al iniciar la preparación en Barra.'
      : '';
    const cafeteriaMessage = cafeteriaOrder?.number
      ? ` Pedido #${cafeteriaOrder.number} enviado a Barra.`
      : cafeteriaQueueWarning;

    setSaleNotice({ type: cafeteriaQueueWarning ? 'error' : 'success', message: `Venta ${newSale.code} registrada correctamente con ${normalizedSaleCart.length} producto(s).${recipeMessage}${cafeteriaMessage}` });
    await loadSalesFromSupabase(currentUser.id, false);
    await loadProductsFromSupabase(currentUser.id, false);
  }

  async function cancelSale(id) {
    if (!hasRestaurantPermission(effectiveCurrentUser, 'cancellations.manage')) {
      setSaleNotice({ type: 'error', message: 'El operador actual no tiene permiso para anular ventas.' });
      return;
    }
    const sale = storeSales.find(s => s.id === id);
    if (!sale || !currentUser?.id) return;

    if (sale.sourceType === 'restaurant_order') {
      const confirmed = window.confirm(
        `La venta ${sale.code} proviene de una cuenta de restaurante. La anulación corregirá la venta y conservará la trazabilidad de los cobros, pero NO devolverá automáticamente ingredientes ni preparaciones al inventario, porque pueden haber sido consumidos durante la preparación. ¿Continuar?`
      );
      if (!confirmed) return;

      const { data, error } = await supabase.rpc('cancel_restaurant_order_sale', {
        p_sale_id: id,
      });

      if (error) {
        console.error('Error anulando venta de restaurante:', error);
        setSaleNotice({ type: 'error', message: `No se pudo anular la venta del restaurante: ${error.message}` });
        return;
      }

      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
      setSaleNotice({
        type: 'success',
        message: `Venta ${data?.sale_code || sale.code} anulada. El consumo gastronómico registrado se conservó y no se devolvieron ingredientes automáticamente al inventario.`,
      });
      await auditRestaurantAction(effectiveCurrentUser, 'sale.cancelled', 'sale', id, { code: sale.code, sourceType: sale.sourceType });
      return;
    }

    if (sale.sourceType === 'bakery_order') {
      const confirmed = window.confirm(
        `La venta ${sale.code} proviene de un pedido especial. Al anularla, InventIQ devolverá el stock y el pedido regresará a “Listo para entregar”. Los abonos permanecerán en el historial de caja. ¿Continuar?`
      );
      if (!confirmed) return;

      const { data, error } = await supabase.rpc('cancel_bakery_custom_order_sale', {
        p_sale_id: id,
      });

      if (error) {
        console.error('Error anulando venta de pedido especial:', error);
        setSaleNotice({ type: 'error', message: `No se pudo anular la venta del pedido: ${error.message}` });
        return;
      }

      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);
      setSaleNotice({
        type: 'success',
        message: `Venta ${data?.sale_code || sale.code} anulada. El stock fue devuelto y el pedido quedó listo para corregirse o entregarse nuevamente.`,
      });
      return;
    }

    if (currentUser?.businessType === 'cafeteria') {
      const confirmed = window.confirm(
        `La venta ${sale.code} pertenece a una cafetería. InventIQ anulará la venta y el ticket en una sola operación. Solo volverá al stock lo que todavía no había iniciado preparación; los ingredientes ya consumidos se conservarán. ¿Continuar?`
      );
      if (!confirmed) return;

      const { data, error } = await supabase.rpc('cancel_cafeteria_sale', {
        p_sale_id: id,
      });

      if (error) {
        console.error('Error anulando venta de cafetería:', error);
        setSaleNotice({ type: 'error', message: `No se pudo anular la venta de cafetería: ${error.message}` });
        return;
      }

      await loadSalesFromSupabase(currentUser.id, false);
      await loadProductsFromSupabase(currentUser.id, false);

      const restoredProducts = Number(data?.restored_products || 0);
      const consumptionRecords = Number(data?.consumption_records || 0);
      const stockMessage = restoredProducts > 0
        ? ` Se devolvió stock directo pendiente de ${restoredProducts} producto(s).`
        : ' No existía stock directo pendiente por devolver.';
      const consumptionMessage = consumptionRecords > 0
        ? ' Los ingredientes ya consumidos durante la preparación se conservaron para mantener la trazabilidad real.'
        : '';

      setSaleNotice({
        type: 'success',
        message: `Venta ${data?.sale_code || sale.code} anulada correctamente.${stockMessage}${consumptionMessage}`,
      });
      await auditRestaurantAction(effectiveCurrentUser, 'sale.cancelled', 'sale', id, {
        code: sale.code,
        sourceType: 'cafeteria',
        restoredProducts,
        consumptionRecords,
      });
      return;
    }

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

      const quantityToRestore = Number(item.quantity || 0);
      if (quantityToRestore <= 0) continue;

      const restoredStock = product.stock + quantityToRestore;
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
    setSaleNotice({ type: 'success', message: 'Venta anulada correctamente.' });
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
    if (!hasRestaurantPermission(effectiveCurrentUser, 'inventory.adjust')) {
      throw new Error('El operador actual no tiene permiso para realizar ajustes de inventario.');
    }
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
    await auditRestaurantAction(effectiveCurrentUser, 'inventory.adjusted', 'product', productId, { newStock: stock, reason: reason || '' });
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

  const effectiveCurrentUser = useMemo(() => {
    if (!currentUser) return null;
    if (!isGastronomyEmployeeBusiness(currentUser.businessType)) return currentUser;
    const effectiveOperator = restaurantOperator || currentUser.restaurantOperator || null;
    return {
      ...currentUser,
      restaurantOperator: effectiveOperator,
      restaurantPermissions: effectiveOperator?.permissions || [],
      restaurantRole: effectiveOperator?.role || 'administrador',
      operatorName: effectiveOperator?.name || 'Administrador',
    };
  }, [currentUser, restaurantOperator]);

  const businessProfile = getBusinessProfile(effectiveCurrentUser?.businessProfile || effectiveCurrentUser?.businessType);
  const businessConfig = businessProfile.config || getBusinessConfig(effectiveCurrentUser?.businessType);

  const pageInfo = getPageInfo(active, businessConfig, businessProfile);
  const visibleMenu = getVisibleMenu(isInventiQAdmin(effectiveCurrentUser) && !effectiveCurrentUser?.restaurantOperator, businessProfile, effectiveCurrentUser);

  useEffect(() => {
    if (!effectiveCurrentUser || visibleMenu.length === 0) return;
    if (!visibleMenu.some((item) => item.label === active)) {
      setActive(visibleMenu.find((item) => item.label === 'Inicio')?.label || visibleMenu[0].label);
    }
  }, [active, effectiveCurrentUser, visibleMenu]);

  if (authMode === 'update-password') {
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
        onBackToLanding={() => navigateTo('/', { instant: true })}
      />
    );
  }

  if (publicRoute === 'landing') {
    return <LandingPage currentUser={currentUser} onNavigate={navigateTo} />;
  }

  if (authLoading || (publicRoute === 'login' && currentUser)) {
    return <SplashScreen />;
  }

  if (!currentUser) {
    if (publicRoute === 'employee' || authMode === 'employee') {
      return (
        <EmployeeLoginPage
          onBackToAdmin={() => { setAuthMode('login'); setAuthNotice(null); navigateTo('/iniciar-sesion', { instant: true }); }}
          onBackToLanding={() => navigateTo('/', { instant: true })}
          onAuthenticated={async (authResult) => {
            const sessionUser = authResult?.sessionUser || authResult;
            const resolved = await loadUserProfile(sessionUser, authResult?.context || null);
            if (resolved) {
              setAuthMode('login');
              setAuthNotice(null);
              navigateTo('/app', { replace: true, instant: true });
            }
          }}
        />
      );
    }

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
        onBackToLanding={() => navigateTo('/', { instant: true })}
      />
    );
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="inventiq-app-shell min-h-screen overflow-x-hidden text-slate-900">
      <MobileTopBar currentUser={effectiveCurrentUser} logout={logout} active={active} onOpenOperatorSwitcher={openRestaurantOperatorControl} />
      <div className="min-h-screen">
        <DesktopSidebar
          menu={visibleMenu}
          active={active}
          setActive={setActive}
          setMobileMoreOpen={setMobileMoreOpen}
          currentUser={effectiveCurrentUser}
          logout={logout}
          onOpenOperatorSwitcher={openRestaurantOperatorControl}
        />

        <main className="relative min-w-0 p-3 pb-32 pt-[calc(env(safe-area-inset-top)+5.25rem)] sm:p-6 sm:pb-28 sm:pt-20 lg:ml-[250px] lg:px-10 lg:pb-10 lg:pt-10 2xl:px-12">
          {active !== 'Inicio' && (
            <PageHeader
              pageInfo={pageInfo}
              currentUser={effectiveCurrentUser}
            />
          )}

          <AppRoutes
            active={active}
            businessConfig={businessConfig}
            currentUser={effectiveCurrentUser}
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
            refreshSales={() => loadSalesFromSupabase(currentUser.id, false)}
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
            onOpenOperatorSwitcher={openRestaurantOperatorControl}
          />
        </main>
      </div>
      <MobileBottomNav menu={visibleMenu} active={active} setActive={setActive} mobileMoreOpen={mobileMoreOpen} setMobileMoreOpen={setMobileMoreOpen} logout={logout} />
      {/* Botón flotante retirado: el menú inferior ya cubre la navegación móvil. */}
      <RestaurantOperatorSwitcher
        open={operatorSwitcherOpen && isGastronomyEmployeeBusiness(currentUser?.businessType) && !currentUser?.isEmployeeSession}
        ownerUser={currentUser}
        currentOperator={restaurantOperator}
        onClose={() => setOperatorSwitcherOpen(false)}
        onOperatorChange={handleRestaurantOperatorChange}
      />
      {receiptSale && <ReceiptModal sale={receiptSale} currentUser={currentUser} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}

export default App;
