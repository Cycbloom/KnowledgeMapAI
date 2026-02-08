# Qwen3-TTS FastAPI Service

This is a Docker-based Text-to-Speech service using Qwen3-TTS-0.6B model.

## Quick Start

### Using Docker Compose

```bash
# Build and start the service
docker-compose up -d tts-service

# View logs
docker-compose logs -f tts-service

# Stop the service
docker-compose down tts-service
```

### Manual Docker Build

```bash
# Build the image
docker build -t qwen3-tts-service .

# Run the container
docker run -d -p 8001:8000 --name qwen3-tts qwen3-tts-service
```

## API Endpoints

### Health Check
```
GET /health
```

### Text-to-Speech
```
POST /tts
Content-Type: application/json

{
  "text": "你好，世界！",
  "voice": "default",
  "speed": 1.0,
  "output_format": "mp3"
}
```

Returns audio file in the specified format.

## Configuration

Environment variables:
- `TTS_MODEL`: Model name (default: Qwen/Qwen3-TTS-0.6B)
- `TTS_VOICE`: Default voice (default: default)
- `TTS_SPEED`: Default speed (default: 1.0)
- `TTS_OUTPUT_FORMAT`: Default output format (default: mp3)

## Available Voices

The Qwen3-TTS model supports multiple voices. Check the official documentation for the complete list of available voices.

## Performance

- First request may take longer due to model loading
- Subsequent requests are faster (model stays in memory)
- Supports streaming for real-time applications

## Troubleshooting

### Model Download Issues

If the model fails to download, check:
1. Network connectivity
2. Hugging Face token (if required)
3. Available disk space (model is ~1GB)

### Out of Memory

If you encounter OOM errors:
1. Reduce batch size
2. Use a smaller model variant
3. Increase container memory limit

## License

This service uses Qwen3-TTS which is licensed under Apache 2.0.