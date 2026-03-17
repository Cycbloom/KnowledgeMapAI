# 移动端黑屏问题解决指南

## 问题原因

黑屏主要由以下原因造成：

1. **SplashScreen 配置问题** - 启动画面没有正确隐藏
2. **API 地址配置问题** - 手机无法连接到本地电脑的后端服务

## 已修复的内容

### 1. SplashScreen 配置
- 将 `launchShowDuration` 从 2000ms 改为 0
- 启用 `autoHide: true` 自动隐藏启动画面

### 2. API 地址配置
- 创建了 `src/config/mobileApiConfig.ts` 文件
- 修改了 API 客户端以支持移动端配置

## 你需要做的配置

### 第一步：获取电脑的局域网 IP 地址

**Windows 系统：**
1. 打开命令提示符（CMD）或 PowerShell
2. 输入命令：
   ```bash
   ipconfig
   ```
3. 找到你的 WiFi 或以太网适配器的 IPv4 地址
   - 通常格式是：`192.168.x.x` 或 `10.x.x.x`

**示例：**
```
无线局域网适配器 WLAN:
   IPv4 地址 . . . . . . . . . . . . : 192.168.1.100
```

### 第二步：配置 API 地址

1. 打开文件：`src/config/mobileApiConfig.ts`
2. 修改 `MOBILE_API_BASE_URL` 为你的电脑 IP 地址：

```typescript
export const MOBILE_API_BASE_URL = 'http://192.168.1.100:3001';
// 把 192.168.1.100 改成你电脑的实际 IP
```

### 第三步：确保手机和电脑在同一网络

- 手机和电脑必须连接到**同一个 WiFi**
- 或者电脑通过网线连接，手机通过同一网络的 WiFi

### 第四步：启动后端服务

确保后端服务正在运行：

```bash
npm run server:dev
```

### 第五步：重新构建并同步

```bash
npm run mobile:sync
```

然后在 Android Studio 中重新安装 APP 到手机。

## 调试技巧

### 查看手机上的日志

在 Android Studio 中打开 Logcat，过滤标签：
- `KnowledgeMap` - 应用日志
- `System.err` - 错误日志
- `Console` - 浏览器控制台日志

### 使用 Chrome 远程调试

1. 在手机上打开 APP
2. 在电脑 Chrome 浏览器中访问：`chrome://inspect`
3. 找到你的设备，点击 "inspect"
4. 就可以像在电脑上一样调试了

## 常见问题

### Q: 还是黑屏怎么办？

A: 检查以下几点：
1. 确认后端服务正在运行（http://localhost:3001 可以访问）
2. 确认手机和电脑在同一 WiFi
3. 确认 IP 地址配置正确
4. 查看 Chrome 远程调试的控制台错误

### Q: API 连接失败？

A: 可能是防火墙问题：
1. 临时关闭 Windows 防火墙测试
2. 或者在防火墙中允许端口 3001

### Q: 如何确认网络连接正常？

A: 在手机浏览器中访问：
```
http://你的电脑IP:3001/api/health
```
如果返回 JSON 数据，说明网络连接正常。
