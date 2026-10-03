import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/ui/components/layout/Layout";
import HomePage from "@/ui/pages/HomePage";

const CatalogPage = lazy(() => import("@/ui/pages/CatalogPage"));
const AccountPage = lazy(() => import("@/ui/pages/AccountPage"));
const CheckoutPage = lazy(() => import("@/ui/pages/CheckoutPage"));
const OrderPage = lazy(() => import("@/ui/pages/OrderPage"));
const TermsPage = lazy(() => import("@/ui/pages/TermsPage"));
const NotFoundPage = lazy(() => import("@/ui/pages/NotFoundPage"));

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
]);
