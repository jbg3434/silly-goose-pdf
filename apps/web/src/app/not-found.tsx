import Link from "next/link";
import { Gus } from "@/components/gus/Gus";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center gap-4 py-20 text-center">
      <Gus pose="alarmed" size={150} decorative />
      <h1 className="font-serif text-3xl">Page not found</h1>
      <p className="muted">Gus has honked at every page in the building. This one does not exist.</p>
      <Link href="/library" className="btn-primary">
        Back to the library
      </Link>
    </div>
  );
}
