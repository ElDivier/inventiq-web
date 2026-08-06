import React from 'react';
import HomePage from '../pages/HomePage';
import FoodSalesPage from '../pages/FoodSalesPage';
import RestaurantTablesPage from '../pages/RestaurantTablesPage';
import SalesPage from '../pages/SalesPage';
import CashPage from '../pages/CashPage';
import DailyCashPage from '../pages/DailyCashPage';
import FoodCashPage from '../pages/FoodCashPage';
import ExpensesPage from '../pages/ExpensesPage';
import PurchasesPage from '../pages/PurchasesPage';
import FoodProductsPage from '../pages/FoodProductsPage';
import ProductsPage from '../pages/ProductsPage';
import InventoryPage from '../pages/InventoryPage';
import BakeryRecipesPage from '../pages/BakeryRecipesPage';
import RestaurantRecipesPage from '../pages/RestaurantRecipesPage';
import BakeryProductionPage from '../pages/BakeryProductionPage';
import BakeryWastePage from '../pages/BakeryWastePage';
import BakeryOrdersPage from '../pages/BakeryOrdersPage';
import ClientsPage from '../pages/ClientsPage';
import ProvidersPage from '../pages/ProvidersPage';
import ReportsPage from '../pages/ReportsPage';
import SettingsPage from '../pages/SettingsPage';
import AdminPage from '../pages/AdminPage';
import { isInventiQAdmin } from '../utils/auth';

export default function AppRoutes({
  active,
  businessConfig,
  currentUser,
  totalSales,
  totalProducts,
  lowStock,
  noStock,
  inventoryValue,
  storeSales,
  storeProducts,
  bestSeller,
  totalProfit,
  setActive,
  expirationText,
  storeClients,
  saleForm,
  setSaleForm,
  saleCart,
  setSaleCart,
  addSaleItem,
  removeSaleItem,
  updateSaleItemDiscount,
  clearSaleCart,
  registerSale,
  resetSaleForm,
  cancelSale,
  totalDiscount,
  totalUnitsSold,
  saleNotice,
  salePreview,
  salesLoading,
  setReceiptSale,
  purchases,
  expenses,
  expenseForm,
  setExpenseForm,
  saveExpense,
  resetExpenseForm,
  editExpense,
  deleteExpense,
  markExpensePaid,
  editingExpenseId,
  pendingDeleteExpenseId,
  setPendingDeleteExpenseId,
  expenseNotice,
  expensesLoading,
  storeProviders,
  purchaseForm,
  setPurchaseForm,
  purchaseCart,
  addPurchaseItem,
  removePurchaseItem,
  clearPurchaseCart,
  registerPurchase,
  resetPurchaseForm,
  purchaseNotice,
  purchasesLoading,
  setEditingId,
  setNotice,
  setProducts,
  search,
  setSearch,
  filtered,
  categories,
  productCategories,
  customProductCategories,
  setCustomProductCategories,
  category,
  setCategory,
  form,
  setForm,
  saveProduct,
  resetForm,
  editProduct,
  editingId,
  notice,
  deleteProduct,
  pendingDeleteId,
  setPendingDeleteId,
  statusText,
  handleProductImage,
  productsLoading,
  importProductsFromExcel,
  excelImportPreview,
  confirmExcelImport,
  cancelExcelImport,
  excelImportProgress,
  potentialProfit,
  adjustProductStock,
  clientForm,
  setClientForm,
  saveClient,
  resetClientForm,
  editClient,
  deleteClient,
  editingClientId,
  pendingDeleteClientId,
  setPendingDeleteClientId,
  clientNotice,
  clientsLoading,
  addClientAccountItem,
  addClientAccountPayment,
  cancelClientAccountItem,
  providerForm,
  setProviderForm,
  saveProvider,
  resetProviderForm,
  editProvider,
  deleteProvider,
  editingProviderId,
  pendingDeleteProviderId,
  setPendingDeleteProviderId,
  providerNotice,
  providersLoading,
  settingsForm,
  setSettingsForm,
  saveSettings,
  settingsNotice,
  handleStoreLogo,
  adminCreateUserForm,
  setAdminCreateUserForm,
  adminNotice,
  createClientAccount,
}) {
  return (
    <>
      {active === 'Inicio' && (
        <HomePage
          currentUser={currentUser}
          totalSales={totalSales}
          totalProducts={totalProducts}
          lowStock={lowStock}
          noStock={noStock}
          inventoryValue={inventoryValue}
          sales={storeSales}
          products={storeProducts}
          bestSeller={bestSeller}
          totalProfit={totalProfit}
          setActive={setActive}
          expirationText={expirationText}
        />
      )}

      {active === 'Ventas' && (
        businessConfig.salesMode === 'food' ? (
          <FoodSalesPage
            currentUser={currentUser}
            sales={storeSales}
            products={storeProducts}
            clients={storeClients}
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
            totalSales={totalSales}
            totalProfit={totalProfit}
            totalDiscount={totalDiscount}
            totalUnitsSold={totalUnitsSold}
            saleNotice={saleNotice}
            salePreview={salePreview}
            salesLoading={salesLoading}
            setReceiptSale={setReceiptSale}
            setActive={setActive}
          />
        ) : (
          <SalesPage
            currentUser={currentUser}
            sales={storeSales}
            products={storeProducts}
            clients={storeClients}
            saleForm={saleForm}
            setSaleForm={setSaleForm}
            saleCart={saleCart}
            addSaleItem={addSaleItem}
            removeSaleItem={removeSaleItem}
            updateSaleItemDiscount={updateSaleItemDiscount}
            clearSaleCart={clearSaleCart}
            registerSale={registerSale}
            resetSaleForm={resetSaleForm}
            cancelSale={cancelSale}
            totalSales={totalSales}
            totalProfit={totalProfit}
            totalDiscount={totalDiscount}
            totalUnitsSold={totalUnitsSold}
            saleNotice={saleNotice}
            salePreview={salePreview}
            salesLoading={salesLoading}
            setReceiptSale={setReceiptSale}
          />
        )
      )}

      {active === 'Mesas' && currentUser?.businessType === 'restaurante' && (
        <RestaurantTablesPage
          currentUser={currentUser}
          setActive={setActive}
          setSaleForm={setSaleForm}
          clearSaleCart={clearSaleCart}
        />
      )}

      {active === 'Caja' && (
        businessConfig.salesMode === 'food' ? (
          <FoodCashPage
            currentUser={currentUser}
            sales={storeSales}
            purchases={purchases}
            businessConfig={businessConfig}
          />
        ) : businessConfig.cashMode === 'daily-cash' ? (
          <DailyCashPage currentUser={currentUser} sales={storeSales} purchases={purchases} />
        ) : (
          <CashPage sales={storeSales} purchases={purchases} />
        )
      )}

      {active === 'Gastos fijos' && (
        <ExpensesPage
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
        />
      )}

      {active === 'Compras' && (
        <PurchasesPage
          purchases={purchases}
          products={storeProducts}
          providers={storeProviders}
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
        />
      )}

      {active === 'Productos' && (
        businessConfig.productMode === 'menu-inventory' ? (
          <FoodProductsPage
            currentUser={currentUser}
            setEditingId={setEditingId}
            setNotice={setNotice}
            products={storeProducts}
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
            expirationText={expirationText}
            totalProducts={totalProducts}
            lowStock={lowStock}
            noStock={noStock}
            inventoryValue={inventoryValue}
            handleProductImage={handleProductImage}
            productsLoading={productsLoading}
            importProductsFromExcel={importProductsFromExcel}
            excelImportPreview={excelImportPreview}
            confirmExcelImport={confirmExcelImport}
            cancelExcelImport={cancelExcelImport}
            excelImportProgress={excelImportProgress}
            setActive={setActive}
          />
        ) : (
          <ProductsPage
            currentUser={currentUser}
            setEditingId={setEditingId}
            setNotice={setNotice}
            products={storeProducts}
            setProducts={setProducts}
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
            expirationText={expirationText}
            totalProducts={totalProducts}
            lowStock={lowStock}
            noStock={noStock}
            inventoryValue={inventoryValue}
            handleProductImage={handleProductImage}
            productsLoading={productsLoading}
            importProductsFromExcel={importProductsFromExcel}
            excelImportPreview={excelImportPreview}
            confirmExcelImport={confirmExcelImport}
            cancelExcelImport={cancelExcelImport}
            excelImportProgress={excelImportProgress}
          />
        )
      )}

      {active === 'Recetas' && currentUser?.businessType === 'panaderia' && (
        <BakeryRecipesPage
          currentUser={currentUser}
          products={storeProducts}
          setActive={setActive}
        />
      )}

      {active === 'Recetas' && currentUser?.businessType === 'restaurante' && (
        <RestaurantRecipesPage
          currentUser={currentUser}
          products={storeProducts}
          setActive={setActive}
        />
      )}

      {active === 'Producción' && currentUser?.businessType === 'panaderia' && (
        <BakeryProductionPage
          currentUser={currentUser}
          products={storeProducts}
          setActive={setActive}
        />
      )}

      {active === 'Mermas' && currentUser?.businessType === 'panaderia' && (
        <BakeryWastePage
          currentUser={currentUser}
          products={storeProducts}
          setActive={setActive}
        />
      )}

      {active === 'Encargos' && currentUser?.businessType === 'panaderia' && (
        <BakeryOrdersPage
          currentUser={currentUser}
          products={storeProducts}
          clients={storeClients}
          setActive={setActive}
        />
      )}

      {active === 'Inventario' && (
        <InventoryPage
          currentUser={currentUser}
          products={storeProducts}
          sales={storeSales}
          purchases={purchases}
          lowStock={lowStock}
          noStock={noStock}
          inventoryValue={inventoryValue}
          potentialProfit={potentialProfit}
          statusText={statusText}
          expirationText={expirationText}
          adjustProductStock={adjustProductStock}
          setActive={setActive}
        />
      )}

      {active === 'Clientes' && (
        <ClientsPage
          currentUser={currentUser}
          clients={storeClients}
          products={storeProducts}
          sales={storeSales}
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
          setActive={setActive}
          setSaleForm={setSaleForm}
          addClientAccountItem={addClientAccountItem}
          addClientAccountPayment={addClientAccountPayment}
          cancelClientAccountItem={cancelClientAccountItem}
        />
      )}

      {active === 'Proveedores' && (
        <ProvidersPage
          providers={storeProviders}
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
          productCategories={productCategories}
          products={storeProducts}
          providersLoading={providersLoading}
          setActive={setActive}
          setPurchaseForm={setPurchaseForm}
        />
      )}

      {active === 'Reportes' && (
        <ReportsPage
          currentUser={currentUser}
          products={storeProducts}
          sales={storeSales}
          purchases={purchases}
          clients={storeClients}
          providers={storeProviders}
          totalSales={totalSales}
          inventoryValue={inventoryValue}
          potentialProfit={potentialProfit}
          bestSeller={bestSeller}
          totalProfit={totalProfit}
          expirationText={expirationText}
        />
      )}

      {active === 'Configuración' && (
        <SettingsPage
          currentUser={currentUser}
          settingsForm={settingsForm}
          setSettingsForm={setSettingsForm}
          saveSettings={saveSettings}
          settingsNotice={settingsNotice}
          handleStoreLogo={handleStoreLogo}
        />
      )}

      {active === 'Admin' && isInventiQAdmin(currentUser) && (
        <AdminPage
          form={adminCreateUserForm}
          setForm={setAdminCreateUserForm}
          notice={adminNotice}
          createClientAccount={createClientAccount}
        />
      )}
    </>
  );
}
