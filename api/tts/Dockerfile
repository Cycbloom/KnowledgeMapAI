FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TTS_MODEL=Qwen/Qwen3-TTS-0.6B \
    TTS_VOICE=default \
    TTS_SPEED=1.0 \
    TTS_OUTPUT_FORMAT=mp3

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]