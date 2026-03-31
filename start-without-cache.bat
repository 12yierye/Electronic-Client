@echo off
chcp 65001 >nul
echo ========================================
echo   Electronic - 无缓存启动
echo ========================================
echo.

set "ELECTRON_DISABLE_GPU=1"
set "ELECTRON_DISABLE_SOFTWARE_RASTERIZER=1"

echo 启动参数：
echo   - 禁用 GPU
echo   - 禁用软件光栅化器
echo   - 禁用沙盒
echo.

npm run electron

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   启动失败，错误代码: %errorlevel%
    echo ========================================
    echo.
    echo 尝试手动清理缓存：
    echo   1. 运行 clear-cache.bat
    echo   2. 手动删除以下目录：
    echo      %%LOCALAPPDATA%%\Electronic\Cache
    echo      %%LOCALAPPDATA%%\Electronic\GPUCache
    echo.
)

pause
