"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Room = { title: string; meetingCode: string; message: string; duration: string; active: boolean; date: string | null; time: string | null };

export default function LiveRoomPage() {
  const params = useParams<{ code: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Room>(`/meetings/room/${params.code}`).then(setRoom).catch((err: Error) => setError(err.message));
  }, [params.code]);

  if (error) {
    return (
      <PageChrome icon="fa-light fa-video" crumbs={[{ label: "Live Classes", href: "/admin/live" }, { label: "Room" }]}>
        <p className="text-sm text-red-600">{error}</p>
      </PageChrome>
    );
  }
  if (!room) {
    return (
      <PageChrome icon="fa-light fa-video" crumbs={[{ label: "Live Classes", href: "/admin/live" }, { label: "Room" }]}>
        <p className="text-sm text-[var(--esk-muted)]">Opening the room…</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-video"
      crumbs={[{ label: "Live Classes", href: "/admin/live" }, { label: room.title }]}
      actions={<Link className="esk-btn-ghost" href="/admin/live">Back</Link>}
    >
      <article className="esk-panel mx-auto max-w-xl">
        <p className="text-xs text-[var(--esk-muted)]">Meeting ID {room.meetingCode}</p>
        <h1 className="mt-1 text-2xl font-semibold">{room.title}</h1>
        <p className="mt-2 text-sm">{room.date} {room.time} · {room.duration}</p>
        {room.message ? <p className="mt-3 text-sm">{room.message}</p> : null}
        {room.active
          ? <p className="mt-4 text-sm text-[var(--esk-muted)]">The room is open in this tab. No video provider is connected.</p>
          : <p className="mt-4 text-sm text-[var(--esk-muted)]">This meeting is inactive.</p>}
      </article>
    </PageChrome>
  );
}
