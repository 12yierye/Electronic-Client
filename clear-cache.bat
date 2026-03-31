@echo off
chcp 65001 >nul
echo ========================================
echo   Electronic - 清理缓存
echo ========================================
echo.

set "LOCALAPPDATA=%LOCALAPPDATA%"

if exist "%LOCALAPPDATA%\Electronic\Cache" (
    echo 正在删除缓存目录...
    rd /s /q "%LOCALAPPDATA%\Electronic\Cache"
    echo ✓ 缓存目录已删除
) else (
    echo ℹ 缓存目录不存在
)

if exist "%LOCALAPPDATA%\Electronic\GPUCache" (
    echo 正在删除 GPU 缓存...
    rd /s /q "%LOCALAPPDATA%\Electronic\GPUCache"
    echo ✓ GPU 缓存已删除
)

if exist "%LOCALAPPDATA%\Electronic\Code Cache" (
    echo 正在删除代码缓存...
    rd /s /q "%LOCALAPPDATA%\Electronic\Code Cache"
    echo ✓ 代码缓存已删除
)

echo.
echo ========================================
echo   清理完成！
echo ========================================
echo.
pause
