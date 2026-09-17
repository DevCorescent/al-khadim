'use client';
import { getYouTubeEmbedUrl } from '@/lib/youtube';
import { Video } from 'lucide-react';

interface Props {
  url?: string | null;
  title?: string;
  className?: string;
}

export default function YouTubeEmbed({ url, title = 'Intro video', className = '' }: Props) {
  const embedUrl = getYouTubeEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className={`aspect-video w-full rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 ${className}`}>
        <Video size={20} />
        <span className="text-xs">No intro video</span>
      </div>
    );
  }

  return (
    <div className={`aspect-video w-full rounded-xl overflow-hidden bg-black ${className}`}>
      <iframe
        className="w-full h-full"
        src={embedUrl}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
