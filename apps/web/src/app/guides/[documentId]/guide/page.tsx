import { redirect } from "next/navigation";

// The canonical guide route is /guides/<id> — this alias forwards old links.
export default function GuideAlias({ params }: { params: { documentId: string } }) {
  redirect(`/guides/${params.documentId}`);
}
