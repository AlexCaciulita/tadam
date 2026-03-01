import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing media id" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterId = authData.user.id;

    const [{ data: requesterProfile, error: requesterProfileError }, { data: mediaRow, error: mediaError }] =
      await Promise.all([
        supabase.from("profiles").select("id, role").eq("id", requesterId).maybeSingle(),
        supabase
          .from("media")
          .select("id, album_id, storage_provider, storage_key")
          .eq("id", id)
          .maybeSingle(),
      ]);

    if (requesterProfileError) throw requesterProfileError;
    if (mediaError) throw mediaError;
    if (!mediaRow) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const isAdmin = requesterProfile?.role === "platform_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (mediaRow.storage_provider === "r2" && mediaRow.storage_key) {
      try {
        await deleteObject(mediaRow.storage_key);
      } catch (r2Error) {
        console.warn("R2 object delete failed, continuing DB delete", r2Error);
      }
    }

    const { error: deleteMediaError } = await supabase.from("media").delete().eq("id", id);
    if (deleteMediaError) throw deleteMediaError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete media", error);
    const message =
      error instanceof Error && error.message ? error.message : "Failed to delete media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
