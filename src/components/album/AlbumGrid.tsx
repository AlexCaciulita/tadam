import AlbumCard from "./AlbumCard";
import type { Album } from "@/types/database";

interface AlbumGridProps {
  albums: Album[];
}

export default function AlbumGrid({ albums }: AlbumGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-5">
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </div>
  );
}
