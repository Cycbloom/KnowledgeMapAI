import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { offlineMutationQueue } from "@/utils/offlineMutations";
import { frontendEventBus } from "@/services/timer/FrontendEventBus";
import type { SyncConflictDetectedPayload } from "@/services/FrontendEventTypes";

type ResolutionStrategy = "local" | "remote" | "merge";

export function ConflictResolutionDialog() {
  const [conflict, setConflict] = useState<SyncConflictDetectedPayload | null>(null);

  useEffect(() => {
    const unsubscribe = frontendEventBus.subscribe(
      "sync_conflict_detected",
      (payload: SyncConflictDetectedPayload) => {
        setConflict(payload);
      },
    );
    return unsubscribe;
  }, []);

  if (!conflict) return null;

  const handleResolve = async (strategy: ResolutionStrategy): Promise<void> => {
    await offlineMutationQueue.enqueue({
      mutationKey: ["conflict-resolution", conflict.entity, conflict.id],
      variables: {
        strategy,
        entityType: conflict.entity,
        entityId: conflict.id,
        local: conflict.localData,
        remote: conflict.remoteData,
      },
      context: undefined,
      meta: { conflictResolution: true },
    });
    setConflict(null);
  };

  return (
    <div
      data-testid="conflict-resolution-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">同步冲突</h2>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            {conflict.entity} #{conflict.id} 存在冲突，请选择解决方案：
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div data-testid="conflict-local-version">
              <h3 className="font-medium text-sm mb-2">本地版本</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(conflict.localData, null, 2)}
              </pre>
            </div>
            <div data-testid="conflict-remote-version">
              <h3 className="font-medium text-sm mb-2">远端版本</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(conflict.remoteData, null, 2)}
              </pre>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              data-testid="conflict-use-local"
              onClick={() => {
                void handleResolve("local");
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              使用本地版本
            </button>
            <button
              type="button"
              data-testid="conflict-use-remote"
              onClick={() => {
                void handleResolve("remote");
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
            >
              使用远端版本
            </button>
            <button
              type="button"
              data-testid="conflict-merge"
              onClick={() => {
                void handleResolve("merge");
              }}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
            >
              合并
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
