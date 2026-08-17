/** 可聚焦控件的统一选择器。 */
const FOCUSABLE_SELECTOR = "input, select, textarea, button, a[href], [tabindex]";

/**
 * 查找第一个存在可聚焦目标的错误标记元素，聚焦并滚动到可见位置。
 *
 * 对容器内所有 `[aria-invalid="true"]` 元素按文档顺序遍历，
 * 优先聚焦元素本身（若为可聚焦控件），否则聚焦其内部第一个可聚焦子元素。
 *
 * @param container 错误标记元素所在的容器，为 null / undefined 时不做任何操作。
 * @returns 是否成功聚焦到某个目标。失败时无副作用、不抛错。
 */
export function focusFirstError(container: HTMLElement | null): boolean {
  if (container == null) {
    return false;
  }

  const errorElements = container.querySelectorAll('[aria-invalid="true"]');

  for (const element of errorElements) {
    let target: HTMLElement | null = null;

    if (element.matches(FOCUSABLE_SELECTOR)) {
      target = element as HTMLElement;
    } else {
      target = element.querySelector(FOCUSABLE_SELECTOR);
    }

    if (target == null) {
      continue;
    }

    target.focus();
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  }

  return false;
}