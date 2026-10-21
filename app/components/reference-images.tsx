import { THUMBNAIL_IMAGE_INDEX, type ProductImage } from "../lib/fourthwall";

const FIRST_REFERENCE_IMAGE_INDEX = THUMBNAIL_IMAGE_INDEX + 1;

interface ThumbnailBackgroundProps {
  images: readonly ProductImage[];
  loading?: "eager" | "lazy";
}

export function ThumbnailBackground({
  images,
  loading,
}: ThumbnailBackgroundProps) {
  const image = images[THUMBNAIL_IMAGE_INDEX];
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

interface ReferenceSlidesProps {
  images: readonly ProductImage[];
  productName: string;
}

export function ReferenceSlides({ images, productName }: ReferenceSlidesProps) {
  const slides = [];
  for (let index = FIRST_REFERENCE_IMAGE_INDEX; index < images.length; index++) {
    const image = images[index];
    slides.push(
      <a
        className="product-focus__slide product-focus__slide--reference"
        href={image.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open reference image ${index - FIRST_REFERENCE_IMAGE_INDEX + 1} of ${productName} in a new tab`}
        key={image.id}
      >
        <img
          src={image.url}
          width={image.width}
          height={image.height}
          alt=""
          decoding="async"
          loading="lazy"
        />
      </a>,
    );
  }
  return slides;
}
