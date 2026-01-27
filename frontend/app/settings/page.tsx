"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Upload, Save, Loader2, Image as ImageIcon, Link as LinkIcon, 
  User, Lock, Bell, LogOut 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  // Данные формы Профиля
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState(""); // Добавим для отображения в Аккаунте
  
  // Файлы
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);

  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [currentHeader, setCurrentHeader] = useState<string | null>(null);

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // 1. ЗАГРУЗКА ДАННЫХ
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      router.push("/login");
      return;
    }
    setToken(storedToken);

    fetch(`${API_URL}/api/v1/users/me`, {
        headers: { "Authorization": `Bearer ${storedToken}` }
    })
    .then(res => res.json())
    .then(data => {
        setUsername(data.username);
        setFullName(data.full_name || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
        setEmail(data.email || ""); // Предполагаем, что email приходит с бэка
        
        if (data.avatar_url) {
            setCurrentAvatar(data.avatar_url.startsWith("http") ? data.avatar_url : `${API_URL}${data.avatar_url}`);
        }
        if (data.header_url) {
            setCurrentHeader(data.header_url.startsWith("http") ? data.header_url : `${API_URL}${data.header_url}`);
        }
    })
    .catch(err => console.error("Ошибка загрузки профиля", err));
  }, [router]);

  // 2. ХЕНДЛЕРЫ ФАЙЛОВ
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setHeaderFile(file);
      setHeaderPreview(URL.createObjectURL(file));
    }
  };

  // 3. ЛОГИКА ВЫХОДА
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
    router.refresh();
  };

  // 4. СОХРАНЕНИЕ ПРОФИЛЯ
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("full_name", fullName);
      formData.append("bio", bio);
      formData.append("website", website);
      
      if (avatarFile) formData.append("avatar_file", avatarFile);
      if (headerFile) formData.append("header_file", headerFile);

      const res = await fetch(`${API_URL}/api/v1/users/me`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error("Ошибка обновления");

      router.refresh();
      alert("Профиль успешно обновлен!");
      
    } catch (error) {
      alert("Не удалось сохранить изменения");
    } finally {
      setIsLoading(false);
    }
  };

  // Заглушка для сохранения пароля (пока нет API)
  const handlePasswordSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      alert("Смена пароля пока не реализована на сервере.");
  };

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Настройки</h1>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8">
        
        {/* === ЛЕВАЯ КОЛОНКА: МЕНЮ === */}
        <aside className="w-full md:w-64 shrink-0">
          <TabsList className="flex md:flex-col h-auto bg-transparent p-0 gap-2 w-full justify-start">
            <TabsTrigger 
              value="profile" 
              className="w-full justify-start gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"
            >
              <User className="w-4 h-4" /> Профиль
            </TabsTrigger>
            <TabsTrigger 
              value="account" 
              className="w-full justify-start gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"
            >
              <Lock className="w-4 h-4" /> Аккаунт
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="w-full justify-start gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"
            >
              <Bell className="w-4 h-4" /> Уведомления
            </TabsTrigger>
          </TabsList>
          
          <Separator className="my-4" />
          
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" /> Выйти
          </Button>
        </aside>

        {/* === ПРАВАЯ КОЛОНКА: КОНТЕНТ === */}
        <div className="flex-1">
            
          {/* --- ВКЛАДКА: ПРОФИЛЬ (РАБОТАЕТ) --- */}
          <TabsContent value="profile" className="mt-0 space-y-6">
            <form onSubmit={handleProfileSubmit}>
                
                {/* Изображения */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Изображения</CardTitle>
                        <CardDescription>Настройте внешний вид вашего профиля</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Шапка профиля</Label>
                            <div className="relative w-full h-40 bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border group cursor-pointer hover:border-primary/50 transition-colors">
                                {(headerPreview || currentHeader) && (
                                    <img src={headerPreview || currentHeader || ""} className="w-full h-full object-cover" alt="Header" />
                                )}
                                <label htmlFor="header-upload" className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                    <ImageIcon className="w-8 h-8 mb-2" />
                                    <span className="text-sm font-medium">Изменить обложку</span>
                                    <Input id="header-upload" type="file" accept="image/*" className="hidden" onChange={handleHeaderChange} />
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative group cursor-pointer">
                                <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
                                    <AvatarImage src={avatarPreview || currentAvatar || ""} className="object-cover" />
                                    <AvatarFallback className="text-2xl">{username[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                     <Upload className="w-6 h-6" />
                                     <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                                </label>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-medium">Ваш аватар</h3>
                                <p className="text-sm text-muted-foreground">Нажмите на фото, чтобы изменить.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Текстовые поля */}
                <Card>
                    <CardHeader>
                        <CardTitle>Основная информация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullname">Имя (отображаемое)</Label>
                            <Input 
                                id="fullname" 
                                placeholder="Иван Иванов" 
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Никнейм</Label>
                            <Input value={`@${username}`} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="website">Веб-сайт</Label>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="website" 
                                    placeholder="https://t.me/username" 
                                    className="pl-9"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bio">О себе</Label>
                            <Textarea 
                                id="bio" 
                                placeholder="Пару слов о том, кто вы..." 
                                className="min-h-[100px]"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-6">
                    <Button type="submit" size="lg" disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Save className="w-4 h-4 mr-2" /> Сохранить профиль
                    </Button>
                </div>
            </form>
          </TabsContent>


          {/* --- ВКЛАДКА: АККАУНТ (ТОЛЬКО UI) --- */}
          <TabsContent value="account" className="mt-0 space-y-6">
             <Card>
              <CardHeader>
                <CardTitle>Безопасность</CardTitle>
                <CardDescription>Управляйте своим паролем и почтой.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} disabled className="bg-muted" />
                </div>
                <Separator />
                <div className="grid gap-2">
                  <Label htmlFor="current">Текущий пароль</Label>
                  <Input id="current" type="password" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new">Новый пароль</Label>
                  <Input id="new" type="password" />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
                <Button onClick={handlePasswordSubmit}>
                    <Save className="w-4 h-4 mr-2" /> Обновить пароль
                </Button>
            </div>
          </TabsContent>


          {/* --- ВКЛАДКА: УВЕДОМЛЕНИЯ (ТОЛЬКО UI) --- */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Предпочтения</CardTitle>
                <CardDescription>Выбери, о чем хочешь узнавать сразу.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="notif-likes" className="flex flex-col space-y-1">
                    <span>Лайки</span>
                    <span className="font-normal text-xs text-muted-foreground">Когда кто-то лайкает твой мем</span>
                  </Label>
                  <Switch id="notif-likes" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="notif-comments" className="flex flex-col space-y-1">
                    <span>Комментарии</span>
                    <span className="font-normal text-xs text-muted-foreground">Когда кто-то комментирует твой мем</span>
                  </Label>
                  <Switch id="notif-comments" defaultChecked />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="notif-follows" className="flex flex-col space-y-1">
                    <span>Новые подписчики</span>
                    <span className="font-normal text-xs text-muted-foreground">Когда кто-то подписывается на тебя</span>
                  </Label>
                  <Switch id="notif-follows" defaultChecked />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
                <Button onClick={() => alert("Настройки уведомлений сохранены (демо)")}>
                    <Save className="w-4 h-4 mr-2" /> Сохранить настройки
                </Button>
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}