import { redirect } from "next/navigation";
import { RadioExperience } from "@/features/radio/radio-experience";
import { authorizeSharedContent } from "@/lib/media/shared-content";
import { toPublicTrack } from "@/lib/radio/tracks";

export default async function RadioPage() {
  const authorized = await authorizeSharedContent("radio");
  if (!authorized) redirect("/?view=world");
  const { data } = await authorized.admin.from("radio_tracks").select("*").order("created_at", { ascending: true });
  const tracks = (data ?? []).map((track) => toPublicTrack(track, authorized.access.user.id));
  return <RadioExperience initialTracks={tracks} progress={{
    storybook: true,
    library: true,
    puzzles: true,
    radio: Boolean(authorized.progress.radio_completed_at),
  }} />;
}
