import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { session } from "@/lib/session";
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { db } = await session();
        const payload = z
          .object({ space: z.uuid(), id: z.uuid() })
          .parse(JSON.parse(clientPayload ?? "{}"));
        if (pathname !== `${payload.space}/${payload.id}`)
          throw new Error("Ruta de archivo inválida");
        const { data, error } = await db.rpc("can_access_space", {
          s: payload.space,
        });
        if (error || !data) throw new Error("No autorizado");
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/avif",
            "application/pdf",
          ],
          maximumSizeInBytes: 10485760,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async () => {
        /* Registration is verified by completeAssetAction after the client upload. */
      },
    });
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "No se pudo autorizar la subida" },
      { status: 403 },
    );
  }
}
