# TTS 服务快速启动指南

## 快速开始

### 1. 启动服务

在 PowerShell 中运行：

```powershell
.\start-tts.ps1
```

脚本会提示你选择模式：
- **选项 1**：GPU 模式（推荐，需要 NVIDIA Container Toolkit）
- **选项 2**：CPU 模式（较慢，但无需额外配置）

### 2. 停止服务

```powershell
.\stop-tts.ps1
```

### 3. 重启服务

```powershell
.\restart-tts.ps1
```

## 前置要求

### GPU 模式（推荐）

1. **NVIDIA GPU**：支持 CUDA 11.8+ 的显卡
2. **NVIDIA 驱动**：在 Windows 上安装最新的 NVIDIA 驱动
3. **NVIDIA Container Toolkit**：在 WSL2 中安装

安装 NVIDIA Container Toolkit：

```bash
# 在 WSL2 Ubuntu 中执行
cd /mnt/d/KnowledgeMap
chmod +x install-nvidia-container-toolkit.sh
./install-nvidia-container-toolkit.sh
```

验证安装：

```bash
# 在 WSL2 中检查 GPU
nvidia-smi

# 测试 Docker GPU 访问
docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi
```

### CPU 模式

- 无需额外配置，可以直接使用

## 常用命令

### 查看日志

```powershell
docker-compose logs -f tts-service
```

### 检查健康状态

```powershell
curl http://localhost:8001/health
```

### 获取可用语音列表

```powershell
curl http://localhost:8001/voices
```

### 测试语音合成

```powershell
curl -X POST http://localhost:8001/tts `
  -H "Content-Type: application/json" `
  -d '{"text":"你好，世界！","voice":"Vivian","speed":1.0,"output_format":"mp3"}' `
  --output test.mp3
```

### 重新构建镜像

```powershell
docker-compose build --no-cache tts-service
docker-compose up -d tts-service
```

## 故障排除

### GPU 未被识别

如果启动后提示 GPU 未被检测到：

1. 检查 NVIDIA 驱动：
   ```bash
   nvidia-smi
   ```

2. 检查 NVIDIA Container Toolkit：
   ```bash
   nvidia-ctk --version
   ```

3. 重新配置 Docker runtime：
   ```bash
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

4. 查看详细日志：
   ```powershell
   docker-compose logs tts-service
   ```

### 服务启动失败

1. 检查端口占用：
   ```powershell
   netstat -ano | findstr :8001
   ```

2. 查看错误日志：
   ```powershell
   docker-compose logs tts-service
   ```

3. 清理并重新构建：
   ```powershell
   docker-compose down tts-service
   docker-compose build --no-cache tts-service
   docker-compose up -d tts-service
   ```

### 模型下载失败

1. 检查网络连接
2. 查看日志了解具体错误
3. 可能需要配置 Hugging Face 访问令牌

## 性能对比

| 模式 | 首次请求 | 后续请求 | 推荐场景 |
|------|----------|----------|----------|
| CPU | 10-30秒 | 3-5秒 | 测试环境，无 GPU |
| GPU (RTX 3060) | 5-8秒 | 0.5-1.5秒 | 开发环境 |
| GPU (RTX 4090) | 3-5秒 | <1秒 | 生产环境 |

## 目录结构

```
KnowledgeMap/
├── api/tts/
│   ├── Dockerfile              # Docker 镜像配置
│   ├── requirements.txt        # Python 依赖
│   ├── server.py               # FastAPI 服务
│   └── tts_model.py            # TTS 模型封装
├── docker-compose.yml          # Docker Compose 配置
├── start-tts.ps1              # 启动脚本
├── stop-tts.ps1               # 停止脚本
├── restart-tts.ps1           # 重启脚本
├── install-nvidia-container-toolkit.sh  # NVIDIA Container Toolkit 安装脚本
└── TTS_DEPLOYMENT.md          # 详细部署文档
```

## 更多信息

详细部署文档请参考：[TTS_DEPLOYMENT.md](./TTS_DEPLOYMENT.md)
