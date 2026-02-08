# Qwen3-TTS 本地部署指南

本指南介绍如何使用 Docker 部署 Qwen3-TTS-0.6B 模型，并将其集成到 KnowledgeMap 项目中。

## 前置要求

- Docker 和 Docker Compose 已安装
- 至少 4GB 可用内存
- 至少 2GB 可用磁盘空间（用于模型文件）

### 硬件要求

#### CPU 模式（默认）
- CPU：任何现代 CPU
- 内存：4GB
- 速度：较慢（首次请求 10-30 秒）

#### GPU 模式（推荐）
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

### CPU 模式（默认）

```bash
# 启动 TTS 服务
docker-compose up -d tts-service

# 查看日志
docker-compose logs -f tts-service
```

### GPU 模式（推荐，需要 NVIDIA 显卡）

如果你有 NVIDIA 显卡（如 RTX 3060），可以使用 GPU 加速：

```bash
# 使用 GPU 配置启动
docker-compose -f docker-compose.gpu.yml up -d tts-service

# 查看日志
docker-compose -f docker-compose.gpu.yml logs -f tts-service
```

**注意**：使用 GPU 模式需要：
1. 安装 NVIDIA 驱动和 CUDA
2. 安装 NVIDIA Container Toolkit
3. 确保 Docker 可以访问 GPU

### 2. 验证服务状态

```bash
# 检查健康状态
curl http://localhost:8001/health

# 获取可用语音列表
curl http://localhost:8001/voices
```

### 3. 测试语音合成

```bash
curl -X POST http://localhost:8001/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，世界！",
    "voice": "default",
    "speed": 1.0,
    "output_format": "mp3"
  }' \
  --output speech.mp3
```

## 配置说明

### 环境变量

在 `docker-compose.yml` 中可以配置以下环境变量：

- `TTS_MODEL`: 模型名称（默认: Qwen/Qwen3-TTS-0.6B）
- `TTS_VOICE`: 默认语音（默认: default）
- `TTS_SPEED`: 默认语速（默认: 1.0）
- `TTS_OUTPUT_FORMAT`: 输出格式（默认: mp3）

### 端口配置

- TTS 服务默认运行在 `8001` 端口
- 如需修改端口，请在 `docker-compose.yml` 中调整端口映射

### 资源限制

默认配置：
- 内存限制: 4GB
- 内存预留: 2GB

如需调整，请修改 `docker-compose.yml` 中的 `deploy.resources` 配置。

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
  "model_name": "Qwen/Qwen3-TTS-0.6B"
}
```

### 获取语音列表

```
GET /voices
```

返回示例：
```json
{
  "voices": ["default", "voice1", "voice2"]
}
```

### 文本转语音

```
POST /tts
Content-Type: application/json

{
  "text": "要转换的文本",
  "voice": "default",
  "speed": 1.0,
  "output_format": "mp3"
}
```

参数说明：
- `text`: 要转换的文本（必填，1-5000 字符）
- `voice`: 语音名称（可选，默认: default）
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

### 首次请求优化

首次请求会加载模型到内存，可能需要较长时间（10-30秒）。后续请求会更快（通常在 1-3 秒内）。

### 批量处理

如需处理大量文本，建议：
1. 分批处理，避免单个请求过长
2. 使用流式输出（未来版本支持）
3. 考虑使用更快的硬件（GPU）

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

## 许可证

Qwen3-TTS 模型使用 Apache 2.0 许可证，可免费商用。

## 参考资源

- [Qwen3-TTS GitHub 仓库](https://github.com/QwenLM/Qwen3-TTS)
- [Qwen3-TTS 官方文档](https://github.com/QwenLM/Qwen3-TTS/blob/main/README.md)
- [FastAPI 文档](https://fastapi.tiangolo.com/)