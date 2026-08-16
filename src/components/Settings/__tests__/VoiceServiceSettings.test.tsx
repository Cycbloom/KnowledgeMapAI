// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { VoiceServiceSettings } from "../VoiceServiceSettings";

// 返回 key 本身作为文案，便于断言组件使用了正确的 i18n key
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
}));

const { ttsHealthMock, sttHealthMock, ttsVoicesMock } = vi.hoisted(() => ({
  ttsHealthMock: vi.fn(),
  sttHealthMock: vi.fn(),
  ttsVoicesMock: vi.fn(),
}));

// 组件通过 api.tts.health() / api.stt.health() 访问健康状态，这里整体 mock api
vi.mock("../../../services/api", () => ({
  api: {
    tts: {
      health: ttsHealthMock,
      voices: ttsVoicesMock,
      synthesize: vi.fn(),
    },
    stt: {
      health: sttHealthMock,
      transcribe: vi.fn(),
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("VoiceServiceSettings", () => {
  beforeEach(() => {
    ttsHealthMock.mockReset();
    sttHealthMock.mockReset();
    ttsVoicesMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("初始 idle 状态渲染中性『未检测』文案而非红色失败文案", async () => {
    // 健康检测挂起（不立即 resolve），用于观察初始提交（idle）的 DOM
    const ttsD = deferred<{ status: string; model_loaded: boolean }>();
    const sttD = deferred<{ status: string; model_loaded: boolean }>();
    ttsHealthMock.mockReturnValue(ttsD.promise);
    sttHealthMock.mockReturnValue(sttD.promise);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    // flushSync 强制提交首个渲染。受控参数下启动会触发自动检测 effect，
    // 因此用 flushSync 观察 effect flush 之前的初始 DOM（此时仍为 idle）。
    flushSync(() => {
      root.render(<VoiceServiceSettings />);
    });

    // 初始 idle：渲染中性文案，而非红色失败文案
    expect(screen.getByText("settings.ttsIdle")).toBeInTheDocument();
    expect(screen.getByText("settings.sttIdle")).toBeInTheDocument();
    expect(screen.queryByText("settings.ttsUnhealthy")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.sttUnhealthy")).not.toBeInTheDocument();

    // 收尾：在 act 内 resolve，随后卸载，避免未包裹的 setState 告警
    await act(async () => {
      ttsD.resolve({ status: "healthy", model_loaded: true });
      sttD.resolve({ status: "healthy", model_loaded: true });
      ttsVoicesMock.mockResolvedValue([]);
    });
    act(() => {
      root.unmount();
    });
  });

  it("健康检测进行中（挂起）时不渲染红色失败文案，且检查按钮被禁用", async () => {
    const ttsD = deferred<{ status: string; model_loaded: boolean }>();
    const sttD = deferred<{ status: string; model_loaded: boolean }>();
    ttsHealthMock.mockReturnValue(ttsD.promise);
    sttHealthMock.mockReturnValue(sttD.promise);

    render(<VoiceServiceSettings />);

    // 自动检测已进入 checking：不出现红色失败文案（原实现 idle 也渲染红色失败）
    expect(screen.queryByText("settings.ttsUnhealthy")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.sttUnhealthy")).not.toBeInTheDocument();

    // checking 期间检查状态按钮禁用，防止重复点击
    const checkButtons = screen.getAllByRole("button", { name: "settings.checkHealth" });
    expect(checkButtons).toHaveLength(2);
    checkButtons.forEach((b) => expect(b).toBeDisabled());
  });

  it("健康检测 resolve healthy 后显示『服务正常』，无红色失败/未检测文案", async () => {
    ttsHealthMock.mockResolvedValue({ status: "healthy", model_loaded: true });
    sttHealthMock.mockResolvedValue({ status: "healthy", model_loaded: true });
    ttsVoicesMock.mockResolvedValue([]);

    render(<VoiceServiceSettings />);

    await waitFor(() => {
      expect(screen.getByText("settings.ttsHealthy")).toBeInTheDocument();
      expect(screen.getByText("settings.sttHealthy")).toBeInTheDocument();
    });

    expect(screen.queryByText("settings.ttsUnhealthy")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.sttUnhealthy")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.ttsIdle")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.sttIdle")).not.toBeInTheDocument();
  });

  it("健康检测 resolve unhealthy 后显示『服务未就绪』，无健康/未检测文案", async () => {
    ttsHealthMock.mockResolvedValue({ status: "unhealthy", model_loaded: false });
    sttHealthMock.mockResolvedValue({ status: "unhealthy", model_loaded: false });

    render(<VoiceServiceSettings />);

    await waitFor(() => {
      expect(screen.getByText("settings.ttsUnhealthy")).toBeInTheDocument();
      expect(screen.getByText("settings.sttUnhealthy")).toBeInTheDocument();
    });

    expect(screen.queryByText("settings.ttsHealthy")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.sttHealthy")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.ttsIdle")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.sttIdle")).not.toBeInTheDocument();
  });

  it("unhealthy 后检查状态按钮恢复可用，可重新触发检测", async () => {
    ttsHealthMock.mockResolvedValue({ status: "unhealthy", model_loaded: false });
    sttHealthMock.mockResolvedValue({ status: "unhealthy", model_loaded: false });

    render(<VoiceServiceSettings />);

    await waitFor(() => {
      expect(screen.getByText("settings.ttsUnhealthy")).toBeInTheDocument();
    });

    const checkButtons = screen.getAllByRole("button", { name: "settings.checkHealth" });
    checkButtons.forEach((b) => expect(b).toBeEnabled());
  });

  it("健康检测成功后默认音色取自已加载列表首项，不硬编码 Cherry", async () => {
    ttsHealthMock.mockResolvedValue({ status: "healthy", model_loaded: true });
    sttHealthMock.mockResolvedValue({ status: "healthy", model_loaded: true });
    ttsVoicesMock.mockResolvedValue([
      { id: "voice-a", name: "Voice A" },
      { id: "voice-b", name: "Voice B" },
    ]);

    render(<VoiceServiceSettings />);

    await waitFor(() => {
      expect(screen.getByText("settings.ttsHealthy")).toBeInTheDocument();
    });

    // 默认选中列表首项 voice-a
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("voice-a");
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument();
  });
});