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
            
            # Set CUDA_LAUNCH_BLOCKING for better error messages
            os.environ['CUDA_LAUNCH_BLOCKING'] = '1'
            
            # Try to use CUDA, fallback to CPU if not available
            if torch.cuda.is_available():
                self._device = 'cuda'
                logger.info(f"Initializing TTS model: {model_name} on device: cuda (GPU)")
                logger.info(f"CUDA version: {torch.version.cuda}")
                logger.info(f"PyTorch version: {torch.__version__}")
                
                # Get GPU info
                if torch.cuda.is_available():
                    gpu_count = torch.cuda.device_count()
                    logger.info(f"Available GPUs: {gpu_count}")
                    for i in range(gpu_count):
                        logger.info(f"GPU {i}: {torch.cuda.get_device_name(i)}")
            else:
                self._device = 'cpu'
                logger.info(f"Initializing TTS model: {model_name} on device: cpu")
            
            # Import qwen-tts with correct API
            try:
                from qwen_tts import Qwen3TTSModel
                
                # Use float32 instead of float16 to avoid CUDA errors
                dtype = torch.float32
                
                logger.info(f"Loading model with dtype: {dtype}")
                
                self._model = Qwen3TTSModel.from_pretrained(
                    model_name,
                    device_map=self._device,
                    dtype=dtype,
                )
                logger.info("TTS model initialized successfully")
            except ImportError as e:
                logger.error(f"Failed to import Qwen3TTSModel from qwen_tts: {e}")
                raise ImportError(f"Cannot import qwen_tts package. Please install it with: pip install qwen-tts")
                    
        except Exception as e:
            logger.error(f"Failed to initialize TTS model: {e}")
            logger.error(f"Error type: {type(e).__name__}")
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
                language="Chinese",
                speaker=voice,
                instruct=""
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
            logger.error(f"Error type: {type(e).__name__}")
            raise

    def get_available_voices(self) -> list[str]:
        if self._model is None:
            return []
        
        try:
            if hasattr(self._model, 'get_supported_speakers'):
                voices = self._model.get_supported_speakers()
                return voices
            else:
                return ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]
        except Exception as e:
            logger.error(f"Failed to get available voices: {e}")
            return ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]

    def is_model_loaded(self) -> bool:
        return self._model is not None

def get_tts_model() -> TTSModel:
    return TTSModel()
