import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SigeApp } from './components/SigeApp'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CustomerProjectPage } from './pages/CustomerProjectPage'
import { Editor3DPage } from './pages/Editor3DPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { ProjectDashboardPage } from './pages/ProjectDashboardPage'
import { ReadOnlyProject3DPage } from './pages/ReadOnlyProject3DPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { VendorRegisterPage } from './pages/VendorRegisterPage'

function loginPathFor(pathname: string): '/sp/login' | '/us/login' {
  // Customer-facing pages
  if (pathname.startsWith('/projects/') && (pathname.includes('/customer') || pathname.includes('/read-only-3d'))) {
    return '/us/login'
  }
  return '/sp/login'
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-surface text-on-surface">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPathFor(location.pathname)} replace state={{ from: location }} />
  }

  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-surface text-on-surface">Loading...</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />
      <Route
        path="/sign-in"
        element={
          <PublicOnlyRoute>
            <Navigate to="/sp/login" replace />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicOnlyRoute>
            <Navigate to="/sp/signup" replace />
          </PublicOnlyRoute>
        }
      />

      {/* Vendor portal */}
      <Route
        path="/sp/login"
        element={
          <PublicOnlyRoute>
            <SignInPage portal="vendor" defaultMode="password" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sp/signup"
        element={
          <PublicOnlyRoute>
            <Navigate to="/sp/register" replace />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sp/register"
        element={
          <VendorRegisterPage />
        }
      />

      {/* Customer portal */}
      <Route
        path="/us/login"
        element={
          <PublicOnlyRoute>
            <SignInPage portal="customer" defaultMode="password" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/us/invite"
        element={
          <PublicOnlyRoute>
            <SignInPage portal="customer" defaultMode="invite" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/us/signup"
        element={
          <PublicOnlyRoute>
            <SignUpPage portal="customer" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ProjectDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/new"
        element={
          <ProtectedRoute>
            <NewProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/customer"
        element={
          <ProtectedRoute>
            <CustomerProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/read-only-3d"
        element={
          <ProtectedRoute>
            <ReadOnlyProject3DPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editor"
        element={
          <ProtectedRoute>
            <SigeApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editor/3d"
        element={
          <ProtectedRoute>
            <Editor3DPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
