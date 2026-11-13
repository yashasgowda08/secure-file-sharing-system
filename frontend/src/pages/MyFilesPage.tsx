import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Edit2,
  Eye,
  ChevronRight,
  Home,
  ShieldCheck,
  Lock,
  Plus,
} from 'lucide-react';
import { api } from '../lib/api';
import { FileItem, FolderItem } from '../types';
import { formatBytes, formatDate, getFileCategory } from '../lib/utils';
import { FileIcon } from '../components/FileIcon';
import { useToast } from '../context/ToastContext';

interface MyFilesPageProps {
  onOpenUpload: (folderId?: string | null) => void;
  onOpenCreateFolder: (parentId?: string | null) => void;
  onPreviewFile: (file: FileItem) => void;
  onShareFile: (file: FileItem) => void;
}

export const MyFilesPage: React.FC<MyFilesPageProps> = ({
  onOpenUpload,
  onOpenCreateFolder,
  onPreviewFile,
  onShareFile,
}) => {
  const { success, error } = useToast();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<FolderItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rename Dialog state
  const [renamingItem, setRenamingItem] = useState<{ id: string; type: 'file' | 'folder'; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadContent(currentFolder ? currentFolder.id : null);
  }, [currentFolder, sortBy, sortOrder]);

  const loadContent = async (folderId: string | null) => {
    setIsLoading(true);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        api.files.list({
          folderId: folderId || 'root',
          sortBy,
          sortOrder,
        }),
        api.folders.list(folderId || 'root'),
      ]);

      if (filesRes.success) setFiles(filesRes.files || []);
      if (foldersRes.success) setFolders(foldersRes.folders || []);
    } catch (err: any) {
      console.error(err);
      error('Failed to Load Files', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folder: FolderItem | null) => {
    if (!folder) {
      setCurrentFolder(null);
      setFolderBreadcrumb([]);
    } else {
      setCurrentFolder(folder);
      // Append to breadcrumb if not already in path
      const idx = folderBreadcrumb.findIndex((f) => f.id === folder.id);
      if (idx !== -1) {
        setFolderBreadcrumb((prev) => prev.slice(0, idx + 1));
      } else {
        setFolderBreadcrumb((prev) => [...prev, folder]);
      }
    }
  };

  const handleTrashFile = async (fileId: string) => {
    try {
      const res = await api.files.delete(fileId);
      if (res.success) {
        success('File Trashed', 'File moved to Trash.');
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err: any) {
      error('Action Failed', err.message);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Delete this folder and its contents?')) return;
    try {
      const res = await api.folders.delete(folderId);
      if (res.success) {
        success('Folder Removed', 'Folder and contents moved to trash.');
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
      }
    } catch (err: any) {
      error('Action Failed', err.message);
    }
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renameValue.trim()) return;

    try {
      if (renamingItem.type === 'file') {
        const res = await api.files.update(renamingItem.id, { name: renameValue.trim() });
        if (res.success) {
          success('Renamed', 'File renamed successfully.');
          setFiles((prev) => prev.map((f) => (f.id === renamingItem.id ? res.file : f)));
        }
      } else {
        const res = await api.folders.update(renamingItem.id, { name: renameValue.trim() });
        if (res.success) {
          success('Renamed', 'Folder renamed successfully.');
          setFolders((prev) => prev.map((f) => (f.id === renamingItem.id ? res.folder : f)));
        }
      }
      setRenamingItem(null);
    } catch (err: any) {
      error('Rename Failed', err.message);
    }
  };

  // Filter files by search and category
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    return getFileCategory(f.mimeType, f.name) === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 overflow-x-auto py-1">
          <button
            onClick={() => navigateToFolder(null)}
            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Vault Root</span>
          </button>
          {folderBreadcrumb.map((f, i) => (
            <React.Fragment key={f.id}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => navigateToFolder(f)}
                className={`hover:text-blue-600 transition-colors truncate max-w-[120px] ${
                  i === folderBreadcrumb.length - 1 ? 'text-slate-900 dark:text-white font-bold' : ''
                }`}
              >
                {f.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenCreateFolder(currentFolder ? currentFolder.id : null)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-semibold shadow-xs"
          >
            <FolderPlus className="w-4 h-4 text-blue-500" />
            <span>New Folder</span>
          </button>
          <button
            onClick={() => onOpenUpload(currentFolder ? currentFolder.id : null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Here</span>
          </button>
        </div>
      </div>

      {/* Search, Filter Category, Sort & View Mode Row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs font-medium">
          {['all', 'document', 'image', 'video', 'code', 'archive'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Right controls: Search input, Sort select, View Mode toggle */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter current view..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
          >
            <option value="createdAt">Date Modified</option>
            <option value="name">Name</option>
            <option value="size">File Size</option>
          </select>

          {/* Sort Order Button */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Folders ({folders.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onDoubleClick={() => navigateToFolder(folder)}
                className="group relative p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer shadow-xs"
              >
                <div
                  onClick={() => navigateToFolder(folder)}
                  className="flex items-center gap-2.5 min-w-0"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Folder className="w-4 h-4 fill-amber-500/20" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {folder.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {folder._count?.files || 0} files
                    </p>
                  </div>
                </div>

                {/* Context menu for folder */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  title="Delete Folder"
                  className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Files ({filteredFiles.length})
        </h3>

        {filteredFiles.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center mx-auto">
              <Folder className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No files found in this directory
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Upload files to protect them with automatic AES-256-GCM encryption.
            </p>
            <button
              onClick={() => onOpenUpload(currentFolder ? currentFolder.id : null)}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-xs"
            >
              Upload Files
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="group relative p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all space-y-3"
              >
                <div
                  onClick={() => onPreviewFile(file)}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <FileIcon mimeType={file.mimeType} filename={file.name} className="w-11 h-11" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                {/* Badges & Actions footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <span className="text-slate-400 truncate max-w-[100px]">
                    {formatDate(file.createdAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onShareFile(file)}
                      title="Share Protected Link"
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={api.files.getDownloadUrl(file.id, false)}
                      download={file.name}
                      title="Download File"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleTrashFile(file.id)}
                      title="Move to Trash"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Encryption</th>
                  <th className="py-3 px-4">Modified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div
                        onClick={() => onPreviewFile(file)}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <FileIcon mimeType={file.mimeType} filename={file.name} className="w-8 h-8" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 truncate max-w-xs">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{formatBytes(file.size)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{file.isE2EE ? 'Client E2EE' : 'AES-256-GCM'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formatDate(file.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onShareFile(file)}
                          title="Share Link"
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={api.files.getDownloadUrl(file.id, false)}
                          download={file.name}
                          title="Download"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleTrashFile(file.id)}
                          title="Move to Trash"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setRenamingItem(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Rename Item</h3>
            <form onSubmit={handleConfirmRename} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingItem(null)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
