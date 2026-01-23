"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProfileSettingsButton({ username }: { username: string }) {
    const [isMe, setIsMe] = useState(false);

    useEffect(() => {
        // Проверяем, совпадает ли никнейм профиля с тем, под которым мы вошли
        const storedUsername = localStorage.getItem("username");
        if (storedUsername === username) {
            setIsMe(true);
        }
    }, [username]);

    if (!isMe) return null;

    return (
        <div className="absolute top-4 right-4">
            <Link href="/settings">
                <Button size="sm" variant="secondary" className="bg-black/40 backdrop-blur-md border-white/10 text-white hover:bg-black/60">
                    <Settings className="w-4 h-4 mr-2" /> Настройки
                </Button>
            </Link>
        </div>
    );
}