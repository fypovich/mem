import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getFollowing(username: string) {
    try {
        const res = await fetch(`${API_URL}/api/v1/users/${username}/following`, { cache: "no-store" });
        if (!res.ok) return [];
        return res.json();
    } catch (e) {
        return [];
    }
}

export default async function FollowingPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    const following = await getFollowing(username);

    return (
        <div className="container max-w-2xl mx-auto py-6 px-4">
            <div className="flex items-center gap-4 mb-6">
                <Link href={`/user/${username}`}>
                    <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
                </Link>
                <h1 className="text-2xl font-bold">Подписки @{username}</h1>
            </div>

            <div className="space-y-4">
                {following.length > 0 ? (
                    following.map((user: any) => (
                        <Link href={`/user/${user.username}`} key={user.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors">
                            <Avatar>
                                <AvatarImage src={user.avatar_url ? `${API_URL}${user.avatar_url}` : undefined} />
                                <AvatarFallback>{user.username[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="font-semibold">{user.full_name || `@${user.username}`}</div>
                                {user.full_name && <div className="text-sm text-muted-foreground">@{user.username}</div>}
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-10">
                        Этот пользователь ни на кого не подписан 🤷‍♂️
                    </div>
                )}
            </div>
        </div>
    );
}