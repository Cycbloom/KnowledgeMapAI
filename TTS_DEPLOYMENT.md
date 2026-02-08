# Qwen3-TTS 本地部署指南

本指南介绍如何使用 Docker 部署 Qwen3-TTS-0.6B 模型，并将其集成到 KnowledgeMap 项目中。

## 前置要求

- Docker 和 Docker Compose 已安装
- 至少 4GB 可用内存
- 至少 2GB 可用磁盘空间（用于模型文件）

### 硬件要求

#### CPU 模式（可选）
- CPU：任何现代 CPU
- 内存：4GB
- 速度：较慢（首次请求 10-30 秒）

#### GPU 模式（推荐，默认）
- **显卡**：NVIDIA RTX 系列（如 RTX 3060、RTX 4090 等）
- **显存**：至少 4GB（推荐 6GB+）
- **内存**：8GB
- **速度**：快（首次请求 5-10 秒，后续 1-3 秒）

### 支持的显卡

Qwen3-TTS-0.6B 模型相对轻量，支持：
- ✅ NVIDIA RTX 2060 及以上
- ✅ NVIDIA GTX 1660 及以上
- ✅ NVIDIA RTX 30/40 系列
- ✅ NVIDIA RTX 20 系列
- ✅ NVIDIA A100 / V100 / T4（服务器显卡）

### 性能对比

| 配置 | 首次请求 | 后续请求 | 备注 |
|------|----------|----------|------|
| CPU | 10-30秒 | 3-5秒 | 可以运行，但较慢 |
| RTX 3060 | 5-8秒 | 0.5-1.5秒 | 推荐 |
| RTX 4090 | 3-5秒 | <1秒 | 最佳性能 |

## 快速开始

### GPU 模式（推荐）

**前置要求**：
1. 已安装 NVIDIA 驱动
2. 已安装 NVIDIA Container Toolkit（nvidia-docker2）

安装 NVIDIA Container Toolkit：
```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# 验证安装
docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi
```

启动 TTS 服务（GPU 模式）：
```bash
# 启动 TTS 服务（GPU 模式）
docker-compose up -d tts-service

# 查看日志
docker-compose logs -f tts-service
```

### CPU 模式

如果需要使用 CPU 模式，需要修改配置：

1. 修改 `docker-compose.yml`，注释掉 GPU 相关配置：
```yaml
tts-service:
  # ... 其他配置 ...
  # runtime: nvidia  # 注释掉这一行
  deploy:
    resources:
      limits:
        memory: 4G  # CPU 模式可以使用更少的内存
      reservations:
        memory: 2G
        # devices:  # 注释掉 GPU 设备配置
        #   - driver: nvidia
        #     count: all
        #     capabilities: [gpu]
```

2. 修改 `api/tts/Dockerfile`，使用 CPU 版本的镜像：
```dockerfile
FROM python:3.12-slim  # 使用 CPU 版本的镜像
```

3. 修改 `api/tts/requirements.txt`，使用 CPU 版本的 PyTorch：
```txt
torch>=2.0.0  # CPU 版本
torchaudio>=2.0.0
```

4. 重新构建并启动：
```bash
docker-compose up -d --build tts-service
```

### 验证服务状态

```bash
# 检查健康状态
curl http://localhost:8001/health
```

预期返回：
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
}
```

```bash
# 获取可用语音列表
curl http://localhost:8001/voices
```

预期返回：
```json
{
  "voices": ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]
}
```

### 测试语音合成

```bash
curl -X POST http://localhost:8001/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，世界！",
    "voice": "Vivian",
    "speed": 1.0,
    "output_format": "mp3"
  }' \
  --output speech.mp3
```

### 在应用中使用

1. 启动你的 KnowledgeMap 应用
2. 打开聊天对话框
3. 点击语音设置按钮（齿轮图标）
4. 切换到 **Qwen3-TTS** 引擎
5. 点击消息旁边的播放按钮即可朗读

## API 端点

### 健康检查

```
GET /health
```

返回示例：
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
}
```

### 获取语音列表

```
GET /voices
```

返回示例：
```json
{
  "voices": ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]
}
```

### 文本转语音

```
POST /tts
Content-Type: application/json

{
  "text": "要转换的文本",
  "voice": "Vivian",
  "speed": 1.0,
  "output_format": "mp3"
}
```

参数说明：
- `text`: 要转换的文本（必填，1-5000 字符）
- `voice`: 语音名称（可选，默认: Vivian）
- `speed`: 语速（可选，0.5-2.0，默认: 1.0）
- `output_format`: 输出格式（可选，mp3 或 wav，默认: mp3）

返回：音频文件（MP3 或 WAV 格式）

## 集成到应用

### 后端集成

后端已集成 TTS API，提供以下端点：

- `GET /api/ai/tts/health`: 检查 TTS 服务健康状态
- `GET /api/ai/tts/voices`: 获取可用语音列表
- `POST /api/ai/tts`: 文本转语音

### 前端集成

前端已支持两种 TTS 引擎：

1. **浏览器 TTS**: 使用浏览器原生的 Web Speech API
2. **Qwen3-TTS**: 使用本地部署的 Qwen3-TTS 模型

在聊天对话框中，点击语音设置按钮（齿轮图标）可以切换 TTS 引擎。

## 故障排除

### GPU 未被识别

如果 GPU 未被识别，请检查：

1. 验证 NVIDIA 驱动是否正确安装：
```bash
nvidia-smi
```

2. 验证 NVIDIA Container Toolkit 是否正确安装：
```bash
docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi
```

3. 检查 Docker 日志：
```bash
docker-compose logs tts-service
```

4. 查看容器内是否能检测到 GPU：
```bash
docker exec -it knowledgemap-tts python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"
```

### 模型下载失败

如果模型下载失败，请检查：
1. 网络连接是否正常
2. Docker 容器是否有足够的磁盘空间
3. 是否需要配置 Hugging Face 访问令牌

### 内存不足

如果遇到内存不足错误：
1. 减少 Docker 容器的内存限制
2. 关闭其他占用内存的应用
3. 考虑使用更小的模型变体

### 服务启动失败

如果服务启动失败，请查看日志：
```bash
docker-compose logs tts-service
```

常见问题：
- 端口冲突：检查 8001 端口是否被占用
- 权限问题：确保 Docker 有足够的权限
- 依赖安装失败：检查网络连接和镜像源

## 性能优化

### GPU 模式优化

1. **使用 float16 精度**：代码已自动配置，在 GPU 上使用 float16 可以提升性能并减少显存占用

2. **批量处理**：如需处理大量文本，建议分批处理，避免单个请求过长

3. **模型缓存**：模型会缓存在 Docker volume 中，首次加载后后续请求会更快

### CPU 模式优化

1. **减少并发**：CPU 模式下，建议减少并发请求数量

2. **使用更快的 CPU**：CPU 性能直接影响合成速度

3. **考虑使用 GPU**：如果性能不足，强烈建议升级到 GPU 模式

## 维护

### 更新模型

如需更新模型，修改 `docker-compose.yml` 中的 `TTS_MODEL` 环境变量，然后重启服务：

```bash
docker-compose up -d --force-recreate tts-service
```

### 清理缓存

清理模型缓存以释放磁盘空间：

```bash
# 停止服务
docker-compose down tts-service

# 删除模型卷
docker volume rm knowledgemap_tts-models

# 重新启动服务
docker-compose up -d tts-service
```

### 重新构建镜像

如果需要重新构建镜像：

```bash
docker-compose build --no-cache tts-service
docker-compose up -d tts-service
```

## 许可证

Qwen3-TTS 模型使用 Apache 2.0 许可证，可免费商用。

## 参考资源

- [Qwen3-TTS GitHub 仓库](https://github.com/QwenLM/Qwen3-TTS)
- [Qwen3-TTS 官方文档](https://github.com/QwenLM/Qwen3-TTS/blob/main/README.md)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [NVIDIA Container Toolkit 文档](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/index.html)














# 安装依赖
sudo apt-get update
sudo apt-get install -y curl

# 添加密钥和仓库
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
