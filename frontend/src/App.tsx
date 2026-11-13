import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyFilesPage } from './pages/MyFilesPage';
import { SharedFilesPage } from './pages/SharedFilesPage';
import { TrashPage } from './pages/TrashPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { PublicSharePage } from './pages/PublicSharePage';

// Modals
import { UploadModal } from './components/UploadModal';
import { ShareModal } from './components/ShareModal';
import { PreviewModal } from './components/PreviewModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { FileItem, FolderItem } from './types';
import { api } from './lib/api';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('/')) return hash;
    if (hash.startsWith('share/')) return `/${hash}`;
    return '/';
  });

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileItem | null>(null);

  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);

  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Synchronize hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.startsWith('/')) {
        setCurrentPath(hash);
      } else if (hash.startsWith('share/')) {
        setCurrentPath(`/${hash}`);
      } else if (!hash) {
        setCurrentPath('/');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch folders for upload selector
  useEffect(() => {
    if (user) {
      api.folders.list().then((res) => {
        if (res.success) setAllFolders(res.folders || []);
      }).catch(console.error);
    }
  }, [user, refreshTrigger]);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
  };

  // Check if viewing a public share link
  if (currentPath.startsWith('/share/')) {
    const token = currentPath.replace('/share/', '');
    return <PublicSharePage token={token} />;
  }

  // Loading indicator on initial session verification
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in
  if (!user) {
    if (currentPath === '/login') {
      return <LoginPage onNavigate={navigate} />;
    }
    if (currentPath === '/register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    return <LandingPage onNavigate={navigate} />;
  }

  // If logged in, render authenticated Layout
  let title = 'Dashboard';
  let content = null;

  switch (currentPath) {
    case '/dashboard':
      title = 'Dashboard Overview';
      content = (
        <DashboardPage
          onNavigate={navigate}
          onOpenUpload={() => {
            setUploadFolderId(null);
            setUploadModalOpen(true);
          }}
          onOpenCreateFolder={() => {
            setCreateFolderParentId(null);
            setCreateFolderModalOpen(true);
          }}
          onPreviewFile={(file) => {
            setSelectedFileForPreview(file);
            setPreviewModalOpen(true);
          }}
          onShareFile={(file) => {
            setSelectedFileForShare(file);
            setShareModalOpen(true);
          }}
        />
      );
      break;
    case '/files':
      title = 'My Encrypted Files';
      content = (
        <MyFilesPage
          key={refreshTrigger}
          onOpenUpload={(folderId) => {
            setUploadFolderId(folderId || null);
            setUploadModalOpen(true);
          }}
          onOpenCreateFolder={(parentId) => {
            setCreateFolderParentId(parentId || null);
            setCreateFolderModalOpen(true);
          }}
          onPreviewFile={(file) => {
            setSelectedFileForPreview(file);
            setPreviewModalOpen(true);
          }}
          onShareFile={(file) => {
            setSelectedFileForShare(file);
            setShareModalOpen(true);
          }}
        />
      );
      break;
    case '/upload':
      title = 'Secure File Ingestion';
      content = (
        <div className="py-8">
          <UploadModal
            isOpen={true}
            onClose={() => navigate('/files')}
            onUploadComplete={() => {
              setRefreshTrigger((prev) => prev + 1);
              navigate('/files');
            }}
            folders={allFolders}
            currentFolderId={uploadFolderId}
          />
        </div>
      );
      break;
    case '/shared':
      title = 'Shared Links & Transfers';
      content = <SharedFilesPage />;
      break;
    case '/trash':
      title = 'Trash Recovery Bin';
      content = <TrashPage />;
      break;
    case '/activity':
      title = 'Security Activity Logs';
      content = <ActivityLogsPage />;
      break;
    case '/settings':
      title = 'Security & Profile Settings';
      content = <SettingsPage />;
      break;
    case '/admin':
      if (user.role !== 'ADMIN') {
        title = 'Dashboard Overview';
        content = <DashboardPage
          onNavigate={navigate}
          onOpenUpload={() => setUploadModalOpen(true)}
          onOpenCreateFolder={() => setCreateFolderModalOpen(true)}
          onPreviewFile={(f) => { setSelectedFileForPreview(f); setPreviewModalOpen(true); }}
          onShareFile={(f) => { setSelectedFileForShare(f); setShareModalOpen(true); }}
        />;
      } else {
        title = 'System Administrator Console';
        content = <AdminPage />;
      }
      break;
    default:
      title = 'Dashboard Overview';
      content = (
        <DashboardPage
          onNavigate={navigate}
          onOpenUpload={() => {
            setUploadFolderId(null);
            setUploadModalOpen(true);
          }}
          onOpenCreateFolder={() => {
            setCreateFolderParentId(null);
            setCreateFolderModalOpen(true);
          }}
          onPreviewFile={(file) => {
            setSelectedFileForPreview(file);
            setPreviewModalOpen(true);
          }}
          onShareFile={(file) => {
            setSelectedFileForShare(file);
            setShareModalOpen(true);
          }}
        />
      );
  }

  return (
    <>
      <Layout
        currentPath={currentPath}
        onNavigate={navigate}
        onOpenUploadModal={() => {
          setUploadFolderId(null);
          setUploadModalOpen(true);
        }}
        title={title}
      >
        {content}
      </Layout>

      {/* Global Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={() => setRefreshTrigger((prev) => prev + 1)}
        folders={allFolders}
        currentFolderId={uploadFolderId}
      />

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        file={selectedFileForShare}
        onShareCreated={() => setRefreshTrigger((prev) => prev + 1)}
      />

      <PreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        file={selectedFileForPreview}
        onShareClick={(f) => {
          setSelectedFileForShare(f);
          setShareModalOpen(true);
        }}
      />

      <CreateFolderModal
        isOpen={createFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        parentId={createFolderParentId}
        onFolderCreated={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
