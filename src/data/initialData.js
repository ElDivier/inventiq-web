export const emptyForm = {
  name: '',
  category: '',
  customCategory: '',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  sku: '',
  barcode: '',
  brand: '',
  size: '',
  color: '',
  description: '',
  batchNumber: '',
  entryDate: '',
  expirationDate: '',
  imageUrl: '',
  imageFile: null,
};

export const initialProducts = [
  { id: 1, sku: 'BEB001', name: 'Coca Cola 600ml', category: 'Bebidas', price: 1.25, cost: 0.75, stock: 25, minStock: 8, status: 'Activo', description: 'Bebida gaseosa personal.' },
  { id: 2, sku: 'SNA002', name: 'Papas Lays Clásicas', category: 'Snacks', price: 1.1, cost: 0.65, stock: 7, minStock: 10, status: 'Activo', description: 'Snack de alta rotación.' },
  { id: 3, sku: 'LIM003', name: 'Jabón Protex', category: 'Limpieza', price: 1.75, cost: 1.05, stock: 0, minStock: 5, status: 'Inactivo', description: 'Producto de limpieza y cuidado.' },
  { id: 4, sku: 'LAC004', name: 'Leche Entera 1L', category: 'Lácteos', price: 1.5, cost: 0.95, stock: 12, minStock: 6, status: 'Activo', description: 'Producto lácteo de consumo diario.' },
  { id: 5, sku: 'PER005', name: 'Colgate Triple Acción', category: 'Cuidado personal', price: 2.2, cost: 1.35, stock: 18, minStock: 7, status: 'Activo', description: 'Producto de cuidado personal.' },
];

export const initialSales = [
  { id: 1, code: 'V-0001', productId: 1, product: 'Coca Cola 600ml', quantity: 3, subtotal: 3.75, discount: 0, total: 3.75, profit: 1.5, date: 'Hoy, 09:15 AM', status: 'Completada' },
  { id: 2, code: 'V-0002', productId: 2, product: 'Papas Lays Clásicas', quantity: 2, subtotal: 2.2, discount: 0, total: 2.2, profit: 0.9, date: 'Hoy, 10:20 AM', status: 'Completada' },
  { id: 3, code: 'V-0003', productId: 4, product: 'Leche Entera 1L', quantity: 1, subtotal: 1.5, discount: 0, total: 1.5, profit: 0.55, date: 'Ayer, 05:30 PM', status: 'Completada' },
];

export const initialClients = [
  { id: 1, name: 'Ana Rodríguez', phone: '099 123 4567', type: 'Frecuente', purchases: 12 },
  { id: 2, name: 'Carlos Mejía', phone: '098 765 4321', type: 'Regular', purchases: 5 },
  { id: 3, name: 'María López', phone: '097 111 2222', type: 'Nuevo', purchases: 1 },
];

export const initialProviders = [
  { id: 1, name: 'Distribuidora Norte', category: 'Bebidas', contact: '099 111 2222', email: 'ventas@disnorte.com', delivery: '2 días' },
  { id: 2, name: 'Comercial Andina', category: 'Snacks', contact: '099 222 3333', email: 'ventas@comercialandina.com', delivery: '1 día' },
  { id: 3, name: 'Lácteos San Miguel', category: 'Lácteos', contact: '098 555 7777', email: 'pedidos@lacteossanmiguel.com', delivery: '3 días' },
];

export const initialUsers = [
  {
    id: 1,
    name: 'Ana Rodríguez',
    store: 'Mi Tienda',
    city: 'Cuenca',
    username: 'demo',
    password: '1234',
  },
];

export const emptyLoginForm = {
  username: '',
  password: '',
};

export const emptyRegisterForm = {
  name: '',
  store: '',
  city: '',
  businessType: 'general',
  username: '',
  password: '',
  confirmPassword: '',
};

export const emptyAdminCreateUserForm = {
  name: '',
  store: '',
  city: '',
  businessType: 'ropa',
  email: '',
  password: '',
  confirmPassword: '',
};

export const emptyClientForm = {
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

export const emptyProviderForm = {
  name: '',
  category: '',
  contact: '',
  email: '',
  delivery: '',
  notes: '',
};

export const emptySettingsForm = {
  name: '',
  store: '',
  city: '',
  businessType: 'general',
  businessId: '',
  address: '',
  phone: '',
  commercialEmail: '',
  receiptFooter: '',
  logoUrl: '',
  logoFile: null,
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

export const emptyPurchaseForm = {
  productId: '',
  providerId: '',
  quantity: 1,
  unitCost: '',
  note: '',
};

export const emptySaleForm = {
  productId: '',
  quantity: 1,
  discountType: 'percent',
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