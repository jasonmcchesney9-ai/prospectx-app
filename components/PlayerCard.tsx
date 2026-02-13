import Link from "next/link";
import { User, MapPin } from "lucide-react";
import type { Player } from "@/types/api";

export default function PlayerCard({ player }: { player: Player }) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="block bg-white rounded-lg border border-border p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {player.image_url ? (
            <div className="w-10 h-10 rounded-full overflow-hidden bg-navy/10 shrink-0">
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${player.image_url}`}
                alt={`${player.first_name} ${player.last_name}`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
              <User size={18} className="text-navy" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-navy text-sm">
              {player.first_name} {player.last_name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
              {player.current_team && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {player.current_team}
                </span>
              )}
              {player.current_league && (
                <span className="text-navy/40">|</span>
              )}
              {player.current_league && (
                <span>{player.current_league}</span>
              )}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal border border-teal/20 font-oswald tracking-wide">
          {player.position}
        </span>
      </div>
    </Link>
  );
}
