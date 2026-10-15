import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { Layout } from "@/ui/components/layout/Layout";
import HomePage from "@/ui/pages/HomePage";

const CatalogPage = lazy(() => import("@/ui/pages/CatalogPage"));
const AccountPage = lazy(() => import("@/ui/pages/AccountPage"));
const CheckoutPage = lazy(() => import("@/ui/pages/CheckoutPage"));
const OrderPage = lazy(() => import("@/ui/pages/OrderPage"));
const TermsPage = lazy(() => import("@/ui/pages/TermsPage"));
const NotFoundPage = lazy(() => import("@/ui/pages/NotFoundPage"));

// Painel em pedaços separados: quem visita a loja não baixa nada dele.
const AdminRoot = lazy(() => import("@/ui/admin/AdminLayout").then((module) => ({ default: module.AdminRoot })));
const AdminProtected = lazy(() => import("@/ui/admin/AdminLayout").then((module) => ({ default: module.AdminProtected })));
const LoginPage = lazy(() => import("@/ui/admin/pages/LoginPage"));
const AccountsListPage = lazy(() => import("@/ui/admin/pages/AccountsListPage"));
const AccountEditorPage = lazy(() => import("@/ui/admin/pages/AccountEditorPage"));
const TestimonialsListPage = lazy(() => import("@/ui/admin/pages/TestimonialsListPage"));
const TestimonialEditorPage = lazy(() => import("@/ui/admin/pages/TestimonialEditorPage"));
const OrdersPage = lazy(() => import("@/ui/admin/pages/OrdersPage"));
const SettingsPage = lazy(() => import("@/ui/admin/pages/SettingsPage"));
const MyAccountPage = lazy(() => import("@/ui/admin/pages/MyAccountPage"));
const CustomersPage = lazy(() => import("@/ui/admin/pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("@/ui/admin/pages/CustomerDetailPage"));
const CrmPage = lazy(() => import("@/ui/admin/pages/CrmPage"));
const LeadEditorPage = lazy(() => import("@/ui/admin/pages/LeadEditorPage"));

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "contas", element: <CatalogPage /> },
      { path: "contas/:slug", element: <AccountPage /> },
      { path: "checkout/:slug", element: <CheckoutPage /> },
      { path: "pedido/:code", element: <OrderPage /> },
      { path: "termos", element: <TermsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "admin",
    element: <AdminRoot />,
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: <AdminProtected />,
        children: [
          { index: true, element: <Navigate to="contas" replace /> },
          { path: "contas", element: <AccountsListPage /> },
          { path: "contas/nova", element: <AccountEditorPage /> },
          { path: "contas/:id", element: <AccountEditorPage /> },
          { path: "depoimentos", element: <TestimonialsListPage /> },
          { path: "depoimentos/novo", element: <TestimonialEditorPage /> },
          { path: "depoimentos/:id", element: <TestimonialEditorPage /> },
          { path: "pedidos", element: <OrdersPage /> },
          { path: "clientes", element: <CustomersPage /> },
          { path: "clientes/:key", element: <CustomerDetailPage /> },
          { path: "crm", element: <CrmPage /> },
          { path: "crm/novo", element: <LeadEditorPage /> },
          { path: "crm/:id", element: <LeadEditorPage /> },
          { path: "configuracoes", element: <SettingsPage /> },
          { path: "minha-conta", element: <MyAccountPage /> },
        ],
      },
    ],
  },
]);
