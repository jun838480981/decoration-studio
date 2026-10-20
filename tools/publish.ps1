#requires -Version 5.1
<#
  decoration-studio 发布脚本（供用户在普通终端里执行）

  为什么需要你手工跑一次：
  DSH 会话内所有进程创建都失败（pwsh / cmd / node 一律 exit 3221225794 = STATUS_DLL_INIT_FAILED），
  因此 pnpm install、git、push 在那个会话里一次都起不来。本脚本把那一串命令固化下来，
  并自动修掉本机 .gitconfig 里会把 github 流量重写到停服镜像的 insteadOf 陷阱。

  用法（在本文件所在目录的上级，即 decoration-studio 目录下打开终端/PowerShell）：
      pwsh -File .\tools\publish.ps1
  或：
      powershell -ExecutionPolicy Bypass -File .\tools\publish.ps1

  只想先装依赖、暂不推送：加 -SkipPush
#>
[CmdletBinding()]
param(
  [string]$RemoteUrl = 'https://github.com/jun838480981/decoration-studio.git',
  [string]$Branch = 'main',
  [switch]$SkipPush,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot   # 本脚本位于 <repo>/tools/
Set-Location -LiteralPath $repoRoot

function Step([string]$text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Ok([string]$text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Warn([string]$text) { Write-Host "  [!!] $text" -ForegroundColor Yellow }

Write-Host "仓库根目录: $repoRoot"

# ---------------------------------------------------------------- 1. 安装依赖
if (-not $SkipInstall) {
  Step '1/6 pnpm install（生成 pnpm-lock.yaml）'
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) {
    & pnpm install
  } else {
    Warn '未找到 pnpm，尝试 corepack 启用'
    & corepack enable
    & corepack prepare pnpm@latest --activate
    & pnpm install
  }
  if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败（exit $LASTEXITCODE）" }
  if (Test-Path (Join-Path $repoRoot 'pnpm-lock.yaml')) {
    Ok 'pnpm-lock.yaml 已生成（会被一起提交，保证可复现安装）'
  } else {
    Warn '没有生成 pnpm-lock.yaml，请检查 pnpm 输出'
  }
} else {
  Warn '已按 -SkipInstall 跳过依赖安装'
}

# ------------------------------------------------- 2. 修掉 insteadOf 重写陷阱
Step '2/6 检查 .gitconfig 的 insteadOf 重写（J4 陷阱）'
$rewrites = git config --get-regexp '^url\.' 2>$null
if ($rewrites) {
  Write-Host "  当前全局重写规则：`n$rewrites"
  if ($rewrites -match 'github\.com\.cnpmjs\.org') {
    Warn '检测到 github.com -> github.com.cnpmjs.org 重写（该镜像已停服，会导致 clone/push 失败）'
    git config --unset-all url.github.com.cnpmjs.org.insteadOf   # 仅清本仓库的本地配置
    Ok '已在【本仓库】清除该重写（未改动 --global，避免影响你其它项目）'
    Warn '若仍推不上去，可在确认无其它项目依赖后手动执行：git config --global --unset url."github.com.cnpmjs.org".insteadOf'
  } else {
    Warn '存在 url.* 重写规则但不含已停服镜像，请自行确认是否影响 github.com'
  }
} else {
  Ok '未发现任何 url.* 重写规则'
}

# ------------------------------------------------------------ 3. 初始化仓库
Step '3/6 git 初始化与身份'
if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
  git init -b $Branch
  Ok "已初始化仓库（分支 $Branch）"
} else {
  Ok '仓库已存在，跳过 init'
}

if (-not (git config user.name))  { git config user.name  'JayChou' }
if (-not (git config user.email)) { git config user.email '838480981@qq.com' }
Ok ("提交身份: {0} <{1}>" -f (git config user.name), (git config user.email))

$remotes = git remote
if ($remotes -notcontains 'origin') {
  git remote add origin $RemoteUrl
  Ok "已添加 remote origin -> $RemoteUrl"
} else {
  Ok ("remote origin 已存在: " + (git remote get-url origin))
}
git remote -v

# ------------------------------------------------------------ 4. 连通性预检
Step '4/6 远程连通性预检（git ls-remote）'
git ls-remote --heads origin
if ($LASTEXITCODE -ne 0) {
  Warn 'ls-remote 失败：可能是网络、镜像重写或凭据未授权。'
  Warn '本仓库若为空，ls-remote 无输出属正常。'
  Warn '认证失败时让 Git Credential Manager 弹窗登录即可；本脚本不会读取或输出任何 token。'
} else {
  Ok '远程可达'
}

# ------------------------------------------------------------ 5. 提交
Step '5/6 暂存并提交（中文提交信息）'
git add -A
Write-Host '--- git status --porcelain ---'
git status --porcelain

# 防呆：确认没有把依赖目录/构建产物/密钥提交进去
$staged = git diff --cached --name-only
$forbidden = $staged | Where-Object { $_ -match '^(node_modules/|dist/|coverage/)' -or $_ -match '\.env($|\.)' -and $_ -notmatch '\.env\.example$' }
if ($forbidden) {
  throw "暂存区包含不该入库的路径，已中止：`n$($forbidden -join "`n")`n请修正 .gitignore 后重跑。"
}
Ok '暂存区未发现 node_modules / dist / coverage / 密钥文件'

$msg = @'
初始提交：装修设计单体 HTML 迁移为 Vue3 + Vite + TypeScript 工程

- 以 装修设计.html（3895 行，含多方案管理与结构编辑模式）为功能基线，装修设计.html.bak 作为差异核对基准
- 搭建工程骨架与主题令牌系统（3 套预设 × 47 令牌，基于 Material Color Utilities + colorjs.io 对比度校验）
- 落地类型与 Pinia store 契约（SPEC §D 冻结），并为 2D / 3D / 亮点三路预留契约占位
- 建立依赖白名单与 docs/THIRD-PARTY.md 依赖登记（MIT 开源发布）
- 交付文档：ORIGINAL-FEATURES.md / SPEC.md / OSS-RESEARCH.md / THIRD-PARTY.md
'@
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Warn '提交失败或没有变更可提交，请查看上方输出' } else { Ok '提交完成' }

# ------------------------------------------------------------ 6. 推送
Step '6/6 推送'
if ($SkipPush) {
  Warn '已按 -SkipPush 跳过推送'
} else {
  git push -u origin $Branch
  if ($LASTEXITCODE -ne 0) {
    Warn '推送失败。常见原因：远程已有提交（先 git pull --rebase）、认证未完成、或仍未修掉重写规则。'
    Warn '不要盲目 force push；把完整报错贴给 DSH 会话中的队长处理。'
  } else {
    Ok '推送成功'
  }
}

Step '结果证据（请把以下输出贴回会话）'
git log -1 --format='%H%n%s'
Write-Host ("当前分支: " + (git rev-parse --abbrev-ref HEAD))
Write-Host '--- git status --porcelain ---'
git status --porcelain