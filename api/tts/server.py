import os
import logging
from io import BytesIO
from typing import Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import soundfile as sf
import numpy as np

from tts_model import get_tts_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Qwen3-TTS Service",
    description="Text-to-Speech service using Qwen3-TTS-0.6B model",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=5000)
    voice: str = Field(default="default", description="Voice to use for synthesis")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed multiplier")
    output_format: str = Field(default="mp3", description="Output audio format (mp3, wav)")


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str


class VoicesResponse(BaseModel):
    voices: list[str]


@app.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        tts_model = get_tts_model()
        model_name = os.getenv('TTS_MODEL', 'Qwen/Qwen3-TTS-0.6B')
        return HealthResponse(
            status="healthy",
            model_loaded=tts_model.is_model_loaded(),
            model_name=model_name
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


@app.get("/voices", response_model=VoicesResponse)
async def get_voices():
    try:
        tts_model = get_tts_model()
        voices = tts_model.get_available_voices()
        return VoicesResponse(voices=voices)
    except Exception as e:
        logger.error(f"Failed to get voices: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve voices")


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    try:
        tts_model = get_tts_model()
        
        audio, sample_rate = tts_model.synthesize(
            text=request.text,
            voice=request.voice,
            speed=request.speed
        )
        
        audio_buffer = BytesIO()
        
        if request.output_format.lower() == "wav":
            sf.write(audio_buffer, audio, sample_rate, format="WAV")
            media_type = "audio/wav"
            filename = "speech.wav"
        else:
            sf.write(audio_buffer, audio, sample_rate, format="MP3")
            media_type = "audio/mpeg"
            filename = "speech.mp3"
        
        audio_buffer.seek(0)
        
        return Response(
            content=audio_buffer.getvalue(),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(audio_buffer.getvalue()))
            }
        )
        
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@app.get("/")
async def root():
    return {
        "service": "Qwen3-TTS Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "voices": "/voices",
            "tts": "/tts"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)