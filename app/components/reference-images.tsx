import {
  DARK_THUMBNAIL_IMAGE_INDEX,
  FIRST_REFERENCE_IMAGE_INDEX,
  LIGHT_THUMBNAIL_IMAGE_INDEX,
  type ProductImage,
} from "../lib/fourthwall";

interface ThumbnailBackgroundProps {
  images: readonly ProductImage[];
  loading?: "eager" | "lazy";
}

export function ThumbnailBackground({
  images,
  loading,
}: ThumbnailBackgroundProps) {
  const lightImage = images[LIGHT_THUMBNAIL_IMAGE_INDEX];
  const darkImage = images[DARK_THUMBNAIL_IMAGE_INDEX];
  const fallbackImage = lightImage ?? darkImage;
  if (!fallbackImage) {
    return null;
  }

  return (
    <span className="thumbnail-background" aria-hidden="true">
      <picture>
        {darkImage ? (
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={darkImage.url}
          />
        ) : null}
        <img
          src={fallbackImage.url}
          width={fallbackImage.width}
          height={fallbackImage.height}
          alt=""
          decoding="async"
          loading={loading}
        />
      </picture>
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
