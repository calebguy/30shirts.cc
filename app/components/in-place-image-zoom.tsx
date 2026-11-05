import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

const MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 3;
const KEYBOARD_SCALE_STEP = 0.25;
const WHEEL_SCALE_SENSITIVITY = 0.002;
const DRAG_THRESHOLD = 4;

interface Point {
  x: number;
  y: number;
}

interface ZoomViewport extends Point {
  scale: number;
}

interface TouchGesture {
  distance: number;
  focalPoint: Point;
  viewport: ZoomViewport;
}

interface SingleTouchGesture {
  startPoint: Point;
  viewport: ZoomViewport;
  gallery: HTMLElement | null;
  galleryScrollLeft: number;
  moved: boolean;
}

interface MouseDrag {
  startPoint: Point;
  viewport: ZoomViewport;
  moved: boolean;
}

interface ZoomTransition {
  viewport: ZoomViewport;
  scale: number;
  startPoint: Point;
  endPoint: Point;
}

interface InPlaceImageZoomProps {
  children: ReactNode;
  label: string;
  resetKey: string;
  maxScale?: number;
}

const INITIAL_VIEWPORT: ZoomViewport = { scale: MIN_SCALE, x: 0, y: 0 };

export function InPlaceImageZoom({
  children,
  label,
  resetKey,
  maxScale = DEFAULT_MAX_SCALE,
}: InPlaceImageZoomProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<ZoomViewport>(INITIAL_VIEWPORT);
  const touchGestureRef = useRef<TouchGesture | null>(null);
  const singleTouchGestureRef = useRef<SingleTouchGesture | null>(null);
  const mouseDragRef = useRef<MouseDrag | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [viewport, setViewport] = useState<ZoomViewport>(INITIAL_VIEWPORT);

  function updateViewport(nextViewport: ZoomViewport) {
    const root = rootRef.current;
    const constrainedViewport = root
      ? constrainViewport(nextViewport, root)
      : nextViewport;
    viewportRef.current = constrainedViewport;
    setViewport(constrainedViewport);
  }

  function resetViewport() {
    updateViewport(INITIAL_VIEWPORT);
  }

  function getScaleLimit() {
    const root = rootRef.current;
    return root ? getImageScaleLimit(root, maxScale) : maxScale;
  }

  useEffect(() => {
    viewportRef.current = INITIAL_VIEWPORT;
    setViewport(INITIAL_VIEWPORT);
  }, [resetKey]);

  useEffect(() => {
    const zoomRoot = rootRef.current;
    if (!(zoomRoot instanceof HTMLDivElement)) {
      return;
    }
    const touchRoot = zoomRoot as HTMLDivElement;

    function handleTouchStart(event: TouchEvent) {
      const touchPair = getTouchPair(event.touches);
      if (!touchPair) {
        const touch = event.touches.item(0);
        if (!touch) {
          return;
        }
        const gallery = touchRoot.closest<HTMLElement>(
          ".product-focus__gallery",
        );
        singleTouchGestureRef.current = {
          startPoint: { x: touch.clientX, y: touch.clientY },
          viewport: viewportRef.current,
          gallery,
          galleryScrollLeft: gallery?.scrollLeft ?? 0,
          moved: false,
        };
        return;
      }

      event.preventDefault();
      suppressClickUntilRef.current = performance.now() + 500;
      singleTouchGestureRef.current = null;
      const distance = getTouchDistance(touchPair);
      if (distance === 0) {
        return;
      }
      touchGestureRef.current = {
        distance,
        focalPoint: getTouchMidpoint(touchPair, touchRoot),
        viewport: viewportRef.current,
      };
    }

    function handleTouchMove(event: TouchEvent) {
      const touchPair = getTouchPair(event.touches);
      const pinchGesture = touchGestureRef.current;
      if (touchPair && pinchGesture) {
        event.preventDefault();
        const scale = clampScale(
          pinchGesture.viewport.scale *
            (getTouchDistance(touchPair) / pinchGesture.distance),
          getImageScaleLimit(touchRoot, maxScale),
        );
        updateViewport(
          zoomBetweenPoints({
            viewport: pinchGesture.viewport,
            scale,
            startPoint: pinchGesture.focalPoint,
            endPoint: getTouchMidpoint(
              touchPair,
              touchRoot,
            ),
          }),
        );
        return;
      }

      const touch = event.touches.item(0);
      const gesture = singleTouchGestureRef.current;
      if (!touch || !gesture) {
        return;
      }

      const x = touch.clientX - gesture.startPoint.x;
      const y = touch.clientY - gesture.startPoint.y;
      if (!gesture.moved && Math.hypot(x, y) >= DRAG_THRESHOLD) {
        gesture.moved = true;
      }
      if (!gesture.moved) {
        return;
      }

      if (gesture.viewport.scale > MIN_SCALE) {
        event.preventDefault();
        suppressClickUntilRef.current = performance.now() + 500;
        updateViewport({
          scale: gesture.viewport.scale,
          x: gesture.viewport.x + x,
          y: gesture.viewport.y + y,
        });
      } else if (Math.abs(x) > Math.abs(y) && gesture.gallery) {
        event.preventDefault();
        suppressClickUntilRef.current = performance.now() + 500;
        gesture.gallery.scrollLeft = gesture.galleryScrollLeft - x;
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length >= 2) {
        return;
      }

      touchGestureRef.current = null;
      const gesture = singleTouchGestureRef.current;
      if (
        gesture?.moved &&
        gesture.viewport.scale === MIN_SCALE &&
        gesture.gallery
      ) {
        const slideIndex = Math.round(
          gesture.gallery.scrollLeft / gesture.gallery.clientWidth,
        );
        gesture.gallery.scrollTo({
          left: slideIndex * gesture.gallery.clientWidth,
          behavior: window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches
            ? "auto"
            : "smooth",
        });
      }
      singleTouchGestureRef.current = null;
    }

    function handleWheel(event: globalThis.WheelEvent) {
      const currentViewport = viewportRef.current;
      const isHorizontalGalleryScroll =
        currentViewport.scale === MIN_SCALE &&
        Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (isHorizontalGalleryScroll) {
        return;
      }

      event.preventDefault();
      const scale = clampScale(
        currentViewport.scale - event.deltaY * WHEEL_SCALE_SENSITIVITY,
        getImageScaleLimit(touchRoot, maxScale),
      );
      updateViewport(
        zoomAtPoint(
          currentViewport,
          scale,
          getEventPoint(event, touchRoot),
        ),
      );
    }

    touchRoot.addEventListener("touchstart", handleTouchStart, { passive: false });
    touchRoot.addEventListener("touchmove", handleTouchMove, { passive: false });
    touchRoot.addEventListener("touchend", handleTouchEnd);
    touchRoot.addEventListener("touchcancel", handleTouchEnd);
    touchRoot.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      touchRoot.removeEventListener("touchstart", handleTouchStart);
      touchRoot.removeEventListener("touchmove", handleTouchMove);
      touchRoot.removeEventListener("touchend", handleTouchEnd);
      touchRoot.removeEventListener("touchcancel", handleTouchEnd);
      touchRoot.removeEventListener("wheel", handleWheel);
    };
  }, [maxScale]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    const currentScale = viewportRef.current.scale;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      updateViewport(
        zoomAtPoint(
          viewportRef.current,
          clampScale(currentScale + KEYBOARD_SCALE_STEP, getScaleLimit()),
          { x: 0, y: 0 },
        ),
      );
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      updateViewport(
        zoomAtPoint(
          viewportRef.current,
          clampScale(currentScale - KEYBOARD_SCALE_STEP, getScaleLimit()),
          { x: 0, y: 0 },
        ),
      );
    } else if (event.key === "0" || event.key === "Escape") {
      event.preventDefault();
      resetViewport();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      viewportRef.current.scale === MIN_SCALE
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    mouseDragRef.current = {
      startPoint: { x: event.clientX, y: event.clientY },
      viewport: viewportRef.current,
      moved: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (!drag || event.pointerType !== "mouse") {
      return;
    }

    const x = event.clientX - drag.startPoint.x;
    const y = event.clientY - drag.startPoint.y;
    if (!drag.moved && Math.hypot(x, y) >= DRAG_THRESHOLD) {
      drag.moved = true;
    }
    if (!drag.moved) {
      return;
    }

    event.preventDefault();
    updateViewport({
      scale: drag.viewport.scale,
      x: drag.viewport.x + x,
      y: drag.viewport.y + y,
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (!drag || event.pointerType !== "mouse") {
      return;
    }

    if (drag.moved) {
      suppressClickUntilRef.current = performance.now() + 500;
    }
    mouseDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={rootRef}
      className="in-place-zoom"
      data-zoomed={viewport.scale > MIN_SCALE || undefined}
      role="group"
      aria-label={`${label}. Scroll or pinch to zoom. Use plus and minus keys when focused.`}
      tabIndex={0}
      onClickCapture={(event) => {
        if (performance.now() > suppressClickUntilRef.current) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="in-place-zoom__content"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
        }}
      >
        {children}
      </div>
      <output className="visually-hidden" aria-live="polite">
        Zoom {Math.round(viewport.scale * 100)}%
      </output>
    </div>
  );
}

function clampScale(scale: number, maxScale: number): number {
  return Math.min(maxScale, Math.max(MIN_SCALE, scale));
}

function getImageScaleLimit(
  root: HTMLDivElement,
  requestedLimit: number,
): number {
  const image = root.querySelector("img");
  if (
    !image?.complete ||
    image.naturalWidth === 0 ||
    image.naturalHeight === 0
  ) {
    return requestedLimit;
  }

  const bounds = root.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) {
    return requestedLimit;
  }

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const containerRatio = bounds.width / bounds.height;
  const renderedWidth =
    sourceRatio > containerRatio ? bounds.width : bounds.height * sourceRatio;
  const renderedHeight =
    sourceRatio > containerRatio ? bounds.width / sourceRatio : bounds.height;
  const imageTransform = getComputedStyle(image).transform;
  const transformMatrix =
    imageTransform === "none" ? null : new DOMMatrixReadOnly(imageTransform);
  const imageScale = transformMatrix
    ? Math.hypot(transformMatrix.a, transformMatrix.b)
    : 1;
  const sourceWidthLimit =
    image.naturalWidth / (renderedWidth * imageScale);
  const sourceHeightLimit =
    image.naturalHeight / (renderedHeight * imageScale);

  return Math.max(
    MIN_SCALE,
    Math.min(requestedLimit, sourceWidthLimit, sourceHeightLimit),
  );
}

function constrainViewport(
  viewport: ZoomViewport,
  root: HTMLDivElement,
): ZoomViewport {
  if (viewport.scale === MIN_SCALE) {
    return INITIAL_VIEWPORT;
  }

  const maxX = (root.clientWidth * (viewport.scale - MIN_SCALE)) / 2;
  const maxY = (root.clientHeight * (viewport.scale - MIN_SCALE)) / 2;
  return {
    scale: viewport.scale,
    x: Math.min(maxX, Math.max(-maxX, viewport.x)),
    y: Math.min(maxY, Math.max(-maxY, viewport.y)),
  };
}

function zoomAtPoint(
  viewport: ZoomViewport,
  scale: number,
  focalPoint: Point,
): ZoomViewport {
  return zoomBetweenPoints({
    viewport,
    scale,
    startPoint: focalPoint,
    endPoint: focalPoint,
  });
}

function zoomBetweenPoints({
  viewport,
  scale,
  startPoint,
  endPoint,
}: ZoomTransition): ZoomViewport {
  if (scale === MIN_SCALE) {
    return INITIAL_VIEWPORT;
  }

  const scaleRatio = scale / viewport.scale;
  return {
    scale,
    x: endPoint.x - scaleRatio * (startPoint.x - viewport.x),
    y: endPoint.y - scaleRatio * (startPoint.y - viewport.y),
  };
}

function getEventPoint(
  event: Pick<globalThis.WheelEvent, "clientX" | "clientY">,
  root: HTMLDivElement,
): Point {
  const bounds = root.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left - bounds.width / 2,
    y: event.clientY - bounds.top - bounds.height / 2,
  };
}

function getTouchPair(touches: TouchList): [Touch, Touch] | null {
  const firstTouch = touches.item(0);
  const secondTouch = touches.item(1);
  return firstTouch && secondTouch ? [firstTouch, secondTouch] : null;
}

function getTouchDistance([firstTouch, secondTouch]: [Touch, Touch]): number {
  return Math.hypot(
    secondTouch.clientX - firstTouch.clientX,
    secondTouch.clientY - firstTouch.clientY,
  );
}

function getTouchMidpoint(
  [firstTouch, secondTouch]: [Touch, Touch],
  root: HTMLDivElement,
): Point {
  const bounds = root.getBoundingClientRect();
  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2 - bounds.left - bounds.width / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2 - bounds.top - bounds.height / 2,
  };
}
