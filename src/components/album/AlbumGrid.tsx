import AlbumCard from "./AlbumCard";
import type { Album } from "@/types/database";

interface AlbumGridProps {
  albums: Album[];
}

export default function AlbumGrid({ albums }: AlbumGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </div>
  );
}
