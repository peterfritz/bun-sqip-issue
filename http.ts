import sharp from "sharp";
import { sqip } from "sqip";

export const resizeImage = async (image: Buffer) => {
  const source = sharp(image);

  const metadata = await source.metadata();

  const isFlipped = (metadata.orientation || 0) >= 5;

  const width = isFlipped ? metadata.height : metadata.width;

  const height = isFlipped ? metadata.width : metadata.height;

  if (!width || !height) {
    throw new Error("Invalid image");
  }

  const sizes = {
    micro: 200,
    small: Math.round(width * 0.4),
    medium: Math.round(width * 0.6),
    large: Math.round(width * 0.8),
    full: width,
  };

  const [microImage, smallImage, mediumImage, largeImage, fullImage] =
    await Promise.all([
      source
        .clone()
        .resize(sizes.micro)
        .jpeg({
          quality: 50,
        })
        .toBuffer(),
      source
        .clone()
        .resize(sizes.small)
        .jpeg({
          quality: 100,
          chromaSubsampling: "4:4:4",
        })
        .toBuffer(),
      source
        .clone()
        .resize(sizes.medium)
        .jpeg({
          quality: 100,
          chromaSubsampling: "4:4:4",
        })
        .toBuffer(),
      source
        .clone()
        .resize(sizes.large)
        .jpeg({
          quality: 100,
          chromaSubsampling: "4:4:4",
        })
        .toBuffer(),
      source
        .clone()
        .jpeg({
          quality: 100,
          chromaSubsampling: "4:4:4",
        })
        .toBuffer(),
    ]);

  return {
    microImage,
    smallImage,
    mediumImage,
    largeImage,
    fullImage,
  };
};

export const generatePrimitive = async (image: Buffer): Promise<Buffer> => {
  const result = await sqip({
    input: image,
    outputFileName: "image.svg",
    plugins: [
      {
        name: "primitive",
        options: {
          numberOfPrimitives: 50,
          mode: 1,
        },
      },
      "svgo",
    ],
  });

  console.log(result);

  if (Array.isArray(result)) {
    throw new Error();
  }

  return result.content;
};

export const generateVariations = async ({
  imageUrl,
}: {
  imageUrl: string;
}) => {
  let source: Buffer | null = null;

  if (imageUrl) {
    console.time("fetch");

    const imageArrayBuffer = await fetch(imageUrl).then((res) =>
      res.arrayBuffer()
    );

    source = Buffer.from(imageArrayBuffer);

    console.timeEnd("fetch");
  }

  if (!source) {
    throw new Error("Invalid image");
  }

  console.time("resize");

  const resized = await resizeImage(source);

  const primitive = await generatePrimitive(source);

  console.log({
    fileSizes: {
      source: source.length,
      small: resized.smallImage.length,
      medium: resized.mediumImage.length,
      large: resized.largeImage.length,
      full: resized.fullImage.length,
      primitive: primitive.length,
    },
  });

  return {
    resized,
    primitive,
  };
};

const server = Bun.serve({
  port: 3000,
  fetch: async (request) => {
    const result = await generateVariations({
      imageUrl:
        "https://unsplash.com/photos/yvR9V-RAz7E/download?ixid=M3wxMjA3fDB8MXxhbGx8MzR8fHx8fHx8fDE3MzQzOTQwNzd8&force=true&w=2400",
    });

    return new Response(result.primitive.toString(), {
      headers: {
        "content-type": "image/svg+xml",
      },
    });
  },
});

console.log(`Listening on localhost:${server.port}`);
