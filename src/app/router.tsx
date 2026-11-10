import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import RouteErrorPage from "@/ui/pages/RouteErrorPage";
import { Layout } from "@/ui/components/layout/Layout";
import HomePage from "@/ui/pages/HomePage";

const CatalogPage = lazy(() => import("@/ui/pages/CatalogPage"));
const AccountPage = lazy(() => import("@/ui/pages/AccountPage"));
const CartPage = lazy(() => import("@/ui/pages/CartPage"));
const CheckoutPage = lazy(() => import("@/ui/pages/CheckoutPage"));
const OrderPage = lazy(() => import("@/ui/pages/OrderPage"));
const LegalDocumentPage = lazy(() => import("@/ui/pages/LegalDocumentPage"));
const MyDataPage = lazy(() => import("@/ui/pages/MyDataPage"));
const PartnerPage = lazy(() => import("@/ui/pages/PartnerPage"));
const AboutPage = lazy(() => import("@/ui/pages/AboutPage"));
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
const SitePage = lazy(() => import("@/ui/admin/pages/SitePage"));
const DashboardPage = lazy(() => import("@/ui/admin/pages/DashboardPage"));
const FinalizedPage = lazy(() => import("@/ui/admin/pages/FinalizedPage"));
const PartnersPage = lazy(() => import("@/ui/admin/pages/PartnersPage"));
const CouponsPage = lazy(() => import("@/ui/admin/pages/CouponsPage"));
const CouponEditorPage = lazy(() => import("@/ui/admin/pages/CouponEditorPage"));
const PartnerEditorPage = lazy(() => import("@/ui/admin/pages/PartnerEditorPage"));
const EmailAccountsPage = lazy(() => import("@/ui/admin/pages/EmailAccountsPage"));
const EmailAccountEditorPage = lazy(() => import("@/ui/admin/pages/EmailAccountEditorPage"));
const UsersPage = lazy(() => import("@/ui/admin/pages/UsersPage"));
const UserAccessPage = lazy(() => import("@/ui/admin/pages/UserAccessPage"));
const UserEditorPage = lazy(() => import("@/ui/admin/pages/UserEditorPage"));
const SettingsPage = lazy(() => import("@/ui/admin/pages/SettingsPage"));
const CustomersPage = lazy(() => import("@/ui/admin/pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("@/ui/admin/pages/CustomerDetailPage"));
const CrmPage = lazy(() => import("@/ui/admin/pages/CrmPage"));
const LeadEditorPage = lazy(() => import("@/ui/admin/pages/LeadEditorPage"));
const CustomerEditorPage = lazy(() => import("@/ui/admin/pages/CustomerEditorPage"));
const AutomationPage = lazy(() => import("@/ui/admin/pages/AutomationPage"));
const PrivacyPage = lazy(() => import("@/ui/admin/pages/PrivacyPage"));
const ApisPage = lazy(() => import("@/ui/admin/pages/ApisPage"));
const MorePage = lazy(() => import("@/ui/admin/pages/MorePage"));
const FinancePage = lazy(() => import("@/ui/admin/pages/FinancePage"));
const ExpenseEditorPage = lazy(() => import("@/ui/admin/pages/ExpenseEditorPage"));
const RevenueEditorPage = lazy(() => import("@/ui/admin/pages/RevenueEditorPage"));
const SupportPage = lazy(() => import("@/ui/admin/pages/SupportPage"));
const AccessPage = lazy(() => import("@/ui/admin/pages/AccessPage"));
const StoragePage = lazy(() => import("@/ui/admin/pages/StoragePage"));
const AccessUserPage = lazy(() => import("@/ui/admin/pages/AccessUserPage"));
const SupportTicketEditorPage = lazy(() => import("@/ui/admin/pages/SupportTicketEditorPage"));
const SupportTicketPage = lazy(() => import("@/ui/admin/pages/SupportTicketPage"));

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "contas", element: <CatalogPage /> },
      { path: "contas/:slug", element: <AccountPage /> },
      { path: "carrinho", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "checkout/:slug", element: <CheckoutPage /> },
      { path: "pedido/:code", element: <OrderPage /> },
      { path: "termos-de-uso", element: <LegalDocumentPage slug="terms" /> },
      { path: "politica-de-privacidade", element: <LegalDocumentPage slug="privacy" /> },
      { path: "meus-dados", element: <MyDataPage /> },
      { path: "seja-parceiro", element: <PartnerPage /> },
      { path: "quem-sou-eu", element: <AboutPage /> },
      // Endereço antigo dos "Termos de compra e garantia", que agora fazem parte dos Termos de Uso.
      { path: "termos", element: <Navigate to="/termos-de-uso" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "admin",
    element: <AdminRoot />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: <AdminProtected />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "contas", element: <AccountsListPage /> },
          { path: "contas/nova", element: <AccountEditorPage /> },
          { path: "contas/:id", element: <AccountEditorPage /> },
          { path: "emails", element: <EmailAccountsPage /> },
          { path: "emails/novo", element: <EmailAccountEditorPage /> },
          { path: "emails/:id", element: <EmailAccountEditorPage /> },
          { path: "depoimentos", element: <TestimonialsListPage /> },
          { path: "depoimentos/novo", element: <TestimonialEditorPage /> },
          { path: "depoimentos/:id", element: <TestimonialEditorPage /> },
          { path: "pedidos", element: <OrdersPage /> },
          { path: "finalizados", element: <FinalizedPage /> },
          { path: "financeiro", element: <FinancePage /> },
          { path: "financeiro/despesas/nova", element: <ExpenseEditorPage /> },
          { path: "financeiro/despesas/:id", element: <ExpenseEditorPage /> },
          { path: "financeiro/receitas/nova", element: <RevenueEditorPage /> },
          { path: "financeiro/receitas/:id", element: <RevenueEditorPage /> },
          { path: "clientes", element: <CustomersPage /> },
          { path: "clientes/novo", element: <CustomerEditorPage /> },
          { path: "clientes/cadastro/:id", element: <CustomerEditorPage /> },
          { path: "clientes/:key", element: <CustomerDetailPage /> },
          { path: "cupons", element: <CouponsPage /> },
          { path: "cupons/novo", element: <CouponEditorPage /> },
          { path: "cupons/:id", element: <CouponEditorPage /> },
          { path: "parceiros", element: <PartnersPage /> },
          { path: "parceiros/novo", element: <PartnerEditorPage /> },
          { path: "parceiros/:id", element: <PartnerEditorPage /> },
          { path: "crm", element: <CrmPage /> },
          { path: "crm/novo", element: <LeadEditorPage /> },
          { path: "crm/:id", element: <LeadEditorPage /> },
          { path: "automacao", element: <AutomationPage /> },
          { path: "apis", element: <ApisPage /> },
          { path: "privacidade", element: <PrivacyPage /> },
          { path: "mais", element: <MorePage /> },
          { path: "site", element: <SitePage /> },
          { path: "configuracoes", element: <SettingsPage /> },
          { path: "usuarios", element: <UsersPage /> },
          { path: "usuarios/novo", element: <UserEditorPage /> },
          { path: "usuarios/:id", element: <UserAccessPage /> },
          { path: "armazenamento", element: <StoragePage /> },
          { path: "acessos", element: <AccessPage /> },
          { path: "acessos/novo", element: <UserEditorPage backPath="/admin/acessos" /> },
          { path: "acessos/:id", element: <AccessUserPage /> },
          { path: "suporte", element: <SupportPage /> },
          { path: "suporte/novo", element: <SupportTicketEditorPage /> },
          { path: "suporte/:id", element: <SupportTicketPage /> },
          // Links antigos de "Minha conta" (e-mails de redefinição já enviados) caem nas Configurações.
          { path: "minha-conta", element: <Navigate to="/admin/configuracoes" replace /> },
        ],
      },
    ],
  },
]);
