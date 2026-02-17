'use client';

// Type declarations for DOM APIs
declare global {
  interface HTMLAnchorElement {
    href: string;
    download: string;
    click(): void;
  }
}

import { AlertTriangle, Download, FileCheck, Lock, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { useAdminLoading } from '@/hooks/admin/useAdminLoading';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

function DataMigration() {
  const { withLoading, isLoading } = useAdminLoading();
  const { showSuccess, showError } = useToastNotification();

  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!exportPassword.trim()) {
      showError('请输入加密密码');
      return;
    }

    await withLoading('export', async () => {
      try {
        const response = await fetch('/api/admin/data_migration/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: exportPassword }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `导出失败: ${response.status}`);
        }

        // 获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch?.[1] || 'vidora-backup.dat';

        // 下载文件
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a') as HTMLAnchorElement;
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);

        const result = { success: true, filename };

        if (result.success) {
          showSuccess(
            `数据已成功导出为 ${result.filename}，请妥善保管备份文件和密码`,
          );
          setExportPassword('');
        }
      } catch (error) {
        showError(
          '导出失败: ' +
            (error instanceof Error ? error.message : '导出过程中发生错误'),
        );
      }
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showError('请选择要导入的备份文件');
      return;
    }

    if (!importPassword.trim()) {
      showError('请输入解密密码');
      return;
    }

    // 使用confirm对话框确认，然后使用Toast通知
    if (confirm('导入数据将清空现有数据，确定要继续吗？')) {
      await withLoading('import', async () => {
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('password', importPassword);

          const response = await fetch('/api/admin/data_migration/import', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || `导入失败: ${response.status}`);
          }

          showSuccess(
            `导入完成！用户数量: ${result.importedUsers}，3秒后自动刷新页面`,
          );

          // 清理状态
          setSelectedFile(null);
          setImportPassword('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          // 3秒后自动刷新页面
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }, 3000);
        } catch (error) {
          showError(
            '导入失败: ' +
              (error instanceof Error ? error.message : '导入过程中发生错误'),
          );
        }
      });
    }
  };

  return (
    <>
      <div className='p-2 sm:p-6'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* 警告提示 */}
          <div className='flex items-center gap-3 p-4 border border-amber-200 dark:border-amber-700 rounded-lg bg-amber-50/30 dark:bg-amber-900/5'>
            <AlertTriangle className='w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0' />
            <p className='text-sm text-amber-800 dark:text-amber-200'>
              数据迁移操作请谨慎，确保已备份重要数据
            </p>
          </div>

          {/* 主要操作区域 */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* 数据导出 */}
            <div className='border border-amber-200 dark:border-amber-700 rounded-lg p-6 bg-amber-50 dark:bg-amber-900/30 hover:shadow-sm transition-shadow flex flex-col'>
              <div className='flex items-center gap-3 mb-6'>
                <div className='w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
                  <Download className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-900 dark:text-gray-100'>
                    数据导出
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    创建加密备份文件
                  </p>
                </div>
              </div>

              <div className='flex-1 flex flex-col'>
                <div className='space-y-4'>
                  {/* 密码输入 */}
                  <div>
                    <label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      <Lock className='w-4 h-4' />
                      加密密码
                    </label>
                    <input
                      type='password'
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      placeholder='设置强密码保护备份文件'
                      className='w-full px-3 py-2.5 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500'
                      disabled={isLoading('export')}
                    />
                    <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                      导入时需要使用相同密码
                    </p>
                  </div>

                  {/* 备份内容列表 */}
                  <div className='text-xs text-gray-600 dark:text-gray-400 space-y-1'>
                    <p className='font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      备份内容：
                    </p>
                    <div className='grid grid-cols-2 gap-1'>
                      <div>• 管理配置</div>
                      <div>• 用户数据</div>
                      <div>• 播放记录</div>
                      <div>• 收藏夹</div>
                    </div>
                  </div>
                </div>

                {/* 导出按钮 */}
                <button
                  onClick={handleExport}
                  disabled={isLoading('export') || !exportPassword.trim()}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors mt-10 ${
                    isLoading('export') || !exportPassword.trim()
                      ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isLoading('export') ? (
                    <div className='flex items-center justify-center gap-2'>
                      <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                      导出中...
                    </div>
                  ) : (
                    <div className='flex items-center justify-center gap-2'>
                      <Download className='w-4 h-4' />
                      导出数据
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* 数据导入 */}
            <div className='border border-amber-200 dark:border-amber-700 rounded-lg p-6 bg-amber-50 dark:bg-amber-900/30 hover:shadow-sm transition-shadow flex flex-col'>
              <div className='flex items-center gap-3 mb-6'>
                <div className='w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center'>
                  <Upload className='w-4 h-4 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-900 dark:text-gray-100'>
                    数据导入
                  </h3>
                  <p className='text-sm text-red-600 dark:text-red-400'>
                    ⚠️ 将清空现有数据
                  </p>
                </div>
              </div>

              <div className='flex-1 flex flex-col'>
                <div className='space-y-4'>
                  {/* 文件选择 */}
                  <div>
                    <label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      <FileCheck className='w-4 h-4' />
                      备份文件
                      {selectedFile && (
                        <span className='ml-auto text-xs text-green-600 dark:text-green-400 font-normal'>
                          {selectedFile.name} (
                          {(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </label>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='.dat'
                      onChange={handleFileSelect}
                      className='w-full px-3 py-2.5 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-amber-50 dark:file:bg-amber-600 file:text-amber-700 dark:file:text-amber-300 hover:file:bg-amber-100 dark:hover:file:bg-amber-500'
                      disabled={isLoading('import')}
                    />
                  </div>

                  {/* 密码输入 */}
                  <div>
                    <label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      <Lock className='w-4 h-4' />
                      解密密码
                    </label>
                    <input
                      type='password'
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder='输入导出时的加密密码'
                      className='w-full px-3 py-2.5 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500'
                      disabled={isLoading('import')}
                    />
                  </div>
                </div>

                {/* 导入按钮 */}
                <button
                  onClick={handleImport}
                  disabled={
                    isLoading('import') ||
                    !selectedFile ||
                    !importPassword.trim()
                  }
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors mt-10 ${
                    isLoading('import') ||
                    !selectedFile ||
                    !importPassword.trim()
                      ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isLoading('import') ? (
                    <div className='flex items-center justify-center gap-2'>
                      <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                      导入中...
                    </div>
                  ) : (
                    <div className='flex items-center justify-center gap-2'>
                      <Upload className='w-4 h-4' />
                      导入数据
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DataMigration;
