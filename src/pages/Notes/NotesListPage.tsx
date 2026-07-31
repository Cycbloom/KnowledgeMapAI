import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { debounce } from "@/utils/performanceUtils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  NotebookPen,
  CalendarDays,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  RefreshCw,
  Plus,
  XCircle,
  Search,
  Hash,
  Loader2,
  LayoutTemplate,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme, useIsMobile } from "../../hooks";
import { usePersistedListState } from "../../hooks/common/usePersistedListState";
import { useScrollRestoration } from "../../hooks/common/useScrollRestoration";
import { useNotesList, type NoteView } from "../../hooks/queries";
import {
  useCreateNoteMutation,
  useGetOrCreateTodayDailyMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useRestoreNoteMutation,
} from "../../hooks/mutations";
import { api } from "../../services/api";
import {
  Skeleton,
  EmptyState,
  ConfirmationModal,
  ErrorBoundary,
} from "../../components/common";
import { VirtualList } from "../../components/common/VirtualList";
import { NotesListSortDropdown, type SortBy } from "../../components/Notes/NotesListSortDropdown";
import { NotesBatchActions } from "../../components/Notes/NotesBatchActions";
import { asyncConfirm } from "../../utils/asyncConfirm";
import { formatDate } from "../../utils/formatters";
import { message } from "../../utils/messageHelper";
import type { Note, NoteType } from "@shared/types/note";

const PAGE_SIZE = 20;

/** 视图标签定义:顺序即渲染顺序,value 对应 useNotesList 的 view 参数。 */
const VIEW_TABS = [
  { value: "all", labelKey: "notes.views.all" },
  { value: "daily", labelKey: "notes.views.daily" },
  { value: "note", labelKey: "notes.views.note" },
  { value: "pinned", labelKey: "notes.views.pinned" },
  { value: "archived", labelKey: "notes.views.archived" },
] as const satisfies ReadonlyArray<{ value: NoteView; labelKey: string }>;

/**
 * 依据标签名生成稳定的颜色(与 TagSystem 视觉风格一致的小型实现,
 * 避免为只读展示引入可编辑的 TagInput 组件)。
 */
const TAG_CHIP_COLORS = [
  "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
];

const getTagChipColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_CHIP_COLORS[Math.abs(hash) % TAG_CHIP_COLORS.length];
};

/** 类型徽章样式:daily 用紫色,note 用蓝色。 */
const getTypeBadgeClass = (type: NoteType): string => {
  if (type === "daily") {
    return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700";
  }
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
};

/**
 * 本地时区当日 YYYY-MM-DD 字符串。
 * 与后端 notesService.getLocalDateString 保持一致,用于 localStorage 跳转标记键。
 */
const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** 判定 note 是否为"刚刚创建"(用于自动跳转启发式),默认阈值 60 秒。 */
const JUST_CREATED_THRESHOLD_MS = 60_000;
const isJustCreated = (note: Note, now: Date = new Date()): boolean => {
  const createdMs = new Date(note.createdAt).getTime();
  return Number.isFinite(createdMs) && now.getTime() - createdMs < JUST_CREATED_THRESHOLD_MS;
};

const FilterTab = ({
  label,
  value,
  current,
  onClick,
}: {
  label: string;
  value: NoteView;
  current: NoteView;
  onClick: (v: NoteView) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
      current === value
        ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
        : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
    }`}
  >
    {label}
  </button>
);

/** 只读标签芯片组(用于列表项展示 note.tags)。 */
const TagChips = ({
  tags,
  onTagClick,
}: {
  tags: string[] | null;
  onTagClick?: (tag: string) => void;
}) => {
  const { t } = useTranslation();
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.slice(0, 6).map((tag) => {
        const clickable = !!onTagClick;
        const handleActivate = (
          e: React.MouseEvent | React.KeyboardEvent,
        ) => {
          if (!onTagClick) return;
          e.stopPropagation();
          onTagClick(tag);
        };
        return (
          <span
            key={tag}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={
              clickable
                ? t("notes.filter.tagAriaLabel", { tag })
                : undefined
            }
            onClick={clickable ? handleActivate : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleActivate(e);
                    }
                  }
                : undefined
            }
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${getTagChipColor(
              tag,
            )}${
              clickable
                ? " cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-opacity"
                : ""
            }`}
          >
            <Hash size={10} aria-hidden="true" />
            {tag}
          </span>
        );
      })}
      {tags.length > 6 && (
        <span className="text-xs text-gray-400 dark:text-slate-500">
          +{tags.length - 6}
        </span>
      )}
    </div>
  );
};

const NoteCard = memo(({
  note,
  onPin,
  onArchive,
  onDelete,
  pendingAction,
  onTagClick,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  note: Note;
  onPin: (note: Note) => void;
  onArchive: (note: Note) => void;
  onDelete: (note: Note) => void;
  pendingAction: string | null;
  onTagClick?: (tag: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const isBusy = pendingAction === note.id;

  const handleClick = () => {
    // 批量选择模式:点击切换选中态,不跳转。
    if (isSelectMode) {
      onToggleSelect?.(note.id);
      return;
    }
    // 跳转笔记编辑器;路由 /notes/:noteId 由 Task 8 注册。
    navigate(`/notes/${note.id}`);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(note.id);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
        isSelectMode && isSelected
          ? "bg-primary-50/40 dark:bg-primary-900/10"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {isSelectMode && (
          <button
            type="button"
            onClick={handleCheckboxClick}
            className="mt-1 flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={note.title || t("notes.fields.untitled")}
            aria-pressed={isSelected}
          >
            {isSelected ? (
              <CheckSquare
                size={20}
                className="text-primary-500"
                aria-hidden="true"
              />
            ) : (
              <Square
                size={20}
                className="text-gray-400 dark:text-slate-500"
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {note.isPinned && (
              <Pin
                size={14}
                className="text-amber-500 flex-shrink-0"
                aria-label={t("notes.badges.pinned")}
              />
            )}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${getTypeBadgeClass(
                note.type,
              )}`}
            >
              {note.type === "daily" ? (
                <CalendarDays size={11} aria-hidden="true" />
              ) : (
                <NotebookPen size={11} aria-hidden="true" />
              )}
              <span>
                {note.type === "daily"
                  ? t("notes.badges.daily")
                  : t("notes.badges.note")}
              </span>
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {note.title || t("notes.fields.untitled")}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-2">
            <span>{formatDate(note.updatedAt, "relative")}</span>
          </div>

          <TagChips tags={note.tags} onTagClick={onTagClick} />
        </div>

        {!isSelectMode && (
          <div
            className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${
              !isMobile
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-100"
            }`}
            onClick={stop}
          >
            <button
              type="button"
              onClick={() => onPin(note)}
              disabled={isBusy}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors disabled:opacity-50"
              title={note.isPinned ? t("notes.actions.unpin") : t("notes.actions.pin")}
              aria-label={note.isPinned ? t("notes.actions.unpin") : t("notes.actions.pin")}
            >
              {note.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <button
              type="button"
              onClick={() => onArchive(note)}
              disabled={isBusy}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
              title={
                note.isArchived
                  ? t("notes.actions.unarchive")
                  : t("notes.actions.archive")
              }
              aria-label={
                note.isArchived
                  ? t("notes.actions.unarchive")
                  : t("notes.actions.archive")
              }
            >
              {note.isArchived ? (
                <ArchiveRestore size={16} />
              ) : (
                <Archive size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={() => onDelete(note)}
              disabled={isBusy}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              title={t("notes.actions.delete")}
              aria-label={t("notes.actions.delete")}
            >
              {isBusy ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const NoteListSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-gray-100 dark:border-slate-500 flex items-center gap-4"
      >
        <Skeleton className="h-5 w-5 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    ))}
  </div>
);

export const NotesListPage = () => {
  const { t } = useTranslation();
  const { token } = useStore();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = usePersistedListState<NoteView>("notes-view", "all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // SubTask 10.1: 客户端标题搜索(useState + useMemo);searchInput 为即时输入值,
  // searchKeyword 为 debounce 后的实际过滤值,避免每次按键都触发过滤。
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  // SubTask 10.2: 客户端标签筛选(点击列表项 tag chip 时设置)。
  // R22 Task 5: view/sortBy/filterTag 持久化到 localStorage,跨会话保留。
  const [filterTag, setFilterTag] = usePersistedListState<string | null>(
    "notes-filterTag",
    null,
  );
  const debouncedSetSearchKeyword = useMemo(
    () =>
      debounce((value: string) => {
        setSearchKeyword(value);
      }, 300),
    [],
  );
  // Infinite Query: 底部 sentinel ref,供 IntersectionObserver 观察以自动加载下一页。
  const loadMoreRef = useRef<HTMLDivElement>(null);
  // 虚拟列表容器高度：基于视口高度估算可用列表区域，resize 时更新。
  const [listContainerHeight, setListContainerHeight] = useState(() =>
    typeof window !== "undefined"
      ? Math.max(300, window.innerHeight - 400)
      : 600,
  );

  // R22 Task 5: 客户端列表排序,持久化到 localStorage。
  const [sortBy, setSortBy] = usePersistedListState<SortBy>(
    "notes-sortBy",
    "updatedAt",
  );

  // R22 Task 7: 滚动位置记忆,卸载时保存 scrollTop,重新进入时恢复;
  // 筛选/排序/搜索变化时重置到顶部(避免停留在旧位置)。
  const scrollRef = useScrollRestoration<HTMLDivElement>("notes-list-scroll", {
    deps: [view, sortBy, filterTag, searchKeyword],
  });

  // Task 5: 批量选择模式
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<{
    isOpen: boolean;
    count: number;
  }>({ isOpen: false, count: 0 });
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotesList({
    view,
    enabled: !!token,
    pageSize: PAGE_SIZE,
  });

  const createNoteMutation = useCreateNoteMutation();
  // Bug 4: 自动创建 useEffect 与"新建 Daily"按钮使用独立的 mutation 实例,
  // 避免自动创建的 isPending 影响按钮可用状态(按钮变灰转圈)。
  const createDailyMutation = useGetOrCreateTodayDailyMutation();
  const manualCreateDailyMutation = useGetOrCreateTodayDailyMutation();
  const updateNoteMutation = useUpdateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const restoreNoteMutation = useRestoreNoteMutation();

  // useInfiniteQuery: data.pages 是各页 NoteListResult 数组,需展平为单层 note 列表。
  const notes = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  // 卸载时清理 debounce 定时器,避免设置已卸载组件 state 的告警。
  useEffect(() => {
    return () => {
      debouncedSetSearchKeyword.cancel();
    };
  }, [debouncedSetSearchKeyword]);

  // 虚拟列表容器高度随窗口尺寸变化重新计算。
  useEffect(() => {
    const updateListHeight = () =>
      setListContainerHeight(Math.max(300, window.innerHeight - 400));
    window.addEventListener("resize", updateListHeight);
    return () => window.removeEventListener("resize", updateListHeight);
  }, []);

  // Infinite Query: 底部 sentinel 进入视口时自动加载下一页。
  // 仅在 hasNextPage 且未在加载中时触发,避免重复请求。
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // debounce 300ms 后再写入 searchKeyword;回车时立即触发(见 onKeyDown)。
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearchKeyword(value);
  };

  const handleSearchClear = () => {
    setSearchInput("");
    debouncedSetSearchKeyword.cancel();
    setSearchKeyword("");
  };

  // SubTask 10.3: 客户端过滤叠加在服务端返回数据之上,与 view 切换独立。
  // 仅对当前页数据生效;分页 total 仍以服务端为准,不改变分页行为。
  const filteredNotes = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw && !filterTag) return notes;
    return notes.filter((note) => {
      const matchTitle =
        !kw || (note.title ?? "").toLowerCase().includes(kw);
      const matchTag =
        !filterTag || (note.tags?.includes(filterTag) ?? false);
      return matchTitle && matchTag;
    });
  }, [notes, searchKeyword, filterTag]);

  // Task 4: 在客户端过滤结果之上叠加排序。
  const sortedFilteredNotes = useMemo(() => {
    const sorted = [...filteredNotes];
    switch (sortBy) {
      case "createdAt":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "title":
        sorted.sort((a, b) =>
          (a.title ?? "").localeCompare(b.title ?? ""),
        );
        break;
      case "updatedAt":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        break;
    }
    return sorted;
  }, [filteredNotes, sortBy]);

  // SubTask 9.1: 进入 /notes 时静默确保今日 daily 存在。
  // 仅当本日首次进入且后端刚创建(createdAt 在最近 60 秒内)时跳转到编辑器,
  // 已存在则留在列表(避免每次进入都跳走打扰用户查看列表)。
  // 用 ref 防止同一组件实例重复执行,用 localStorage 标记防止同日跨导航重复跳转。
  const autoDailyInitiatedRef = useRef(false);
  useEffect(() => {
    if (autoDailyInitiatedRef.current) return;
    if (!token) return;
    autoDailyInitiatedRef.current = true;

    const today = getLocalDateString();
    const jumpFlagKey = `notes:dailyAutoJumped:${today}`;
    const alreadyHandledToday =
      typeof window !== "undefined" &&
      window.localStorage.getItem(jumpFlagKey) === "1";

    void (async () => {
      try {
        const note = await createDailyMutation.mutateAsync();
        // 无论是否跳转,都标记今日已处理自动流程,避免同日重复进入时再次判断
        if (typeof window !== "undefined") {
          window.localStorage.setItem(jumpFlagKey, "1");
        }
        if (!alreadyHandledToday && isJustCreated(note)) {
          navigate(`/notes/${note.id}`);
        }
      } catch (err: unknown) {
        console.error("Failed to create daily note:", err);
        message.error(t("notes.createDailyFailed"));
      }
    })();
    // 仅在 token 就绪后触发一次;mutation/navigate 故意不进依赖以防重复执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleViewChange = (next: NoteView) => {
    setView(next);
    // setPage(1) 不再需要:infinite query 在 view 变化(queryKey 变化)时
    // 会自动从第 1 页重新拉取
  };

  const handleCreateNote = async () => {
    try {
      await createNoteMutation.mutateAsync({
        title: t("notes.newNoteDefaultTitle"),
        type: "note",
      });
      message.success(t("notes.noteCreated"));
      // Task 8 完成后可在此处跳转 /notes/:id 打开编辑器。
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("notes.createNoteFailed");
      message.error(errorMessage);
    }
  };

  const handleCreateDaily = async () => {
    try {
      const note = await manualCreateDailyMutation.mutateAsync();
      message.success(t("notes.dailyCreated"));
      // SubTask 9.2: 跳转到当日 daily 编辑器(无论新建还是已存在都打开)
      navigate(`/notes/${note.id}`);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("notes.createDailyFailed");
      message.error(errorMessage);
    }
  };

  const handlePin = async (note: Note) => {
    setPendingAction(note.id);
    try {
      await updateNoteMutation.mutateAsync({
        id: note.id,
        data: { isPinned: !note.isPinned },
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("notes.updateFailed");
      message.error(errorMessage);
    } finally {
      setPendingAction(null);
    }
  };

  const handleArchive = async (note: Note) => {
    setPendingAction(note.id);
    try {
      await updateNoteMutation.mutateAsync({
        id: note.id,
        data: { isArchived: !note.isArchived },
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("notes.updateFailed");
      message.error(errorMessage);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (note: Note) => {
    const confirmed = await asyncConfirm({
      title: t("notes.deleteConfirmTitle"),
      message: t("notes.deleteConfirmMessage"),
      confirmText: t("common.delete"),
      cancelText: t("common.cancel"),
      isDangerous: true,
    });
    if (!confirmed) return;

    // Task 3: 在 mutation 之前捕获 note id/title,用于撤销 toast 回调。
    const deletedNoteId = note.id;
    setPendingAction(note.id);
    try {
      await deleteNoteMutation.mutateAsync(note.id);
      message.success(t("notes.undo.deletedOne", {
        title: note.title || t("notes.fields.untitled"),
      }), {
        duration: 5000,
        action: {
          label: t("common.undo"),
          onClick: () => {
            void handleUndoDeleteNote(deletedNoteId);
          },
        },
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("notes.deleteFailed");
      message.error(errorMessage);
    } finally {
      setPendingAction(null);
    }
  };

  // Task 3: 撤销单条删除。使用 useRestoreNoteMutation(后端 POST /notes/:id/restore)。
  // 失效 ["notes"] 前缀以刷新列表/详情/回收站等所有 notes 查询。
  const handleUndoDeleteNote = useCallback(
    async (id: string) => {
      try {
        await restoreNoteMutation.mutateAsync(id);
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
        message.success(t("notes.undo.restored"));
      } catch {
        message.error(t("notes.undo.restoreFailed"));
      }
    },
    [restoreNoteMutation, queryClient, t],
  );

  // Task 5: 批量删除确认回调。
  // 使用 Promise.allSettled 并行调用 api.notes.delete;部分失败时给出 warning toast。
  // 全部成功时给出带 undo 按钮的 success toast,点击 undo 调用 handleUndoBatchDeleteNotes。
  const handleConfirmBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBatchDeleting(true);
    setBatchDeleteConfirm({ isOpen: false, count: 0 });
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.notes.delete(id)),
      );
      const failedCount = results.filter(
        (r) => r.status === "rejected",
      ).length;
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      if (failedCount === 0) {
        message.success(t("notes.undo.deletedMany", { count: ids.length }), {
          duration: 5000,
          action: {
            label: t("common.undo"),
            onClick: () => {
              void handleUndoBatchDeleteNotes(ids);
            },
          },
        });
      } else {
        message.warning(t("notes.batch.partialDeleteFailed"));
      }
    } catch {
      // allSettled 不会 reject,此分支仅作防御。
      message.error(t("notes.deleteFailed"));
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Task 5: 撤销批量删除。使用 Promise.allSettled 并行调用 api.notes.restore。
  const handleUndoBatchDeleteNotes = useCallback(
    async (ids: string[]) => {
      try {
        const results = await Promise.allSettled(
          ids.map((id) => api.notes.restore(id)),
        );
        const failedCount = results.filter(
          (r) => r.status === "rejected",
        ).length;
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
        if (failedCount === 0) {
          message.success(t("notes.undo.restored"));
        } else {
          message.error(t("notes.undo.restoreFailed"));
        }
      } catch {
        message.error(t("notes.undo.restoreFailed"));
      }
    },
    [queryClient, t],
  );

  // Task 5: 进入/退出批量选择模式。
  const enterSelectMode = () => {
    setSelectedIds(new Set());
    setIsSelectMode(true);
  };
  const exitSelectMode = () => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  // Task 5: 切换单条选中态。
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Task 5: 全选/取消全选(基于当前排序+过滤后的可见项)。
  const toggleSelectAll = () => {
    if (
      sortedFilteredNotes.length > 0 &&
      sortedFilteredNotes.every((n) => selectedIds.has(n.id))
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(sortedFilteredNotes.map((n) => n.id)),
      );
    }
  };

  const emptyConfig = useMemo(() => {
    switch (view) {
      case "archived":
        return {
          title: t("notes.empty.archivedTitle"),
          description: t("notes.empty.archivedDescription"),
        };
      case "pinned":
        return {
          title: t("notes.empty.pinnedTitle"),
          description: t("notes.empty.pinnedDescription"),
        };
      case "daily":
        return {
          title: t("notes.empty.dailyTitle"),
          description: t("notes.empty.dailyDescription"),
        };
      case "note":
        return {
          title: t("notes.empty.title"),
          description: t("notes.empty.description"),
        };
      case "all":
      default:
        return {
          title: t("notes.empty.title"),
          description: t("notes.empty.description"),
        };
    }
  }, [view, t]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300"
    >
      {/* 顶部:标题 + 操作区 */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
            {t("notes.title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            {t("notes.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreateDaily}
            disabled={manualCreateDailyMutation.isPending}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {manualCreateDailyMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
            <span>{t("notes.actions.newDaily")}</span>
          </button>
          <button
            type="button"
            onClick={handleCreateNote}
            disabled={createNoteMutation.isPending}
            className="bg-primary-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {createNoteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>{t("notes.actions.newNote")}</span>
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 px-3 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            title={t("notes.actions.refresh")}
            aria-label={t("notes.actions.refresh")}
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
          {/* Task 11: 跳转模板管理页 */}
          <button
            type="button"
            onClick={() => navigate("/notes/templates")}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 px-3 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            title={t("notes.templates.actions.manage")}
            aria-label={t("notes.templates.actions.manage")}
          >
            <LayoutTemplate className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t("notes.templates.actions.manage")}
            </span>
          </button>
          {/* Task 5: 批量管理 / 退出批量管理 */}
          {!isSelectMode ? (
            <button
              type="button"
              onClick={enterSelectMode}
              className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 px-3 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              title={t("notes.batch.enterSelectMode")}
              aria-label={t("notes.batch.enterSelectMode")}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t("notes.batch.enterSelectMode")}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={exitSelectMode}
              className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-2 rounded-md flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              title={t("notes.batch.exit")}
              aria-label={t("notes.batch.exit")}
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t("notes.batch.exit")}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 视图切换 + Task 4 排序下拉 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 overflow-x-auto flex-1 min-w-0">
          {VIEW_TABS.map((tab) => (
            <FilterTab
              key={tab.value}
              label={t(tab.labelKey)}
              value={tab.value}
              current={view}
              onClick={handleViewChange}
            />
          ))}
        </div>
        <NotesListSortDropdown
          value={sortBy}
          onChange={setSortBy}
          isDark={isDark}
        />
      </div>

      {/* SubTask 10.1: 顶部搜索框(debounce 300ms,回车立即触发) */}
      <div
        role="search"
        aria-label={t('common.aria.searchWithTarget', { target: t('notes.title') })}
        className="relative mb-4"
      >
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          aria-label={t("common.aria.search")}
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              debouncedSetSearchKeyword.cancel();
              setSearchKeyword(searchInput);
            }
          }}
          placeholder={t("notes.search.placeholder")}
          className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-500 rounded-lg pl-10 pr-10 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleSearchClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label={t("notes.filter.clear")}
            title={t("notes.filter.clear")}
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* SubTask 10.2: 当前标签筛选条(点击列表项 tag chip 设置,可清除) */}
      {filterTag && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t("notes.filter.current")}:
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Hash size={12} aria-hidden="true" />
            {filterTag}
            <button
              type="button"
              onClick={() => setFilterTag(null)}
              className="ml-1 -mr-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full p-2 transition-colors"
              aria-label={t("notes.filter.clearAriaLabel")}
              title={t("notes.filter.clear")}
            >
              <XCircle size={14} />
            </button>
          </span>
        </div>
      )}

      {/* 内容区 */}
      {error ? (
        <div role="alert" className="p-8 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{t("notes.loadFailed")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 text-primary-600 dark:text-primary-400 underline"
          >
            {t("notes.retry")}
          </button>
        </div>
      ) : (
        <div
          aria-busy={isLoading}
          aria-label={t("common.aria.loadingRegion")}
          className="space-y-4"
        >
          {/* sr-only 实时区域:筛选结果数量变化时向 SR 用户播报 */}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {t("notes.notesListPage.srLiveRegion.showingCount", {
              count: filteredNotes.length,
            })}
          </span>
          {isLoading && !isFetching && <NoteListSkeleton />}

          {!isLoading && notes.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-500">
              <EmptyState
                icon={
                  <NotebookPen className="w-12 h-12 text-gray-300 dark:text-slate-600" />
                }
                title={emptyConfig.title}
                description={emptyConfig.description}
                action={
                  view === "all" || view === "note"
                    ? {
                        label: t("notes.empty.cta"),
                        onClick: handleCreateNote,
                      }
                    : view === "daily"
                      ? {
                          label: t("notes.actions.newDaily"),
                          onClick: handleCreateDaily,
                        }
                      : undefined
                }
              />
            </div>
          )}

          {/* SubTask 10.1/10.2 空状态:服务端有数据但被客户端搜索/标签筛选过滤掉。
              保留外层 div 是为了提供视觉样式(虚线边框/背景),不再设置 aria-live:
              EmptyState 组件已自带 role="status",避免重复播报。 */}
          {!isLoading && notes.length > 0 && filteredNotes.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-500">
              <EmptyState
                icon={
                  <Search className="w-12 h-12 text-gray-300 dark:text-slate-600" />
                }
                illustration="search"
                title={t("notes.empty.searchTitle")}
                description={t("notes.empty.searchDescription")}
              />
            </div>
          )}

          {!isLoading && filteredNotes.length > 0 && (
            <>
              {/* Task 5: 批量选择模式下的批量操作工具栏 */}
              {isSelectMode && (
                <NotesBatchActions
                  isDark={isDark}
                  isAllSelected={
                    sortedFilteredNotes.length > 0 &&
                    sortedFilteredNotes.every((n) => selectedIds.has(n.id))
                  }
                  isPartialSelected={
                    !(
                      sortedFilteredNotes.length > 0 &&
                      sortedFilteredNotes.every((n) => selectedIds.has(n.id))
                    ) &&
                    sortedFilteredNotes.some((n) => selectedIds.has(n.id))
                  }
                  selectedCount={selectedIds.size}
                  isBatchDeleting={isBatchDeleting}
                  onToggleSelectAll={toggleSelectAll}
                  onBatchDelete={() =>
                    setBatchDeleteConfirm({
                      isOpen: true,
                      count: selectedIds.size,
                    })
                  }
                  onClearSelection={exitSelectMode}
                />
              )}
              <ErrorBoundary
                fallbackRender={(error, resetErrorBoundary) => (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-red-200 dark:border-red-900/40 p-8 text-center">
                    <XCircle className="w-8 h-8 mx-auto mb-3 text-red-600 dark:text-red-400" />
                    <p role="alert" className="text-red-600 dark:text-red-400 mb-2 font-medium">
                      {t("notes.notesListPage.errorBoundary.listLoadFailed")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 font-mono break-all">
                      {error.message}
                    </p>
                    <button
                      type="button"
                      onClick={resetErrorBoundary}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                      {t("notes.retry")}
                    </button>
                  </div>
                )}
              >
                <VirtualList
                  items={sortedFilteredNotes}
                  itemHeight={140}
                  containerHeight={listContainerHeight}
                  role="list"
                  className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-500"
                  renderItem={(note) => (
                    <div
                      role="listitem"
                      className="border-b border-gray-100 dark:border-slate-500"
                    >
                      <NoteCard
                        note={note}
                        onPin={handlePin}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        pendingAction={pendingAction}
                        onTagClick={(tag) => setFilterTag(tag)}
                        isSelectMode={isSelectMode}
                        isSelected={selectedIds.has(note.id)}
                        onToggleSelect={toggleSelect}
                      />
                    </div>
                  )}
                />
              </ErrorBoundary>

              {/* Infinite Query 加载更多:IntersectionObserver 自动触发,显示加载状态 */}
              {hasNextPage && (
                <div
                  ref={loadMoreRef}
                  className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2
                        className="w-4 h-4 animate-spin mr-2"
                        aria-hidden="true"
                      />
                      {t("notes.loadingMore")}
                    </>
                  ) : (
                    t("notes.loadMore")
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Task 5: 批量删除确认对话框 */}
      <ConfirmationModal
        isOpen={batchDeleteConfirm.isOpen}
        title={t("notes.batch.confirmTitle")}
        message={t("notes.batch.confirmMessage", {
          count: batchDeleteConfirm.count,
        })}
        onConfirm={handleConfirmBatchDelete}
        onClose={() => setBatchDeleteConfirm({ isOpen: false, count: 0 })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        isDangerous
      />
    </div>
  );
};

export default NotesListPage;
