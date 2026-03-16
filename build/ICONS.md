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

### 方法 1: 使用 electron-icon-builder (推荐)

```bash
# 安装工具
npm install -D electron-icon-builder

# 从 SVG 生成所有平台的图标
npx electron-icon-builder --input=build/icon.svg --output=build
```

### 方法 2: 在线工具

1. 访问 https://www.electronjs.org/docs/latest/tutorial/application-distribution#icon
2. 使用在线转换工具将 SVG 转换为 ICO 和 ICNS 格式

### 方法 3: 手动创建

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

项目已配置好图标路径，只需将生成的图标文件放入 `build` 目录即可：

```
build/
├── icon.svg           # 源 SVG 图标 (已创建)
├── icon.ico           # Windows 图标 (需要生成)
├── icon.icns          # macOS 图标 (需要生成)
├── icons/             # Linux 图标目录
│   ├── 16x16.png
│   ├── 32x32.png
│   ├── 48x48.png
│   ├── 64x64.png
│   ├── 128x128.png
│   ├── 256x256.png
│   └── 512x512.png
├── entitlements.mac.plist
├── entitlements.mac.inherit.plist
└── installer.nsh
```

## 快速开始

运行以下命令自动生成所有图标：

```bash
# 安装 electron-icon-builder
npm install -D electron-icon-builder

# 生成图标
npx electron-icon-builder --input=build/icon.svg --output=build
```
