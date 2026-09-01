import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AppLayout } from "@/components/layout";
import { LoginPage } from "@/pages/login";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { ResetPasswordPage } from "@/pages/reset-password";
import { DashboardPage } from "@/pages/dashboard";
import { PosPage } from "@/pages/pos";
import { SaleDetailPage, SalesListPage } from "@/pages/sales";
import { ReturnsPage } from "@/pages/returns";
import { CustomerProfilePage, CustomersPage } from "@/pages/customers";
import { AdjustmentsPage, InventoryPage, MovementsPage, WastePage } from "@/pages/inventory";
import { NewPurchasePage, PurchaseDetailPage, PurchasesPage } from "@/pages/procurement";
import { SupplierDetailPage, SuppliersPage } from "@/pages/suppliers";
import { ProductsPage } from "@/pages/products";
import { ReportsPage } from "@/pages/reports";
import { SettingsPage } from "@/pages/settings";
import { PlatformPage } from "@/pages/platform";
import { hasStaffPage, homePathForUser, type StaffPage } from "@/lib/staff-pages";

function Guard({ children, platform }: { children: ReactNode; platform?: boolean }) {
  const { user, loading, authStatus } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="p-10">{t("loading")}</div>;
  if (authStatus === "RENEWAL_REQUIRED" || authStatus === "LICENSE_EXPIRED") {
    return <Navigate to="/login" replace />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (platform && user.role !== "PLATFORM_ADMIN") {
    return <Navigate to={homePathForUser(user.role, user.staffPages)} replace />;
  }
  if (!platform && user.role === "PLATFORM_ADMIN") return <Navigate to="/platform" replace />;
  return children;
}

function PageGuard({ page, children }: { page: StaffPage; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasStaffPage(user.role, user.staffPages, page)) {
    return <Navigate to={homePathForUser(user.role, user.staffPages)} replace />;
  }
  return children;
}

function OwnerGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "OWNER") return <Navigate to={homePathForUser(user.role, user.staffPages)} replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="p-10">{t("loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForUser(user.role, user.staffPages)} replace />;
}

function TenantShell() {
  return (
    <Guard>
      <AppLayout />
    </Guard>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/platform"
        element={
          <Guard platform>
            <PlatformPage />
          </Guard>
        }
      />
      <Route element={<TenantShell />}>
        <Route
          path="/"
          element={
            <PageGuard page="dashboard">
              <DashboardPage />
            </PageGuard>
          }
        />
        <Route path="/sales/new" element={<PosPage />} />
        <Route path="/sales" element={<SalesListPage />} />
        <Route path="/sales/:id" element={<SaleDetailPage />} />
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerProfilePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/movements" element={<MovementsPage />} />
        <Route path="/inventory/waste" element={<WastePage />} />
        <Route path="/inventory/adjustments" element={<AdjustmentsPage />} />
        <Route
          path="/procurement"
          element={
            <PageGuard page="procurement">
              <PurchasesPage />
            </PageGuard>
          }
        />
        <Route
          path="/procurement/new"
          element={
            <PageGuard page="procurement">
              <NewPurchasePage />
            </PageGuard>
          }
        />
        <Route
          path="/procurement/:id"
          element={
            <PageGuard page="procurement">
              <PurchaseDetailPage />
            </PageGuard>
          }
        />
        <Route
          path="/suppliers"
          element={
            <PageGuard page="suppliers">
              <SuppliersPage />
            </PageGuard>
          }
        />
        <Route
          path="/suppliers/:id"
          element={
            <PageGuard page="suppliers">
              <SupplierDetailPage />
            </PageGuard>
          }
        />
        <Route
          path="/products"
          element={
            <OwnerGuard>
              <ProductsPage />
            </OwnerGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <PageGuard page="reports">
              <ReportsPage />
            </PageGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <PageGuard page="settings">
              <SettingsPage />
            </PageGuard>
          }
        />
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
