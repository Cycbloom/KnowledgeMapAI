# 华为设备调试指南

## 前置条件

1. **安装 Android Studio**
   - 下载地址：https://developer.android.com/studio
   - 安装时会自动安装 Android SDK 和 ADB

2. **配置环境变量**
   - 将 Android SDK 的 `platform-tools` 目录添加到 PATH
   - 默认路径：`C:\Users\<用户名>\AppData\Local\Android\Sdk\platform-tools`

## 华为手机设置

### 1. 开启开发者选项

1. 打开手机的 **设置**
2. 进入 **关于手机**
3. 连续点击 **版本号** 7 次
4. 提示"您已处于开发者模式"

### 2. 开启 USB 调试

1. 返回 **设置**
2. 进入 **系统和更新** → **开发者选项**
3. 开启 **USB 调试**
4. 开启 **"仅充电"模式下允许 ADB 调试**（可选）

### 3. 连接电脑

1. 使用 USB 数据线连接手机和电脑
2. 手机上会弹出"允许 USB 调试吗？"
3. 勾选"始终允许使用这台计算机进行调试"
4. 点击"允许"

### 4. 验证连接

打开命令行，运行：
```bash
adb devices
```

应该看到类似输出：
```
List of devices attached
XXXXXXXX    device
```

## 使用 Anlink 进行无线调试

### 1. 安装 Anlink

- 下载地址：https://cn.anlinksoft.com/
- 安装并运行 Anlink

### 2. 连接华为手机

1. 确保手机和电脑在同一 WiFi 网络
2. 在 Anlink 中选择"无线连接"
3. 扫描手机上的二维码或输入配对码
4. 连接成功后，可以在电脑上操作手机

### 3. 启用无线 ADB

1. 在 Anlink 设置中找到"ADB 调试"
2. 启用后，Anlink 会自动配置 ADB 连接
3. 可以通过 `adb connect <IP地址>:5555` 进行连接

## 运行 APP

### 方式一：通过 Android Studio

1. 打开 Android Studio
2. 选择 **Open an Existing Project**
3. 打开项目中的 `android` 目录
4. 等待 Gradle 同步完成
5. 点击 **Run** 按钮（绿色三角形）
6. 选择连接的华为设备

### 方式二：通过命令行

```bash
# 构建并同步
npm run mobile:sync

# 在设备上运行
npx cap run android
```

### 方式三：通过 ADB 安装 APK

```bash
# 构建 APK
cd android
./gradlew assembleDebug

# 安装到设备
adb install app/build/outputs/apk/debug/app-debug.apk
```

## 常见问题

### 1. ADB 无法识别设备

- 确保已安装华为 USB 驱动
- 尝试更换 USB 端口或数据线
- 重启 ADB 服务：`adb kill-server && adb start-server`

### 2. 华为手机无法安装应用

- 进入 **设置** → **系统和更新** → **开发者选项**
- 关闭 **监控 ADB 安装应用**
- 或者在安装时手动确认

### 3. Anlink 连接失败

- 确保手机和电脑在同一 WiFi 网络
- 关闭手机防火墙或 VPN
- 重启 Anlink 和手机的无线调试功能

### 4. APP 闪退

- 检查 Android Studio 的 Logcat 日志
- 确保后端服务正在运行
- 检查网络连接是否正常

## 开发调试技巧

### 查看日志

```bash
# 查看所有日志
adb logcat

# 只看应用日志
adb logcat | grep KnowledgeMap

# 清除日志
adb logcat -c
```

### 远程调试

1. 在 Chrome 浏览器中打开 `chrome://inspect`
2. 确保手机已连接并运行 APP
3. 点击对应的 WebView 进行调试

### 性能分析

- 使用 Android Studio 的 Profiler 工具
- 分析 CPU、内存、网络使用情况
- 检查帧率和渲染性能
