import { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = '/api';

        // Icons
        const Icons = {
            Trophy: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" /></svg>,
            ChartBar: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
            Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>,
            Cog: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
            Plus: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
            Refresh: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>,
            Check: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>,
            Clock: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
            User: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
            History: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
            Snowflake: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3M3 12h18M3 12l3-3m-3 3l3 3m15-3l-3-3m3 3l-3 3M7.5 7.5l9 9m-9 0l9-9" /></svg>,
            Menu: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>,
        };

        // Avatar Icons (Heroicons) - stored per player in localStorage
        const AvatarIcons = {
            User: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
            Star: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>,
            Bolt: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>,
            Fire: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /></svg>,
            Heart: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>,
            Rocket: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg>,
            Trophy: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" /></svg>,
            Crown: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full p-1"><path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z" /></svg>,
            Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>,
            Face: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" /></svg>,
            Cube: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-full h-full p-1"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>,
            Target: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full p-1"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
        };
        const avatarIconList = Object.keys(AvatarIcons);

        // Get player's avatar from localStorage
        // Global avatar cache (loaded from database via players)
        let playerAvatarCache = {};

        const setAvatarCache = (players) => {
            if (Array.isArray(players)) {
                players.forEach(p => {
                    if (p.avatar) playerAvatarCache[p.name] = p.avatar;
                });
            }
        };

        const getPlayerAvatar = (name) => {
            if (!name) return null;
            // Check database cache first, then localStorage fallback
            if (playerAvatarCache[name]) return playerAvatarCache[name];
            const avatars = JSON.parse(localStorage.getItem('pingpong_avatars') || '{}');
            return avatars[name] || null;
        };

        // Save player's avatar to database and localStorage
        const savePlayerAvatar = async (name, iconName) => {
            // Save to localStorage for immediate feedback
            const avatars = JSON.parse(localStorage.getItem('pingpong_avatars') || '{}');
            if (iconName) {
                avatars[name] = iconName;
                playerAvatarCache[name] = iconName;
            } else {
                delete avatars[name];
                delete playerAvatarCache[name];
            }
            localStorage.setItem('pingpong_avatars', JSON.stringify(avatars));

            // Save to database
            try {
                await fetch(`${API_BASE}/players/${encodeURIComponent(name)}/avatar`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: iconName || null })
                });
            } catch (e) {
                console.error('Failed to save avatar to database:', e);
            }
        };

        // Player Avatar
        function PlayerAvatar({ name, size = 'md', onClick }) {
            const avatarIcon = getPlayerAvatar(name);
            const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
            const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
            const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
            const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' };

            const IconComponent = avatarIcon ? AvatarIcons[avatarIcon] : null;

            return (
                <div
                    className={`${sizes[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-white/50' : ''}`}
                    onClick={onClick}
                    title={onClick ? 'Click to change avatar' : name}
                >
                    {IconComponent ? <IconComponent /> : initials}
                </div>
            );
        }

        // Avatar Picker Modal
        function AvatarPicker({ playerName, onClose, onSelect }) {
            const currentAvatar = getPlayerAvatar(playerName);
            const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
            const colorIndex = playerName ? playerName.charCodeAt(0) % colors.length : 0;

            const handleSelect = async (iconName) => {
                await savePlayerAvatar(playerName, iconName);
                onSelect?.(iconName);
                onClose();
            };

            const handleClear = async () => {
                await savePlayerAvatar(playerName, null);
                onSelect?.(null);
                onClose();
            };

            return (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
                    <div className="bg-gray-100 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-2 text-center">Choose Avatar</h3>
                        <p className="text-sm text-gray-500 text-center mb-4">{playerName}</p>

                        <div className="grid grid-cols-6 gap-3 mb-4">
                            {avatarIconList.map(iconName => {
                                const IconComponent = AvatarIcons[iconName];
                                const isSelected = currentAvatar === iconName;
                                return (
                                    <button
                                        key={iconName}
                                        onClick={() => handleSelect(iconName)}
                                        className={`w-12 h-12 ${colors[colorIndex]} rounded-full flex items-center justify-center text-white transition-all ${isSelected ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                                        title={iconName}
                                    >
                                        <IconComponent />
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleClear} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">
                                Use Initials
                            </button>
                            <button onClick={onClose} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // Swap Zone Icons (Heroicons)
        const SwapIcons = {
            Warning: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>,
            ArrowDown: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>,
            ArrowUp: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>,
            Bolt: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>,
            ArrowsUpDown: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" /></svg>,
        };

        // Swap Zone Banner (F1-style elimination/promotion zone)
        function SwapZoneBanner({ swapZone }) {
            if (!swapZone?.active) return null;

            return (
                <div className="bg-gradient-to-r from-red-100 via-gray-100 to-green-100 border border-gray-300 rounded-xl p-4 mb-6 animate-slideIn">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="text-amber-600"><SwapIcons.ArrowsUpDown /></div>
                            <h3 className="text-lg font-bold text-white">MID-SEASON SWAP ZONE</h3>
                            <div className="text-amber-600"><SwapIcons.Warning /></div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">Week {swapZone.currentWeek} of {swapZone.midSeasonWeek * 2}</div>
                            <div className={`font-bold ${swapZone.weeksRemaining <= 2 ? 'text-red-500 animate-pulse' : 'text-amber-600'}`}>
                                {swapZone.weeksRemaining} week(s) until swap!
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Relegation Zone */}
                        <div className="bg-rose-900/30 border border-rose-600/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="text-red-500"><SwapIcons.ArrowDown /></div>
                                <span className="font-bold text-red-500 uppercase tracking-wide text-sm">RELEGATION ZONE</span>
                            </div>
                            <p className="text-xs text-rose-300/70 mb-2">Bottom 3 of Group A move DOWN to Group B</p>
                            <div className="space-y-1">
                                {swapZone.relegationZone?.map(player => (
                                    <div key={player.name} className="flex items-center justify-between bg-rose-900/40 rounded px-2 py-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-red-500 font-bold">#{player.rank}</span>
                                            <PlayerAvatar name={player.name} size="sm" />
                                            <span className="text-sm text-white">{player.name}</span>
                                        </div>
                                        <span className="text-xs text-rose-300">{player.wins}W-{player.losses}L</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Promotion Zone */}
                        <div className="bg-emerald-900/30 border border-emerald-600/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="text-green-600"><SwapIcons.ArrowUp /></div>
                                <span className="font-bold text-green-600 uppercase tracking-wide text-sm">PROMOTION ZONE</span>
                            </div>
                            <p className="text-xs text-emerald-300/70 mb-2">Top 3 of Group B move UP to Group A</p>
                            <div className="space-y-1">
                                {swapZone.promotionZone?.map(player => (
                                    <div key={player.name} className="flex items-center justify-between bg-emerald-900/40 rounded px-2 py-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600 font-bold">#{player.rank}</span>
                                            <PlayerAvatar name={player.name} size="sm" />
                                            <span className="text-sm text-white">{player.name}</span>
                                        </div>
                                        <span className="text-xs text-emerald-300">{player.wins}W-{player.losses}L</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bubble Players */}
                    {swapZone.bubble?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="text-amber-600"><SwapIcons.Bolt /></div>
                                <span className="text-sm font-semibold text-amber-600">ON THE BUBBLE</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {swapZone.bubble.map(player => (
                                    <div key={player.name} className="flex items-center gap-2 bg-amber-900/30 border border-amber-600/50 rounded px-2 py-1 text-sm">
                                        <span className="text-amber-600">#{player.rank} G{player.group}</span>
                                        <span className="text-white">{player.name}</span>
                                        <span className="text-xs text-amber-300">- {player.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Standings Table
        function StandingsTable({ standings, groupName, groupLabel }) {
            const sorted = useMemo(() => {
                // Tiebreaker rules:
                // 1. Most match wins
                // 2. Point differential (games won - games lost)
                // 3. Most total games won (pointsFor)
                // 4. Fewest games lost (pointsAgainst)
                return Object.entries(standings || {})
                    .map(([name, stats]) => ({ name, ...stats }))
                    .sort((a, b) => {
                        if (b.wins !== a.wins) return b.wins - a.wins;
                        const diffA = a.pointsFor - a.pointsAgainst;
                        const diffB = b.pointsFor - b.pointsAgainst;
                        if (diffB !== diffA) return diffB - diffA;
                        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
                        return a.pointsAgainst - b.pointsAgainst;
                    });
            }, [standings]);

            return (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-900">
                        <span className={groupName === 'A' ? 'text-purple-600' : 'text-amber-500'}>●</span>
                        Group {groupName}: {groupLabel}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-200 bg-gray-50">
                                    <th className="text-left py-2 px-2">#</th>
                                    <th className="text-left py-2 px-2">Player</th>
                                    <th className="text-center py-2 px-2">W</th>
                                    <th className="text-center py-2 px-2">L</th>
                                    <th className="text-center py-2 px-2">PF</th>
                                    <th className="text-center py-2 px-2">PA</th>
                                    <th className="text-center py-2 px-2">Diff</th>
                                    <th className="text-center py-2 px-2">Streak</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((player, idx) => (
                                    <tr key={player.name} className={`border-b border-gray-100 ${idx < 4 ? 'bg-purple-50' : ''}`}>
                                        <td className="py-2 px-2">
                                            <span className={idx < 4 ? 'text-purple-600 font-bold' : 'text-gray-400'}>{idx + 1}</span>
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="flex items-center gap-2">
                                                <PlayerAvatar name={player.name} size="sm" />
                                                <span className="font-medium text-gray-900">{player.name}</span>
                                                {player.promotedFrom === 'B' && <span className="text-xs bg-green-100 text-green-700 px-1 rounded" title="Promoted from Group B">⬆️</span>}
                                                {player.promotedFrom === 'A' && <span className="text-xs bg-red-100 text-red-700 px-1 rounded" title="Moved from Group A">⬇️</span>}
                                            </div>
                                        </td>
                                        <td className="text-center py-2 px-2 text-green-600 font-semibold">{player.wins}</td>
                                        <td className="text-center py-2 px-2 text-red-500">{player.losses}</td>
                                        <td className="text-center py-2 px-2 text-gray-700">{player.pointsFor}</td>
                                        <td className="text-center py-2 px-2 text-gray-700">{player.pointsAgainst}</td>
                                        <td className="text-center py-2 px-2">
                                            <span className={player.pointsFor - player.pointsAgainst >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                {player.pointsFor - player.pointsAgainst >= 0 ? '+' : ''}{player.pointsFor - player.pointsAgainst}
                                            </span>
                                        </td>
                                        <td className="text-center py-2 px-2">
                                            {player.streak > 0 && <span className="text-green-600">W{player.streak}</span>}
                                            {player.streak < 0 && <span className="text-red-500">L{Math.abs(player.streak)}</span>}
                                            {player.streak === 0 && <span className="text-gray-400">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Top 4 advance to playoffs</p>
                </div>
            );
        }

        // Weekly Matches
        function WeeklyMatches({ matches, week, onRecordResult }) {
            const [selectedMatch, setSelectedMatch] = useState(null);
            const [winner, setWinner] = useState(null);
            const [score1, setScore1] = useState('');
            const [score2, setScore2] = useState('');

            const handleSubmit = () => {
                if (!winner) return;
                const s1 = parseInt(score1) || 0;
                const s2 = parseInt(score2) || 0;
                // Validate best of 3: winner needs 2 wins, max score is 2-1 or 2-0
                if (Math.max(s1, s2) > 2 || (s1 === 2 && s2 === 2)) {
                    alert('Best of 3: Winner needs 2 wins. Valid scores: 2-0, 2-1');
                    return;
                }
                const loser = winner === selectedMatch.player1 ? selectedMatch.player2 : selectedMatch.player1;
                onRecordResult(selectedMatch.id, winner, loser, s1, s2);
                setSelectedMatch(null);
                setWinner(null);
                setScore1('');
                setScore2('');
            };

            return (
                <div className="space-y-2">
                    {matches.map(match => (
                        <div key={match.id} className={`flex items-center justify-between p-3 rounded-lg ${match.completed ? 'bg-gray-100/50' : 'bg-gray-100'}`}>
                            <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center gap-2 flex-1">
                                    <PlayerAvatar name={match.player1} size="sm" />
                                    <span className={match.winner === match.player1 ? 'text-green-600 font-semibold' : ''}>{match.player1}</span>
                                </div>
                                <div className="text-gray-500 text-sm">vs</div>
                                <div className="flex items-center gap-2 flex-1 justify-end">
                                    <span className={match.winner === match.player2 ? 'text-green-600 font-semibold' : ''}>{match.player2}</span>
                                    <PlayerAvatar name={match.player2} size="sm" />
                                </div>
                            </div>
                            <div className="ml-4 w-24 text-right">
                                {match.completed ? (
                                    <span className="text-green-600 font-semibold">{match.score1} - {match.score2}</span>
                                ) : (
                                    <button onClick={() => setSelectedMatch(match)} className="text-xs bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-lg">
                                        Record
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Record Result Modal */}
                    {selectedMatch && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMatch(null)}>
                            <div className="bg-gray-100 rounded-xl p-6 max-w-sm w-full animate-slideIn" onClick={e => e.stopPropagation()}>
                                <h3 className="text-lg font-bold mb-4 text-center">Record Result</h3>
                                <p className="text-center text-gray-500 mb-4">{selectedMatch.player1} vs {selectedMatch.player2}</p>

                                <div className="mb-4">
                                    <p className="text-sm text-gray-500 mb-2">Who won?</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[selectedMatch.player1, selectedMatch.player2].map(p => (
                                            <button key={p} onClick={() => setWinner(p)} className={`p-3 rounded-lg transition ${winner === p ? 'bg-emerald-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                                <PlayerAvatar name={p} size="sm" />
                                                <div className="mt-1 text-sm font-medium">{p}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm text-gray-500 mb-2">Score (Best of 3: 2-0 or 2-1)</p>
                                    <div className="flex items-center justify-center gap-4">
                                        <input type="number" min="0" max="2" value={score1} onChange={e => setScore1(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                        <span className="text-gray-500">-</span>
                                        <input type="number" min="0" max="2" value={score2} onChange={e => setScore2(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                    </div>
                                </div>

                                <button onClick={handleSubmit} disabled={!winner} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-500 rounded-lg font-semibold">
                                    Save Result
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Playoff Bracket
        function PlayoffBracket({ playoff, groupName, onRecordResult }) {
            if (!playoff) return null;

            const MatchCard = ({ match, label }) => {
                const [showModal, setShowModal] = useState(false);
                const [winner, setWinner] = useState(null);
                const [score1, setScore1] = useState('');
                const [score2, setScore2] = useState('');

                const handleSubmit = () => {
                    if (!winner) return;
                    const s1 = parseInt(score1) || 0;
                    const s2 = parseInt(score2) || 0;
                    // Validate best of 3: winner needs 2 wins, max score is 2-1 or 2-0
                    if (Math.max(s1, s2) > 2 || (s1 === 2 && s2 === 2)) {
                        alert('Best of 3: Winner needs 2 wins. Valid scores: 2-0, 2-1');
                        return;
                    }
                    const loser = winner === match.player1 ? match.player2 : match.player1;
                    onRecordResult(match.id, winner, loser, s1, s2);
                    setShowModal(false);
                };

                const canPlay = match.player1 && match.player2 && !match.completed;

                return (
                    <div className="bg-gray-100 rounded-lg p-3 w-48">
                        <div className="text-xs text-gray-500 mb-2">{label}</div>
                        <div className={`flex items-center gap-2 mb-1 ${match.winner === match.player1 ? 'text-green-600' : ''}`}>
                            {match.player1 ? <><PlayerAvatar name={match.player1} size="sm" /><span className="text-sm truncate">{match.player1}</span></> : <span className="text-gray-500 italic text-sm">TBD</span>}
                            {match.seed1 && <span className="text-xs text-gray-500">#{match.seed1}</span>}
                        </div>
                        <div className={`flex items-center gap-2 ${match.winner === match.player2 ? 'text-green-600' : ''}`}>
                            {match.player2 ? <><PlayerAvatar name={match.player2} size="sm" /><span className="text-sm truncate">{match.player2}</span></> : <span className="text-gray-500 italic text-sm">TBD</span>}
                            {match.seed2 && <span className="text-xs text-gray-500">#{match.seed2}</span>}
                        </div>
                        {match.completed ? (
                            <div className="mt-2 text-center text-green-600 font-semibold text-sm">{match.score1} - {match.score2}</div>
                        ) : canPlay ? (
                            <button onClick={() => setShowModal(true)} className="mt-2 w-full text-xs bg-purple-600 hover:bg-purple-700 py-1 rounded">Record</button>
                        ) : null}

                        {showModal && (
                            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                                <div className="bg-gray-100 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                                    <h3 className="text-lg font-bold mb-4 text-center">{label}</h3>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[match.player1, match.player2].map(p => (
                                            <button key={p} onClick={() => setWinner(p)} className={`p-3 rounded-lg ${winner === p ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                                                <PlayerAvatar name={p} size="sm" /><div className="mt-1 text-sm">{p}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2 text-center">Score (Best of 3: 2-0 or 2-1)</p>
                                    <div className="flex items-center justify-center gap-4 mb-4">
                                        <input type="number" min="0" max="2" value={score1} onChange={e => setScore1(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                        <span>-</span>
                                        <input type="number" min="0" max="2" value={score2} onChange={e => setScore2(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                    </div>
                                    <button onClick={handleSubmit} disabled={!winner} className="w-full py-3 bg-emerald-600 disabled:bg-gray-200 rounded-lg font-semibold">Save</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            };

            const groupColors = {
                A: { bg: 'bg-emerald-900/30', border: 'border-emerald-500', accent: 'text-green-600', glow: 'shadow-emerald-500/20' },
                B: { bg: 'bg-amber-900/30', border: 'border-amber-500', accent: 'text-amber-600', glow: 'shadow-amber-500/20' }
            };
            const colors = groupColors[groupName] || groupColors.A;

            return (
                <div className={`bg-white shadow-sm border border-gray-200 rounded-xl p-6 border ${colors.border} shadow-lg ${colors.glow}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center font-bold ${colors.accent}`}>
                            {groupName}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Group {groupName} Playoffs</h3>
                            <p className="text-xs text-gray-500">Single elimination bracket</p>
                        </div>
                    </div>
                    <div className="flex gap-6 items-center overflow-x-auto pb-4">
                        {/* Semifinals Column */}
                        <div className="flex flex-col gap-6 relative">
                            <div className={`text-xs ${colors.accent} font-semibold text-center uppercase tracking-wide mb-2`}>Semifinals</div>
                            {playoff.semifinals.map((sf, i) => {
                                const seed1Label = sf.seed1 === 'WC' ? 'WC' : `#${sf.seed1}`;
                                const seed2Label = sf.seed2 === 'WC' ? 'WC' : `#${sf.seed2}`;
                                return <MatchCard key={sf.id} match={sf} label={`${seed1Label} vs ${seed2Label}`} />;
                            })}
                            {/* Connector lines */}
                            <div className="absolute right-0 top-16 h-24 w-8 border-r-2 border-t-2 border-b-2 border-gray-400 rounded-r-lg"></div>
                        </div>

                        {/* Arrow */}
                        <div className={`${colors.accent} px-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>

                        {/* Finals Column */}
                        <div className="flex flex-col items-center">
                            <div className={`text-xs ${colors.accent} font-semibold text-center uppercase tracking-wide mb-2`}>Final</div>
                            <MatchCard match={playoff.final} label="Championship" />
                            {playoff.champion && (
                                <div className={`mt-4 text-center px-4 py-2 rounded-lg ${colors.bg} border ${colors.border}`}>
                                    <div className="text-xs text-gray-500 uppercase">Champion</div>
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-amber-600">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0" />
                                        </svg>
                                        <span className={`font-bold text-lg ${colors.accent}`}>{playoff.champion}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // Combined Championship Bracket (8 players - top 4 from each group)
        function ChampionshipBracket({ championship, onRecordResult }) {
            if (!championship) return null;

            const MatchCard = ({ match, label, showSeeds = true }) => {
                const [showModal, setShowModal] = useState(false);
                const [winner, setWinner] = useState(null);
                const [score1, setScore1] = useState('');
                const [score2, setScore2] = useState('');

                const handleSubmit = () => {
                    if (!winner) return;
                    const s1 = parseInt(score1) || 0;
                    const s2 = parseInt(score2) || 0;
                    if (Math.max(s1, s2) > 2 || (s1 === 2 && s2 === 2)) {
                        alert('Best of 3: Winner needs 2 wins. Valid scores: 2-0, 2-1');
                        return;
                    }
                    const loser = winner === match.player1 ? match.player2 : match.player1;
                    onRecordResult(match.id, winner, loser, s1, s2);
                    setShowModal(false);
                };

                const canPlay = match.player1 && match.player2 && !match.completed;
                const getGroupColor = (group) => group === 'A' ? 'text-green-600' : group === 'B' ? 'text-amber-600' : 'text-gray-500';

                return (
                    <div className="bg-gray-100 rounded-lg p-3 w-52">
                        <div className="text-xs text-gray-500 mb-2 font-semibold">{label}</div>
                        <div className={`flex items-center gap-2 mb-1 ${match.winner === match.player1 ? 'text-green-600 font-semibold' : ''}`}>
                            {match.player1 ? (
                                <>
                                    <PlayerAvatar name={match.player1} size="sm" />
                                    <span className="text-sm truncate flex-1">{match.player1}</span>
                                    {showSeeds && match.seed1 && <span className={`text-xs ${getGroupColor(match.player1Group)}`}>{match.seed1}</span>}
                                </>
                            ) : (
                                <span className="text-gray-500 italic text-sm">TBD</span>
                            )}
                        </div>
                        <div className={`flex items-center gap-2 ${match.winner === match.player2 ? 'text-green-600 font-semibold' : ''}`}>
                            {match.player2 ? (
                                <>
                                    <PlayerAvatar name={match.player2} size="sm" />
                                    <span className="text-sm truncate flex-1">{match.player2}</span>
                                    {showSeeds && match.seed2 && <span className={`text-xs ${getGroupColor(match.player2Group)}`}>{match.seed2}</span>}
                                </>
                            ) : (
                                <span className="text-gray-500 italic text-sm">TBD</span>
                            )}
                        </div>
                        {match.completed ? (
                            <div className="mt-2 text-center text-green-600 font-semibold text-sm">{match.score1} - {match.score2}</div>
                        ) : canPlay ? (
                            <button onClick={() => setShowModal(true)} className="mt-2 w-full text-xs bg-purple-600 hover:bg-purple-700 py-1 rounded">Record</button>
                        ) : null}

                        {showModal && (
                            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                                <div className="bg-gray-100 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                                    <h3 className="text-lg font-bold mb-4 text-center">{label}</h3>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[match.player1, match.player2].map(p => (
                                            <button key={p} onClick={() => setWinner(p)} className={`p-3 rounded-lg ${winner === p ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                                                <PlayerAvatar name={p} size="sm" /><div className="mt-1 text-sm">{p}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2 text-center">Score (Best of 3: 2-0 or 2-1)</p>
                                    <div className="flex items-center justify-center gap-4 mb-4">
                                        <input type="number" min="0" max="2" value={score1} onChange={e => setScore1(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                        <span>-</span>
                                        <input type="number" min="0" max="2" value={score2} onChange={e => setScore2(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                    </div>
                                    <button onClick={handleSubmit} disabled={!winner} className="w-full py-3 bg-emerald-600 disabled:bg-gray-200 rounded-lg font-semibold">Save</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            };

            return (
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 border border-violet-500 shadow-lg shadow-violet-500/20">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-violet-900/50 border border-violet-500 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-amber-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-violet-300">Championship Bracket</h3>
                            <p className="text-xs text-gray-500">Top 4 from each group compete for the title</p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start overflow-x-auto pb-4">
                        {/* Quarterfinals */}
                        <div className="flex flex-col gap-4">
                            <div className="text-xs text-purple-600 font-semibold text-center uppercase tracking-wide mb-1">Quarterfinals</div>
                            <div className="flex flex-col gap-8">
                                <MatchCard match={championship.quarterfinals[0]} label="QF1: A#1 vs B#4" />
                                <MatchCard match={championship.quarterfinals[1]} label="QF2: B#2 vs A#3" />
                            </div>
                            <div className="h-4"></div>
                            <div className="flex flex-col gap-8">
                                <MatchCard match={championship.quarterfinals[2]} label="QF3: A#2 vs B#3" />
                                <MatchCard match={championship.quarterfinals[3]} label="QF4: B#1 vs A#4" />
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="text-purple-600 px-2 pt-24">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>

                        {/* Semifinals */}
                        <div className="flex flex-col gap-4 pt-8">
                            <div className="text-xs text-purple-600 font-semibold text-center uppercase tracking-wide mb-1">Semifinals</div>
                            <div className="flex flex-col gap-32">
                                <MatchCard match={championship.semifinals[0]} label="SF1: QF1 Winner vs QF2 Winner" showSeeds={false} />
                                <MatchCard match={championship.semifinals[1]} label="SF2: QF3 Winner vs QF4 Winner" showSeeds={false} />
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="text-purple-600 px-2 pt-32">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>

                        {/* Final */}
                        <div className="flex flex-col items-center pt-24">
                            <div className="text-xs text-amber-600 font-semibold text-center uppercase tracking-wide mb-1">Championship Final</div>
                            <MatchCard match={championship.final} label="Grand Final" showSeeds={false} />
                            {championship.champion && (
                                <div className="mt-4 text-center px-6 py-3 rounded-lg bg-gradient-to-r from-amber-900/50 to-violet-900/50 border border-amber-500">
                                    <div className="text-xs text-gray-500 uppercase">Season Champion</div>
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-amber-600">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0" />
                                        </svg>
                                        <span className="font-bold text-lg text-amber-600">{championship.champion}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seed Legend */}
                    <div className="mt-4 pt-4 border-t border-gray-300">
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                            <span><span className="text-green-600">A#1-4</span> = Group A seeds</span>
                            <span><span className="text-amber-600">B#1-4</span> = Group B seeds</span>
                            <span><span className="text-purple-600">WC</span> = Wildcard winner</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Wildcard Round Component
        function WildcardRound({ wildcard, onRecordResult }) {
            if (!wildcard?.matches) return null;

            const WildcardMatch = ({ match }) => {
                const [showModal, setShowModal] = useState(false);
                const [winner, setWinner] = useState(null);
                const [score1, setScore1] = useState('');
                const [score2, setScore2] = useState('');

                const handleSubmit = () => {
                    if (!winner) return;
                    const s1 = parseInt(score1) || 0;
                    const s2 = parseInt(score2) || 0;
                    // Validate best of 3: winner needs 2 wins, max score is 2-1 or 2-0
                    if (Math.max(s1, s2) > 2 || (s1 === 2 && s2 === 2)) {
                        alert('Best of 3: Winner needs 2 wins. Valid scores: 2-0, 2-1');
                        return;
                    }
                    const loser = winner === match.player1 ? match.player2 : match.player1;
                    onRecordResult(match.id, winner, loser, s1, s2);
                    setShowModal(false);
                };

                return (
                    <div className="bg-gray-100 rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-2">{match.description}</div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`text-center ${match.winner === match.player1 ? 'ring-2 ring-emerald-400 rounded-lg p-1' : ''}`}>
                                    <PlayerAvatar name={match.player1} size="sm" />
                                    <div className="text-xs mt-1">{match.player1}</div>
                                    <div className="text-xs text-green-600">Group {match.player1Group}</div>
                                </div>
                                <div className="text-gray-500 text-lg">vs</div>
                                <div className={`text-center ${match.winner === match.player2 ? 'ring-2 ring-emerald-400 rounded-lg p-1' : ''}`}>
                                    <PlayerAvatar name={match.player2} size="sm" />
                                    <div className="text-xs mt-1">{match.player2}</div>
                                    <div className="text-xs text-amber-600">Group {match.player2Group}</div>
                                </div>
                            </div>
                            {match.completed ? (
                                <div className="text-green-600 font-bold">{match.score1} - {match.score2}</div>
                            ) : (
                                <button onClick={() => setShowModal(true)} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm">
                                    Record
                                </button>
                            )}
                        </div>
                        {match.completed && (
                            <div className="mt-2 text-sm text-center">
                                <span className="text-green-600 font-semibold">{match.winner}</span>
                                <span className="text-gray-500"> earns wildcard to Group {match.winner === match.player1 ? match.player1Group : match.player2Group} playoffs!</span>
                            </div>
                        )}

                        {showModal && (
                            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                                <div className="bg-gray-100 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                                    <h3 className="text-lg font-bold mb-4 text-center">Wildcard Match</h3>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[match.player1, match.player2].map(p => (
                                            <button key={p} onClick={() => setWinner(p)} className={`p-3 rounded-lg ${winner === p ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                                                <PlayerAvatar name={p} size="sm" /><div className="mt-1 text-sm">{p}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2 text-center">Score (Best of 3: 2-0 or 2-1)</p>
                                    <div className="flex items-center justify-center gap-4 mb-4">
                                        <input type="number" min="0" max="2" value={score1} onChange={e => setScore1(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                        <span>-</span>
                                        <input type="number" min="0" max="2" value={score2} onChange={e => setScore2(e.target.value)} className="w-16 bg-gray-200 text-center text-xl rounded-lg p-2" placeholder="0" />
                                    </div>
                                    <button onClick={handleSubmit} disabled={!winner} className="w-full py-3 bg-emerald-600 disabled:bg-gray-200 rounded-lg font-semibold">Save</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            };

            return (
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                        <span className="text-purple-600">⚡</span> Wildcard Round
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">
                        Group A #5-6 vs Group B #5-6 - Cross-group showdown for playoff spots!
                    </p>
                    <div className="text-xs text-gray-500 mb-4 bg-gray-100/50 rounded-lg p-2">
                        <strong>Stakes:</strong> Winner earns a wildcard spot in their <em>own</em> group's playoffs.
                        Beat the player at your same rank from the other group to prove you deserve a playoff spot!
                    </div>
                    <div className="space-y-3">
                        {wildcard.matches.map(match => (
                            <WildcardMatch key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            );
        }

        function SuperBowl({ match, onRecordResult }) {
            const [showModal, setShowModal] = useState(false);
            const [winner, setWinner] = useState(null);
            const [score1, setScore1] = useState('');
            const [score2, setScore2] = useState('');

            const handleSubmit = () => {
                if (!winner) return;
                const s1 = parseInt(score1) || 0;
                const s2 = parseInt(score2) || 0;
                // Validate best of 3
                if (Math.max(s1, s2) > 2 || (s1 === 2 && s2 === 2)) {
                    alert('Best of 3: Winner needs 2 wins. Valid scores: 2-0, 2-1');
                    return;
                }
                const loser = winner === match.player1 ? match.player2 : match.player1;
                onRecordResult(match.id, winner, loser, s1, s2);
                setShowModal(false);
                confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
            };

            return (
                <div className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 border-2 border-amber-500/50 rounded-2xl p-6 text-center">
                    <div className="flex justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-amber-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-4">MAMMOTOME PING PONG FINALE</h2>
                    <div className="flex items-center justify-center gap-8">
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Group A Champion</div>
                            <PlayerAvatar name={match.player1} size="lg" />
                            <div className={`mt-2 font-bold ${match.winner === match.player1 ? 'text-amber-600' : ''}`}>{match.player1}</div>
                        </div>
                        <div className="text-2xl font-bold text-gray-500">VS</div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Group B Champion</div>
                            <PlayerAvatar name={match.player2} size="lg" />
                            <div className={`mt-2 font-bold ${match.winner === match.player2 ? 'text-amber-600' : ''}`}>{match.player2}</div>
                        </div>
                    </div>
                    {match.completed ? (
                        <div className="mt-4">
                            <div className="text-3xl font-bold text-amber-600">{match.score1} - {match.score2}</div>
                            <div className="text-xl mt-2 flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-amber-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                                </svg>
                                <span>{match.winner} is the Champion!</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-amber-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                                </svg>
                            </div>
                        </div>
                    ) : match.player1 && match.player2 && (
                        <button onClick={() => setShowModal(true)} className="mt-4 bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-lg font-semibold">
                            Record Finale Result
                        </button>
                    )}

                    {showModal && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                            <div className="bg-gray-100 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                                <h3 className="text-xl font-bold mb-4">Finale Result</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    {[match.player1, match.player2].map(p => (
                                        <button key={p} onClick={() => setWinner(p)} className={`p-4 rounded-lg ${winner === p ? 'bg-amber-600' : 'bg-gray-200'}`}>
                                            <PlayerAvatar name={p} size="md" /><div className="mt-2 font-semibold">{p}</div>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 mb-2 text-center">Score (Best of 3: 2-0 or 2-1)</p>
                                <div className="flex items-center justify-center gap-4 mb-4">
                                    <input type="number" min="0" max="2" value={score1} onChange={e => setScore1(e.target.value)} className="w-20 bg-gray-200 text-center text-2xl rounded-lg p-2" placeholder="0" />
                                    <span className="text-xl">-</span>
                                    <input type="number" min="0" max="2" value={score2} onChange={e => setScore2(e.target.value)} className="w-20 bg-gray-200 text-center text-2xl rounded-lg p-2" placeholder="0" />
                                </div>
                                <button onClick={handleSubmit} disabled={!winner} className="w-full py-3 bg-amber-600 disabled:bg-gray-200 rounded-lg font-semibold flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0" />
                                    </svg>
                                    Crown the Champion
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Player Schedule & Booking System
        function PlayerSchedule({ players, season, currentPlayer, onSelectPlayer }) {
            const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
            const [myAvailability, setMyAvailability] = useState({});
            const [bookings, setBookings] = useState([]);
            const [tableBookings, setTableBookings] = useState([]);
            const [showBookingModal, setShowBookingModal] = useState(false);
            const [selectedMatch, setSelectedMatch] = useState(null);
            const [selectedSlot, setSelectedSlot] = useState(null);
            const [opponentAvailability, setOpponentAvailability] = useState({});
            const [loading, setLoading] = useState(false);
            const [showMoveModal, setShowMoveModal] = useState(false);
            const [bookingToMove, setBookingToMove] = useState(null);
            const [newDate, setNewDate] = useState('');
            const [newSlot, setNewSlot] = useState('');
            const [leagueMatches, setLeagueMatches] = useState([]);

            // Fetch league matches
            useEffect(() => {
                fetch(`${API_BASE}/league/matches`)
                    .then(r => r.json())
                    .then(data => setLeagueMatches(data || []))
                    .catch(() => setLeagueMatches([]));
            }, []);

            // Get all players from both groups
            const allPlayers = useMemo(() => {
                if (!season?.groups) return players.map(p => p.name);
                const groupA = season.groups.A?.players?.map(p => p.name) || [];
                const groupB = season.groups.B?.players?.map(p => p.name) || [];
                return [...new Set([...groupA, ...groupB, ...players.map(p => p.name)])].sort();
            }, [season, players]);

            // Get current player's upcoming matches
            const myMatches = useMemo(() => {
                if (!currentPlayer) return [];
                const matches = [];

                // Add season matches
                if (season) {
                    ['A', 'B'].forEach(group => {
                        season.schedule?.[group]?.forEach((week, weekIdx) => {
                            week.forEach(match => {
                                if (!match.completed && (match.player1 === currentPlayer || match.player2 === currentPlayer)) {
                                    matches.push({
                                        ...match,
                                        weekNum: weekIdx + 1,
                                        opponent: match.player1 === currentPlayer ? match.player2 : match.player1,
                                        group,
                                        type: 'season'
                                    });
                                }
                            });
                        });
                    });
                }

                // Add league bracket matches
                leagueMatches.forEach(match => {
                    if (!match.completed &&
                        (match.player1 === currentPlayer || match.player2 === currentPlayer) &&
                        match.player1 && match.player2 &&
                        match.player1 !== 'BYE' && match.player2 !== 'BYE') {
                        const opponent = match.player1 === currentPlayer ? match.player2 : match.player1;
                        matches.push({
                            id: match.id,
                            player1: match.player1,
                            player2: match.player2,
                            completed: match.completed,
                            weekNum: null,
                            opponent: opponent,
                            group: 'League',
                            type: 'league',
                            round: match.round,
                            matchNumber: match.match_number
                        });
                    }
                });

                return matches.slice(0, 6); // Next 6 matches
            }, [season, currentPlayer, leagueMatches]);

            // Load all data
            const loadData = useCallback(async () => {
                try {
                    // Load availability for all players
                    const availRes = await fetch(`${API_BASE}/availability`);
                    const availData = await availRes.json();
                    setMyAvailability(availData || {});

                    // Load table bookings
                    const bookingsRes = await fetch(`${API_BASE}/bookings?start_date=${selectedDate}`);
                    const bookingsData = await bookingsRes.json();
                    setTableBookings(Array.isArray(bookingsData) ? bookingsData : []);
                } catch (e) {
                    console.error('Error loading data:', e);
                }
            }, [selectedDate]);

            useEffect(() => { loadData(); }, [loadData]);

            // Toggle availability for current player
            const toggleMyAvailability = async (date, slot) => {
                if (!currentPlayer) return;

                const playerAvail = myAvailability[currentPlayer] || {};
                const dateSlots = playerAvail[date] || [];
                const newSlots = dateSlots.includes(slot)
                    ? dateSlots.filter(s => s !== slot)
                    : [...dateSlots, slot];

                const updatedAvail = {
                    ...myAvailability,
                    [currentPlayer]: {
                        ...playerAvail,
                        [date]: newSlots
                    }
                };
                setMyAvailability(updatedAvail);

                // Save to server
                try {
                    await fetch(`${API_BASE}/availability`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [currentPlayer]: { [date]: newSlots } })
                    });
                } catch (e) {
                    console.error('Failed to save availability');
                }
            };

            // Book a match
            const handleBookMatch = async () => {
                if (!selectedMatch || !selectedSlot || !currentPlayer) return;
                setLoading(true);
                try {
                    const res = await fetch(`${API_BASE}/bookings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            match_id: selectedMatch.id,
                            player1: currentPlayer,
                            player2: selectedMatch.opponent,
                            booking_date: selectedDate,
                            start_time: selectedSlot,
                            group_name: selectedMatch.group
                        })
                    });
                    if (res.ok) {
                        await loadData();
                        setShowBookingModal(false);
                        setSelectedMatch(null);
                        setSelectedSlot(null);
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to book');
                    }
                } catch (e) {
                    alert('Failed to book');
                }
                setLoading(false);
            };

            const handleCancelBooking = async (id) => {
                if (!confirm('Cancel this booking?')) return;
                try {
                    await fetch(`${API_BASE}/bookings/${id}`, { method: 'DELETE' });
                    await loadData();
                } catch (e) {
                    alert('Failed to cancel');
                }
            };

            const handleMoveBooking = async () => {
                if (!bookingToMove || !newDate || !newSlot) return;
                setLoading(true);
                try {
                    const res = await fetch(`${API_BASE}/bookings/${bookingToMove.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ booking_date: newDate, start_time: newSlot })
                    });
                    if (res.ok) {
                        await loadData();
                        setShowMoveModal(false);
                        setBookingToMove(null);
                        setNewDate('');
                        setNewSlot('');
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to move booking');
                    }
                } catch (e) {
                    alert('Failed to move booking');
                }
                setLoading(false);
            };

            const openMoveModal = (booking) => {
                setBookingToMove(booking);
                setNewDate(booking.booking_date?.split('T')[0] || '');
                setNewSlot(booking.start_time?.substring(0, 5) || '');
                setShowMoveModal(true);
            };

            const formatTime = (time) => {
                if (!time) return '';
                const [h, m] = time.split(':');
                const hour = parseInt(h);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const h12 = hour % 12 || 12;
                return `${h12}:${m} ${ampm}`;
            };

            // Generate 2 weeks of dates
            const weekDates = useMemo(() => {
                const dates = [];
                const start = new Date();
                start.setDate(start.getDate() - start.getDay()); // Start from Sunday
                for (let i = 0; i < 14; i++) { // Changed from 7 to 14 for 2 weeks
                    const d = new Date(start);
                    d.setDate(start.getDate() + i);
                    dates.push(d.toISOString().split('T')[0]);
                }
                return dates;
            }, []);

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
                              '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

            // Get overlap between current player and opponent for a match
            const getOverlapSlots = (opponent, date) => {
                if (!currentPlayer || !opponent) return [];
                const mySlots = myAvailability[currentPlayer]?.[date] || [];
                const oppSlots = myAvailability[opponent]?.[date] || [];
                const tableBooked = tableBookings
                    .filter(b => b.booking_date?.split('T')[0] === date && b.status !== 'cancelled')
                    .map(b => b.start_time?.substring(0, 5));
                return mySlots.filter(s => oppSlots.includes(s) && !tableBooked.includes(s));
            };

            // If no player selected, show player selection
            if (!currentPlayer) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 text-center">
                        <h3 className="text-xl font-bold mb-4">Who are you?</h3>
                        <p className="text-gray-500 mb-4">Select your name to manage your schedule</p>
                        <select onChange={e => onSelectPlayer(e.target.value)} value=""
                                className="bg-gray-100 rounded-lg px-4 py-3 text-lg w-full max-w-xs">
                            <option value="">Select your name...</option>
                            {allPlayers.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                );
            }

            return (
                <div className="space-y-4">
                    {/* Current Player Header */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <PlayerAvatar name={currentPlayer} size="lg" />
                            <div>
                                <div className="font-bold text-lg">{currentPlayer}</div>
                                <div className="text-sm text-gray-500">My Schedule</div>
                            </div>
                        </div>
                        <button onClick={() => onSelectPlayer('')} className="text-gray-500 hover:text-white text-sm">
                            Switch Player
                        </button>
                    </div>

                    {/* My Upcoming Matches */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h3 className="text-lg font-bold mb-3">My Upcoming Matches</h3>
                        {myMatches.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No upcoming matches</p>
                        ) : (
                            <div className="space-y-3">
                                {myMatches.map(match => {
                                    const overlap = weekDates.flatMap(d => getOverlapSlots(match.opponent, d).map(s => ({ date: d, slot: s })));
                                    return (
                                        <div key={match.id} className="bg-gray-100 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">Week {match.weekNum}</span>
                                                    <span className={`text-xs px-2 py-1 rounded ${match.group === 'A' ? 'bg-emerald-900/50 text-green-600' : 'bg-amber-900/50 text-amber-600'}`}>
                                                        Group {match.group}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="font-medium">vs</span>
                                                <PlayerAvatar name={match.opponent} size="sm" />
                                                <span className="font-semibold">{match.opponent}</span>
                                            </div>
                                            {overlap.length > 0 ? (
                                                <div>
                                                    <p className="text-xs text-green-600 mb-2">{overlap.length} mutual available slots this week:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {overlap.slice(0, 6).map(({date, slot}) => (
                                                            <button key={date + slot} onClick={() => {
                                                                setSelectedMatch(match);
                                                                setSelectedDate(date);
                                                                setSelectedSlot(slot);
                                                                setShowBookingModal(true);
                                                            }} className="text-xs bg-emerald-900/50 text-green-600 px-2 py-1 rounded hover:bg-emerald-800">
                                                                {dayNames[new Date(date).getDay()]} {formatTime(slot)}
                                                            </button>
                                                        ))}
                                                        {overlap.length > 6 && <span className="text-xs text-gray-500">+{overlap.length - 6} more</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-amber-600">No mutual availability yet. Set your available times below!</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* My Availability Grid */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h3 className="text-lg font-bold mb-3">Set My Availability (2 Weeks)</h3>
                        <p className="text-sm text-gray-500 mb-4">Tap slots when you're free to play. Your opponents will see when you overlap!</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        <th className="p-1 text-left text-gray-500">Time</th>
                                        {weekDates.map((date, i) => {
                                            const d = new Date(date + 'T12:00');
                                            const isSecondWeek = i >= 7;
                                            return (
                                                <th key={date} className={`p-1 text-center ${isSecondWeek ? 'bg-blue-50' : ''} ${i === 7 ? 'border-l-2 border-blue-300' : ''}`}>
                                                    <div className="text-gray-500 text-xs">{dayNames[d.getDay()]}</div>
                                                    <div className="font-semibold">{d.getDate()}</div>
                                                    {i === 0 && <div className="text-[10px] text-purple-600">Week 1</div>}
                                                    {i === 7 && <div className="text-[10px] text-blue-600">Week 2</div>}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map(slot => (
                                        <tr key={slot}>
                                            <td className="p-1 text-gray-500 text-xs">{formatTime(slot)}</td>
                                            {weekDates.map((date, i) => {
                                                const isAvailable = myAvailability[currentPlayer]?.[date]?.includes(slot);
                                                const existingBooking = tableBookings.find(b =>
                                                    b.booking_date?.split('T')[0] === date &&
                                                    b.start_time?.substring(0, 5) === slot &&
                                                    b.status !== 'cancelled'
                                                );
                                                const isTableBooked = !!existingBooking;
                                                const myBooking = existingBooking && (existingBooking.player1 === currentPlayer || existingBooking.player2 === currentPlayer);
                                                const bookingGroup = existingBooking?.group_name;
                                                const isSecondWeek = i >= 7;
                                                return (
                                                    <td key={date} className={`p-1 ${isSecondWeek ? 'bg-blue-50/30' : ''} ${i === 7 ? 'border-l-2 border-blue-300' : ''}`}>
                                                        <button
                                                            onClick={() => !isTableBooked && toggleMyAvailability(date, slot)}
                                                            disabled={isTableBooked && !myBooking}
                                                            title={existingBooking ? `${existingBooking.player1} vs ${existingBooking.player2}${bookingGroup ? ` (Group ${bookingGroup})` : ''}` : ''}
                                                            className={`w-full h-8 rounded text-xs relative ${
                                                                myBooking ? 'bg-purple-600 text-white' :
                                                                isTableBooked && bookingGroup === 'A' ? 'bg-emerald-900/60 text-green-600 cursor-not-allowed border border-emerald-700' :
                                                                isTableBooked && bookingGroup === 'B' ? 'bg-amber-900/60 text-amber-600 cursor-not-allowed border border-amber-700' :
                                                                isTableBooked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' :
                                                                isAvailable ? 'bg-emerald-600 text-white' :
                                                                'bg-gray-100 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {myBooking ? 'My' : isTableBooked ? (bookingGroup || 'X') : isAvailable ? '✓' : ''}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs flex-wrap">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-600 rounded"></span> I'm available</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-600 rounded"></span> My booking</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-900/60 border border-emerald-700 rounded"></span> Group A</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-900/60 border border-amber-700 rounded"></span> Group B</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-200 rounded"></span> Other</span>
                        </div>
                    </div>

                    {/* My Booked Matches */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h3 className="text-lg font-bold mb-3">My Booked Matches</h3>
                        {(() => {
                            const myBooked = tableBookings.filter(b =>
                                (b.player1 === currentPlayer || b.player2 === currentPlayer) && b.status !== 'cancelled'
                            );
                            return myBooked.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No booked matches yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {myBooked.map(b => (
                                        <div key={b.id} className="flex items-center justify-between bg-gray-100 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="text-purple-600 font-mono font-semibold">
                                                    {new Date(b.booking_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    {' '}{formatTime(b.start_time?.substring(0, 5))}
                                                </div>
                                                <div className="font-medium">vs {b.player1 === currentPlayer ? b.player2 : b.player1}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => openMoveModal(b)} className="text-amber-600 hover:text-amber-300 text-sm">
                                                    Move
                                                </button>
                                                <button onClick={() => handleCancelBooking(b.id)} className="text-red-500 hover:text-rose-300 text-sm">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Booking Confirmation Modal */}
                    {showBookingModal && selectedMatch && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowBookingModal(false)}>
                            <div className="bg-gray-100 rounded-xl p-6 max-w-md w-full animate-slideIn" onClick={e => e.stopPropagation()}>
                                <h3 className="text-lg font-bold mb-2">Confirm Match Booking</h3>
                                <p className="text-gray-500 mb-4">
                                    {new Date(selectedDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {formatTime(selectedSlot)}
                                </p>
                                <div className="bg-gray-200 rounded-lg p-4 mb-4 flex items-center justify-center gap-4">
                                    <div className="text-center">
                                        <PlayerAvatar name={currentPlayer} />
                                        <div className="mt-1 text-sm">{currentPlayer}</div>
                                    </div>
                                    <div className="text-gray-500 text-lg">vs</div>
                                    <div className="text-center">
                                        <PlayerAvatar name={selectedMatch.opponent} />
                                        <div className="mt-1 text-sm">{selectedMatch.opponent}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowBookingModal(false)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">
                                        Cancel
                                    </button>
                                    <button onClick={handleBookMatch} disabled={loading}
                                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 rounded-lg font-semibold">
                                        {loading ? 'Booking...' : 'Confirm Booking'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Move Booking Modal */}
                    {showMoveModal && bookingToMove && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowMoveModal(false)}>
                            <div className="bg-gray-100 rounded-xl p-6 max-w-md w-full animate-slideIn" onClick={e => e.stopPropagation()}>
                                <h3 className="text-lg font-bold mb-2">Move Booking</h3>
                                <p className="text-gray-500 mb-4">
                                    Current: {new Date(bookingToMove.booking_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {formatTime(bookingToMove.start_time?.substring(0, 5))}
                                </p>
                                <div className="space-y-3 mb-4">
                                    <div>
                                        <label className="block text-sm text-gray-500 mb-1">New Date</label>
                                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                                               className="w-full bg-gray-200 rounded-lg px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-500 mb-1">New Time</label>
                                        <select value={newSlot} onChange={e => setNewSlot(e.target.value)}
                                                className="w-full bg-gray-200 rounded-lg px-3 py-2">
                                            {timeSlots.map(slot => (
                                                <option key={slot} value={slot}>{formatTime(slot)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowMoveModal(false)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">
                                        Cancel
                                    </button>
                                    <button onClick={handleMoveBooking} disabled={loading}
                                            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-200 rounded-lg font-semibold">
                                        {loading ? 'Moving...' : 'Move Booking'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Admin Panel
        // Snow Effect Component
        function SnowEffect() {
            const [snowflakes, setSnowflakes] = useState([]);

            useEffect(() => {
                const flakes = Array.from({ length: 50 }, (_, i) => ({
                    id: i,
                    left: Math.random() * 100,
                    delay: Math.random() * 10,
                    duration: 8 + Math.random() * 7,
                    size: 0.5 + Math.random() * 1,
                    opacity: 0.4 + Math.random() * 0.6
                }));
                setSnowflakes(flakes);
            }, []);

            return (
                <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
                    {snowflakes.map(flake => (
                        <div
                            key={flake.id}
                            className="snowflake"
                            style={{
                                left: `${flake.left}%`,
                                animationDelay: `${flake.delay}s`,
                                animationDuration: `${flake.duration}s`,
                                fontSize: `${flake.size}rem`,
                                opacity: flake.opacity
                            }}
                        >
                            ❄
                        </div>
                    ))}
                </div>
            );
        }

        // Winter League Registration Component
        function WinterLeagueRegistration({ isAdmin, onRefresh }) {
            const [config, setConfig] = useState(null);
            const [registrations, setRegistrations] = useState([]);
            const [leagueMatches, setLeagueMatches] = useState([]);
            const [playerName, setPlayerName] = useState('');
            const [email, setEmail] = useState('');
            const [loading, setLoading] = useState(true);
            const [submitting, setSubmitting] = useState(false);
            const [message, setMessage] = useState(null);
            const [showAdminPanel, setShowAdminPanel] = useState(false);

            // Admin state
            const [editingId, setEditingId] = useState(null);
            const [editSeed, setEditSeed] = useState('');
            const [closeDate, setCloseDate] = useState('');

            const fetchData = async () => {
                try {
                    const [configRes, listRes, matchesRes] = await Promise.all([
                        fetch(`${API_BASE}/registration/config`),
                        fetch(`${API_BASE}/registration/list`),
                        fetch(`${API_BASE}/league/matches`)
                    ]);
                    const configData = await configRes.json();
                    const listData = await listRes.json();
                    const matchesData = await matchesRes.json();
                    setConfig(configData);
                    setRegistrations(listData);
                    setLeagueMatches(matchesData || []);
                    if (configData.registration_close_date) {
                        setCloseDate(new Date(configData.registration_close_date).toISOString().slice(0, 16));
                    }
                } catch (e) {
                    console.error('Failed to load registration data');
                }
                setLoading(false);
            };

            useEffect(() => { fetchData(); }, []);

            const handleRegister = async (e) => {
                e.preventDefault();
                if (!playerName.trim()) return;

                setSubmitting(true);
                setMessage(null);

                try {
                    const res = await fetch(`${API_BASE}/registration/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ playerName: playerName.trim(), email: email.trim() || null })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        setMessage({ type: 'success', text: data.message });
                        setPlayerName('');
                        setEmail('');
                        fetchData();
                    } else {
                        setMessage({ type: 'error', text: data.error });
                    }
                } catch (e) {
                    setMessage({ type: 'error', text: 'Failed to register. Please try again.' });
                }
                setSubmitting(false);
            };

            const handleApprove = async (id, status, seed = null) => {
                try {
                    // Explicitly handle unseeded case
                    let finalSeed = null;
                    if (seed !== null && seed !== undefined && seed !== '') {
                        finalSeed = parseInt(seed);
                    }

                    console.log('Updating registration:', { id, status, finalSeed });

                    const res = await fetch(`${API_BASE}/registration/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': localStorage.getItem('adminPassword') || '' },
                        body: JSON.stringify({ registration_status: status, final_seed: finalSeed })
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        alert('Failed: ' + (err.error || 'Unknown error'));
                        return;
                    }

                    const result = await res.json();
                    console.log('Update successful:', result);
                    alert(finalSeed === null ? 'Player set to unseeded (Group B)' : `Player seed set to #${finalSeed}`);

                    setEditingId(null);
                    setEditSeed('');
                    fetchData();
                } catch (e) {
                    console.error('Failed to approve:', e);
                    alert('Failed to update registration: ' + e.message);
                }
            };

            const handleDelete = async (id) => {
                if (!confirm('Remove this registration? (Player will remain in the database)')) return;
                try {
                    const res = await fetch(`${API_BASE}/registration/${id}`, {
                        method: 'DELETE',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        alert('Failed: ' + (err.error || 'Unknown error'));
                        return;
                    }
                    fetchData();
                } catch (e) { console.error('Failed to delete:', e); alert('Failed to remove registration'); }
            };

            const handleUpdateConfig = async () => {
                try {
                    await fetch(`${API_BASE}/registration/config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': localStorage.getItem('adminPassword') || '' },
                        body: JSON.stringify({
                            registration_open: config.registration_open,
                            registration_close_date: closeDate ? new Date(closeDate).toISOString() : null
                        })
                    });
                    fetchData();
                } catch (e) { }
            };

            const handleConvertToSeason = async () => {
                if (!confirm('Convert to Season format?\n\n• Deletes current bracket tournament\n• Creates 10-week season with Groups A & B\n• 8 games per player\n• Mid-season swap at Week 3\n• Keeps all registered players\n\nThis will close registration. Continue?')) return;
                try {
                    const res = await fetch(`${API_BASE}/registration/convert-to-season`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(`Season created!\n\nGroup A: ${data.season.groupA} players\nGroup B: ${data.season.groupB} players\nTotal Weeks: ${data.season.totalWeeks}\n\nGo to Home/Schedule tab to view the season.`);
                        window.location.href = '/';
                    } else {
                        alert(data.error);
                    }
                } catch (e) {
                    console.error('Failed to convert:', e);
                    alert('Failed to convert to season');
                }
            };

            const handleGenerateBracket = async () => {
                if (!confirm('Generate bracket from approved registrations? This will close registration.')) return;
                try {
                    const res = await fetch(`${API_BASE}/registration/generate-bracket`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(`Bracket generated! ${data.numPlayers} players, ${data.numByes} byes, ${data.seededCount} seeded.`);
                        fetchData();
                    } else {
                        alert(data.error);
                    }
                } catch (e) { console.error('Failed to generate bracket:', e); alert('Failed to generate bracket'); }
            };

            const daysUntilClose = config?.registration_close_date
                ? Math.ceil((new Date(config.registration_close_date) - new Date()) / (1000 * 60 * 60 * 24))
                : null;

            if (loading) {
                return <div className="text-center py-20">Loading...</div>;
            }

            return (
                <div className="relative min-h-screen">
                    <SnowEffect />

                    <div className="relative z-10">
                        {/* Winter Header */}
                        <div className="winter-gradient rounded-2xl p-8 mb-6 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-30"></div>
                            <div className="relative">
                                <div className="text-6xl mb-4">❄️ 🏓 ❄️</div>
                                <h1 className="text-4xl font-bold text-white mb-2">Mammotome Ping Pong League</h1>
                                <h2 className="text-2xl text-fuchsia-200 mb-2">{config?.season_name || 'Winter League 2026'}</h2>
                                <p className="text-fuchsia-100 text-lg">Register now to compete!</p>

                                {config?.registration_open ? (
                                    <div className="mt-4 inline-block bg-emerald-500/20 border border-emerald-400/50 rounded-full px-6 py-2">
                                        <span className="text-emerald-300 font-semibold">
                                            ✓ Registration Open
                                            {daysUntilClose !== null && daysUntilClose > 0 && (
                                                <span className="text-emerald-200 ml-2">({daysUntilClose} days left)</span>
                                            )}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mt-4 inline-block bg-rose-500/20 border border-rose-400/50 rounded-full px-6 py-2">
                                        <span className="text-rose-300 font-semibold">Registration Closed</span>
                                    </div>
                                )}

                                {config?.stats && (
                                    <div className="mt-4 flex justify-center gap-8 text-sm">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-white">{config.stats.approved}</div>
                                            <div className="text-fuchsia-200">Confirmed</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-amber-300">{config.stats.pending}</div>
                                            <div className="text-fuchsia-200">Awaiting Admin</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-fuchsia-300">{config.stats.ranked}</div>
                                            <div className="text-fuchsia-200">Returning Players</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Registration Form */}
                        {config?.registration_open && (
                            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 mb-6">
                                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                    <span className="text-fuchsia-400">❄️</span>
                                    Register to Play
                                </h2>

                                <form onSubmit={handleRegister} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-500 mb-1">Your Name *</label>
                                        <input
                                            type="text"
                                            value={playerName}
                                            onChange={e => setPlayerName(e.target.value)}
                                            placeholder="Enter your name"
                                            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Returning players: Use the same name from last season to keep your ranking
                                        </p>
                                    </div>

                                    {message && (
                                        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-500/50' : 'bg-rose-900/50 text-rose-300 border border-rose-500/50'}`}>
                                            {message.text}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting || !playerName.trim()}
                                        className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 disabled:from-gray-400 disabled:to-gray-400 py-3 rounded-lg font-bold text-lg transition-all"
                                    >
                                        {submitting ? 'Registering...' : '❄️ Register for Winter League'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Tournament Rules & Format */}
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 mb-6">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <span>📋</span>
                                League Format & Rules
                            </h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* League Structure */}
                                <div>
                                    <h3 className="font-bold text-purple-600 mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>
                                        League Structure
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-1.5 ml-7">
                                        <li><span className="text-green-600 font-semibold">Group A</span> - Seeded/Ranked players (competitive)</li>
                                        <li><span className="text-amber-600 font-semibold">Group B</span> - New/Unseeded players (developmental)</li>
                                        <li>10-week regular season with round-robin matches</li>
                                        <li>Mid-season promotion/relegation between groups</li>
                                        <li>Championship bracket with top 4 from each group</li>
                                    </ul>
                                </div>

                                {/* Match Format */}
                                <div>
                                    <h3 className="font-bold text-purple-600 mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.75 0" /></svg>
                                        Match Format
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-1.5 ml-7">
                                        <li>Best of 3 games (first to win 2 games)</li>
                                        <li>Games played to 11 points, win by 2</li>
                                        <li>Serve switches every 2 points</li>
                                        <li>Players schedule matches via table booking</li>
                                        <li>Match must be completed within the week</li>
                                    </ul>
                                </div>

                                {/* Scoring */}
                                <div>
                                    <h3 className="font-bold text-purple-600 mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
                                        Scoring System
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-1.5 ml-7">
                                        <li><span className="font-semibold">Win 2-0:</span> 3 points for winner</li>
                                        <li><span className="font-semibold">Win 2-1:</span> 2 points for winner, 1 point for loser</li>
                                        <li>Standings by: Wins → Point Differential → Head-to-Head</li>
                                        <li>Forfeit = 2-0 loss for forfeiting player</li>
                                    </ul>
                                </div>

                                {/* Championship */}
                                <div>
                                    <h3 className="font-bold text-purple-600 mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                                        Championship Playoffs
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-1.5 ml-7">
                                        <li>Top 4 from each group qualify for playoffs</li>
                                        <li>5th/6th place play wildcard for final spots</li>
                                        <li>8-player single elimination bracket</li>
                                        <li>Seeding: A1, B1, A2, B2, A3, B3, A4/WC, B4/WC</li>
                                        <li>Finals played on championship week</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Important Dates */}
                            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <h3 className="font-bold text-purple-700 mb-2">📅 Key Dates</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div className="text-center">
                                        <div className="text-purple-600 font-semibold">Registration</div>
                                        <div className="text-gray-600">Open Now</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-purple-600 font-semibold">Season Start</div>
                                        <div className="text-gray-600">TBD</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-purple-600 font-semibold">Mid-Season</div>
                                        <div className="text-gray-600">Week 5</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-purple-600 font-semibold">Championships</div>
                                        <div className="text-gray-600">Week 11-12</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Registered Players List */}
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 mb-6">
                            <h2 className="text-2xl font-bold mb-4">Registered Players ({registrations.length})</h2>

                            {registrations.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No registrations yet. Be the first!</p>
                            ) : (
                                <div className="grid gap-2">
                                    {registrations.map((reg, idx) => (
                                        <div key={reg.player_name} className={`flex items-center justify-between p-3 rounded-lg ${reg.is_ranked ? 'bg-violet-900/30 border border-violet-500/30' : 'bg-gray-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 w-8">{idx + 1}.</span>
                                                <span className="font-semibold">{reg.player_name}</span>
                                                {reg.registration_status === 'pending' && (
                                                    <span className="text-xs bg-amber-600/50 px-2 py-0.5 rounded text-amber-200" title="League admin will confirm your seed placement">
                                                        Awaiting Admin Approval
                                                    </span>
                                                )}
                                                {reg.registration_status === 'approved' && (reg.final_seed === null || reg.final_seed === undefined || reg.final_seed === '') && (
                                                    <span className="text-xs bg-gray-500/50 px-2 py-0.5 rounded text-gray-300">
                                                        Unseeded
                                                    </span>
                                                )}
                                            </div>
                                            {reg.final_seed !== null && reg.final_seed !== undefined && reg.final_seed !== '' ? (
                                                <span className="text-green-600 font-bold">Seed #{reg.final_seed}</span>
                                            ) : reg.registration_status === 'approved' ? (
                                                <span className="text-amber-600 font-semibold">Group B</span>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Admin Panel */}
                        {isAdmin && (
                            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
                                <button
                                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                                    className="w-full flex items-center justify-between text-xl font-bold mb-4"
                                >
                                    <span>⚙️ Admin Controls</span>
                                    <span className="text-gray-500">{showAdminPanel ? '▼' : '▶'}</span>
                                </button>

                                {showAdminPanel && (
                                    <div className="space-y-6">
                                        {/* Registration Settings */}
                                        <div className="bg-gray-100 rounded-lg p-4">
                                            <h3 className="font-bold mb-3">Registration Settings</h3>
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={config?.registration_open}
                                                        onChange={e => setConfig({ ...config, registration_open: e.target.checked })}
                                                        className="w-5 h-5"
                                                    />
                                                    <span>Registration Open</span>
                                                </label>
                                                <div>
                                                    <label className="block text-sm text-gray-500 mb-1">Close Date</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={closeDate}
                                                        onChange={e => setCloseDate(e.target.value)}
                                                        className="bg-gray-200 rounded px-3 py-2 w-full"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleUpdateConfig}
                                                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold"
                                                >
                                                    Save Settings
                                                </button>
                                            </div>
                                        </div>

                                        {/* Review Registrations */}
                                        <div className="bg-gray-100 rounded-lg p-4">
                                            <h3 className="font-bold mb-3">Review Registrations ({registrations.length})</h3>
                                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                                {registrations.map(reg => (
                                                    <div key={reg.id || reg.player_name} className="flex items-center justify-between gap-2 p-3 bg-gray-200/50 rounded-lg">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-semibold">{reg.player_name}</span>
                                                                {reg.is_ranked && <span className="text-xs bg-purple-600/50 px-2 py-0.5 rounded text-violet-200">Prev #{reg.suggested_seed}</span>}
                                                                <span className={`text-xs px-2 py-0.5 rounded ${reg.registration_status === 'approved' ? 'bg-emerald-600/50 text-emerald-200' : 'bg-amber-600/50 text-amber-200'}`}>
                                                                    {reg.registration_status === 'approved' ? 'Approved' : 'Pending'}
                                                                </span>
                                                                {reg.final_seed !== null && reg.final_seed !== undefined && reg.final_seed !== '' ? (
                                                                    <span className="text-xs bg-cyan-600/50 px-2 py-0.5 rounded text-cyan-200">Seed #{reg.final_seed}</span>
                                                                ) : (
                                                                    <span className="text-xs bg-amber-600/50 px-2 py-0.5 rounded text-amber-200">Unseeded (Group B)</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {editingId === reg.id ? (
                                                                <>
                                                                    <input
                                                                        type="number"
                                                                        value={editSeed}
                                                                        onChange={e => setEditSeed(e.target.value)}
                                                                        placeholder="Seed #"
                                                                        min="1"
                                                                        className="w-20 bg-gray-300 rounded px-2 py-1.5 text-sm"
                                                                    />
                                                                    <button onClick={() => handleApprove(reg.id, 'approved', editSeed)} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded font-semibold">Save</button>
                                                                    <button onClick={() => handleApprove(reg.id, 'approved', null)} className="text-xs bg-gray-400 hover:bg-gray-500 px-3 py-1.5 rounded font-semibold">Unseeded</button>
                                                                    <button onClick={() => { setEditingId(null); setEditSeed(''); }} className="text-xs bg-gray-300 hover:bg-gray-400 px-2 py-1.5 rounded">✕</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {reg.registration_status === 'pending' && (
                                                                        <button onClick={() => handleApprove(reg.id, 'approved', null)} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded font-semibold">Approve</button>
                                                                    )}
                                                                    <button onClick={() => { setEditingId(reg.id); setEditSeed(reg.final_seed || reg.suggested_seed || ''); }} className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-1.5 rounded font-semibold">Set Seed</button>
                                                                    <button onClick={() => handleDelete(reg.id)} className="text-xs bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded font-semibold">Remove</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {registrations.length === 0 && (
                                                    <p className="text-gray-500 text-center py-4">No registrations yet</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Generate Tournament */}
                                        <div className="bg-gray-100 rounded-lg p-4">
                                            <h3 className="font-bold mb-3">Start Tournament</h3>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Choose your tournament format. This will close registration.
                                            </p>

                                            <div className="space-y-3">
                                                <button
                                                    onClick={handleConvertToSeason}
                                                    className="w-full bg-green-600 hover:bg-green-500 px-4 py-3 rounded-lg font-semibold text-left"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-2xl">🏆</span>
                                                        <div>
                                                            <div className="font-bold">Season Format (Recommended)</div>
                                                            <div className="text-xs text-white/80 mt-1">
                                                                • 10 weeks with Groups A & B<br/>
                                                                • 8 games per player<br/>
                                                                • Mid-season group swap (Week 3)<br/>
                                                                • Playoffs with top 4 from each group
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={handleGenerateBracket}
                                                    className="w-full bg-amber-600 hover:bg-amber-500 px-4 py-3 rounded-lg font-semibold text-left"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-2xl">🥊</span>
                                                        <div>
                                                            <div className="font-bold">Bracket Tournament</div>
                                                            <div className="text-xs text-white/80 mt-1">
                                                                • Single-elimination<br/>
                                                                • Lose once = eliminated<br/>
                                                                • 1-5 games per player<br/>
                                                                • Faster format (4-5 weeks)
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Hint to view bracket */}
                        {!config?.registration_open && leagueMatches.length > 0 && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                                <p className="text-purple-700">
                                    🏆 Bracket has been generated! Go to the <strong>League</strong> tab to view matches.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Player Profile Component
        function PlayerProfile({ playerName }) {
            const [stats, setStats] = useState(null);
            const [loading, setLoading] = useState(true);
            const [selectedPlayer, setSelectedPlayer] = useState(playerName);
            const [allPlayers, setAllPlayers] = useState([]);

            useEffect(() => {
                fetch(`${API_BASE}/players`).then(r => r.json()).then(data => setAllPlayers(data || []));
            }, []);

            useEffect(() => {
                if (!selectedPlayer) {
                    setLoading(false);
                    return;
                }
                setLoading(true);
                fetch(`${API_BASE}/player/${encodeURIComponent(selectedPlayer)}/stats`)
                    .then(r => r.json())
                    .then(data => {
                        setStats(data);
                        setLoading(false);
                    })
                    .catch(() => setLoading(false));
            }, [selectedPlayer]);

            if (!selectedPlayer) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
                        <h2 className="text-xl font-bold mb-4">Player Profile</h2>
                        <p className="text-gray-500 mb-4">Select a player to view their stats:</p>
                        <select
                            className="w-full p-3 border rounded-lg"
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                            value=""
                        >
                            <option value="">-- Select Player --</option>
                            {allPlayers.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                );
            }

            if (loading) {
                return <div className="text-center py-8">Loading player stats...</div>;
            }

            if (!stats) {
                return <div className="text-center py-8 text-gray-500">Could not load stats for {selectedPlayer}</div>;
            }

            return (
                <div className="space-y-6">
                    {/* Player Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">{stats.playerName}</h2>
                                {stats.currentSeason && (
                                    <p className="text-purple-200">
                                        Group {stats.currentSeason.group} | Rank #{stats.currentSeason.rank}
                                    </p>
                                )}
                            </div>
                            <select
                                className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2"
                                value={selectedPlayer}
                                onChange={(e) => setSelectedPlayer(e.target.value)}
                            >
                                {allPlayers.map(p => (
                                    <option key={p.name} value={p.name} className="text-gray-900">{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.currentSeason && (
                            <>
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-green-600">{stats.currentSeason.wins}</div>
                                    <div className="text-gray-500 text-sm">Season Wins</div>
                                </div>
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-red-500">{stats.currentSeason.losses}</div>
                                    <div className="text-gray-500 text-sm">Season Losses</div>
                                </div>
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-purple-600">{stats.currentSeason.winRate}%</div>
                                    <div className="text-gray-500 text-sm">Win Rate</div>
                                </div>
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                                    <div className={`text-3xl font-bold ${stats.currentSeason.pointsFor - stats.currentSeason.pointsAgainst >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {stats.currentSeason.pointsFor - stats.currentSeason.pointsAgainst >= 0 ? '+' : ''}{stats.currentSeason.pointsFor - stats.currentSeason.pointsAgainst}
                                    </div>
                                    <div className="text-gray-500 text-sm">Point Diff</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* All-Time Stats */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h3 className="font-bold text-lg mb-3">All-Time Stats</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-gray-800">{stats.allTime.seasonsPlayed}</div>
                                <div className="text-xs text-gray-500">Seasons</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-600">{stats.allTime.wins}</div>
                                <div className="text-xs text-gray-500">Total Wins</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-red-500">{stats.allTime.losses}</div>
                                <div className="text-xs text-gray-500">Total Losses</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-500">{stats.allTime.championships}</div>
                                <div className="text-xs text-gray-500">Championships</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-400">{stats.allTime.runnerUps}</div>
                                <div className="text-xs text-gray-500">Runner-Ups</div>
                            </div>
                        </div>
                    </div>

                    {/* Head to Head */}
                    {Object.keys(stats.headToHead).length > 0 && (
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                            <h3 className="font-bold text-lg mb-3">Head-to-Head Record</h3>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {Object.entries(stats.headToHead)
                                    .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
                                    .map(([opponent, record]) => (
                                        <div key={opponent} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                            <span className="font-medium">{opponent}</span>
                                            <span className={`font-bold ${record.wins > record.losses ? 'text-green-600' : record.wins < record.losses ? 'text-red-500' : 'text-gray-500'}`}>
                                                {record.wins}-{record.losses}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Match History */}
                    {stats.matchHistory.length > 0 && (
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                            <h3 className="font-bold text-lg mb-3">Recent Matches</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {stats.matchHistory.slice().reverse().map((match, idx) => (
                                    <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${match.won ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-400'}`}>
                                        <div>
                                            <span className="text-gray-500 text-sm mr-2">
                                                {typeof match.week === 'number' ? `Wk ${match.week}` : match.week}
                                            </span>
                                            <span className="font-medium">vs {match.opponent}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${match.won ? 'text-green-600' : 'text-red-500'}`}>
                                                {match.score}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded ${match.won ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                {match.won ? 'W' : 'L'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Table Calendar Component
        function TableCalendar() {
            const [calendarData, setCalendarData] = useState(null);
            const [loading, setLoading] = useState(true);
            const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

            useEffect(() => {
                const start = new Date();
                start.setDate(start.getDate() - 7);
                const end = new Date();
                end.setDate(end.getDate() + 14);

                fetch(`${API_BASE}/table/calendar?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`)
                    .then(r => r.json())
                    .then(data => {
                        setCalendarData(data);
                        setLoading(false);
                    })
                    .catch(() => setLoading(false));
            }, []);

            const [daySlots, setDaySlots] = useState(null);

            useEffect(() => {
                if (selectedDate) {
                    fetch(`${API_BASE}/table/availability/${selectedDate}`)
                        .then(r => r.json())
                        .then(setDaySlots)
                        .catch(() => {});
                }
            }, [selectedDate]);

            if (loading) {
                return <div className="text-center py-8">Loading calendar...</div>;
            }

            // Generate dates for display
            const dates = [];
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 3);
            for (let i = 0; i < 14; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push(d.toISOString().split('T')[0]);
            }

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            return (
                <div className="space-y-6">
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Table Availability Calendar</h2>

                        {/* Date Selector */}
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                            {dates.map(date => {
                                const d = new Date(date + 'T12:00:00');
                                const isToday = date === new Date().toISOString().split('T')[0];
                                const bookings = calendarData?.bookings?.[date] || [];
                                return (
                                    <button
                                        key={date}
                                        onClick={() => setSelectedDate(date)}
                                        className={`flex-shrink-0 p-3 rounded-lg text-center min-w-16 transition-colors ${
                                            selectedDate === date
                                                ? 'bg-purple-600 text-white'
                                                : isToday
                                                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                                    : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                    >
                                        <div className="text-xs font-medium">{dayNames[d.getDay()]}</div>
                                        <div className="text-lg font-bold">{d.getDate()}</div>
                                        {bookings.length > 0 && (
                                            <div className={`text-xs ${selectedDate === date ? 'text-purple-200' : 'text-purple-600'}`}>
                                                {bookings.length} game{bookings.length !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Time Slots for Selected Date */}
                        {daySlots && (
                            <div>
                                <h3 className="font-semibold mb-2">
                                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </h3>
                                <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
                                    {daySlots.slots.map(slot => (
                                        <div
                                            key={slot.time}
                                            className={`p-2 rounded-lg text-center text-sm ${
                                                slot.available
                                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                                    : 'bg-red-100 text-red-700 border border-red-300'
                                            }`}
                                            title={slot.booking ? `${slot.booking.player1} vs ${slot.booking.player2}` : 'Available'}
                                        >
                                            <div className="font-medium">{slot.time}</div>
                                            <div className="text-xs">{slot.available ? 'Free' : 'Booked'}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex gap-4 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded bg-green-500"></span> Available: {daySlots.totalAvailable}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded bg-red-500"></span> Booked: {daySlots.totalBooked}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bookings List */}
                    {calendarData?.bookings?.[selectedDate]?.length > 0 && (
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                            <h3 className="font-bold mb-3">Scheduled Games</h3>
                            <div className="space-y-2">
                                {calendarData.bookings[selectedDate].map(booking => (
                                    <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <span className="font-medium">{booking.player1}</span>
                                            <span className="text-gray-500 mx-2">vs</span>
                                            <span className="font-medium">{booking.player2}</span>
                                            {booking.group && (
                                                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                                    Group {booking.group}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-gray-600">
                                            {booking.startTime?.slice(0, 5)} - {booking.endTime?.slice(0, 5)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Season Archive Component
        function SeasonArchive() {
            const [archives, setArchives] = useState([]);
            const [loading, setLoading] = useState(true);
            const [selectedSeason, setSelectedSeason] = useState(null);
            const [seasonDetails, setSeasonDetails] = useState(null);

            useEffect(() => {
                fetch(`${API_BASE}/seasons/history`)
                    .then(r => r.json())
                    .then(data => {
                        setArchives(data || []);
                        setLoading(false);
                    })
                    .catch(() => setLoading(false));
            }, []);

            const loadSeasonDetails = (seasonNumber) => {
                setSelectedSeason(seasonNumber);
                fetch(`${API_BASE}/seasons/history/${seasonNumber}`)
                    .then(r => r.json())
                    .then(setSeasonDetails)
                    .catch(() => {});
            };

            if (loading) {
                return <div className="text-center py-8">Loading archives...</div>;
            }

            if (archives.length === 0) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 text-center">
                        <h2 className="text-xl font-bold mb-2">Season Archive</h2>
                        <p className="text-gray-500">No archived seasons yet. Seasons are archived when completed.</p>
                    </div>
                );
            }

            return (
                <div className="space-y-6">
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Season Archive</h2>

                        <div className="space-y-3">
                            {archives.map(archive => (
                                <div
                                    key={archive.season_number}
                                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                                        selectedSeason === archive.season_number
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                    }`}
                                    onClick={() => loadSeasonDetails(archive.season_number)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-lg">{archive.name}</h3>
                                            <p className="text-sm text-gray-500">
                                                Season #{archive.season_number} | {archive.total_matches} matches
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            {archive.champion && (
                                                <div className="text-yellow-600 font-bold flex items-center gap-1">
                                                    <span>Champion:</span> {archive.champion}
                                                </div>
                                            )}
                                            {archive.runner_up && (
                                                <div className="text-gray-500 text-sm">
                                                    Runner-up: {archive.runner_up}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Season Details */}
                    {seasonDetails && (
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                            <h3 className="font-bold text-lg mb-4">{seasonDetails.name} - Final Standings</h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                {['A', 'B'].map(group => {
                                    const standings = seasonDetails.data?.standings?.[group];
                                    if (!standings) return null;

                                    const sorted = Object.entries(standings)
                                        .map(([name, s]) => ({ name, ...s }))
                                        .sort((a, b) => {
                                            if (b.wins !== a.wins) return b.wins - a.wins;
                                            return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
                                        });

                                    return (
                                        <div key={group}>
                                            <h4 className="font-semibold mb-2 text-purple-600">Group {group}</h4>
                                            <div className="space-y-1">
                                                {sorted.map((player, idx) => (
                                                    <div key={player.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                        <span>
                                                            <span className="text-gray-400 mr-2">{idx + 1}.</span>
                                                            {player.name}
                                                        </span>
                                                        <span className="text-sm">
                                                            {player.wins}W-{player.losses}L
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function AdminPanel({ players, onCreateSeason, isAdmin, onLogin, onAddPlayer, onCreateBracket, season, onArchiveSeason, onClearSeason }) {
            const [groupA, setGroupA] = useState([]);
            const [groupB, setGroupB] = useState([]);
            const [gamesPerPlayerA, setGamesPerPlayerA] = useState('');
            const [gamesPerPlayerB, setGamesPerPlayerB] = useState('');
            const [newPlayer, setNewPlayer] = useState('');
            const [newPlayerSeed, setNewPlayerSeed] = useState('');
            const [password, setPassword] = useState('');
            const [bracketPlayers, setBracketPlayers] = useState([]);
            const [addingPlayer, setAddingPlayer] = useState(false);
            const [creatingBracket, setCreatingBracket] = useState(false);
            const [editingSeed, setEditingSeed] = useState(null);
            const [editSeedValue, setEditSeedValue] = useState('');
            const [deletingPlayer, setDeletingPlayer] = useState(null);

            const addToGroup = (player, group) => {
                if (group === 'A') {
                    setGroupB(groupB.filter(p => p.name !== player.name));
                    if (!groupA.find(p => p.name === player.name)) setGroupA([...groupA, player]);
                } else {
                    setGroupA(groupA.filter(p => p.name !== player.name));
                    if (!groupB.find(p => p.name === player.name)) setGroupB([...groupB, player]);
                }
            };

            const addNewPlayerToGroup = () => {
                if (!newPlayer.trim()) return;
                const player = { name: newPlayer.trim(), seed: null };
                setGroupB([...groupB, player]);
                setNewPlayer('');
            };

            const handleAddPlayerToDatabase = async () => {
                if (!newPlayer.trim()) return;
                setAddingPlayer(true);
                try {
                    await onAddPlayer(newPlayer.trim(), newPlayerSeed ? parseInt(newPlayerSeed) : null);
                    setNewPlayer('');
                    setNewPlayerSeed('');
                } finally {
                    setAddingPlayer(false);
                }
            };

            const toggleBracketPlayer = (player) => {
                if (bracketPlayers.find(p => p.name === player.name)) {
                    setBracketPlayers(bracketPlayers.filter(p => p.name !== player.name));
                } else {
                    setBracketPlayers([...bracketPlayers, player]);
                }
            };

            const handleCreateBracket = async () => {
                if (bracketPlayers.length < 2) return;
                setCreatingBracket(true);
                try {
                    await onCreateBracket(bracketPlayers);
                    setBracketPlayers([]);
                } finally {
                    setCreatingBracket(false);
                }
            };

            const handleUpdateSeed = async (playerName, newSeed) => {
                try {
                    const res = await fetch(`${API_BASE}/players/${encodeURIComponent(playerName)}/seed`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': localStorage.getItem('adminPassword') || '' },
                        body: JSON.stringify({ seed: newSeed === '' ? null : parseInt(newSeed) })
                    });
                    if (res.ok) {
                        setEditingSeed(null);
                        setEditSeedValue('');
                        window.location.reload();
                    }
                } catch (e) {
                    console.error('Failed to update seed:', e);
                }
            };

            const handleDeletePlayer = async (playerName) => {
                if (!confirm(`Are you sure you want to delete ${playerName}? This cannot be undone.`)) return;
                try {
                    const res = await fetch(`${API_BASE}/players/${encodeURIComponent(playerName)}`, {
                        method: 'DELETE',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    if (res.ok) {
                        setDeletingPlayer(null);
                        window.location.reload();
                    }
                } catch (e) {
                    console.error('Failed to delete player:', e);
                }
            };

            if (!isAdmin) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 max-w-md mx-auto">
                        <h2 className="text-xl font-bold mb-4">Admin Login</h2>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-gray-100 rounded-lg px-4 py-2 mb-4" />
                        <button onClick={() => onLogin(password)} className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg font-semibold">Login</button>
                    </div>
                );
            }

            return (
                <div className="space-y-6">
                    {/* Season Management */}
                    {season && (
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                            <h2 className="text-xl font-bold mb-4">Season Management</h2>
                            <div className="flex flex-wrap gap-3">
                                {season.status === 'complete' && (
                                    <button
                                        onClick={onArchiveSeason}
                                        className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                        </svg>
                                        Archive Season & Start New
                                    </button>
                                )}
                                <button
                                    onClick={onClearSeason}
                                    className="bg-rose-600 hover:bg-rose-500 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                    Delete Season (No Archive)
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                                {season.status === 'complete'
                                    ? 'Season is complete! Archive it to save to history before creating a new season.'
                                    : `Current season status: ${season.status}. Complete the season before archiving.`}
                            </p>
                        </div>
                    )}

                    {/* Manage Players */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Manage Players ({players.length})</h2>
                        <p className="text-sm text-gray-500 mb-4">Edit seed rankings or delete players from the database.</p>
                        <div className="max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="text-left px-3 py-2">Player Name</th>
                                        <th className="text-center px-3 py-2 w-24">Seed</th>
                                        <th className="text-right px-3 py-2 w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map((p, idx) => (
                                        <tr key={p.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-3 py-2 font-medium">{p.name}</td>
                                            <td className="px-3 py-2 text-center">
                                                {editingSeed === p.name ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editSeedValue}
                                                            onChange={e => setEditSeedValue(e.target.value)}
                                                            placeholder="Seed"
                                                            className="w-16 px-2 py-1 bg-gray-100 rounded text-center text-sm"
                                                            min="1"
                                                        />
                                                        <button onClick={() => handleUpdateSeed(p.name, editSeedValue)} className="text-green-600 hover:text-green-500 text-xs">✓</button>
                                                        <button onClick={() => handleUpdateSeed(p.name, '')} className="text-amber-600 hover:text-amber-500 text-xs">⊘</button>
                                                        <button onClick={() => { setEditingSeed(null); setEditSeedValue(''); }} className="text-gray-500 hover:text-gray-400 text-xs">✕</button>
                                                    </div>
                                                ) : (
                                                    <span className={p.seed ? 'text-purple-600 font-semibold' : 'text-gray-400'}>
                                                        {p.seed ? `#${p.seed}` : '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => { setEditingSeed(p.name); setEditSeedValue(p.seed || ''); }}
                                                        className="text-purple-600 hover:text-purple-500 text-xs px-2 py-1 rounded bg-purple-100 hover:bg-purple-200"
                                                    >
                                                        Edit Seed
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePlayer(p.name)}
                                                        className="text-rose-600 hover:text-rose-500 text-xs px-2 py-1 rounded bg-rose-100 hover:bg-rose-200"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Add Player to Database */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Add Player to Database</h2>
                        <div className="flex gap-2 flex-wrap">
                            <input
                                type="text"
                                value={newPlayer}
                                onChange={e => setNewPlayer(e.target.value)}
                                placeholder="Player name"
                                className="flex-1 min-w-[200px] bg-gray-100 rounded-lg px-4 py-2"
                            />
                            <input
                                type="number"
                                value={newPlayerSeed}
                                onChange={e => setNewPlayerSeed(e.target.value)}
                                placeholder="Seed (optional)"
                                className="w-32 bg-gray-100 rounded-lg px-4 py-2"
                            />
                            <button
                                onClick={handleAddPlayerToDatabase}
                                disabled={!newPlayer.trim() || addingPlayer}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 px-6 py-2 rounded-lg font-semibold"
                            >
                                {addingPlayer ? 'Adding...' : 'Add Player'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Players added here are saved to the database permanently.</p>
                    </div>

                    {/* Send Manual Notification */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Send Push Notification</h2>
                        <p className="text-sm text-gray-500 mb-4">Send custom notifications to players.</p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Recipients</label>
                                <select
                                    id="notif-recipient"
                                    className="w-full bg-gray-100 rounded-lg px-4 py-2 text-sm"
                                    defaultValue="all"
                                >
                                    <option value="all">All Players</option>
                                    <option value="groupA">Group A Only</option>
                                    <option value="groupB">Group B Only</option>
                                    {players.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Title</label>
                                <input
                                    type="text"
                                    id="notif-title"
                                    placeholder="e.g., Important Update"
                                    className="w-full bg-gray-100 rounded-lg px-4 py-2 text-sm"
                                    maxLength="50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Message</label>
                                <textarea
                                    id="notif-message"
                                    placeholder="e.g., Tournament schedule has been updated..."
                                    className="w-full bg-gray-100 rounded-lg px-4 py-2 text-sm resize-none"
                                    rows="3"
                                    maxLength="200"
                                />
                            </div>

                            <button
                                onClick={async () => {
                                    const recipient = document.getElementById('notif-recipient').value;
                                    const title = document.getElementById('notif-title').value.trim();
                                    const message = document.getElementById('notif-message').value.trim();

                                    if (!title || !message) {
                                        alert('Please fill in both title and message');
                                        return;
                                    }

                                    if (!confirm(`Send notification to ${recipient === 'all' ? 'all players' : recipient}?`)) return;

                                    try {
                                        const res = await fetch(`${API_BASE}/notifications/send-manual`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'X-Admin-Password': localStorage.getItem('adminPassword') || ''
                                            },
                                            body: JSON.stringify({ recipient, title, message })
                                        });

                                        const data = await res.json();

                                        if (res.ok) {
                                            alert(`✓ Notification sent successfully to ${data.recipientCount} player(s)`);
                                            document.getElementById('notif-title').value = '';
                                            document.getElementById('notif-message').value = '';
                                            document.getElementById('notif-recipient').value = 'all';
                                        } else {
                                            alert(`Failed: ${data.error}`);
                                        }
                                    } catch (e) {
                                        alert('Failed to send notification: ' + e.message);
                                    }
                                }}
                                className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                                </svg>
                                Send Notification
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">Notifications will be sent to all subscribed players in the selected group.</p>
                    </div>

                    {/* Create Bracket */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Create Double Elimination Bracket</h2>
                        <p className="text-sm text-gray-500 mb-4">Select players for the bracket tournament:</p>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {players.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => toggleBracketPlayer(p)}
                                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                        bracketPlayers.find(bp => bp.name === p.name)
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    {p.name} {p.seed ? `(#${p.seed})` : ''}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                {bracketPlayers.length} players selected
                            </span>
                            <button
                                onClick={handleCreateBracket}
                                disabled={bracketPlayers.length < 2 || creatingBracket}
                                className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-gray-500 px-6 py-2 rounded-lg font-semibold"
                            >
                                {creatingBracket ? 'Creating...' : 'Create Bracket'}
                            </button>
                        </div>
                    </div>

                    {/* Create Season */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h2 className="text-xl font-bold mb-4">Create New Season</h2>

                        <div className="mb-4">
                            <div className="flex gap-2 mb-2">
                                <input type="text" value={newPlayer} onChange={e => setNewPlayer(e.target.value)} placeholder="Add player to groups" className="flex-1 bg-gray-100 rounded-lg px-4 py-2" />
                                <button onClick={addNewPlayerToGroup} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg"><Icons.Plus /></button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 mb-2">Available Players</h3>
                                <div className="bg-gray-100 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto space-y-1">
                                    {players.filter(p => !groupA.find(g => g.name === p.name) && !groupB.find(g => g.name === p.name)).map(p => (
                                        <div key={p.name} className="flex items-center justify-between bg-gray-200 rounded px-2 py-1 text-sm">
                                            <span>{p.name} {p.seed ? `(#${p.seed})` : ''}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => addToGroup(p, 'A')} className="text-green-600 hover:text-emerald-300 text-xs">→A</button>
                                                <button onClick={() => addToGroup(p, 'B')} className="text-amber-600 hover:text-amber-300 text-xs">→B</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-green-600 mb-2">Group A: Seeded ({groupA.length})</h3>
                                <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto space-y-1">
                                    {groupA.map(p => (
                                        <div key={p.name} className="flex items-center justify-between bg-gray-200 rounded px-2 py-1 text-sm">
                                            <span>{p.name}</span>
                                            <button onClick={() => setGroupA(groupA.filter(g => g.name !== p.name))} className="text-red-500 text-xs">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-amber-600 mb-2">Group B: Unseeded ({groupB.length})</h3>
                                <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-2 min-h-[200px] max-h-[300px] overflow-y-auto space-y-1">
                                    {groupB.map(p => (
                                        <div key={p.name} className="flex items-center justify-between bg-gray-200 rounded px-2 py-1 text-sm">
                                            <span>{p.name}</span>
                                            <button onClick={() => setGroupB(groupB.filter(g => g.name !== p.name))} className="text-red-500 text-xs">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h3 className="text-sm font-semibold text-blue-900 mb-3">Games Per Player (Optional)</h3>
                            <p className="text-xs text-blue-700 mb-3">
                                Leave blank for full round-robin. Set a number to limit games (useful for large groups).
                            </p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">
                                        Group A: Seeded
                                        <span className="text-gray-400 ml-1">
                                            (Full: {groupA.length > 0 ? groupA.length - 1 : 0} games)
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={groupA.length > 0 ? groupA.length - 1 : 100}
                                        value={gamesPerPlayerA}
                                        onChange={e => setGamesPerPlayerA(e.target.value)}
                                        placeholder={`Default: ${groupA.length > 0 ? groupA.length - 1 : 'auto'}`}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">
                                        Group B: Unseeded
                                        <span className="text-gray-400 ml-1">
                                            (Full: {groupB.length > 0 ? groupB.length - 1 : 0} games)
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={groupB.length > 0 ? groupB.length - 1 : 100}
                                        value={gamesPerPlayerB}
                                        onChange={e => setGamesPerPlayerB(e.target.value)}
                                        placeholder={`Default: ${groupB.length > 0 ? groupB.length - 1 : 'auto'}`}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            {gamesPerPlayerA && groupA.length > 0 && parseInt(gamesPerPlayerA) < groupA.length - 1 && (
                                <p className="text-xs text-orange-600 mt-2">
                                    ⚠️ Group A: Partial schedule - not all players will face each other
                                </p>
                            )}
                            {gamesPerPlayerB && groupB.length > 0 && parseInt(gamesPerPlayerB) < groupB.length - 1 && (
                                <p className="text-xs text-orange-600 mt-2">
                                    ⚠️ Group B: Partial schedule - not all players will face each other
                                </p>
                            )}
                        </div>

                        <button onClick={() => onCreateSeason(groupA, groupB)} disabled={groupA.length < 2 || groupB.length < 2} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-500 py-3 rounded-lg font-semibold">
                            Create Season (10 weeks)
                        </button>
                    </div>
                </div>
            );
        }

        // Player Self-Registration Component
        function PlayerRegistration({ onSuccess }) {
            const [name, setName] = useState('');
            const [email, setEmail] = useState('');
            const [loading, setLoading] = useState(false);
            const [message, setMessage] = useState(null);

            const handleRegister = async () => {
                if (!name.trim()) return;
                setLoading(true);
                setMessage(null);

                try {
                    const res = await fetch(`${API_BASE}/players/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name.trim(), email: email.trim() || null })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        setMessage({ type: 'success', text: data.message });
                        setName('');
                        setEmail('');
                        onSuccess?.();
                    } else {
                        setMessage({ type: 'error', text: data.error });
                    }
                } catch (e) {
                    setMessage({ type: 'error', text: 'Registration failed. Please try again.' });
                }
                setLoading(false);
            };

            return (
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 max-w-md">
                    <h3 className="text-lg font-bold mb-2">Join the League</h3>
                    <p className="text-sm text-gray-500 mb-4">Register to be added to the next season</p>

                    {message && (
                        <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-emerald-900/50 text-green-600' : 'bg-rose-900/50 text-red-500'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="space-y-3">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your full name *"
                            className="w-full bg-gray-100 rounded-lg px-4 py-3"
                        />
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Email (optional)"
                            className="w-full bg-gray-100 rounded-lg px-4 py-3"
                        />
                        <button
                            onClick={handleRegister}
                            disabled={!name.trim() || loading}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 py-3 rounded-lg font-semibold"
                        >
                            {loading ? 'Registering...' : 'Register'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">New players are added to Group B (Unseeded) when the next season starts.</p>
                </div>
            );
        }

        // Season History Archive Component
        function SeasonHistory() {
            const [history, setHistory] = useState([]);
            const [loading, setLoading] = useState(true);
            const [selectedSeason, setSelectedSeason] = useState(null);

            useEffect(() => {
                fetch(`${API_BASE}/seasons/history`)
                    .then(res => res.json())
                    .then(data => {
                        setHistory(Array.isArray(data) ? data : []);
                        setLoading(false);
                    })
                    .catch(() => setLoading(false));
            }, []);

            if (loading) return <div className="text-center py-8 text-gray-500">Loading history...</div>;

            if (history.length === 0) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 text-center">
                        <h3 className="text-lg font-bold mb-2">Season History</h3>
                        <p className="text-gray-500">No archived seasons yet. History will appear here after each completed season.</p>
                    </div>
                );
            }

            return (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Season History</h3>
                    <div className="grid gap-4">
                        {history.map(season => (
                            <div key={season.season_number} className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-lg">{season.name}</h4>
                                        <p className="text-sm text-gray-500">
                                            {new Date(season.created_at).toLocaleDateString()} • {season.total_matches} matches
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="text-2xl">🏆</span>
                                            <span className="font-bold text-green-600">{season.champion}</span>
                                        </div>
                                        <p className="text-sm text-gray-500">Runner-up: {season.runner_up}</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-green-600">Group A Champion:</span> {season.group_a_champion}
                                    </div>
                                    <div>
                                        <span className="text-amber-600">Group B Champion:</span> {season.group_b_champion}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Service Worker Registration for Web Push
        const registerServiceWorker = async () => {
            if (!('serviceWorker' in navigator)) {
                console.log('Service Worker not supported');
                return null;
            }

            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered:', registration.scope);
                return registration;
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                return null;
            }
        };

        // Subscribe to Web Push notifications
        const subscribeToPush = async (playerName) => {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Get VAPID public key from server
                const vapidRes = await fetch(`${API_BASE}/push/vapid-public-key`);
                const { publicKey } = await vapidRes.json();

                // Convert VAPID key to Uint8Array
                const urlBase64ToUint8Array = (base64String) => {
                    const padding = '='.repeat((4 - base64String.length % 4) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i);
                    }
                    return outputArray;
                };

                // Subscribe to push
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });

                // Send subscription to server
                await fetch(`${API_BASE}/push/subscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscription: subscription.toJSON(),
                        playerName
                    })
                });

                console.log('Push subscription successful');
                return subscription;
            } catch (error) {
                console.error('Push subscription failed:', error);
                return null;
            }
        };

        // Browser Push Notifications Helper (now with Service Worker)
        const requestPushPermission = async (playerName = null) => {
            if (!('Notification' in window)) {
                return { supported: false, permission: null };
            }

            if (Notification.permission === 'granted') {
                // Already granted - make sure we're subscribed to web push
                const swReg = await registerServiceWorker();
                if (swReg) {
                    await subscribeToPush(playerName);
                }
                return { supported: true, permission: 'granted' };
            }

            if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    // Register service worker and subscribe to web push
                    const swReg = await registerServiceWorker();
                    if (swReg) {
                        await subscribeToPush(playerName);
                    }
                }
                return { supported: true, permission };
            }

            return { supported: true, permission: 'denied' };
        };

        const showBrowserNotification = (title, body, icon = '🏓') => {
            if (Notification.permission === 'granted') {
                new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: 'pingpong-notification',
                    requireInteraction: false
                });
            }
        };

        // Register service worker on page load
        if ('serviceWorker' in navigator) {
            registerServiceWorker();
        }

        // Notifications Bell Component
        function NotificationsBell({ currentPlayer }) {
            const [notifications, setNotifications] = useState([]);
            const [unreadCount, setUnreadCount] = useState(0);
            const [showDropdown, setShowDropdown] = useState(false);
            const [pushEnabled, setPushEnabled] = useState(false);
            const [lastNotificationId, setLastNotificationId] = useState(null);

            useEffect(() => {
                // Check if push is already enabled
                if ('Notification' in window && Notification.permission === 'granted') {
                    setPushEnabled(true);
                }
            }, []);

            useEffect(() => {
                if (!currentPlayer) return;

                const fetchNotifications = async () => {
                    try {
                        const res = await fetch(`${API_BASE}/notifications/${encodeURIComponent(currentPlayer)}`);
                        const data = await res.json();
                        const newNotifications = data.notifications || [];
                        setNotifications(newNotifications);
                        setUnreadCount(data.unreadCount || 0);

                        // Show browser notification for new unread notifications
                        if (pushEnabled && newNotifications.length > 0) {
                            const latestUnread = newNotifications.find(n => !n.is_read);
                            if (latestUnread && latestUnread.id !== lastNotificationId) {
                                setLastNotificationId(latestUnread.id);
                                showBrowserNotification(latestUnread.title, latestUnread.message);
                            }
                        }
                    } catch (e) { }
                };

                fetchNotifications();
                const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
                return () => clearInterval(interval);
            }, [currentPlayer, pushEnabled, lastNotificationId]);

            const markAllRead = async () => {
                if (!currentPlayer) return;
                await fetch(`${API_BASE}/notifications/${encodeURIComponent(currentPlayer)}/read-all`, { method: 'PUT' });
                setNotifications(notifications.map(n => ({ ...n, is_read: true })));
                setUnreadCount(0);
            };

            const handleBellClick = () => {
                if (!currentPlayer) {
                    alert('Please select your player name first.\n\nGo to "My Games" tab and select your name to enable notifications.');
                    return;
                }
                setShowDropdown(!showDropdown);
            };

            return (
                <div className="relative">
                    <button
                        onClick={handleBellClick}
                        className={`relative p-2 rounded-lg transition-colors ${currentPlayer ? 'hover:bg-gray-200 text-gray-900' : 'text-gray-400 cursor-pointer hover:bg-gray-100'}`}
                        title={currentPlayer ? 'Notifications' : 'Select player name first (My Games tab)'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                        </svg>
                        {currentPlayer && unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-xs flex items-center justify-center font-bold text-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-100 rounded-xl shadow-xl z-50 border border-gray-300">
                            <div className="flex items-center justify-between p-3 border-b border-gray-300">
                                <span className="font-semibold">Notifications</span>
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} className="text-xs text-purple-600 hover:text-violet-300">
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            {/* Push Notification Toggle */}
                            {'Notification' in window && (
                                <div className="p-3 border-b border-gray-300 bg-gray-200/30">
                                    {Notification.permission === 'denied' ? (
                                        <div className="flex items-center gap-2 text-xs text-amber-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                            </svg>
                                            <span>Browser notifications blocked. Check browser settings.</span>
                                        </div>
                                    ) : pushEnabled ? (
                                        <div className="flex items-center gap-2 text-xs text-green-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                            </svg>
                                            <span>Push notifications enabled</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                const result = await requestPushPermission(currentPlayer);
                                                if (result.permission === 'granted') {
                                                    setPushEnabled(true);
                                                    showBrowserNotification('Notifications Enabled', 'You will now receive match updates!');
                                                }
                                            }}
                                            className="flex items-center gap-2 text-xs text-purple-600 hover:text-violet-300 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                                            </svg>
                                            <span>Enable push notifications</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="p-4 text-center text-gray-500 text-sm">No notifications</p>
                                ) : (
                                    notifications.slice(0, 10).map(n => (
                                        <div key={n.id} className={`p-3 border-b border-gray-300 ${!n.is_read ? 'bg-gray-200/50' : ''}`}>
                                            <div className="flex items-start gap-2">
                                                {!n.is_read && <span className="w-2 h-2 bg-violet-500 rounded-full mt-2"></span>}
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{n.title}</p>
                                                    <p className="text-xs text-gray-500">{n.message}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // My Games - Personal player dashboard
        function MyGames({ players, season, currentPlayer, onSelectPlayer }) {
            const [showAvatarPicker, setShowAvatarPicker] = useState(false);
            const [, forceUpdate] = useState(0); // To trigger re-render after avatar change
            const [leagueMatches, setLeagueMatches] = useState([]);

            useEffect(() => {
                // Fetch league matches
                fetch(`${API_BASE}/league/matches`)
                    .then(r => r.json())
                    .then(data => setLeagueMatches(data || []))
                    .catch(() => setLeagueMatches([]));
            }, []);

            const playerStats = useMemo(() => {
                if (!currentPlayer) return null;
                if (!season && leagueMatches.length === 0) return null;

                // Get league bracket matches for this player
                const playerLeagueMatches = leagueMatches.filter(m =>
                    m.player1 === currentPlayer || m.player2 === currentPlayer
                );

                // If no season, return league-only stats
                if (!season && playerLeagueMatches.length > 0) {
                    // Calculate league stats
                    const wins = playerLeagueMatches.filter(m => m.completed && m.winner === currentPlayer).length;
                    const losses = playerLeagueMatches.filter(m => m.completed && m.winner && m.winner !== currentPlayer).length;

                    return {
                        leagueOnly: true,
                        stats: { wins, losses, pointsFor: 0, pointsAgainst: 0 },
                        matches: [],
                        leagueMatches: playerLeagueMatches
                    };
                }

                // Season-based logic
                const inGroupA = season?.standings?.A?.[currentPlayer];
                const inGroupB = season?.standings?.B?.[currentPlayer];
                const group = inGroupA ? 'A' : (inGroupB ? 'B' : null);
                const stats = inGroupA || inGroupB;

                // Get all season matches for this player
                const allMatches = [];
                if (season && group) {
                    const schedule = season.schedule?.[group] || [];
                    schedule.forEach((week, weekIdx) => {
                        week.forEach(match => {
                            if (match.player1 === currentPlayer || match.player2 === currentPlayer) {
                                allMatches.push({ ...match, week: weekIdx + 1 });
                            }
                        });
                    });
                }

                // Calculate rank in group
                let rank = null;
                let totalPlayers = null;
                if (season && group && stats) {
                    const standings = Object.entries(season.standings[group] || {})
                        .map(([name, s]) => ({ name, ...s }))
                        .sort((a, b) => {
                            if (b.wins !== a.wins) return b.wins - a.wins;
                            const diffA = a.pointsFor - a.pointsAgainst;
                            const diffB = b.pointsFor - b.pointsAgainst;
                            return diffB - diffA;
                        });
                    rank = standings.findIndex(p => p.name === currentPlayer) + 1;
                    totalPlayers = standings.length;
                }

                // Check wildcard eligibility
                const wildcardMatch = season?.wildcard?.matches?.find(m =>
                    m.player1 === currentPlayer || m.player2 === currentPlayer
                );

                // Check playoff qualification
                const playoffTeam = season?.playoffs?.[group];
                const inPlayoffs = playoffTeam?.semifinals?.some(m =>
                    m.player1 === currentPlayer || m.player2 === currentPlayer
                ) || playoffTeam?.final?.player1 === currentPlayer || playoffTeam?.final?.player2 === currentPlayer;

                return {
                    group,
                    rank,
                    totalPlayers,
                    stats: stats || { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
                    matches: allMatches,
                    leagueMatches: playerLeagueMatches,
                    wildcardMatch,
                    inPlayoffs,
                    isChampion: season?.playoffs?.[group]?.champion === currentPlayer,
                    isFinalist: season?.superBowl?.player1 === currentPlayer || season?.superBowl?.player2 === currentPlayer,
                    isOverallChamp: season?.superBowl?.winner === currentPlayer
                };
            }, [currentPlayer, season, leagueMatches]);

            if (!players?.length) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 text-center">
                        <p className="text-gray-500">No players registered yet.</p>
                    </div>
                );
            }

            return (
                <div className="space-y-4">
                    {/* Player Selection */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                        <h3 className="text-lg font-bold mb-3">Select Your Name</h3>
                        <select
                            value={currentPlayer}
                            onChange={e => onSelectPlayer(e.target.value)}
                            className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-lg"
                        >
                            <option value="">-- Select Player --</option>
                            {players.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {currentPlayer && playerStats && (
                        <>
                            {/* Player Card */}
                            {!playerStats.leagueOnly && (
                            <div className={`bg-gradient-to-r ${playerStats.group === 'A' ? 'from-green-100 to-white' : 'from-amber-100 to-white'} rounded-xl p-6 border ${playerStats.group === 'A' ? 'border-emerald-700' : 'border-amber-700'}`}>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative group">
                                        <PlayerAvatar name={currentPlayer} size="lg" onClick={() => setShowAvatarPicker(true)} />
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{currentPlayer}</h2>
                                        <p className={`text-sm ${playerStats.group === 'A' ? 'text-green-600' : 'text-amber-600'}`}>
                                            Group {playerStats.group} • Rank #{playerStats.rank} of {playerStats.totalPlayers}
                                        </p>
                                        <button onClick={() => setShowAvatarPicker(true)} className="text-xs text-gray-500 hover:text-white mt-1">
                                            Change avatar
                                        </button>
                                    </div>
                                    {playerStats.isOverallChamp && <span className="text-4xl">🏆</span>}
                                    {playerStats.isChampion && !playerStats.isOverallChamp && <span className="text-3xl">👑</span>}
                                </div>

                                {/* Avatar Picker Modal */}
                                {showAvatarPicker && (
                                    <AvatarPicker
                                        playerName={currentPlayer}
                                        onClose={() => setShowAvatarPicker(false)}
                                        onSelect={() => forceUpdate(n => n + 1)}
                                    />
                                )}

                                {/* Stats Grid */}
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <div className="bg-gray-100/50 rounded-lg p-3">
                                        <div className="text-2xl font-bold text-green-600">{playerStats.stats.wins}</div>
                                        <div className="text-xs text-gray-500">Wins</div>
                                    </div>
                                    <div className="bg-gray-100/50 rounded-lg p-3">
                                        <div className="text-2xl font-bold text-red-500">{playerStats.stats.losses}</div>
                                        <div className="text-xs text-gray-500">Losses</div>
                                    </div>
                                    <div className="bg-gray-100/50 rounded-lg p-3">
                                        <div className="text-2xl font-bold">{playerStats.stats.pointsFor}</div>
                                        <div className="text-xs text-gray-500">Games Won</div>
                                    </div>
                                    <div className="bg-gray-100/50 rounded-lg p-3">
                                        <div className={`text-2xl font-bold ${(playerStats.stats.pointsFor - playerStats.stats.pointsAgainst) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {playerStats.stats.pointsFor - playerStats.stats.pointsAgainst >= 0 ? '+' : ''}{playerStats.stats.pointsFor - playerStats.stats.pointsAgainst}
                                        </div>
                                        <div className="text-xs text-gray-500">Diff</div>
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* Status Badges */}
                            {!playerStats.leagueOnly && (
                            <div className="flex flex-wrap gap-2">
                                {playerStats.rank <= 4 && (
                                    <span className="bg-emerald-900/50 text-green-600 px-3 py-1 rounded-full text-sm">✓ Playoff Qualified</span>
                                )}
                                {playerStats.rank === 5 || playerStats.rank === 6 ? (
                                    <span className="bg-violet-900/50 text-purple-600 px-3 py-1 rounded-full text-sm">⚡ Wildcard Eligible</span>
                                ) : null}
                                {playerStats.wildcardMatch && (
                                    <span className="bg-amber-900/50 text-amber-600 px-3 py-1 rounded-full text-sm">
                                        🎯 Wildcard: vs {playerStats.wildcardMatch.player1 === currentPlayer ? playerStats.wildcardMatch.player2 : playerStats.wildcardMatch.player1}
                                    </span>
                                )}
                                {playerStats.inPlayoffs && (
                                    <span className="bg-cyan-900/50 text-cyan-400 px-3 py-1 rounded-full text-sm">🏆 In Playoffs</span>
                                )}
                            </div>
                            )}

                            {/* League-Only Mode Stats */}
                            {playerStats.leagueOnly && (
                                <div className="bg-gradient-to-r from-purple-100 to-white rounded-xl p-6 border border-purple-700">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="relative group">
                                            <PlayerAvatar name={currentPlayer} size="lg" onClick={() => setShowAvatarPicker(true)} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">{currentPlayer}</h2>
                                            <p className="text-sm text-purple-600">League Bracket Player</p>
                                        </div>
                                    </div>

                                    {showAvatarPicker && (
                                        <AvatarPicker
                                            playerName={currentPlayer}
                                            onClose={() => setShowAvatarPicker(false)}
                                            onSelect={() => forceUpdate(n => n + 1)}
                                        />
                                    )}

                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div className="bg-gray-100/50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-green-600">{playerStats.stats.wins}</div>
                                            <div className="text-xs text-gray-500">Wins</div>
                                        </div>
                                        <div className="bg-gray-100/50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-red-500">{playerStats.stats.losses}</div>
                                            <div className="text-xs text-gray-500">Losses</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Season Match History */}
                            {!playerStats.leagueOnly && playerStats.matches.length > 0 && (
                            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                <h3 className="text-lg font-bold mb-3">Your Season Matches</h3>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {playerStats.matches.map((match, idx) => {
                                        const opponent = match.player1 === currentPlayer ? match.player2 : match.player1;
                                        const isWinner = match.winner === currentPlayer;
                                        const isLoser = match.loser === currentPlayer;

                                        return (
                                            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${match.completed ? (isWinner ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-rose-900/20 border border-rose-800') : 'bg-gray-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-500 w-12">Wk {match.week}</span>
                                                    <PlayerAvatar name={opponent} size="sm" />
                                                    <span className="font-medium">{opponent}</span>
                                                </div>
                                                <div>
                                                    {match.completed ? (
                                                        <div className={`flex items-center gap-2 ${isWinner ? 'text-green-600' : 'text-red-500'}`}>
                                                            <span className="font-bold">{isWinner ? 'W' : 'L'}</span>
                                                            <span className="text-sm">{match.score1}-{match.score2}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500 text-sm">Upcoming</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            )}

                            {/* League Bracket Matches */}
                            {playerStats.leagueMatches && playerStats.leagueMatches.length > 0 && (
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                        <span>🏆</span>
                                        Your Bracket Matches
                                    </h3>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {playerStats.leagueMatches.map((match) => {
                                            const opponent = match.player1 === currentPlayer ? match.player2 : match.player1;
                                            const opponentSeed = match.player1 === currentPlayer ? match.seed2 : match.seed1;
                                            const isWinner = match.winner === currentPlayer;
                                            const isBye = match.is_bye;

                                            return (
                                                <div key={match.id} className={`p-3 rounded-lg border ${match.completed ? (isWinner ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300') : 'bg-purple-50 border-purple-200'}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-semibold text-gray-600">
                                                            Round {match.round} • Match {match.match_number}
                                                        </span>
                                                        {isBye && (
                                                            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded font-semibold">
                                                                BYE
                                                            </span>
                                                        )}
                                                        {match.completed && (
                                                            <span className={`text-xs px-2 py-1 rounded font-semibold ${isWinner ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                                {isWinner ? 'WON' : 'LOST'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {!isBye && <PlayerAvatar name={opponent} size="sm" />}
                                                        <div>
                                                            <div className="font-medium">
                                                                {isBye ? 'BYE - Automatic Advance' : opponent}
                                                            </div>
                                                            {opponentSeed && !isBye && (
                                                                <span className="text-xs text-gray-500">Seed #{opponentSeed}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {match.score && (
                                                        <div className="mt-2 text-sm text-gray-600">
                                                            Score: {match.score}
                                                        </div>
                                                    )}
                                                    {!match.completed && !isBye && opponent !== 'TBD' && (
                                                        <div className="mt-2 text-xs text-purple-600 font-semibold">
                                                            Match pending - check League tab
                                                        </div>
                                                    )}
                                                    {opponent === 'TBD' && (
                                                        <div className="mt-2 text-xs text-gray-500 italic">
                                                            Waiting for previous round to complete
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {currentPlayer && !playerStats && (
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 text-center">
                            <p className="text-gray-500">Player "{currentPlayer}" not found in current season.</p>
                        </div>
                    )}
                </div>
            );
        }

        // History/Activity Feed - Shows all match results like a news feed
        function HistoryFeed({ season }) {
            const [filter, setFilter] = useState('all'); // 'all', 'A', 'B'

            // Collect all completed matches with details
            const allEvents = useMemo(() => {
                if (!season?.schedule) return [];

                const events = [];

                // Get all completed matches from schedule
                ['A', 'B'].forEach(group => {
                    season.schedule[group]?.forEach((week, weekIdx) => {
                        week.forEach(match => {
                            if (match.completed && match.winner) {
                                events.push({
                                    type: 'match',
                                    group,
                                    week: weekIdx + 1,
                                    winner: match.winner,
                                    loser: match.loser,
                                    score1: match.score1,
                                    score2: match.score2,
                                    matchId: match.id,
                                    timestamp: Date.now() - (10 - weekIdx) * 86400000 // Fake timestamps for ordering
                                });
                            }
                        });
                    });
                });

                // Get wildcard results
                if (season.wildcard?.matches) {
                    season.wildcard.matches.forEach(match => {
                        if (match.completed && match.winner) {
                            events.push({
                                type: 'wildcard',
                                group: 'Wildcard',
                                week: 'Wildcard',
                                winner: match.winner,
                                loser: match.loser,
                                score1: match.score1,
                                score2: match.score2,
                                description: match.description,
                                winnerGroup: match.winner === match.player1 ? match.player1Group : match.player2Group,
                                timestamp: Date.now() - 100000
                            });
                        }
                    });
                }

                // Get playoff results
                if (season.playoffs) {
                    ['A', 'B'].forEach(group => {
                        if (season.playoffs[group]) {
                            // Semifinals
                            season.playoffs[group].semifinals?.forEach((sf, idx) => {
                                if (sf.completed && sf.winner) {
                                    events.push({
                                        type: 'playoff',
                                        group,
                                        round: 'Semifinal',
                                        winner: sf.winner,
                                        loser: sf.loser,
                                        score1: sf.score1,
                                        score2: sf.score2,
                                        timestamp: Date.now() - 50000 + idx * 1000
                                    });
                                }
                            });
                            // Final
                            if (season.playoffs[group].final?.completed) {
                                events.push({
                                    type: 'champion',
                                    group,
                                    round: 'Final',
                                    winner: season.playoffs[group].champion,
                                    loser: season.playoffs[group].final.loser,
                                    score1: season.playoffs[group].final.score1,
                                    score2: season.playoffs[group].final.score2,
                                    timestamp: Date.now() - 10000
                                });
                            }
                        }
                    });
                }

                // Super Bowl
                if (season.superBowl?.completed) {
                    events.push({
                        type: 'superbowl',
                        winner: season.champion,
                        loser: season.superBowl.loser,
                        score1: season.superBowl.score1,
                        score2: season.superBowl.score2,
                        timestamp: Date.now()
                    });
                }

                // Sort by week (descending) then by timestamp
                return events.sort((a, b) => {
                    if (typeof a.week === 'number' && typeof b.week === 'number') {
                        return b.week - a.week;
                    }
                    return b.timestamp - a.timestamp;
                });
            }, [season]);

            const filteredEvents = filter === 'all' ? allEvents : allEvents.filter(e => e.group === filter);

            if (!season) {
                return (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 text-center">
                        <p className="text-gray-500">No season data available.</p>
                    </div>
                );
            }

            const getEventIcon = (type) => {
                switch(type) {
                    case 'wildcard': return '⚡';
                    case 'playoff': return '🏆';
                    case 'champion': return '👑';
                    case 'superbowl': return '🎉';
                    default: return '🏓';
                }
            };

            const getEventColor = (group) => {
                if (group === 'A') return 'border-emerald-500 bg-emerald-900/20';
                if (group === 'B') return 'border-amber-500 bg-amber-900/20';
                return 'border-violet-500 bg-violet-900/20';
            };

            return (
                <div className="space-y-4">
                    {/* Filter */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span>📰</span> Match History
                        </h2>
                        <div className="flex gap-2">
                            {['all', 'A', 'B'].map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                        className={`px-3 py-1 rounded-lg text-sm ${filter === f ? 'bg-purple-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                    {f === 'all' ? 'All' : `Group ${f}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-green-600">{allEvents.filter(e => e.type === 'match').length}</div>
                            <div className="text-sm text-gray-500">Matches Played</div>
                        </div>
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-purple-600">{season.currentWeek || 1}</div>
                            <div className="text-sm text-gray-500">Current Week</div>
                        </div>
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-amber-600">{season.status}</div>
                            <div className="text-sm text-gray-500">Season Status</div>
                        </div>
                    </div>

                    {/* Events Feed */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 max-h-[600px] overflow-y-auto scrollbar-thin">
                        <div className="space-y-3">
                            {filteredEvents.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No matches completed yet.</p>
                            ) : (
                                filteredEvents.map((event, idx) => (
                                    <div key={idx} className={`border-l-4 ${getEventColor(event.group)} rounded-r-lg p-3 transition-all hover:translate-x-1`}>
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{getEventIcon(event.type)}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {event.type === 'superbowl' ? (
                                                        <span className="text-xs bg-gradient-to-r from-amber-600 to-rose-600 px-2 py-0.5 rounded font-bold">FINALE</span>
                                                    ) : event.type === 'champion' ? (
                                                        <span className="text-xs bg-amber-600 px-2 py-0.5 rounded font-bold">GROUP {event.group} CHAMPION</span>
                                                    ) : event.type === 'playoff' ? (
                                                        <span className="text-xs bg-cyan-600 px-2 py-0.5 rounded">Playoff {event.round}</span>
                                                    ) : event.type === 'wildcard' ? (
                                                        <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">Wildcard</span>
                                                    ) : (
                                                        <>
                                                            <span className={`text-xs px-2 py-0.5 rounded ${event.group === 'A' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                                                                Group {event.group}
                                                            </span>
                                                            <span className="text-xs text-gray-500">Week {event.week}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <PlayerAvatar name={event.winner} size="sm" />
                                                    <span className="font-bold text-green-600">{event.winner}</span>
                                                    <span className="text-gray-500">defeated</span>
                                                    <PlayerAvatar name={event.loser} size="sm" />
                                                    <span className="text-red-500">{event.loser}</span>
                                                    <span className="text-gray-500 ml-2">({event.score1}-{event.score2})</span>
                                                </div>
                                                {event.type === 'champion' && (
                                                    <p className="text-sm text-amber-600 mt-1">🎊 {event.winner} is the Group {event.group} Champion!</p>
                                                )}
                                                {event.type === 'superbowl' && (
                                                    <p className="text-sm text-amber-600 mt-1">🏆 {event.winner} wins the Mammotome Ping Pong Finale!</p>
                                                )}
                                                {event.type === 'wildcard' && (
                                                    <p className="text-sm text-purple-600 mt-1">Earns wildcard to Group {event.winnerGroup} playoffs</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // Main App
        function App() {
            // Get initial view from URL hash or localStorage
            const getInitialView = () => {
                const hash = window.location.hash.slice(1);
                const validViews = ['register', 'league', 'standings', 'schedule', 'mygames', 'profile', 'table', 'book', 'calendar', 'playoffs', 'history', 'archive', 'admin'];
                if (hash && validViews.includes(hash)) {
                    return hash;
                }
                const saved = localStorage.getItem('pingpong_currentView');
                if (saved && validViews.includes(saved)) {
                    return saved;
                }
                return 'league';
            };

            const [view, setViewState] = useState(getInitialView);

            // Custom setView that also updates URL hash and localStorage
            const setView = (newView) => {
                setViewState(newView);
                window.location.hash = newView;
                localStorage.setItem('pingpong_currentView', newView);
            };

            // Listen for hash changes (browser back/forward)
            useEffect(() => {
                const handleHashChange = () => {
                    const hash = window.location.hash.slice(1);
                    const validViews = ['register', 'league', 'standings', 'schedule', 'mygames', 'profile', 'table', 'book', 'calendar', 'playoffs', 'history', 'archive', 'admin'];
                    if (hash && validViews.includes(hash)) {
                        setViewState(hash);
                        localStorage.setItem('pingpong_currentView', hash);
                    }
                };
                window.addEventListener('hashchange', handleHashChange);
                return () => window.removeEventListener('hashchange', handleHashChange);
            }, []);

            const [season, setSeason] = useState(null);
            const [players, setPlayers] = useState([]);
            const [swapZone, setSwapZone] = useState(null);
            const [leagueMatches, setLeagueMatches] = useState([]);
            const [loading, setLoading] = useState(true);
            const [showLeagueScoreModal, setShowLeagueScoreModal] = useState(false);
            const [selectedLeagueMatch, setSelectedLeagueMatch] = useState(null);
            const [leagueScore, setLeagueScore] = useState('');
            const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('pingpong_isAdmin') === 'true');
            const [selectedWeek, setSelectedWeek] = useState(1);
            const [selectedGroup, setSelectedGroup] = useState('A');
            const [currentPlayer, setCurrentPlayer] = useState(() => localStorage.getItem('pingpong_currentPlayer') || '');

            const handleSelectPlayer = async (player) => {
                setCurrentPlayer(player);
                localStorage.setItem('pingpong_currentPlayer', player);

                // Auto-request notification permission when player selects their name
                if (player && 'Notification' in window && Notification.permission === 'default') {
                    try {
                        const result = await requestPushPermission(player);
                        if (result.permission === 'granted') {
                            showBrowserNotification('Welcome ' + player + '!', 'You will receive match updates and notifications.');
                        }
                    } catch (e) {
                        console.log('Notification permission request failed');
                    }
                } else if (player && 'Notification' in window && Notification.permission === 'granted') {
                    // Already have permission - just ensure we're subscribed with updated player name
                    try {
                        await subscribeToPush(player);
                    } catch (e) {
                        console.log('Push subscription update failed');
                    }
                }
            };

            // Lazy load data only when needed
            const loadData = useCallback(async () => {
                if (season && players.length > 0) return; // Already loaded

                try {
                    const [seasonRes, playersRes, swapZoneRes, leagueMatchesRes] = await Promise.all([
                        fetch(`${API_BASE}/season`),
                        fetch(`${API_BASE}/players`),
                        fetch(`${API_BASE}/season/swap-zone`),
                        fetch(`${API_BASE}/league/matches`)
                    ]);
                    const seasonData = await seasonRes.json();
                    const playersData = await playersRes.json();
                    const swapZoneData = await swapZoneRes.json();
                    const leagueMatchesData = await leagueMatchesRes.json();
                    setSeason(seasonData);
                    setPlayers(playersData || []);
                    setAvatarCache(playersData || []);
                    setSwapZone(swapZoneData);
                    setLeagueMatches(leagueMatchesData || []);
                    if (seasonData?.currentWeek) setSelectedWeek(seasonData.currentWeek);
                } catch (e) {
                    console.error('Error loading:', e);
                }
                setLoading(false);
            }, [season, players]);

            // Only load data for tabs that need it
            useEffect(() => {
                const needsData = ['league', 'standings', 'schedule', 'mygames', 'playoffs', 'admin'];
                if (needsData.includes(view)) {
                    loadData();
                } else {
                    setLoading(false); // No data needed for this tab
                }
            }, [view, loadData]);

            const handleLogin = async (password) => {
                try {
                    const res = await fetch(`${API_BASE}/admin/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });
                    if (res.ok) {
                        setIsAdmin(true);
                        localStorage.setItem('pingpong_isAdmin', 'true');
                        localStorage.setItem('adminPassword', password); // Save password for API calls
                    } else {
                        alert('Invalid password');
                    }
                } catch (e) {
                    alert('Login failed');
                }
            };

            const handleCreateSeason = async (groupA, groupB) => {
                try {
                    const res = await fetch(`${API_BASE}/season/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': localStorage.getItem('adminPassword') || '' },
                        body: JSON.stringify({
                            groupA,
                            groupB,
                            numWeeks: 10,
                            gamesPerPlayerA: gamesPerPlayerA ? parseInt(gamesPerPlayerA) : undefined,
                            gamesPerPlayerB: gamesPerPlayerB ? parseInt(gamesPerPlayerB) : undefined
                        })
                    });
                    if (res.ok) {
                        await loadData();
                        setView('standings');
                    }
                } catch (e) {
                    alert('Failed to create season');
                }
            };

            const handleRecordResult = async (matchId, winner, loser, score1, score2) => {
                try {
                    await fetch(`${API_BASE}/season/match`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ matchId, winner, loser, score1, score2 })
                    });
                    await loadData();
                } catch (e) {
                    alert('Failed to record result');
                }
            };

            const handleRecordLeagueScore = async (scoreFormat) => {
                if (!selectedLeagueMatch || !scoreFormat) {
                    alert('Please select a score');
                    return;
                }

                // Parse score to determine winner (format: "2-1", "2-0", etc.)
                const [gamesWon, gamesLost] = scoreFormat.split('-').map(Number);

                if (!gamesWon || !gamesLost || (gamesWon !== 2 && gamesLost !== 2)) {
                    alert('Invalid score format. Must be 2-0, 2-1, 1-2, or 0-2');
                    return;
                }

                // Determine winner based on who got 2 games
                const winner = gamesWon === 2 ? selectedLeagueMatch.player1 : selectedLeagueMatch.player2;

                try {
                    const res = await fetch(`${API_BASE}/league/match/result`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            matchId: selectedLeagueMatch.id,
                            winner: winner,
                            score: scoreFormat
                        })
                    });

                    if (res.ok) {
                        setShowLeagueScoreModal(false);
                        setSelectedLeagueMatch(null);
                        setLeagueScore('');
                        await loadData();
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to record result');
                    }
                } catch (e) {
                    alert('Failed to record result');
                }
            };

            const handleStartWildcard = async () => {
                try {
                    await fetch(`${API_BASE}/season/wildcard`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    await loadData();
                } catch (e) {
                    alert('Failed to start wildcard round');
                }
            };

            const handleStartPlayoffs = async () => {
                try {
                    await fetch(`${API_BASE}/season/playoffs`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    await loadData();
                } catch (e) {
                    alert('Failed to start playoffs');
                }
            };

            const handleMidSeasonReview = async () => {
                if (!confirm('Execute mid-season review? This will swap bottom 3 from Group A with top 3 from Group B.')) return;
                try {
                    const res = await fetch(`${API_BASE}/season/mid-review`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(`Mid-season review complete!\n\nMoved to Group B: ${data.swaps.fromAtoB.join(', ')}\nMoved to Group A: ${data.swaps.fromBtoA.join(', ')}\n\n${data.newMatchesCreated} new matches created.`);
                        await loadData();
                    } else {
                        alert(data.error || 'Failed to execute mid-season review');
                    }
                } catch (e) {
                    alert('Failed to execute mid-season review');
                }
            };

            const handleLogout = () => {
                setIsAdmin(false);
                localStorage.removeItem('pingpong_isAdmin');
                localStorage.removeItem('adminPassword'); // Clear password on logout
            };

            const handleArchiveSeason = async () => {
                if (!confirm('Archive current season and prepare for a new one?\n\nThis will:\n- Save the current season to history\n- Allow you to create a new season\n\nMake sure the season is complete first!')) return;
                try {
                    const res = await fetch(`${API_BASE}/season/archive`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(`Season archived as "${data.champion}'s Championship"!\n\nYou can now create a new season.`);
                        await loadData();
                    } else {
                        alert(data.error || 'Failed to archive season');
                    }
                } catch (e) {
                    alert('Failed to archive season');
                }
            };

            const handleClearSeason = async () => {
                if (!confirm('WARNING: This will delete the current season without archiving!\n\nAre you sure?')) return;
                if (!confirm('This action cannot be undone. Type "DELETE" in the next prompt to confirm.')) return;
                const confirmation = prompt('Type DELETE to confirm:');
                if (confirmation !== 'DELETE') return;

                try {
                    const res = await fetch(`${API_BASE}/season`, {
                        method: 'DELETE',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    if (res.ok) {
                        alert('Season deleted.');
                        await loadData();
                    }
                } catch (e) {
                    alert('Failed to delete season');
                }
            };

            const handleAddPlayer = async (name, seed) => {
                try {
                    const res = await fetch(`${API_BASE}/players`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': localStorage.getItem('adminPassword') || '' },
                        body: JSON.stringify([{ name, seed }])
                    });
                    if (res.ok) {
                        await loadData();
                        alert(`Player "${name}" added successfully!`);
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to add player');
                    }
                } catch (e) {
                    alert('Failed to add player');
                }
            };

            const handleCreateBracket = async (bracketPlayers) => {
                try {
                    // First update players list
                    await fetch(`${API_BASE}/players`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': localStorage.getItem('adminPassword') || '' },
                        body: JSON.stringify(bracketPlayers)
                    });
                    // Then generate bracket
                    const res = await fetch(`${API_BASE}/bracket/generate`, {
                        method: 'POST',
                        headers: { 'X-Admin-Password': localStorage.getItem('adminPassword') || '' }
                    });
                    if (res.ok) {
                        await loadData();
                        alert('Bracket created successfully!');
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to create bracket');
                    }
                } catch (e) {
                    alert('Failed to create bracket');
                }
            };

            if (loading) {
                return <div className="min-h-screen flex items-center justify-center"><div className="text-xl animate-pulse">Loading...</div></div>;
            }

            const weekMatches = season?.schedule?.[selectedGroup]?.[selectedWeek - 1] || [];

            return (
                <div className="min-h-screen bg-gray-50">
                    {/* Header - Mammotome White/Purple Theme */}
                    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                        <div className="max-w-6xl mx-auto px-4 py-3">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🏓</span>
                                    <div>
                                        <h1 className="font-bold text-purple-900">{season?.name || 'Mammotome Ping Pong League'}</h1>
                                        <p className="text-xs text-gray-500">
                                            {season ? `Week ${season.currentWeek} of ${season.totalWeeks} • ${season.status === 'playoffs' ? 'Playoffs' : season.status === 'complete' ? 'Complete' : 'Regular Season'}` : 'No active season'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <NotificationsBell currentPlayer={currentPlayer} />
                                    <button onClick={loadData} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600" title="Refresh"><Icons.Refresh /></button>
                                    {isAdmin && (
                                        <>
                                            <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded font-semibold">Admin</span>
                                            <button onClick={handleLogout} className="text-xs text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded">Logout</button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-1 overflow-x-auto items-center">
                                {/* Main Navigation - 5 tabs */}
                                {[
                                    { id: 'register', icon: Icons.Snowflake, label: 'Register' },
                                    { id: 'league', icon: Icons.ChartBar, label: 'League' },
                                    { id: 'mygames', icon: Icons.User, label: 'My Games' },
                                    { id: 'table', icon: Icons.Clock, label: 'Table' },
                                    { id: 'playoffs', icon: Icons.Trophy, label: 'Playoffs' },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setView(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${view === tab.id || (tab.id === 'league' && ['standings', 'schedule'].includes(view)) || (tab.id === 'mygames' && view === 'profile') || (tab.id === 'table' && ['book', 'calendar'].includes(view)) || (tab.id === 'playoffs' && ['brackets', 'history', 'archive'].includes(view)) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-700'}`}>
                                        <tab.icon />{tab.label}
                                    </button>
                                ))}

                                {/* Admin button - always visible for login access */}
                                <button onClick={() => setView('admin')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${view === 'admin' ? 'bg-purple-600 text-white' : isAdmin ? 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                                    <Icons.Cog />{isAdmin ? 'Admin' : 'Login'}
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Content */}
                    <main className="max-w-6xl mx-auto p-4">
                        {view === 'register' && <WinterLeagueRegistration isAdmin={isAdmin} onRefresh={loadData} />}

                        {/* Combined League View (Standings + Schedule) */}
                        {(view === 'league' || view === 'standings' || view === 'schedule') && season && (
                            <div className="space-y-4">
                                {/* Sub-tabs */}
                                <div className="flex gap-2 border-b border-gray-200 pb-2">
                                    <button onClick={() => setView('standings')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'standings' || view === 'league' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Standings
                                    </button>
                                    <button onClick={() => setView('schedule')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'schedule' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Schedule
                                    </button>
                                </div>

                                {/* Standings Content */}
                                {(view === 'league' || view === 'standings') && (
                            <div className="space-y-6">
                                {/* Swap Zone Banner - F1 style elimination/promotion zone */}
                                <SwapZoneBanner swapZone={swapZone} />

                                <div className="grid md:grid-cols-2 gap-4">
                                    <StandingsTable standings={season.standings.A} groupName="A" groupLabel={season.groups.A.name} />
                                    <StandingsTable standings={season.standings.B} groupName="B" groupLabel={season.groups.B.name} />
                                </div>

                                {/* League Info Section */}
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <span className="text-purple-600">📋</span> League Format & Rules
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6 text-sm">
                                        {/* Match Format */}
                                        <div>
                                            <h4 className="font-semibold text-green-600 mb-2">Match Format</h4>
                                            <ul className="space-y-1 text-gray-700">
                                                <li>• Best of 3 games per match</li>
                                                <li>• Valid scores: 2-0 or 2-1</li>
                                                <li>• Winner gets 1 match win</li>
                                                <li>• Individual games count for tiebreakers</li>
                                            </ul>
                                        </div>

                                        {/* Tiebreaker Rules */}
                                        <div>
                                            <h4 className="font-semibold text-amber-600 mb-2">Tiebreaker Rules (in order)</h4>
                                            <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                                                <li>Most match wins</li>
                                                <li>Point differential (games won - lost)</li>
                                                <li>Most total games won</li>
                                                <li>Fewest games lost</li>
                                            </ol>
                                        </div>

                                        {/* Championship Bracket */}
                                        <div>
                                            <h4 className="font-semibold text-cyan-400 mb-2">Championship Bracket (8 Players)</h4>
                                            <ul className="space-y-1 text-gray-700">
                                                <li>• Top 4 from each group compete together</li>
                                                <li>• <strong>Quarterfinals:</strong> Cross-group matchups</li>
                                                <li className="ml-4 text-xs">QF1: A#1 vs B#4 | QF2: B#2 vs A#3</li>
                                                <li className="ml-4 text-xs">QF3: A#2 vs B#3 | QF4: B#1 vs A#4</li>
                                                <li>• <strong>Semifinals:</strong> QF winners advance</li>
                                                <li className="ml-4 text-xs">SF1: QF1 vs QF2 | SF2: QF3 vs QF4</li>
                                                <li>• <strong>Final:</strong> SF winners for championship</li>
                                            </ul>
                                        </div>

                                        {/* Wildcard Round */}
                                        <div>
                                            <h4 className="font-semibold text-purple-600 mb-2">Wildcard Round</h4>
                                            <ul className="space-y-1 text-gray-700">
                                                <li>• Group A #5 vs Group B #5</li>
                                                <li>• Group A #6 vs Group B #6</li>
                                                <li>• Winners replace #4 seed from their group</li>
                                                <li>• Ensures best performers advance to championship</li>
                                            </ul>
                                        </div>

                                        {/* Mid-Season Review */}
                                        <div>
                                            <h4 className="font-semibold text-red-500 mb-2">Mid-Season Review (Week 5)</h4>
                                            <ul className="space-y-1 text-gray-700">
                                                <li>• Bottom 3 from Group A move to Group B</li>
                                                <li>• Top 3 from Group B move to Group A</li>
                                                <li>• Keeps groups competitive and balanced</li>
                                                <li>• New matches generated for swapped players</li>
                                            </ul>
                                        </div>

                                        {/* Odd Players / Bye Weeks */}
                                        <div>
                                            <h4 className="font-semibold text-gray-500 mb-2">Bye Weeks (Odd Players)</h4>
                                            <ul className="space-y-1 text-gray-700">
                                                <li>• If a group has odd # of players, one sits out each week</li>
                                                <li>• "Bye" rotates so each player gets rest</li>
                                                <li>• Bye does not count as win or loss</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Column Legend */}
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <h4 className="font-semibold text-gray-500 mb-2">Table Legend</h4>
                                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                            <span><strong>W</strong> = Match Wins</span>
                                            <span><strong>L</strong> = Match Losses</span>
                                            <span><strong>PF</strong> = Games Won (Points For)</span>
                                            <span><strong>PA</strong> = Games Lost (Points Against)</span>
                                            <span><strong>Diff</strong> = PF - PA</span>
                                            <span><strong>Streak</strong> = Current W/L streak</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Match Feed */}
                                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <span className="text-cyan-400">📰</span> Recent Match Results
                                    </h3>
                                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-2">
                                        {(() => {
                                            // Collect recent completed matches
                                            const recentMatches = [];
                                            ['A', 'B'].forEach(group => {
                                                season.schedule?.[group]?.forEach((week, weekIdx) => {
                                                    week.forEach(match => {
                                                        if (match.completed && match.winner) {
                                                            recentMatches.push({
                                                                ...match,
                                                                group,
                                                                week: weekIdx + 1,
                                                                sortKey: weekIdx * 1000 + Math.random()
                                                            });
                                                        }
                                                    });
                                                });
                                            });
                                            // Add wildcard
                                            if (season.wildcard?.matches) {
                                                season.wildcard.matches.forEach(m => {
                                                    if (m.completed) recentMatches.push({ ...m, type: 'wildcard', sortKey: 10000 });
                                                });
                                            }
                                            // Add playoffs
                                            if (season.playoffs) {
                                                ['A', 'B'].forEach(g => {
                                                    season.playoffs[g]?.semifinals?.forEach(sf => {
                                                        if (sf.completed) recentMatches.push({ ...sf, group: g, type: 'playoff', sortKey: 11000 });
                                                    });
                                                    if (season.playoffs[g]?.final?.completed) {
                                                        recentMatches.push({ ...season.playoffs[g].final, group: g, type: 'final', sortKey: 12000 });
                                                    }
                                                });
                                            }
                                            // Add super bowl
                                            if (season.superBowl?.completed) {
                                                recentMatches.push({ ...season.superBowl, type: 'superbowl', sortKey: 13000 });
                                            }

                                            const sorted = recentMatches.sort((a, b) => b.sortKey - a.sortKey).slice(0, 20);

                                            if (sorted.length === 0) {
                                                return <p className="text-gray-500 text-center py-4">No matches completed yet.</p>;
                                            }

                                            return sorted.map((m, i) => (
                                                <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${
                                                    m.type === 'superbowl' ? 'bg-gradient-to-r from-amber-900/30 to-rose-900/30 border border-amber-600' :
                                                    m.type === 'final' ? 'bg-amber-900/20 border-l-4 border-amber-500' :
                                                    m.type === 'playoff' ? 'bg-cyan-900/20 border-l-4 border-cyan-500' :
                                                    m.type === 'wildcard' ? 'bg-violet-900/20 border-l-4 border-violet-500' :
                                                    m.group === 'A' ? 'bg-emerald-900/10 border-l-4 border-emerald-600' :
                                                    'bg-amber-900/10 border-l-4 border-amber-600'
                                                }`}>
                                                    <span className="text-lg">
                                                        {m.type === 'superbowl' ? '🏆' : m.type === 'final' ? '👑' : m.type === 'playoff' ? '⚔️' : m.type === 'wildcard' ? '⚡' : '🏓'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                                m.type === 'superbowl' ? 'bg-amber-600' :
                                                                m.type === 'final' ? 'bg-amber-700' :
                                                                m.type === 'playoff' ? 'bg-cyan-600' :
                                                                m.type === 'wildcard' ? 'bg-purple-600' :
                                                                m.group === 'A' ? 'bg-emerald-700' : 'bg-amber-700'
                                                            }`}>
                                                                {m.type === 'superbowl' ? 'FINALE' : m.type === 'final' ? `G${m.group} Final` : m.type === 'playoff' ? `G${m.group} Playoff` : m.type === 'wildcard' ? 'Wildcard' : `G${m.group} W${m.week}`}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <span className="font-semibold text-green-600 truncate">{m.winner}</span>
                                                            <span className="text-gray-500 text-xs">beat</span>
                                                            <span className="text-red-500 truncate">{m.loser}</span>
                                                            <span className="text-gray-500 text-xs ml-1">({m.score1}-{m.score2})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                                )}

                                {/* Schedule Content */}
                                {view === 'schedule' && (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedGroup('A')} className={`px-4 py-2 rounded-lg ${selectedGroup === 'A' ? 'bg-emerald-600' : 'bg-gray-100'}`}>Group A</button>
                                    <button onClick={() => setSelectedGroup('B')} className={`px-4 py-2 rounded-lg ${selectedGroup === 'B' ? 'bg-amber-600' : 'bg-gray-100'}`}>Group B</button>
                                </div>

                                {/* Multi-Week Schedule Display */}
                                {(() => {
                                    const currentWeek = season.currentWeek || 1;
                                    const swapWeek = 3;
                                    // Show weeks 1-4 initially, then all remaining weeks after swap
                                    const weeksToShow = currentWeek <= swapWeek
                                        ? Array.from({ length: Math.min(4, season.totalWeeks) }, (_, i) => i + 1)
                                        : Array.from({ length: season.totalWeeks }, (_, i) => i + 1);

                                    return weeksToShow.map(weekNum => {
                                        const matches = season?.schedule?.[selectedGroup]?.[weekNum - 1] || [];
                                        const activeMatches = matches.filter(m => !m.cancelled);

                                        return (
                                            <div key={weekNum} className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-lg font-bold">Week {weekNum} - Group {selectedGroup}</h3>
                                                    {weekNum === currentWeek && (
                                                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                            Current Week
                                                        </span>
                                                    )}
                                                    {weekNum === swapWeek && currentWeek < swapWeek && (
                                                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                            Swap Week
                                                        </span>
                                                    )}
                                                </div>
                                                {activeMatches.length > 0 ? (
                                                    <WeeklyMatches matches={activeMatches} week={weekNum} onRecordResult={handleRecordResult} />
                                                ) : (
                                                    <p className="text-gray-400 text-sm text-center py-4">No matches scheduled for this week</p>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}

                                {/* Mid-Season Review Panel */}
                                {isAdmin && season?.status === 'regular' && season.currentWeek >= Math.floor(season.totalWeeks / 2) && !season.midSeasonReview?.completed && (
                                    <div className="bg-gradient-to-r from-rose-900/30 to-amber-900/30 border border-rose-500/30 rounded-xl p-4">
                                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                            <span className="text-red-500">🔄</span> Mid-Season Review Available
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-3">
                                            Week {season.currentWeek} reached! Time to balance the groups.
                                        </p>
                                        <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                                            <div className="bg-gray-100/50 rounded-lg p-3">
                                                <h4 className="text-red-500 font-semibold mb-2">⬇️ Moving to Group B</h4>
                                                <p className="text-gray-500 text-xs mb-1">Bottom 3 from Group A</p>
                                                <p className="text-gray-700">Will face easier competition</p>
                                            </div>
                                            <div className="bg-gray-100/50 rounded-lg p-3">
                                                <h4 className="text-green-600 font-semibold mb-2">⬆️ Moving to Group A</h4>
                                                <p className="text-gray-500 text-xs mb-1">Top 3 from Group B</p>
                                                <p className="text-gray-700">Earned their spot with stronger players</p>
                                            </div>
                                        </div>
                                        <button onClick={handleMidSeasonReview} className="w-full bg-rose-600 hover:bg-rose-500 py-2 rounded-lg font-semibold">
                                            Execute Mid-Season Review
                                        </button>
                                    </div>
                                )}

                                {/* Show mid-season review results if completed */}
                                {season?.midSeasonReview?.completed && (
                                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
                                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                            <span className="text-green-600">✓</span> Mid-Season Review Completed
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-3">Week {season.midSeasonReview.week}</p>
                                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <h4 className="text-red-500 font-semibold mb-1">Moved to Group B:</h4>
                                                <p className="text-gray-700">{season.midSeasonReview.swaps?.fromAtoB?.join(', ') || 'None'}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-green-600 font-semibold mb-1">Moved to Group A:</h4>
                                                <p className="text-gray-700">{season.midSeasonReview.swaps?.fromBtoA?.join(', ') || 'None'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                                )}
                            </div>
                        )}

                        {/* League - No season message */}
                        {(view === 'league' || view === 'standings' || view === 'schedule') && !season && (
                            <div>
                                {leagueMatches.length > 0 ? (
                                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 mb-6">
                                        <div className="mb-6">
                                            <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                                                <span>🏆</span>
                                                Single-Elimination Bracket Tournament
                                            </h2>
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                                <p className="text-sm text-purple-900 font-semibold mb-1">📋 Tournament Format:</p>
                                                <ul className="text-xs text-purple-800 space-y-1 ml-4">
                                                    <li>• Single-elimination bracket (lose once = eliminated)</li>
                                                    <li>• Win your match to advance to next round</li>
                                                    <li>• Play matches anytime before next round starts</li>
                                                    <li>• Final winner becomes tournament champion</li>
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Group matches by round */}
                                        {Array.from(new Set(leagueMatches.map(m => m.round))).sort((a, b) => a - b).map(roundNum => {
                                            const roundMatches = leagueMatches.filter(m => m.round === roundNum);
                                            const totalMatches = roundMatches.length;
                                            const completedMatches = roundMatches.filter(m => m.completed).length;

                                            // For Round 1, group by scheduled_week
                                            const hasWeeks = roundNum === 1 && roundMatches.some(m => m.scheduled_week);

                                            return (
                                                <div key={roundNum} className="mb-6">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h3 className="text-lg font-bold text-purple-600">
                                                            Round {roundNum}
                                                            {roundNum === 1 && totalMatches === 16 && ' (Round of 32)'}
                                                            {roundNum === 2 && totalMatches === 8 && ' (Round of 16)'}
                                                            {roundNum === 3 && totalMatches === 4 && ' (Quarterfinals)'}
                                                            {roundNum === 4 && totalMatches === 2 && ' (Semifinals)'}
                                                            {roundNum === 5 && totalMatches === 1 && ' (Final)'}
                                                        </h3>
                                                        <span className="text-sm text-gray-500">
                                                            {completedMatches}/{totalMatches} complete
                                                        </span>
                                                    </div>

                                                    {hasWeeks ? (
                                                        // Show Round 1 matches grouped by week
                                                        Array.from(new Set(roundMatches.map(m => m.scheduled_week))).sort().map(weekNum => {
                                                            const weekMatches = roundMatches.filter(m => m.scheduled_week === weekNum);
                                                            const weekCompleted = weekMatches.filter(m => m.completed).length;

                                                            return (
                                                                <div key={weekNum} className="mb-4">
                                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
                                                                        <span className="text-sm font-bold text-blue-900">
                                                                            Week {weekNum} Schedule
                                                                        </span>
                                                                        <span className="text-xs text-blue-700 ml-2">
                                                                            ({weekCompleted}/{weekMatches.length} complete)
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid md:grid-cols-2 gap-4">
                                                                        {weekMatches.map(match => (
                                                                            <div
                                                                                key={match.id}
                                                                                className={`border rounded-lg p-4 ${match.completed ? 'bg-gray-50 border-gray-300' : 'bg-white border-purple-200'}`}
                                                                            >
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <span className="text-xs font-semibold text-gray-500">
                                                                                        Match {match.match_number}
                                                                                    </span>
                                                                                    {match.completed && (
                                                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                                            Complete
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    {/* Player 1 */}
                                                                                    <div className={`flex items-center justify-between p-2 rounded ${
                                                                                        match.completed && match.winner === match.player1
                                                                                            ? 'bg-green-100 font-semibold'
                                                                                            : match.player1 === currentPlayer
                                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                                            : 'bg-gray-100'
                                                                                    }`}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {match.seed1 ? (
                                                                                                <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                                                                                    #{match.seed1}
                                                                                                </span>
                                                                                            ) : match.player1 && match.player1 !== 'BYE' && match.player1 !== 'TBD' ? (
                                                                                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                                                                                    Unseeded
                                                                                                </span>
                                                                                            ) : null}
                                                                                            <span className={match.player1 === 'BYE' ? 'text-gray-400 italic' : match.player1 === currentPlayer ? 'font-bold text-blue-700' : ''}>
                                                                                                {match.player1 === currentPlayer && '👤 '}
                                                                                                {match.player1 || 'TBD'}
                                                                                            </span>
                                                                                        </div>
                                                                                        {match.completed && match.winner === match.player1 && (
                                                                                            <span className="text-green-600">✓</span>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* VS */}
                                                                                    <div className="text-center text-xs text-gray-400 font-semibold">VS</div>

                                                                                    {/* Player 2 */}
                                                                                    <div className={`flex items-center justify-between p-2 rounded ${
                                                                                        match.completed && match.winner === match.player2
                                                                                            ? 'bg-green-100 font-semibold'
                                                                                            : match.player2 === currentPlayer
                                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                                            : 'bg-gray-100'
                                                                                    }`}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {match.seed2 ? (
                                                                                                <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                                                                                    #{match.seed2}
                                                                                                </span>
                                                                                            ) : match.player2 && match.player2 !== 'BYE' && match.player2 !== 'TBD' ? (
                                                                                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                                                                                    Unseeded
                                                                                                </span>
                                                                                            ) : null}
                                                                                            <span className={match.player2 === 'BYE' ? 'text-gray-400 italic' : match.player2 === currentPlayer ? 'font-bold text-blue-700' : ''}>
                                                                                                {match.player2 === currentPlayer && '👤 '}
                                                                                                {match.player2 || 'TBD'}
                                                                                            </span>
                                                                                        </div>
                                                                                        {match.completed && match.winner === match.player2 && (
                                                                                            <span className="text-green-600">✓</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {match.score && (
                                                                                    <div className="mt-2 text-xs text-gray-600 text-center">
                                                                                        Score: {match.score}
                                                                                    </div>
                                                                                )}

                                                                                {match.is_bye && (
                                                                                    <div className="mt-2 text-xs text-amber-600 text-center font-semibold">
                                                                                        BYE - Winner advances automatically
                                                                                    </div>
                                                                                )}

                                                                                {/* Record Score Button */}
                                                                                {!match.completed && !match.is_bye && match.player1 && match.player2 &&
                                                                                 match.player1 !== 'TBD' && match.player2 !== 'TBD' &&
                                                                                 (isAdmin || match.player1 === currentPlayer || match.player2 === currentPlayer) && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedLeagueMatch(match);
                                                                                            setShowLeagueScoreModal(true);
                                                                                        }}
                                                                                        className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-sm font-semibold"
                                                                                    >
                                                                                        Record Score
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        // Show matches without week grouping for other rounds
                                                        <div className="grid md:grid-cols-2 gap-4">
                                                            {roundMatches.map(match => (
                                                            <div
                                                                key={match.id}
                                                                className={`border rounded-lg p-4 ${match.completed ? 'bg-gray-50 border-gray-300' : 'bg-white border-purple-200'}`}
                                                            >
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-semibold text-gray-500">
                                                                        Match {match.match_number}
                                                                    </span>
                                                                    {match.completed && (
                                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                            Complete
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {/* Player 1 */}
                                                                    <div className={`flex items-center justify-between p-2 rounded ${
                                                                        match.completed && match.winner === match.player1
                                                                            ? 'bg-green-100 font-semibold'
                                                                            : match.player1 === currentPlayer
                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                            : 'bg-gray-100'
                                                                    }`}>
                                                                        <div className="flex items-center gap-2">
                                                                            {match.seed1 ? (
                                                                                <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                                                                    #{match.seed1}
                                                                                </span>
                                                                            ) : match.player1 && match.player1 !== 'BYE' && match.player1 !== 'TBD' ? (
                                                                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                                                                    Unseeded
                                                                                </span>
                                                                            ) : null}
                                                                            <span className={match.player1 === 'BYE' ? 'text-gray-400 italic' : match.player1 === currentPlayer ? 'font-bold text-blue-700' : ''}>
                                                                                {match.player1 === currentPlayer && '👤 '}
                                                                                {match.player1 || 'TBD'}
                                                                            </span>
                                                                        </div>
                                                                        {match.completed && match.winner === match.player1 && (
                                                                            <span className="text-green-600">✓</span>
                                                                        )}
                                                                    </div>

                                                                    {/* VS */}
                                                                    <div className="text-center text-xs text-gray-400 font-semibold">VS</div>

                                                                    {/* Player 2 */}
                                                                    <div className={`flex items-center justify-between p-2 rounded ${
                                                                        match.completed && match.winner === match.player2
                                                                            ? 'bg-green-100 font-semibold'
                                                                            : match.player2 === currentPlayer
                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                            : 'bg-gray-100'
                                                                    }`}>
                                                                        <div className="flex items-center gap-2">
                                                                            {match.seed2 ? (
                                                                                <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                                                                    #{match.seed2}
                                                                                </span>
                                                                            ) : match.player2 && match.player2 !== 'BYE' && match.player2 !== 'TBD' ? (
                                                                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                                                                    Unseeded
                                                                                </span>
                                                                            ) : null}
                                                                            <span className={match.player2 === 'BYE' ? 'text-gray-400 italic' : match.player2 === currentPlayer ? 'font-bold text-blue-700' : ''}>
                                                                                {match.player2 === currentPlayer && '👤 '}
                                                                                {match.player2 || 'TBD'}
                                                                            </span>
                                                                        </div>
                                                                        {match.completed && match.winner === match.player2 && (
                                                                            <span className="text-green-600">✓</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {match.score && (
                                                                    <div className="mt-2 text-xs text-gray-600 text-center">
                                                                        Score: {match.score}
                                                                    </div>
                                                                )}

                                                                {match.is_bye && (
                                                                    <div className="mt-2 text-xs text-amber-600 text-center font-semibold">
                                                                        BYE - Winner advances automatically
                                                                    </div>
                                                                )}

                                                                {/* Record Score Button */}
                                                                {!match.completed && !match.is_bye && match.player1 && match.player2 &&
                                                                 match.player1 !== 'TBD' && match.player2 !== 'TBD' &&
                                                                 (isAdmin || match.player1 === currentPlayer || match.player2 === currentPlayer) && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedLeagueMatch(match);
                                                                            setShowLeagueScoreModal(true);
                                                                        }}
                                                                        className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-sm font-semibold"
                                                                    >
                                                                        Record Score
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 text-center">
                                        <div className="text-6xl mb-4">🏆</div>
                                        <h2 className="text-2xl font-bold mb-3 text-gray-800">No Bracket Tournament Active</h2>
                                        <p className="text-gray-600 mb-6">Start a single-elimination bracket tournament to begin play</p>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                                            <p className="text-sm font-semibold text-blue-900 mb-2">To start a bracket tournament:</p>
                                            <ol className="text-xs text-blue-800 text-left space-y-1">
                                                <li>1. Go to <span className="font-bold">Register</span> tab</li>
                                                <li>2. Review all player registrations</li>
                                                <li>3. Click <span className="font-bold">"Generate Bracket from Registrations"</span></li>
                                                <li>4. Return here to see the bracket and play matches</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}

                                {/* League Score Recording Modal */}
                                {showLeagueScoreModal && selectedLeagueMatch && (
                                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                        <div className="bg-white rounded-xl p-6 max-w-lg w-full">
                                            <h3 className="text-xl font-bold mb-4">Record Match Result</h3>

                                            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                                                <div className="text-sm text-gray-600 mb-2">Round {selectedLeagueMatch.round} - Match {selectedLeagueMatch.match_number}</div>
                                                <div className="flex items-center justify-center gap-4">
                                                    <span className="text-lg font-bold text-blue-600">{selectedLeagueMatch.player1}</span>
                                                    <span className="text-gray-400 font-semibold">VS</span>
                                                    <span className="text-lg font-bold text-red-600">{selectedLeagueMatch.player2}</span>
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <label className="block text-sm font-medium mb-3 text-center">
                                                    Best of 3 Games - Select Final Score
                                                </label>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Player 1 wins 2-0 */}
                                                    <button
                                                        onClick={() => handleRecordLeagueScore('2-0')}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-lg font-semibold flex flex-col items-center gap-2 transition-all hover:scale-105"
                                                    >
                                                        <span className="text-sm opacity-80">{selectedLeagueMatch.player1}</span>
                                                        <span className="text-2xl">2-0</span>
                                                        <span className="text-xs opacity-80">Wins 2 games straight</span>
                                                    </button>

                                                    {/* Player 2 wins 0-2 */}
                                                    <button
                                                        onClick={() => handleRecordLeagueScore('0-2')}
                                                        className="bg-red-600 hover:bg-red-500 text-white p-4 rounded-lg font-semibold flex flex-col items-center gap-2 transition-all hover:scale-105"
                                                    >
                                                        <span className="text-sm opacity-80">{selectedLeagueMatch.player2}</span>
                                                        <span className="text-2xl">2-0</span>
                                                        <span className="text-xs opacity-80">Wins 2 games straight</span>
                                                    </button>

                                                    {/* Player 1 wins 2-1 */}
                                                    <button
                                                        onClick={() => handleRecordLeagueScore('2-1')}
                                                        className="bg-blue-500 hover:bg-blue-400 text-white p-4 rounded-lg font-semibold flex flex-col items-center gap-2 transition-all hover:scale-105"
                                                    >
                                                        <span className="text-sm opacity-80">{selectedLeagueMatch.player1}</span>
                                                        <span className="text-2xl">2-1</span>
                                                        <span className="text-xs opacity-80">Wins after losing 1 game</span>
                                                    </button>

                                                    {/* Player 2 wins 1-2 */}
                                                    <button
                                                        onClick={() => handleRecordLeagueScore('1-2')}
                                                        className="bg-red-500 hover:bg-red-400 text-white p-4 rounded-lg font-semibold flex flex-col items-center gap-2 transition-all hover:scale-105"
                                                    >
                                                        <span className="text-sm opacity-80">{selectedLeagueMatch.player2}</span>
                                                        <span className="text-2xl">2-1</span>
                                                        <span className="text-xs opacity-80">Wins after losing 1 game</span>
                                                    </button>
                                                </div>

                                                <div className="mt-4 text-xs text-gray-500 text-center">
                                                    Score format: [Player 1 games won] - [Player 2 games won]
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setShowLeagueScoreModal(false);
                                                    setSelectedLeagueMatch(null);
                                                    setLeagueScore('');
                                                }}
                                                className="w-full bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg font-semibold"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Combined Table View (Book + Calendar) */}
                        {(view === 'table' || view === 'book' || view === 'calendar') && (
                            <div className="space-y-4">
                                {/* Sub-tabs */}
                                <div className="flex gap-2 border-b border-gray-200 pb-2">
                                    <button onClick={() => setView('book')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'book' || view === 'table' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Book Table
                                    </button>
                                    <button onClick={() => setView('calendar')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'calendar' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Calendar
                                    </button>
                                </div>

                                {/* Book Table Content */}
                                {(view === 'table' || view === 'book') && (
                                    <PlayerSchedule players={players} season={season} currentPlayer={currentPlayer} onSelectPlayer={handleSelectPlayer} />
                                )}

                                {/* Calendar Content */}
                                {view === 'calendar' && (
                                    <TableCalendar />
                                )}
                            </div>
                        )}

                        {/* Combined My Games View (My Matches + Profile) */}
                        {(view === 'mygames' || view === 'profile') && (
                            <div className="space-y-4">
                                {/* Sub-tabs */}
                                <div className="flex gap-2 border-b border-gray-200 pb-2">
                                    <button onClick={() => setView('mygames')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'mygames' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        My Matches
                                    </button>
                                    <button onClick={() => setView('profile')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'profile' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Profile
                                    </button>
                                </div>

                                {/* My Matches Content */}
                                {view === 'mygames' && (
                                    <MyGames players={players} season={season} currentPlayer={currentPlayer} onSelectPlayer={handleSelectPlayer} />
                                )}

                                {/* Profile Content */}
                                {view === 'profile' && (
                                    <PlayerProfile playerName={currentPlayer} onSelectPlayer={(name) => { setView('profile'); }} />
                                )}
                            </div>
                        )}

                        {/* Combined Playoffs View (Brackets + History) */}
                        {(view === 'playoffs' || view === 'brackets' || view === 'history' || view === 'archive') && (
                            <div className="space-y-4">
                                {/* Sub-tabs */}
                                <div className="flex gap-2 border-b border-gray-200 pb-2">
                                    <button onClick={() => setView('playoffs')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'playoffs' || view === 'brackets' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Brackets
                                    </button>
                                    <button onClick={() => setView('history')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'history' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        History
                                    </button>
                                    <button onClick={() => setView('archive')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${view === 'archive' ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                        Past Seasons
                                    </button>
                                </div>

                                {/* Brackets Content */}
                                {(view === 'playoffs' || view === 'brackets') && (
                            <div className="space-y-4">
                                {/* Regular season - offer wildcard or direct playoffs */}
                                {season?.status === 'regular' && isAdmin && (
                                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                                        <p className="text-gray-500 mb-4">Regular season in progress. Start wildcard round or go directly to playoffs.</p>
                                        <div className="flex gap-4 justify-center flex-wrap">
                                            <button onClick={handleStartWildcard} className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-semibold">
                                                Start Wildcard Round
                                            </button>
                                            <button onClick={handleStartPlayoffs} className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-lg font-semibold">
                                                Skip to Playoffs
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3">Wildcard: Group A #5-6 vs Group B #5-6 - winners earn playoff spot in their own group</p>
                                    </div>
                                )}

                                {/* Wildcard round in progress */}
                                {season?.status === 'wildcard' && (
                                    <>
                                        <WildcardRound wildcard={season.wildcard} onRecordResult={handleRecordResult} />
                                        {isAdmin && season.wildcard?.matches?.every(m => m.completed) && (
                                            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 text-center">
                                                <p className="text-green-600 mb-4">Wildcard round complete! Start playoffs.</p>
                                                <button onClick={handleStartPlayoffs} className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-lg font-semibold">
                                                    Start Playoffs
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* New combined championship bracket (top 4 from each group) */}
                                {season?.championship && (
                                    <ChampionshipBracket championship={season.championship} onRecordResult={handleRecordResult} />
                                )}

                                {/* Legacy playoff brackets (separate group brackets + super bowl) */}
                                {season?.playoffs && !season?.championship && (
                                    <>
                                        <PlayoffBracket playoff={season.playoffs.A} groupName="A" onRecordResult={handleRecordResult} />
                                        <PlayoffBracket playoff={season.playoffs.B} groupName="B" onRecordResult={handleRecordResult} />
                                    </>
                                )}

                                {season?.superBowl && !season?.championship && <SuperBowl match={season.superBowl} onRecordResult={handleRecordResult} />}

                                {season?.champion && (
                                    <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-8 text-center">
                                        <div className="text-6xl mb-4">🏆</div>
                                        <div className="text-3xl font-bold">{season.champion}</div>
                                        <div className="text-violet-200 text-xl">Season Champion!</div>
                                    </div>
                                )}

                                {!season?.playoffs && !season?.wildcard && season?.status !== 'regular' && (
                                    <p className="text-center text-gray-500">No playoff data available.</p>
                                )}
                            </div>
                                )}

                                {/* History Content */}
                                {view === 'history' && (
                                    <HistoryFeed season={season} />
                                )}

                                {/* Past Seasons Content */}
                                {view === 'archive' && (
                                    <SeasonArchive />
                                )}
                            </div>
                        )}

                        {view === 'admin' && <AdminPanel players={players} season={season} onCreateSeason={handleCreateSeason} isAdmin={isAdmin} onLogin={handleLogin} onAddPlayer={handleAddPlayer} onCreateBracket={handleCreateBracket} onArchiveSeason={handleArchiveSeason} onClearSeason={handleClearSeason} />}
                    </main>
                </div>
            );
        }


export default App;
