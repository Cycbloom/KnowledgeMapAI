// @vitest-environment jsdom
// 简化测试说明：useTextToSpeech 对 browser 引擎委托 useBrowserTTS 内部状态管理，
// isSpeaking/isPaused/error 在 browser 引擎下由 useBrowserTTS 维护，不直接暴露到外层。
// 因此外层 error/isSpeaking 断言仅适用于 sambert 引擎；browser 引擎只验证 speechSynthesis API 调用。
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTextToSpeech } from "../useTextToSpeech";

const mocks = vi.hoisted(() => ({
  synthesize: vi.fn(),
  voices: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    tts: {
      synthesize: mocks.synthesize,
      voices: mocks.voices,
    },
  },
}));

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function setupSpeechSynthesisMock() {
  const mockSynth = {
    getVoices: vi.fn(() => []),
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onvoiceschanged: null as unknown,
  };
  Object.defineProperty(window, "speechSynthesis", {
    value: mockSynth,
    writable: true,
    configurable: true,
  });

  const mockUtteranceCtor = vi.fn(function (text: string) {
    return {
      text,
      rate: 1,
      pitch: 1,
      volume: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
      onpause: null,
      onresume: null,
    };
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    value: mockUtteranceCtor,
    writable: true,
    configurable: true,
  });

  return { mockSynth, mockUtteranceCtor };
}

function setupAudioMock() {
  const mockAudioInstance = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
    ontimeupdate: null as (() => void) | null,
    duration: 10,
    currentTime: 0,
  };
  // 使用普通函数而非箭头函数，确保 new Audio() 能正常工作
  const mockAudioCtor = vi.fn(function () {
    return mockAudioInstance;
  });
  Object.defineProperty(global, "Audio", {
    value: mockAudioCtor,
    writable: true,
    configurable: true,
  });
  return { mockAudioCtor, mockAudioInstance };
}

describe("useTextToSpeech", () => {
  let mockSynth: ReturnType<typeof setupSpeechSynthesisMock>["mockSynth"];
  let mockUtteranceCtor: ReturnType<typeof setupSpeechSynthesisMock>["mockUtteranceCtor"];

  beforeEach(() => {
    const synthSetup = setupSpeechSynthesisMock();
    mockSynth = synthSetup.mockSynth;
    mockUtteranceCtor = synthSetup.mockUtteranceCtor;
    URL.createObjectURL = vi.fn(() => "blob:test-url");
    URL.revokeObjectURL = vi.fn();
    mocks.synthesize.mockResolvedValue(new Blob(["audio"], { type: "audio/mp3" }));
    mocks.voices.mockResolvedValue([]);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("应该返回正确的初始状态（browser 引擎默认）", () => {
    const { result } = renderHook(() => useTextToSpeech());
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentEngine).toBe("browser");
    expect(result.current.hasSupport).toBe(true);
    expect(typeof result.current.speak).toBe("function");
    expect(typeof result.current.pause).toBe("function");
    expect(typeof result.current.resume).toBe("function");
    expect(typeof result.current.cancel).toBe("function");
    expect(typeof result.current.switchEngine).toBe("function");
  });

  it("应该支持以 sambert 引擎初始化", () => {
    const { result } = renderHook(() => useTextToSpeech("sambert"));
    expect(result.current.currentEngine).toBe("sambert");
  });

  it("speak 在 browser 引擎下应该创建 utterance 并调用 speechSynthesis.speak", async () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));

    await act(async () => {
      await result.current.speak("你好世界");
    });

    expect(mockUtteranceCtor).toHaveBeenCalledWith("你好世界");
    expect(mockSynth.speak).toHaveBeenCalled();
    expect(mockSynth.cancel).toHaveBeenCalled();
  });

  it("speak 在空文本时不应调用 speechSynthesis.speak", () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));

    act(() => {
      result.current.speak("");
    });

    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it("speak 在纯空白文本时不应调用 speechSynthesis.speak", () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));

    act(() => {
      result.current.speak("   ");
    });

    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it("cancel 应该调用 speechSynthesis.cancel", () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));

    act(() => {
      result.current.cancel();
    });

    expect(mockSynth.cancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it("switchEngine 应该切换到 sambert 引擎", () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));
    expect(result.current.currentEngine).toBe("browser");

    act(() => {
      result.current.switchEngine("sambert");
    });

    expect(result.current.currentEngine).toBe("sambert");
  });

  it("switchEngine 切换到相同引擎时不应改变状态", () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));

    act(() => {
      result.current.switchEngine("browser");
    });

    expect(result.current.currentEngine).toBe("browser");
  });

  it("sambert 引擎 speak 空文本应设置错误且不调用 synthesize", async () => {
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      await result.current.speak("");
    });

    expect(result.current.error).toBe("没有可朗读的文本");
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it("sambert 引擎 speak 成功时应调用 synthesize 并创建 audio", async () => {
    setupAudioMock();
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      await result.current.speak("你好");
    });

    expect(mocks.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "你好",
        output_format: "mp3",
      }),
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("sambert 引擎 speak 失败时应设置错误并重置状态", async () => {
    setupAudioMock();
    mocks.synthesize.mockRejectedValueOnce(new Error("synthesize fail"));

    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      // 使用与成功测试不同的文本，避免命中模块级缓存 sambertAudioCache
      await result.current.speak("合成失败场景测试文本");
    });

    expect(result.current.error).toBe("synthesize fail");
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("sambert 引擎 cancel 应重置所有状态", async () => {
    setupAudioMock();
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      // 使用唯一文本避免模块级缓存命中
      await result.current.speak("取消场景测试文本");
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("setVoice 在 browser 引擎下应可调用且不抛出", () => {
    const { result } = renderHook(() => useTextToSpeech("browser"));
    const voice = { name: "zh-CN", lang: "zh-CN" } as SpeechSynthesisVoice;

    expect(() => {
      act(() => {
        result.current.setVoice(voice);
      });
    }).not.toThrow();
  });

  it("setVoice 在 sambert 引擎下应可调用且不抛出", () => {
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    expect(() => {
      act(() => {
        result.current.setVoice("sambert-test");
      });
    }).not.toThrow();
  });

  it("loadVoices 在 sambert 引擎下应调用 api.tts.voices", async () => {
    const fakeVoices = [{ id: "v1", name: "voice1" }];
    mocks.voices.mockResolvedValueOnce(fakeVoices);
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      await result.current.loadVoices();
    });

    expect(mocks.voices).toHaveBeenCalled();
  });

  it("loadVoices 失败时应设置错误", async () => {
    mocks.voices.mockRejectedValueOnce(new Error("voices fail"));
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      await result.current.loadVoices();
    });

    expect(result.current.error).toBe("voices fail");
  });

  it("组件卸载时应调用 speechSynthesis.cancel 进行清理", () => {
    const { unmount } = renderHook(() => useTextToSpeech("browser"));

    unmount();

    expect(mockSynth.cancel).toHaveBeenCalled();
  });

  it("sambert 引擎 speak 在纯空白文本时应设置错误", async () => {
    const { result } = renderHook(() => useTextToSpeech("sambert"));

    await act(async () => {
      await result.current.speak("   ");
    });

    expect(result.current.error).toBe("没有可朗读的文本");
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });
});
