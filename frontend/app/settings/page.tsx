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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
      full_name: "",
      bio: "",
      website: ""
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);

  const [passData, setPassData] = useState({ current: "", new: "", confirm: "" });

  // 1. ЗАГРУЗКА ДАННЫХ
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      router.push("/login");
      return;
    }
    setToken(storedToken);

    // Добавлено: cache: "no-store" и timestamp для избежания кэша
    fetch(`${API_URL}/api/v1/users/me?ts=${Date.now()}`, {
        headers: { "Authorization": `Bearer ${storedToken}` },
        cache: "no-store" 
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
    })
    .then(data => {
        setUser(data);
        setFormData({
            full_name: data.full_name || "",
            bio: data.bio || "",
            website: data.website || ""
        });
    })
    .catch(() => router.push("/login"))
    .finally(() => setIsLoading(false));
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'header') => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      if (type === 'avatar') {
          setAvatarFile(file);
          setAvatarPreview(preview);
      } else {
          setHeaderFile(file);
          setHeaderPreview(preview);
      }
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const form = new FormData();
      form.append("full_name", formData.full_name);
      form.append("bio", formData.bio);
      form.append("website", formData.website);
      
      if (avatarFile) form.append("avatar_file", avatarFile);
      if (headerFile) form.append("header_file", headerFile);

      const res = await fetch(`${API_URL}/api/v1/users/me`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
        body: form
      });

      if (!res.ok) throw new Error();

      const updatedUser = await res.json();
      setUser(updatedUser);
      alert("Профиль обновлен!");
      router.refresh();
      
    } catch (error) {
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (passData.new !== passData.confirm) {
          alert("Пароли не совпадают");
          return;
      }
      setIsSaving(true);
      try {
          const res = await fetch(`${API_URL}/api/v1/users/me/password`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}` 
              },
              body: JSON.stringify({
                  current_password: passData.current,
                  new_password: passData.new
              })
          });
          if (res.ok) {
              alert("Пароль успешно изменен");
              setPassData({ current: "", new: "", confirm: "" });
          } else {
              const err = await res.json();
              alert(err.detail || "Ошибка");
          }
      } catch (e) {
          alert("Ошибка соединения");
      } finally {
          setIsSaving(false);
      }
  };

  // 5. УВЕДОМЛЕНИЯ
  const toggleNotification = async (key: string, value: boolean) => {
      // Сохраняем предыдущее состояние для отката
      const prevUser = { ...user };
      
      // Оптимистичное обновление
      setUser((prev: any) => ({ ...prev, [key]: value }));
      
      try {
          const res = await fetch(`${API_URL}/api/v1/users/me/settings`, {
              method: "PATCH",
              headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}` 
              },
              body: JSON.stringify({ [key]: value })
          });
          
          if (!res.ok) throw new Error("Failed to update");
          
          // Обновляем состояние данными с сервера, чтобы убедиться
          const updatedUser = await res.json();
          setUser(updatedUser);

      } catch (e) {
          console.error(e);
          setUser(prevUser); // Откат при ошибке
          alert("Не удалось сохранить настройку");
      }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
    router.refresh();
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  const avatarUrl = avatarPreview || (user?.avatar_url?.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`);
  const headerUrl = headerPreview || (user?.header_url?.startsWith('http') ? user.header_url : `${API_URL}${user.header_url}`);

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Настройки</h1>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8">
        
        <aside className="w-full md:w-64 shrink-0">
          <TabsList className="flex md:flex-col h-auto bg-transparent p-0 gap-2 w-full justify-start">
            <TabsTrigger value="profile" className="w-full justify-start gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent">
              <User className="w-4 h-4" /> Профиль
            </TabsTrigger>
            <TabsTrigger value="account" className="w-full justify-start gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent">
              <Lock className="w-4 h-4" /> Аккаунт и Пароль
            </TabsTrigger>
            <TabsTrigger value="notifications" className="w-full justify-start gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent">
              <Bell className="w-4 h-4" /> Уведомления
            </TabsTrigger>
          </TabsList>
          
          <Separator className="my-4" />
          
          <Button variant="ghost" className="w-full justify-start gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Выйти
          </Button>
        </aside>

        <div className="flex-1">
            
          <TabsContent value="profile" className="mt-0 space-y-6">
            <form onSubmit={handleProfileSubmit}>
                <Card className="mb-6">
                    <CardHeader><CardTitle>Изображения</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Шапка</Label>
                            <div className="relative w-full h-40 bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border group cursor-pointer hover:border-primary/50 transition-colors">
                                {headerUrl && <img src={headerUrl} className="w-full h-full object-cover" />}
                                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                    <ImageIcon className="w-8 h-8 mb-2" />
                                    <span className="text-sm">Изменить</span>
                                    <Input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'header')} />
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative group cursor-pointer">
                                <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
                                    <AvatarImage src={avatarUrl} className="object-cover" />
                                    <AvatarFallback>{user?.username?.[0]}</AvatarFallback>
                                </Avatar>
                                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                     <Upload className="w-6 h-6" />
                                     <Input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'avatar')} />
                                </label>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-medium">Ваш аватар</h3>
                                <p className="text-sm text-muted-foreground">JPG, PNG или GIF. Макс. 2MB.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Основная информация</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Имя</Label>
                            <Input value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Никнейм</Label>
                            <Input value={`@${user?.username}`} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <Label>О себе</Label>
                            <Textarea value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Сайт</Label>
                            <Input value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} placeholder="https://" />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-6">
                    <Button type="submit" size="lg" disabled={isSaving}>
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Сохранить
                    </Button>
                </div>
            </form>
          </TabsContent>

          <TabsContent value="account" className="mt-0 space-y-6">
             <Card>
              <CardHeader>
                <CardTitle>Безопасность</CardTitle>
                <CardDescription>Изменение пароля и email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={user?.email} disabled className="bg-muted" />
                </div>
                <Separator />
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Текущий пароль</Label>
                        <Input type="password" value={passData.current} onChange={(e) => setPassData({...passData, current: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Новый пароль</Label>
                        <Input type="password" value={passData.new} onChange={(e) => setPassData({...passData, new: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Подтвердите новый пароль</Label>
                        <Input type="password" value={passData.confirm} onChange={(e) => setPassData({...passData, confirm: e.target.value})} />
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Сменить пароль
                        </Button>
                    </div>
                </form>
              </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Настройки уведомлений</CardTitle>
                <CardDescription>Что вы хотите получать?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                    { id: 'notify_on_like', label: 'Лайки', desc: 'Кто-то лайкнул ваш мем' },
                    { id: 'notify_on_comment', label: 'Комментарии', desc: 'Новый комментарий под постом' },
                    { id: 'notify_on_new_follower', label: 'Подписки', desc: 'У вас новый подписчик' },
                    { id: 'notify_on_new_meme', label: 'Новые мемы', desc: 'Кто-то из подписок выложил мем' },
                ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between space-x-2">
                        <Label htmlFor={item.id} className="flex flex-col space-y-1">
                            <span>{item.label}</span>
                            <span className="font-normal text-xs text-muted-foreground">{item.desc}</span>
                        </Label>
                        <Switch 
                            id={item.id} 
                            // Важно: проверяем наличие поля, если нет - считаем true
                            checked={user?.[item.id] !== undefined ? user[item.id] : true} 
                            onCheckedChange={(c) => toggleNotification(item.id, c)}
                        />
                    </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}