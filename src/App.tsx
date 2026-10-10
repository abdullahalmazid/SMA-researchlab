import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import AdminPreviewBar from "./components/AdminPreviewBar";
import AppErrorBoundary from "./components/AppErrorBoundary";
import BrandingHead from "./components/BrandingHead";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import ChatLauncher from "./components/ChatLauncher";
import AnalyticsTracker from "./analytics/AnalyticsTracker";
import { AuthProvider } from "./context/AuthContext";
import { EditableContentProvider } from "./context/EditableContentContext";
import { AdminPreviewProvider } from "./context/AdminPreviewContext";
import { ThemeProvider } from "./context/ThemeContext";

// Pages
import About from "./pages/About";
/* Loaded on demand: the messenger (and its emoji picker) is a large chunk
   that most visitors never open. */
const Chat = lazy(() => import("./pages/Chat"));
import CollaboratorProfilePage from "./pages/CollaboratorProfilePage";
import Collaborators from "./pages/Collaborators";
import Contact from "./pages/Contact";
import Home from "./pages/Home";
import IdeaDetail from "./pages/IdeaDetail";
import LabHead from "./pages/LabHead";
import Login from "./pages/Login";
import Publications from "./pages/Publications";
import PublicationDetail from "./pages/PublicationDetail";
import ResearchIdeas from "./pages/ResearchIdeas";
import Announcements from "./pages/Announcements";

// Portals
/* Admin console (and its stylesheet) loads on demand — visitors never need it. */
const AdminDashboard = lazy(() => import("./portals/AdminDashboard"));
import CollaboratorPortal from "./portals/CollaboratorPortal";

import DeveloperProfile from "./pages/DeveloperProfile";
import Gallery from "./pages/Gallery";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <AdminPreviewProvider>
        <ThemeProvider>
          <EditableContentProvider>
          <BrandingHead />
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <ChatLauncher />
            <AnalyticsTracker />
            <AdminPreviewBar />
            <div
              id="app-layout-content"
              className="flex flex-col flex-1 min-w-0"
            >
              <div className="flex-1">
                <AppErrorBoundary>
                <Routes>
                  {/* Public pages */}
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/lab-head" element={<LabHead />} />
                  <Route path="/collaborators" element={<Collaborators />} />
                  <Route
                    path="/collaborators/:uid"
                    element={<CollaboratorProfilePage />}
                  />
                  <Route path="/publications" element={<Publications />} />
                  <Route path="/publications/:id" element={<PublicationDetail />} />
                  <Route path="/research-ideas" element={<ResearchIdeas />} />
                  <Route path="/research-ideas/:id" element={<IdeaDetail />} />
                  <Route path="/announcements" element={<Announcements />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route
                    path="/chat"
                    element={
                      <ProtectedRoute
                        allowedRoles={["collaborator", "lab_head"]}
                        redirectTo="/login"
                      >
                        <Suspense
                          fallback={
                            <div className="fixed inset-0 z-[2147482000] grid place-items-center bg-slate-950">
                              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-transparent" />
                            </div>
                          }
                        >
                          <Chat />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin-login" element={<Login portal="admin" />} />
                  <Route
                    path="/secret-developer"
                    element={<DeveloperProfile />}
                  />
                  {/* Admin portal */}
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute
                        allowedRoles={["admin", "lab_head", "collaborator"]}
                        requireAdminAccess
                        redirectTo="/admin-login"
                      >
                        <Suspense
                          fallback={
                            <div className="fixed inset-0 z-[2147481000] grid place-items-center" style={{ background: "#05070b" }}>
                              <span className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400/40 border-t-transparent" />
                            </div>
                          }
                        >
                          <AdminDashboard />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  {/* Collaborator portal */}
                  <Route
                    path="/collaborator-portal"
                    element={
                      <ProtectedRoute
                        allowedRoles={["collaborator", "lab_head"]}
                        redirectTo="/login"
                      >
                        <CollaboratorPortal />
                      </ProtectedRoute>
                    }
                  />
                  {/* 404 */}
                  <Route
                    path="*"
                    element={
                      <div className="flex items-center justify-center min-h-[60vh] text-center px-4">
                        <div>
                          <h1
                            className="text-6xl font-black mb-4"
                            style={{ color: "var(--color-primary)" }}
                          >
                            404
                          </h1>
                          <p className="text-gray-500 mb-6">Page not found.</p>
                          <a
                            href="/"
                            className="font-bold text-sm px-6 py-3 rounded-xl text-white no-underline"
                            style={{ background: "var(--color-primary)" }}
                          >
                            Go Home
                          </a>
                        </div>
                      </div>
                    }
                  />
                  <Route path="/editlogin" element={<Login forceShow />} />
                </Routes>
                </AppErrorBoundary>
              </div>
              <Footer />
            </div>
          </div>
          </EditableContentProvider>
        </ThemeProvider>
        </AdminPreviewProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
