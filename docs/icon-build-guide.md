# Electron 应用图标说明

## 图标文件要求

为了正确打包 Electron 应用，需要准备以下图标文件：

### Windows
- `build/icon.ico` - 256x256 或更大的 ICO 格式图标

### macOS
- `build/icon.icns` - 包含多种尺寸的 ICNS 格式图标

### Linux
- `build/icons/` - PNG 格式图标目录，包含以下尺寸：
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

## 生成图标的方法

### 方法 1: 使用内置脚本 (推荐)

项目自带从 `build/icon.svg` 单一源重新生成全部图标的脚本（sharp 渲染 + png-to-ico）：

```bash
npm run icons:generate    # 生成 icon.ico 与 build/icons/ 全尺寸 PNG
```

### 方法 2: 使用 electron-icon-builder

`electron-icon-builder` 已在 devDependencies 中，也可直接使用：

```bash
npx electron-icon-builder --input=build/icon.svg --output=build
```

### 方法 3: 在线工具

1. 访问 https://www.electronjs.org/docs/latest/tutorial/application-distribution#icon
2. 使用在线转换工具将 SVG 转换为 ICO 和 ICNS 格式

### 方法 4: 手动创建

#### Windows ICO
使用 ImageMagick 或 GIMP 创建：
```bash
# 使用 ImageMagick
convert build/icon.svg -resize 256x256 build/icon.ico
```

#### macOS ICNS
使用 macOS 自带的 `iconutil` 工具：
```bash
# 创建 iconset 目录
mkdir build/icon.iconset

# 生成各种尺寸的 PNG
sips -z 16 16     build/icon.svg --out build/icon.iconset/icon_16x16.png
sips -z 32 32     build/icon.svg --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32     build/icon.svg --out build/icon.iconset/icon_32x32.png
sips -z 64 64     build/icon.svg --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128   build/icon.svg --out build/icon.iconset/icon_128x128.png
sips -z 256 256   build/icon.svg --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256   build/icon.svg --out build/icon.iconset/icon_256x256.png
sips -z 512 512   build/icon.svg --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512   build/icon.svg --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 build/icon.svg --out build/icon.iconset/icon_512x512@2x.png

# 生成 ICNS
iconutil -c icns build/icon.iconset -o build/icon.icns
```

#### Linux PNG
```bash
# 生成各种尺寸的 PNG
for size in 16 32 48 64 128 256 512; do
  convert build/icon.svg -resize ${size}x${size} build/icons/${size}x${size}.png
done
```

## 当前状态

项目已配置好图标路径（2026-09 核对）：

```
build/
├── icon.svg           # 源 SVG 图标 (已创建，单一源)
├── icon.ico           # Windows 图标 (已生成)
├── icons/             # Linux/PWA PNG 图标目录 (已生成，含 16-512 各尺寸)
├── entitlements.mac.plist
├── entitlements.mac.inherit.plist
└── installer.nsh
```

> 唯一缺失：`build/icon.icns`（macOS 图标）。仅在需要打 macOS 包时生成（方法 3/4）。

## 快速开始

```bash
npm run icons:generate    # 从 build/icon.svg 重新生成 icon.ico + build/icons/
```