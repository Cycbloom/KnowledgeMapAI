import os
import logging
from typing import Optional
import torch
import numpy as np

logger = logging.getLogger(__name__)

class TTSModel:
    _instance: Optional['TTSModel'] = None
    _model = None
    _device = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._model is None:
            self._initialize_model()

    def _initialize_model(self):
        try:
            model_name = os.getenv('TTS_MODEL', 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice')
            
            # Try to use CUDA, fallback to CPU if not available
            if torch.cuda.is_available():
                self._device = 'cuda'
                logger.info(f"Initializing TTS model: {model_name} on device: cuda (GPU)")
            else:
                self._device = 'cpu'
                logger.info(f"Initializing TTS model: {model_name} on device: cpu")
            
            # Import qwen-tts with correct API
            try:
                from qwen_tts import Qwen3TTSModel
                self._model = Qwen3TTSModel.from_pretrained(
                    model_name,
                    device_map=self._device,
                    dtype=torch.float16 if self._device == 'cuda' else torch.float32,
                )
                logger.info("TTS model initialized successfully")
            except ImportError as e:
                logger.error(f"Failed to import Qwen3TTSModel from qwen_tts: {e}")
                raise ImportError(f"Cannot import qwen_tts package. Please install it with: pip install qwen-tts")
                    
        except Exception as e:
            logger.error(f"Failed to initialize TTS model: {e}")
            raise

    def synthesize(
        self,
        text: str,
        voice: str = "Vivian",
        speed: float = 1.0,
        output_format: str = "mp3"
    ) -> tuple[np.ndarray, int]:
        if self._model is None:
            raise RuntimeError("TTS model not initialized")
        
        try:
            logger.info(f"Synthesizing text: {text[:50]}... with voice: {voice}, speed: {speed}")
            
            # Generate audio using Qwen3TTSModel API
            wavs, sr = self._model.generate_custom_voice(
                text=text,
                language="Chinese",  # Default to Chinese, can be auto-detected
                speaker=voice,
                instruct=""  # Empty instruct for normal speech
            )
            
            # Convert to numpy array if needed
            if hasattr(wavs, 'numpy'):
                audio_array = wavs[0].numpy()
            elif hasattr(wavs, 'cpu'):
                audio_array = wavs[0].cpu().numpy()
            else:
                audio_array = np.array(wavs[0])
            
            logger.info(f"Audio synthesized successfully, shape: {audio_array.shape}")
            return audio_array, sr
            
        except Exception as e:
            logger.error(f"Failed to synthesize audio: {e}")
            raise

    def get_available_voices(self) -> list[str]:
        if self._model is None:
            return []
        
        try:
            # Try to get available speakers
            if hasattr(self._model, 'get_supported_speakers'):
                voices = self._model.get_supported_speakers()
                return voices
            else:
                # Return default voices for CustomVoice model
                return ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]
        except Exception as e:
            logger.error(f"Failed to get available voices: {e}")
            return ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]

    def is_model_loaded(self) -> bool:
        return self._model is not None

def get_tts_model() -> TTSModel:
    return TTSModel()