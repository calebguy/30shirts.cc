import { type WheelEvent, useEffect, useRef, useState } from "react";

import type { ProductImage } from "../lib/fourthwall";
import { CloseIcon } from "./icons/close";
import { LeftArrowIcon } from "./icons/left-arrow";
import { MinusIcon } from "./icons/minus";
import { PlusIcon } from "./icons/plus";
import { RightArrowIcon } from "./icons/right-arrow";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const SHIRT_INITIAL_ZOOM = 1.35;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_SENSITIVITY = 0.002;

interface ZoomViewport {
  scale: number;
  x: number;
  y: number;
}

function getInitialZoom(imageIndex: number, shirtImageCount: number): number {
  return imageIndex < shirtImageCount ? SHIRT_INITIAL_ZOOM : MIN_ZOOM;
}

function getInitialViewport(
  imageIndex: number,
  shirtImageCount: number,
): ZoomViewport {
  return {
    scale: getInitialZoom(imageIndex, shirtImageCount),
    x: 0,
    y: 0,
  };
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function zoomAtPoint(
  viewport: ZoomViewport,
  nextScale: number,
  focalPoint: { x: number; y: number },
): ZoomViewport {
  if (nextScale === MIN_ZOOM) {
    return { scale: nextScale, x: 0, y: 0 };
  }

  const scaleRatio = nextScale / viewport.scale;
  return {
    scale: nextScale,
    x: focalPoint.x - scaleRatio * (focalPoint.x - viewport.x),
    y: focalPoint.y - scaleRatio * (focalPoint.y - viewport.y),
  };
}

interface ImageZoomDialogProps {
  images: readonly ProductImage[];
  initialIndex: number;
  shirtImageCount: number;
  productName: string;
  onClose: () => void;
}

export function ImageZoomDialog({
  images,
  initialIndex,
  shirtImageCount,
  productName,
  onClose,
}: ImageZoomDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [viewport, setViewport] = useState(() =>
    getInitialViewport(initialIndex, shirtImageCount),
  );
  const activeImage = images[activeIndex];
  const lastIndex = images.length - 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  function showImage(index: number) {
    const nextIndex = Math.min(lastIndex, Math.max(0, index));
    setActiveIndex(nextIndex);
    setViewport(getInitialViewport(nextIndex, shirtImageCount));
  }

  function showPreviousImage() {
    showImage(activeIndex - 1);
  }

  function showNextImage() {
    showImage(activeIndex + 1);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const focalPoint = {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
    setViewport((current) =>
      zoomAtPoint(
        current,
        clampZoom(current.scale - event.deltaY * WHEEL_ZOOM_SENSITIVITY),
        focalPoint,
      ),
    );
  }

  function changeZoom(amount: number) {
    setViewport((current) =>
      zoomAtPoint(current, clampZoom(current.scale + amount), { x: 0, y: 0 }),
    );
  }

  if (!activeImage) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="image-zoom"
      aria-label={`Fullscreen images of ${productName}`}
      aria-describedby="image-zoom-instructions"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          showPreviousImage();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          showNextImage();
        }
      }}
    >
      <p className="visually-hidden" id="image-zoom-instructions">
        Use the mouse wheel or zoom controls to magnify the current image.
      </p>

      <button
        className="image-zoom__close"
        type="button"
        aria-label="Close fullscreen images"
        autoFocus
        onClick={() => dialogRef.current?.close()}
      >
        <CloseIcon />
      </button>

      <div className="image-zoom__stage" onWheel={handleWheel}>
        <img
          src={activeImage.url}
          width={activeImage.width}
          height={activeImage.height}
          alt={`${productName}, image ${activeIndex + 1} of ${images.length}`}
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            transformOrigin: "center",
          }}
        />
      </div>

      <div
        className="image-zoom__controls"
        role="group"
        aria-label="Image magnification"
      >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={viewport.scale <= MIN_ZOOM}
          onClick={() => changeZoom(-ZOOM_STEP)}
        >
          <MinusIcon />
        </button>
        <output aria-label="Current magnification">
          {Math.round(viewport.scale * 100)}%
        </output>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={viewport.scale >= MAX_ZOOM}
          onClick={() => changeZoom(ZOOM_STEP)}
        >
          <PlusIcon />
        </button>
      </div>

      {images.length > 1 ? (
        <nav
          className="image-zoom__navigation"
          aria-label="Fullscreen image navigation"
        >
          <button
            className="image-zoom__arrow image-zoom__arrow--previous"
            type="button"
            aria-label="Previous image"
            disabled={activeIndex === 0}
            onClick={showPreviousImage}
          >
            <LeftArrowIcon />
          </button>
          <button
            className="image-zoom__arrow image-zoom__arrow--next"
            type="button"
            aria-label="Next image"
            disabled={activeIndex === lastIndex}
            onClick={showNextImage}
          >
            <RightArrowIcon />
          </button>
          <div className="image-zoom__dots" aria-label="Choose image">
            {images.map((image, index) => (
              <button
                type="button"
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                key={image.id}
                onClick={() => showImage(index)}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </dialog>
  );
}
