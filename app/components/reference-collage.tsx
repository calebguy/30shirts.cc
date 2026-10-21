import type { ProductImage } from "../lib/fourthwall";

const THUMBNAIL_REFERENCE_INDEX = 2;
const MAX_COLLAGE_IMAGES = 4;

interface ReferenceImagesProps {
  images: readonly ProductImage[];
  loading?: "eager" | "lazy";
}

export function ReferenceCollage({ images, loading }: ReferenceImagesProps) {
  if (images.length <= THUMBNAIL_REFERENCE_INDEX) {
    return null;
  }

  const firstIndex =
    images.length > THUMBNAIL_REFERENCE_INDEX + 1
      ? THUMBNAIL_REFERENCE_INDEX + 1
      : THUMBNAIL_REFERENCE_INDEX;
  const references = [];
  for (
    let index = firstIndex;
    index < images.length && index < firstIndex + MAX_COLLAGE_IMAGES;
    index++
  ) {
    const image = images[index];
    references.push(
      <img
        src={image.url}
        width={image.width}
        height={image.height}
        alt=""
        decoding="async"
        loading={loading}
        key={image.id}
      />,
    );
  }

  return (
    <span className="reference-collage" aria-hidden="true">
      {references}
    </span>
  );
}

export function ThumbnailBackground({ images, loading }: ReferenceImagesProps) {
  const image = images[THUMBNAIL_REFERENCE_INDEX];
  if (!image) {
    return null;
  }

  return (
    <span className="thumbnail-background" aria-hidden="true">
      <img
        src={image.url}
        width={image.width}
        height={image.height}
        alt=""
        decoding="async"
        loading={loading}
      />
    </span>
  );
}
